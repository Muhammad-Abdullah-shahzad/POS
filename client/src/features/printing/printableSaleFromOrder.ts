/**
 * Rebuilds a printed sale from a saved order, so a reprint matches the
 * invoice handed over at the till.
 *
 * Sales made before the till started recording cash, card and credit fall
 * back to working it out from the payment method, so old receipts still print.
 */
import type { PrintableLine, PrintableSale } from './printableSale';

export interface StoredOrderItem {
  name?: string;
  quantity?: number;
  /** Charged per unit, after any discount. */
  price?: number;
  /** Line total before discount. */
  totalPrice?: number;
  /** Line total charged, deposits included. */
  finalPrice?: number;
  discountPct?: number;
  /** Discount for the whole line. */
  discountAmt?: number;
  /** Deposit per unit. */
  drs?: number;
}

export interface StoredOrder {
  _id?: string;
  invoiceId?: string;
  createdAt?: string;
  items?: StoredOrderItem[];
  subtotal?: number;
  discount?: number;
  totalDRS?: number;
  total?: number;
  paymentMethod?: string;
  splitCash?: number | null;
  splitCard?: number | null;
  paidCash?: number | null;
  paidCard?: number | null;
  creditAmount?: number | null;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  remarks?: string | null;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const amount = (value: unknown): number => round2(Number(value) || 0);

function toLine(item: StoredOrderItem, index: number): PrintableLine {
  const quantity = Number(item.quantity) || 0;
  const drsAmount = amount((Number(item.drs) || 0) * quantity);
  const charged = Number(item.price) || 0;
  const beforeDiscount = Number(item.totalPrice);

  return {
    id: `${index}`,
    name: item.name ?? 'Item',
    quantity,
    unitPrice: amount(quantity > 0 && Number.isFinite(beforeDiscount) ? beforeDiscount / quantity : charged),
    lineTotal: amount(Number.isFinite(Number(item.finalPrice)) ? Number(item.finalPrice) : quantity * charged + drsAmount),
    discountPct: Number(item.discountPct) || 0,
    discountAmount: amount(item.discountAmt),
    drsAmount,
  };
}

/**
 * How the sale was settled. Recorded parts always add up to the total; older
 * orders have none, or zeros where a till added the columns later, so they are
 * read from the payment method instead.
 */
function settlementOf(order: StoredOrder): { cash: number; card: number; credit: number } {
  const total = amount(order.total);
  const recorded = { cash: amount(order.paidCash), card: amount(order.paidCard), credit: amount(order.creditAmount) };
  if (recorded.cash + recorded.card + recorded.credit > 0) return recorded;

  const method = String(order.paymentMethod ?? '').toLowerCase();
  if (method.startsWith('split')) return { cash: amount(order.splitCash), card: amount(order.splitCard), credit: 0 };
  if (method === 'credit') return { cash: 0, card: 0, credit: total };
  if (method === 'card') return { cash: 0, card: total, credit: 0 };
  return { cash: total, card: 0, credit: 0 };
}

/** Details the sale record does not hold: change given, and points earned. */
export interface PrintExtras {
  change?: number;
  loyalty?: PrintableSale['loyalty'];
}

export function printableSaleFromOrder(order: StoredOrder, extras: PrintExtras = {}): PrintableSale {
  const at = order.createdAt ? new Date(order.createdAt) : new Date();
  const lines = (order.items ?? []).map(toLine);
  const settled = settlementOf(order);
  const hasBalances = order.balanceBefore != null && order.balanceAfter != null;

  return {
    invoiceNo: order.invoiceId ?? '',
    date: at.toLocaleDateString(),
    time: at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    customer: {
      name: order.customerName?.trim() || 'Walk-in',
      phone: order.customerPhone?.trim() || '',
      address: order.customerAddress?.trim() || '',
    },
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subTotal: amount(order.subtotal),
    discount: amount(order.discount),
    totalDRS: amount(order.totalDRS),
    grandTotal: amount(order.total),
    payments: { cash: settled.cash, card: settled.card, credit: settled.credit, change: amount(extras.change) },
    balances: hasBalances ? { previous: amount(order.balanceBefore), current: amount(order.balanceAfter) } : null,
    paymentLabel: (order.paymentMethod ?? '').toUpperCase(),
    remarks: order.remarks?.trim() ?? '',
    loyalty: extras.loyalty,
  };
}
