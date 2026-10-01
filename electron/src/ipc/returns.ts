/**
 * Product returns on the till. Mirrors server/services/returnService.ts.
 *
 * Invoice returns refund each item at what was actually paid for it on the
 * original sale (its line total over its quantity), and never more of a line
 * than was sold less what came back before. Open returns take the cashier's
 * price and discount. Every returned item goes back into stock; a refund to
 * the customer's account takes the amount off what they owe, and anything
 * beyond that is paid in cash. One transaction, marked for the next sync.
 */
import { handleLicensed } from '../license/licenseGuard';
import { dbAll, dbGet, dbTransaction, generateLocalId, now } from '../db/database';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

const round2 = (value: number): number => Math.round(value * 100) / 100;

interface ReturnItem {
  product: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  total: number;
  orderLine?: number;
}

interface ReturnableLine {
  orderLine: number;
  product: string | null;
  name: string;
  sold: number;
  returned: number;
  unitPrice: number;
  lineTotal: number;
  refunded: number;
}

const parseItems = (row: any) => ({ ...row, items: JSON.parse(row?.items || '[]') });

const liveReturnsFor = (orderId: string) =>
  dbAll(`SELECT items FROM product_returns WHERE orderId = $id AND (deletedAt IS NULL OR deletedAt = '')`, { $id: orderId }).map(parseItems);

/** Each line of a sale with what was paid and how much of it has already come back. */
function returnableLines(order: any, earlier: { items: ReturnItem[] }[]): ReturnableLine[] {
  const items: any[] = JSON.parse(order.items || '[]');
  return items.map((item, orderLine) => {
    const sold = Number(item.quantity) || 0;
    const lineTotal = round2(
      Number.isFinite(Number(item.finalPrice)) ? Number(item.finalPrice) : sold * ((Number(item.price) || 0) + (Number(item.drs) || 0))
    );
    const previous = earlier.flatMap((ret) => ret.items.filter((line) => line.orderLine === orderLine));
    const productId = item.product || item.productId;
    return {
      orderLine,
      product: productId ? String(productId) : null,
      name: item.name,
      sold,
      returned: previous.reduce((sum, line) => sum + Number(line.quantity), 0),
      unitPrice: sold > 0 ? round2(lineTotal / sold) : 0,
      lineTotal,
      refunded: round2(previous.reduce((sum, line) => sum + Number(line.total), 0)),
    };
  });
}

function getSale(orderId: string): any {
  const order = dbGet(`SELECT * FROM orders WHERE _id = $id AND (deletedAt IS NULL OR deletedAt = '')`, { $id: orderId });
  if (!order) throw new Error('Sale not found');
  return order;
}

/** A sale with what can still be returned from each of its lines. */
export function getReturnableSale(orderId: string) {
  const order = getSale(orderId);
  return { order: parseItems(order), lines: returnableLines(order, liveReturnsFor(orderId)) };
}

function invoiceItems(lines: ReturnableLine[], requested: { orderLine: number; quantity: number }[]): ReturnItem[] {
  const seen = new Set<number>();
  return requested.map((request) => {
    const orderLine = Number(request.orderLine);
    const quantity = Number(request.quantity);
    const line = lines[orderLine];
    if (!line) throw new Error('That item is not on this sale');
    if (seen.has(orderLine)) throw new Error(`${line.name} is listed twice`);
    seen.add(orderLine);
    if (!(quantity > 0)) throw new Error('Quantity must be more than zero');

    const left = line.sold - line.returned;
    if (quantity > left + 1e-9) {
      throw new Error(`Only ${left} of ${line.name} can still be returned (${line.sold} sold, ${line.returned} already returned)`);
    }
    // Returning the last of a line refunds exactly what is left of its total, so pennies never drift.
    const total = Math.abs(quantity - left) < 1e-9 ? round2(line.lineTotal - line.refunded) : round2(line.unitPrice * quantity);
    return { product: line.product, name: line.name, quantity, unitPrice: line.unitPrice, total, orderLine };
  });
}

function openItems(requested: any[]): ReturnItem[] {
  return requested.map((item) => {
    const product = dbGet(`SELECT name FROM products WHERE _id = $id AND (deletedAt IS NULL OR deletedAt = '')`, { $id: String(item.product) }) as any;
    if (!product) throw new Error('Product not found');
    const quantity = Number(item.quantity);
    const price = Number(item.unitPrice);
    const discountPct = Number(item.discountPct ?? 0);
    if (!(quantity > 0)) throw new Error('Quantity must be more than zero');
    if (!(price >= 0)) throw new Error('Price cannot be negative');
    if (!(discountPct >= 0 && discountPct <= 100)) throw new Error('Discount must be between 0 and 100');
    const unitPrice = round2(price * (1 - discountPct / 100));
    return { product: String(item.product), name: product.name, quantity, unitPrice, discountPct, total: round2(unitPrice * quantity) };
  });
}

