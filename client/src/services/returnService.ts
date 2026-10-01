/**
 * Product returns. The server (or the desktop app) applies the rules, so the
 * screens only gather what comes back and how it is refunded.
 */
import api from './api';

export type RefundMethod = 'cash' | 'card' | 'account';

/** What can still come back from one line of a sale, and what each unit is refunded at. */
export interface ReturnableLine {
  orderLine: number;
  product: string | null;
  name: string;
  sold: number;
  returned: number;
  unitPrice: number;
  lineTotal: number;
  refunded: number;
}

export interface ReturnItem {
  product?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  total: number;
  orderLine?: number;
}

export interface ProductReturn {
  _id: string;
  returnNo: string;
  type: 'invoice' | 'open';
  orderId?: string | null;
  invoiceId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  items: ReturnItem[];
  total: number;
  refundMethod: RefundMethod;
  refundToAccount: number;
  refundCash: number;
  refundCard: number;
  reason?: string;
  createdAt: string;
}

export interface InvoiceReturnRequest {
  type: 'invoice';
  orderId: string;
  items: { orderLine: number; quantity: number }[];
  refundMethod: RefundMethod;
  reason?: string;
}

export interface OpenReturnRequest {
  type: 'open';
  items: { product: string; quantity: number; unitPrice: number; discountPct: number }[];
  refundMethod: Exclude<RefundMethod, 'account'>;
  reason?: string;
}

/** A sale with what can still be returned from each of its lines. */
export const getReturnableSale = async (orderId: string): Promise<{ order: any; lines: ReturnableLine[] }> =>
  (await api.get(`/returns/sale/${orderId}`)).data.data;

export const createReturn = async (request: InvoiceReturnRequest | OpenReturnRequest): Promise<ProductReturn> =>
  (await api.post('/returns', request)).data.data;

export const listReturns = async (filter: { search?: string; orderId?: string; customerId?: string } = {}): Promise<ProductReturn[]> =>
  (await api.get('/returns', { params: filter })).data.data ?? [];

/** How a refund was paid out, in words: "€10.00 off account + €8.00 cash". */
export function describeRefund(ret: Pick<ProductReturn, 'refundToAccount' | 'refundCash' | 'refundCard'>, format: (amount: number) => string): string {
  const parts = [
    ret.refundToAccount > 0 && `${format(ret.refundToAccount)} off account`,
    ret.refundCash > 0 && `${format(ret.refundCash)} cash`,
    ret.refundCard > 0 && `${format(ret.refundCard)} card`,
  ].filter(Boolean);
  return parts.length ? parts.join(' + ') : format(0);
}
