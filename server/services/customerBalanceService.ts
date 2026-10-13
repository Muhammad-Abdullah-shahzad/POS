/**
 * A customer's balance: what they owe, kept on the customer as
 * `outstandingBalance` and always equal to their account:
 *
 *   opening balance + sales put on account − payments − returns refunded to the account
 *
 * The server is the only place this figure is worked out. Desktop tills send
 * the sales, payments and returns they record; the server moves the balance
 * by what each one changed, exactly once (see syncService). A till's own copy
 * of the balance is never written back: it can be stale, and writing it would
 * undo payments taken meanwhile on the web or another till.
 */
import { Types } from 'mongoose';
import Customer from '../models/Customer';
import CustomerPayment from '../models/CustomerPayment';
import Order from '../models/Order';
import ProductReturn from '../models/ProductReturn';

type Doc = Record<string, any>;

/** What a record does to one customer's balance. */
export interface AccountEffect {
  customerId: string;
  amount: number;
}

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const asId = (value: unknown) => (typeof value === 'string' && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value);

/** What a sale put on the customer's account. Older sales on credit only recorded the method. */
export function onAccountOf(order: Doc): number {
  const recorded = Number(order.creditAmount) || 0;
  if (recorded > 0) return recorded;
  const paidAtTill = (Number(order.paidCash) || 0) + (Number(order.paidCard) || 0);
  return order.paymentMethod === 'credit' && paidAtTill === 0 ? Number(order.total) || 0 : 0;
}

/** Each synced record type's effect on a balance; null when it has none. */
export const ACCOUNT_EFFECTS = {
  orders: (order: Doc): AccountEffect | null =>
    order.customerId && order.status !== 'voided' ? { customerId: String(order.customerId), amount: onAccountOf(order) } : null,
  'customer-payments': (payment: Doc): AccountEffect | null =>
    payment.customerId ? { customerId: String(payment.customerId), amount: -(Number(payment.amountPaid) || 0) } : null,
  'product-returns': (ret: Doc): AccountEffect | null =>
    ret.customerId ? { customerId: String(ret.customerId), amount: -(Number(ret.refundToAccount) || 0) } : null,
  customers: (customer: Doc): AccountEffect | null => ({ customerId: String(customer._id), amount: Number(customer.openingBalance) || 0 }),
} satisfies Record<string, (doc: Doc) => AccountEffect | null>;

export type AccountEffectFn = (doc: Doc) => AccountEffect | null;

/**
 * Move balances by what changed between a record's previous and new version:
 * a new record adds its effect, an edit adds the difference, a deletion
 * (`after` null) takes its effect back. Sending the same record twice changes
 * nothing.
 */
export async function moveBalancesFor(effectOf: AccountEffectFn, before: Doc | null, after: Doc | null): Promise<void> {
  const moves = new Map<string, number>();
  const add = (effect: AccountEffect | null, sign: 1 | -1) => {
    if (effect && effect.amount) moves.set(effect.customerId, (moves.get(effect.customerId) ?? 0) + sign * effect.amount);
  };
  add(before ? effectOf(before) : null, -1);
  add(after ? effectOf(after) : null, 1);

  for (const [customerId, delta] of moves) {
    if (Math.abs(delta) <= ROUNDING_TOLERANCE) continue;
    await Customer.updateOne({ _id: asId(customerId) }, { $inc: { outstandingBalance: round2(delta) } });
  }
}

/** Every customer's balance as their account adds it up, by customer id. */
export async function balancesFromAccounts(customerIds?: string[]): Promise<Map<string, number>> {
  const ids = customerIds?.map(asId);
  const scope = ids ? { customerId: { $in: ids } } : { customerId: { $ne: null } };
  const [customers, orders, payments, returns] = await Promise.all([
    Customer.find(ids ? { _id: { $in: ids } } : {}, { openingBalance: 1 }).lean(),
    Order.find({ ...scope, status: { $ne: 'voided' } }, { customerId: 1, creditAmount: 1, paymentMethod: 1, paidCash: 1, paidCard: 1, total: 1 }).lean(),
    CustomerPayment.find(scope, { customerId: 1, amountPaid: 1 }).lean(),
    // Returns keep the customer id as text.
    ProductReturn.find(customerIds ? { customerId: { $in: customerIds } } : { customerId: { $nin: [null, ''] } }, { customerId: 1, refundToAccount: 1 }).lean(),
  ]);

  const balances = new Map<string, number>(customers.map((customer) => [String(customer._id), Number(customer.openingBalance) || 0]));
  const add = (customerId: unknown, amount: number) => {
    const key = String(customerId);
    if (balances.has(key)) balances.set(key, (balances.get(key) ?? 0) + amount);
  };
  for (const order of orders) add(order.customerId, onAccountOf(order));
  for (const payment of payments) add(payment.customerId, -(Number(payment.amountPaid) || 0));
  for (const ret of returns) add(ret.customerId, -(Number(ret.refundToAccount) || 0));

  for (const [key, value] of balances) balances.set(key, round2(value));
  return balances;
}

/** Set a customer's balance to what their account adds up to. */
export async function setBalanceFromAccount(customerId: string): Promise<number> {
  const balance = (await balancesFromAccounts([customerId])).get(customerId) ?? 0;
  await Customer.updateOne({ _id: asId(customerId) }, { $set: { outstandingBalance: balance } });
  return balance;
}
