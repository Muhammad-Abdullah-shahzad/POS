/**
 * Corrections to a customer's account, made from the account statement.
 * Mirrors server/services/customerLedgerService.ts for the till's own data.
 *
 * A customer's outstanding balance is the opening balance, plus what sales put
 * on account, minus payments. Each correction changes one of those figures and
 * moves the outstanding balance by exactly the difference, in one transaction,
 * so the statement, the balance, the receipts and the KPIs always agree.
 * Every row it touches is marked for the next sync.
 */
import { handleLicensed } from '../license/licenseGuard';
import { dbGet, dbTransaction, now } from '../db/database';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

const round2 = (value: number): number => Math.round(value * 100) / 100;

interface Settlement {
  paidCash: number;
  paidCard: number;
  creditAmount: number;
}

type OrderRow = Record<string, any>;

/** How a sale stands now. Older sales only recorded the payment method. */
export function currentSettlement(order: OrderRow): Settlement {
  const total = round2(Number(order.total) || 0);
  const recorded = {
    paidCash: round2(Number(order.paidCash) || 0),
    paidCard: round2(Number(order.paidCard) || 0),
    creditAmount: round2(Number(order.creditAmount) || 0),
  };
  if (Math.abs(recorded.paidCash + recorded.paidCard + recorded.creditAmount - total) <= ROUNDING_TOLERANCE) return recorded;

  const method = String(order.paymentMethod ?? '').toLowerCase();
  if (method === 'card') return { paidCash: 0, paidCard: total, creditAmount: 0 };
  if (method === 'credit') return { paidCash: 0, paidCard: 0, creditAmount: total };
  if (method.startsWith('split')) {
    const paidCash = round2(Number(order.splitCash) || 0);
    const paidCard = round2(Number(order.splitCard) || 0);
    return { paidCash, paidCard, creditAmount: round2(Math.max(0, total - paidCash - paidCard)) };
  }
  return { paidCash: total, paidCard: 0, creditAmount: 0 };
}

/**
 * The sale settled again with a different amount on account. What is paid at
 * the till changes by the difference: cash first, so a card payment already
 * taken stays as it was unless there is no cash left to adjust.
 */
function resettle(order: OrderRow, creditAmount: number): Settlement & { paymentMethod: string } {
  const total = round2(Number(order.total) || 0);
  const now = currentSettlement(order);
  const atTill = round2(total - creditAmount);
  const paidCard = round2(Math.min(now.paidCard, atTill));
  const paidCash = round2(atTill - paidCard);

  const paymentMethod = creditAmount > ROUNDING_TOLERANCE ? 'credit' : paidCard <= ROUNDING_TOLERANCE ? 'cash' : paidCash <= ROUNDING_TOLERANCE ? 'card' : 'split';
  return { paidCash, paidCard, creditAmount: round2(creditAmount), paymentMethod };
}

function getCustomer(customerId: string): Record<string, any> {
  const customer = dbGet('SELECT * FROM customers WHERE _id = $id AND deletedAt IS NULL', { $id: customerId }) as any;
  if (!customer) throw new Error('Customer not found');
  return customer;
}

/** Refuse a change that would take the customer's balance below zero. */
function assertBalanceAllows(customer: Record<string, any>, delta: number): void {
  const owed = Number(customer.outstandingBalance) || 0;
  if (owed + delta < -ROUNDING_TOLERANCE) {
    throw new Error(`That change would leave ${customer.name} with a negative balance (they owe ${round2(owed).toFixed(2)})`);
  }
}

const moveBalanceSql = `UPDATE customers SET outstandingBalance = outstandingBalance + $delta, updatedAt = $ts, isSync = 0 WHERE _id = $id`;

/** Correct a payment's amount, method or notes. */
export function updatePayment(customerId: string, paymentId: string, changes: Record<string, unknown>) {
  const customer = getCustomer(customerId);
  const payment = dbGet(
    `SELECT * FROM customer_payments WHERE _id = $id AND customerId = $customerId AND (deletedAt IS NULL OR deletedAt = '')`,
    { $id: paymentId, $customerId: customerId }
  ) as any;
  if (!payment) throw new Error('Payment not found');

  const amountPaid = changes.amountPaid === undefined ? Number(payment.amountPaid) : round2(Number(changes.amountPaid));
  if (!(amountPaid > 0)) throw new Error('Amount must be more than zero');
  const paymentMethod = changes.paymentMethod === undefined ? payment.paymentMethod : String(changes.paymentMethod);
  if (paymentMethod !== 'cash' && paymentMethod !== 'card') throw new Error('Payment method must be cash or card');
  const notes = changes.notes === undefined ? payment.notes : String(changes.notes).trim();

  // A larger payment lowers what the customer owes, a smaller one raises it.
  const delta = round2(Number(payment.amountPaid) - amountPaid);
  assertBalanceAllows(customer, delta);

  const ts = now();
  dbTransaction((d) => {
    d.run(moveBalanceSql, { $delta: delta, $ts: ts, $id: customerId });
    d.run(
      `UPDATE customer_payments SET amountPaid = $amount, paymentMethod = $method, notes = $notes, updatedAt = $ts, isSync = 0 WHERE _id = $id`,
      { $amount: amountPaid, $method: paymentMethod, $notes: notes ?? '', $ts: ts, $id: paymentId }
    );
  });

  return {
    customer: getCustomer(customerId),
    payment: dbGet('SELECT * FROM customer_payments WHERE _id = $id', { $id: paymentId }),
  };
}

