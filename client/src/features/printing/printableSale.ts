/**
 * The sale as it appears on a printed receipt or invoice.
 *
 * The till builds this once at checkout, so the thermal receipt and the A4
 * invoice always show the same figures and neither has to dig through cart
 * state while printing.
 */
import type { SystemSettings } from '../../store/settingsStore';

export interface PrintableLine {
  id: string;
  name: string;
  quantity: number;
  /** Price per unit before any discount. */
  unitPrice: number;
  /** Charged for the line, including its deposit. */
  lineTotal: number;
  discountPct: number;
  discountAmount: number;
  drsAmount: number;
}

export interface PrintablePayments {
  cash: number;
  card: number;
  /** Put on the customer's account. */
  credit: number;
  /** Change handed back. */
  change: number;
}

/** The customer's account before and after this sale. Absent for walk-ins. */
export interface PrintableBalances {
  previous: number;
  current: number;
}

export interface PrintableSale {
  invoiceNo: string;
  date: string;
  time: string;
  customer: { name: string; phone: string; address: string };
  lines: PrintableLine[];
  /** Units sold, all lines added together. */
  itemCount: number;
  subTotal: number;
  discount: number;
  totalDRS: number;
  grandTotal: number;
  payments: PrintablePayments;
  balances: PrintableBalances | null;
  paymentLabel: string;
  /** Typed by the cashier at checkout; empty when there are none. */
  remarks: string;
  loyalty?: {
    earned: number;
    total: number;
    rewardThreshold?: number;
    rewardValue?: number;
  };
}

export interface ShopDetails {
  /** The company logo, when the operator has set one. */
  logoUrl: string | null;
  name: string;
  address: string;
  phone: string;
  email: string;
  footer: string;
}

const DEFAULT_FOOTER = 'THANK YOU FOR SHOPPING! Please visit us again soon.';

export function shopDetailsFrom(
  settings: Partial<SystemSettings> | null | undefined,
  logoUrl: string | null = null
): ShopDetails {
  return {
    logoUrl,
    name: settings?.shopName?.trim() || 'Your Shop',
    address: settings?.shopAddress?.trim() || '',
    phone: settings?.shopPhone?.trim() || '',
    email: settings?.shopEmail?.trim() || '',
    footer: settings?.receiptFooter?.trim() || DEFAULT_FOOTER,
  };
}
