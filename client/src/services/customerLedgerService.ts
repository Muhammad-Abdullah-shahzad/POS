/**
 * Corrections to a customer's account, made from the account statement.
 * Each one moves the customer's balance by the difference it makes; the
 * server (or the desktop app) applies the rules, so they live in one place.
 */
import api from './api';

export interface PaymentCorrection {
  amountPaid?: number;
  paymentMethod?: 'cash' | 'card';
  notes?: string;
}

export interface SaleCorrection {
  /** How much of the sale goes on the customer's account. */
  creditAmount?: number;
  remarks?: string;
}

export const correctPayment = (customerId: string, paymentId: string, changes: PaymentCorrection) =>
  api.patch(`/customers/${customerId}/payments/${paymentId}`, changes);

export const correctSale = (customerId: string, orderId: string, changes: SaleCorrection) =>
  api.patch(`/customers/${customerId}/sales/${orderId}`, changes);

export const setOpeningBalance = (customerId: string, openingBalance: number) =>
  api.patch(`/customers/${customerId}/opening-balance`, { openingBalance });

/** Delete a recorded payment; the customer owes that amount again. */
export const deletePayment = (customerId: string, paymentId: string) =>
  api.delete(`/customers/${customerId}/payments/${paymentId}`);

/**
 * Remove a sale from the account by voiding it, as the till does: its stock
 * goes back, its credit comes off the balance, and it stays on record under
 * Void Transactions with the reason given.
 */
export const voidSale = (orderId: string, reason: string) =>
  api.delete(`/orders/${orderId}?${new URLSearchParams({ reason }).toString()}`);