/** Correct how much of a sale went on account, or its remarks. */
export function updateSale(customerId: string, orderId: string, changes: Record<string, unknown>) {
  const customer = getCustomer(customerId);
  const order = dbGet(
    `SELECT * FROM orders WHERE _id = $id AND customerId = $customerId AND status != 'voided' AND (deletedAt IS NULL OR deletedAt = '')`,
    { $id: orderId, $customerId: customerId }
  ) as OrderRow | undefined;
  if (!order) throw new Error('Sale not found');

  const before = currentSettlement(order);
  const total = round2(Number(order.total) || 0);
  const creditAmount = changes.creditAmount === undefined ? before.creditAmount : round2(Number(changes.creditAmount));
  if (!(creditAmount >= 0)) throw new Error('Amount cannot be negative');
  if (creditAmount > total + ROUNDING_TOLERANCE) throw new Error(`At most the sale total (${total.toFixed(2)}) can go on account`);

  const delta = round2(creditAmount - before.creditAmount);
  assertBalanceAllows(customer, delta);

  const settled = delta === 0 ? { ...before, paymentMethod: order.paymentMethod } : resettle(order, creditAmount);
  // The receipt shows the account after this sale; later receipts keep the balance they printed.
  const balanceAfter =
    order.balanceBefore === null || order.balanceBefore === undefined ? order.balanceAfter : round2(Number(order.balanceBefore) + settled.creditAmount);
  const remarks = changes.remarks === undefined ? order.remarks : String(changes.remarks).trim() || null;

  const ts = now();
  dbTransaction((d) => {
    d.run(moveBalanceSql, { $delta: delta, $ts: ts, $id: customerId });
    d.run(
      `UPDATE orders SET paidCash = $cash, paidCard = $card, creditAmount = $credit, paymentMethod = $method,
         splitCash = $splitCash, splitCard = $splitCard, balanceAfter = $balanceAfter, remarks = $remarks,
         updatedAt = $ts, isSync = 0
       WHERE _id = $id`,
      {
        $cash: settled.paidCash,
        $card: settled.paidCard,
        $credit: settled.creditAmount,
        $method: settled.paymentMethod,
        $splitCash: settled.paymentMethod === 'split' ? settled.paidCash : order.splitCash ?? null,
        $splitCard: settled.paymentMethod === 'split' ? settled.paidCard : order.splitCard ?? null,
        $balanceAfter: balanceAfter ?? null,
        $remarks: remarks ?? null,
        $ts: ts,
        $id: orderId,
      }
    );
  });

  const updated = dbGet('SELECT * FROM orders WHERE _id = $id', { $id: orderId }) as OrderRow;
  return { customer: getCustomer(customerId), order: { ...updated, items: JSON.parse(updated.items || '[]') } };
}

/** Delete a recorded payment: the customer owes that amount again. Synced as a deletion. */
export function deletePayment(customerId: string, paymentId: string) {
  getCustomer(customerId);
  const payment = dbGet(
    `SELECT * FROM customer_payments WHERE _id = $id AND customerId = $customerId AND (deletedAt IS NULL OR deletedAt = '')`,
    { $id: paymentId, $customerId: customerId }
  ) as any;
  if (!payment) throw new Error('Payment not found');

  const ts = now();
  dbTransaction((d) => {
    d.run(moveBalanceSql, { $delta: round2(Number(payment.amountPaid) || 0), $ts: ts, $id: customerId });
    d.run(`UPDATE customer_payments SET deletedAt = $ts, updatedAt = $ts, isSync = 0 WHERE _id = $id`, { $ts: ts, $id: paymentId });
    d.run(
      `INSERT INTO pending_deletes (tableName, localId, deletedAt, isSync) VALUES ('customer_payments', $id, $ts, 0)`,
      { $id: paymentId, $ts: ts }
    );
  });
  return { customer: getCustomer(customerId) };
}

/** Change a customer's opening balance; what they owe moves by the same amount. */
export function setOpeningBalance(customerId: string, openingBalance: unknown) {
  const customer = getCustomer(customerId);
  const value = round2(Number(openingBalance));
  if (!(value >= 0)) throw new Error('Amount cannot be negative');

  const delta = round2(value - (Number(customer.openingBalance) || 0));
  assertBalanceAllows(customer, delta);

  const ts = now();
  dbTransaction((d) => {
    d.run(moveBalanceSql, { $delta: delta, $ts: ts, $id: customerId });
    d.run(`UPDATE customers SET openingBalance = $value WHERE _id = $id`, { $value: value, $id: customerId });
  });
  return { customer: getCustomer(customerId) };
}

export function registerCustomerLedgerHandlers(): void {
  handleLicensed('customers:updatePayment', (_e, customerId: string, paymentId: string, changes: Record<string, unknown>) =>
    updatePayment(customerId, paymentId, changes)
  );
  handleLicensed('customers:updateSale', (_e, customerId: string, orderId: string, changes: Record<string, unknown>) =>
    updateSale(customerId, orderId, changes)
  );
  handleLicensed('customers:deletePayment', (_e, customerId: string, paymentId: string) => deletePayment(customerId, paymentId));
  handleLicensed('customers:setOpeningBalance', (_e, customerId: string, changes: Record<string, unknown>) =>
    setOpeningBalance(customerId, changes.openingBalance)
  );
}
