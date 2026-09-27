/** Prints the A4 invoice or the till receipt, whichever Settings asks for. */
import A4Invoice from './A4Invoice';
import ThermalReceipt from './ThermalReceipt';
import type { PrintableSale, ShopDetails } from './printableSale';

interface PrintableSaleDocumentProps {
  sale: PrintableSale | null;
  shop: ShopDetails;
  size: 'Thermal' | 'A4';
}

export default function PrintableSaleDocument({ sale, shop, size }: PrintableSaleDocumentProps) {
  if (!sale) return <div style={{ padding: '30px', fontFamily: 'Arial, Helvetica, sans-serif' }}>No transaction data</div>;
  return size === 'A4' ? <A4Invoice sale={sale} shop={shop} /> : <ThermalReceipt sale={sale} shop={shop} />;
}