export function createReturn(data: Record<string, any>) {
  const type = data.type === 'open' ? 'open' : data.type === 'invoice' ? 'invoice' : null;
  if (!type) throw new Error('Choose an invoice return or an open return');
  const refundMethod = String(data.refundMethod ?? '');
  if (!['cash', 'card', 'account'].includes(refundMethod)) throw new Error('Choose how the refund is paid');
  if (type === 'open' && refundMethod === 'account') throw new Error('An open return is refunded in cash or by card');
  if (!Array.isArray(data.items) || data.items.length === 0) throw new Error('Choose at least one item to return');

  let sale: any = null;
  let items: ReturnItem[];
  if (type === 'invoice') {
    sale = getSale(String(data.orderId));
    if (sale.status === 'voided') throw new Error('This sale was voided, so nothing on it can be returned');
    items = invoiceItems(returnableLines(sale, liveReturnsFor(sale._id)), data.items);
  } else {
    items = openItems(data.items);
  }

  const total = round2(items.reduce((sum, item) => sum + item.total, 0));
  const customerId: string | null = sale?.customerId ? String(sale.customerId) : null;
  if (refundMethod === 'account' && !customerId) throw new Error('Only a sale to a customer can be refunded to their account');

  // Off what the customer owes, never below zero; the rest is paid in cash.
  let refundToAccount = 0;
  if (refundMethod === 'account' && customerId) {
    const customer = dbGet(`SELECT outstandingBalance FROM customers WHERE _id = $id`, { $id: customerId }) as any;
    if (!customer) throw new Error('Customer not found');
    refundToAccount = round2(Math.min(total, Math.max(0, Number(customer.outstandingBalance) || 0)));
  }
  const rest = round2(total - refundToAccount);

  const _id = generateLocalId();
  const ts = now();
  dbTransaction((d) => {
    for (const item of items) {
      if (!item.product) continue;
      d.run(`UPDATE products SET stock = stock + $qty, updatedAt = $ts, isSync = 0 WHERE _id = $id`, { $qty: item.quantity, $ts: ts, $id: item.product });
    }
    if (refundToAccount > ROUNDING_TOLERANCE && customerId) {
      d.run(`UPDATE customers SET outstandingBalance = outstandingBalance - $amount, updatedAt = $ts, isSync = 0 WHERE _id = $id`, {
        $amount: refundToAccount,
        $ts: ts,
        $id: customerId,
      });
    }
    // What the customer spent with the shop goes down by what they got back.
    if (customerId && total > 0) {
      d.run(`UPDATE customers SET totalAmount = MAX(0, COALESCE(totalAmount, 0) - $total), updatedAt = $ts, isSync = 0 WHERE _id = $id`, {
        $total: total,
        $ts: ts,
        $id: customerId,
      });
    }
    d.run(
      `INSERT INTO product_returns
         (_id, returnNo, type, orderId, invoiceId, customerId, customerName, items, total, refundMethod,
          refundToAccount, refundCash, refundCard, reason, createdAt, updatedAt, isSync)
       VALUES
         ($id, $returnNo, $type, $orderId, $invoiceId, $customerId, $customerName, $items, $total, $refundMethod,
          $toAccount, $cash, $card, $reason, $ts, $ts, 0)`,
      {
        $id: _id,
        $returnNo: `RET-${Date.now()}`,
        $type: type,
        $orderId: sale?._id ?? null,
        $invoiceId: sale?.invoiceId ?? null,
        $customerId: customerId,
        $customerName: sale?.customerName ?? null,
        $items: JSON.stringify(items),
        $total: total,
        $refundMethod: refundMethod,
        $toAccount: refundToAccount,
        $cash: refundMethod === 'card' ? 0 : rest,
        $card: refundMethod === 'card' ? rest : 0,
        $reason: String(data.reason ?? '').trim(),
        $ts: ts,
      }
    );
  });
  return parseItems(dbGet(`SELECT * FROM product_returns WHERE _id = $id`, { $id: _id }));
}

export function getReturns(filter: Record<string, unknown> = {}) {
  const rows = dbAll(`SELECT * FROM product_returns WHERE (deletedAt IS NULL OR deletedAt = '') ORDER BY createdAt DESC LIMIT 500`).map(parseItems);
  const search = String(filter.search ?? '').trim().toLowerCase();
  return rows.filter(
    (row: any) =>
      (!filter.orderId || row.orderId === filter.orderId) &&
      (!filter.customerId || row.customerId === filter.customerId) &&
      (!search || String(row.returnNo).toLowerCase().includes(search) || String(row.invoiceId ?? '').toLowerCase().includes(search))
  );
}

export function registerReturnHandlers(): void {
  handleLicensed('returns:getAll', (_e, filter: Record<string, unknown>) => getReturns(filter ?? {}));
  handleLicensed('returns:getSale', (_e, orderId: string) => getReturnableSale(orderId));
  handleLicensed('returns:create', (_e, data: Record<string, unknown>) => createReturn(data));
}
