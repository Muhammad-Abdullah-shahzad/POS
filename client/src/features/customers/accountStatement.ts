/**
 * A customer's account statement: every sale and payment, with the balance
 * owed after each line, worked out from what the server or till returns.
 */

import { formatMoney } from '../../utils/money';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
export const ROUNDING_TOLERANCE = 0.005;

/** A line of a customer's account: the opening balance, a sale, a payment, or an unexplained adjustment. */
export interface StatementLine {
  key: string;
  at: string;
  type: 'Opening' | 'Sale' | 'Payment' | 'Return' | 'Adjustment';
  reference: string;
  details: string;
  remarks: string;
  saleTotal: number;
  paidAtTill: number;
  onAccount: number;
  received: number;
  balance: number;
  /** The sale behind a Sale line. */
  order?: any;
  /** The payment behind a Payment line. */
  payment?: any;
  /** The return behind a Return line. */
  productReturn?: any;
}

export const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

/** What a sale put on the customer's account. Older sales on credit only recorded the method. */
export const onAccountOf = (order: any): number => {
  const recorded = Number(order.creditAmount) || 0;
  if (recorded > 0) return recorded;
  const paidAtTill = (Number(order.paidCash) || 0) + (Number(order.paidCard) || 0);
  return order.paymentMethod === 'credit' && paidAtTill === 0 ? Number(order.total) || 0 : 0;
};

export interface StatementOptions {
  /** Show the opening balance line even at zero, so it can be set from the statement. */
  alwaysShowOpening?: boolean;
  /** Returns from this customer's sales; a refund to their account lowers what they owe. */
  returns?: any[];
}

/**
 * Every sale and payment on a customer's account, newest first, with the
 * balance owed after each line. Anything the lines cannot explain (such as a
 * balance changed by hand) is shown as one adjustment, so the newest balance
 * always matches the account.
 */
export function buildStatement(customer: any, orders: any[], payments: any[], options: StatementOptions = {}): StatementLine[] {
  const lines: Omit<StatementLine, 'balance'>[] = [];
  const blank = { saleTotal: 0, paidAtTill: 0, onAccount: 0, received: 0, remarks: '' };

  const opening = Number(customer.openingBalance) || 0;
  if (opening > 0 || options.alwaysShowOpening) {
    lines.push({ ...blank, key: 'opening', at: customer.createdAt, type: 'Opening', reference: '—', details: 'Opening balance', onAccount: opening });
  }

  for (const order of orders) {
    const total = Number(order.total) || 0;
    const onAccount = onAccountOf(order);
    const method = order.paymentMethod === 'credit' && onAccount < total ? 'part credit' : order.paymentMethod;
    lines.push({
      ...blank,
      key: `order-${order._id}`,
      at: order.createdAt,
      type: 'Sale',
      reference: order.invoiceId || '—',
      details: `${order.items?.length || 0} item(s) · ${method || '—'}`,
      remarks: order.remarks || '',
      saleTotal: total,
      paidAtTill: Math.max(0, total - onAccount),
      onAccount,
      order,
    });
  }

  for (const payment of payments) {
    lines.push({
      ...blank,
      key: `payment-${payment._id}`,
      at: payment.createdAt,
      type: 'Payment',
      reference: '—',
      details: `Payment received · ${payment.paymentMethod || 'cash'}`,
      remarks: payment.notes || '',
      received: Number(payment.amountPaid) || 0,
      payment,
    });
  }

  for (const ret of options.returns ?? []) {
    const toAccount = Number(ret.refundToAccount) || 0;
    const paidOut = (Number(ret.refundCash) || 0) + (Number(ret.refundCard) || 0);
    lines.push({
      ...blank,
      key: `return-${ret._id}`,
      at: ret.createdAt,
      type: 'Return',
      reference: ret.invoiceId || ret.returnNo,
      details: `${ret.returnNo} · ${ret.items?.length || 0} item(s) returned${paidOut > 0 ? ` · ${formatMoney(paidOut)} paid out` : ''}`,
      remarks: ret.reason || '',
      // What came off their account shows as a negative amount added to it.
      onAccount: -toAccount,
      productReturn: ret,
    });
  }

  // Oldest first, so the running balance adds up in order.
  lines.sort((a, b) => {
    if (a.type === 'Opening') return -1;
    if (b.type === 'Opening') return 1;
    return new Date(a.at).getTime() - new Date(b.at).getTime();
  });

  let balance = 0;
  const statement: StatementLine[] = lines.map((line) => {
    balance += line.onAccount - line.received;
    return { ...line, balance };
  });

  const actual = Number(customer.outstandingBalance) || 0;
  const difference = actual - balance;
  if (Math.abs(difference) > ROUNDING_TOLERANCE) {
    statement.push({
      ...blank,
      key: 'adjustment',
      at: customer.updatedAt || new Date().toISOString(),
      type: 'Adjustment',
      reference: '—',
      details: 'Balance adjustment',
      remarks: 'Change to the balance not linked to a sale or payment (e.g. edited by hand or from an older version)',
      onAccount: difference > 0 ? difference : 0,
      received: difference < 0 ? -difference : 0,
      balance: actual,
    });
  }

  // Most recent first on screen.
  return statement.reverse();
}
