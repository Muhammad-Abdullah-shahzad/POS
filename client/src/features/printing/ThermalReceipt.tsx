/**
 * The 80mm till receipt, printed when Settings has the receipt size set to
 * Thermal. Inline styles, so the print window never loses them.
 */
import type { CSSProperties } from 'react';
import { formatMoney } from '../../utils/money';
import type { PrintableSale, ShopDetails } from './printableSale';

const paper: CSSProperties = {
  width: '300px',
  padding: '8px',
  boxSizing: 'border-box',
  margin: '0 auto',
  fontFamily: 'Arial, Helvetica, sans-serif',
  color: '#000',
  backgroundColor: '#fff',
  fontSize: '12px',
  fontWeight: 500,
  lineHeight: 1.4,
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
};

const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '3px 0' };
const nowrap: CSSProperties = { whiteSpace: 'nowrap' };

interface ThermalReceiptProps {
  sale: PrintableSale;
  shop: ShopDetails;
}

export default function ThermalReceipt({ sale, shop }: ThermalReceiptProps) {
  const { payments, balances } = sale;

  return (
    <div style={paper}>
      <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '1px solid #000', paddingBottom: '12px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}>{shop.name}</h1>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', fontSize: '10px', color: '#333' }}>
        <div>
          <p style={{ margin: '2px 0' }}><strong>CUSTOMER:</strong> {sale.customer.name}</p>
          {sale.customer.phone && <p style={{ margin: '2px 0' }}><strong>PHONE:</strong> {sale.customer.phone}</p>}
          <p style={{ margin: '2px 0' }}><strong>DATE:</strong> {sale.date} {sale.time}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '2px 0' }}><strong>RECEIPT #:</strong> {sale.invoiceNo}</p>
          <p style={{ margin: '2px 0' }}><strong>STATUS:</strong> {payments.credit > 0 ? 'ON ACCOUNT' : 'PAID'}</p>
        </div>
      </div>

      {sale.remarks && (
        <p style={{ margin: '-4px 0 12px', fontSize: '10px', color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <strong>REMARKS:</strong> {sale.remarks}
        </p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px', fontSize: '11px' }}>
        <thead>
          <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', lineHeight: '2' }}>
            <th style={{ width: '50%', textAlign: 'left', padding: '4px 0', fontWeight: 'bold' }}>ITEM</th>
            <th style={{ width: '10%', textAlign: 'center', padding: '4px 0', fontWeight: 'bold' }}>QTY</th>
            <th style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>PRICE</th>
            <th style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line) => (
            <tr key={line.id} style={{ borderBottom: '1px dashed #eee' }}>
              <td style={{ textAlign: 'left', padding: '6px 0', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold' }}>{line.name}</div>
                {line.discountAmount > 0 && (
                  <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>
                    Discount: {line.discountPct > 0 ? `-${line.discountPct}% ` : ''}(-{formatMoney(line.discountAmount)})
                  </div>
                )}
                {line.drsAmount > 0 && (
                  <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>
                    DRS Deposit: +{formatMoney(line.drsAmount)}
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'center', padding: '6px 0', verticalAlign: 'top' }}>{line.quantity}</td>
              <td style={{ textAlign: 'right', padding: '6px 0', verticalAlign: 'top', ...nowrap }}>{formatMoney(line.unitPrice)}</td>
              <td style={{ textAlign: 'right', padding: '6px 0', verticalAlign: 'top', fontWeight: 'bold', ...nowrap }}>{formatMoney(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ width: '100%', fontSize: '11px', color: '#333' }}>
        <div style={row}>
          <span>Subtotal:</span>
          <span style={nowrap}>{formatMoney(sale.subTotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div style={{ ...row, color: '#000' }}>
            <span>Flat Discount:</span>
            <span style={nowrap}>-{formatMoney(sale.discount)}</span>
          </div>
        )}
        {sale.totalDRS > 0 && (
          <div style={row}>
            <span>Total DRS:</span>
            <span style={nowrap}>{formatMoney(sale.totalDRS)}</span>
          </div>
        )}
        <div style={{ ...row, padding: '8px 0 4px', borderTop: '1px solid #000', fontWeight: 'bold', fontSize: '15px', color: '#000' }}>
          <span>TOTAL:</span>
          <span style={nowrap}>{formatMoney(sale.grandTotal)}</span>
        </div>

        <div style={{ ...row, borderTop: '1px dashed #ccc', marginTop: '4px', paddingTop: '4px' }}>
          <span>Cash Paid:</span>
          <span style={nowrap}>{formatMoney(payments.cash)}</span>
        </div>
        {payments.card > 0 && (
          <div style={row}>
            <span>Card Paid:</span>
            <span style={nowrap}>{formatMoney(payments.card)}</span>
          </div>
        )}
        {payments.credit > 0 && (
          <div style={{ ...row, fontWeight: 'bold' }}>
            <span>On Account (Credit):</span>
            <span style={nowrap}>{formatMoney(payments.credit)}</span>
          </div>
        )}
        {payments.change > 0 && (
          <div style={{ ...row, fontWeight: 'bold' }}>
            <span>Change:</span>
            <span style={nowrap}>{formatMoney(payments.change)}</span>
          </div>
        )}
        {balances && (
          <>
            <div style={{ ...row, borderTop: '1px dashed #ccc', marginTop: '4px', paddingTop: '4px' }}>
              <span>Old Balance:</span>
              <span style={nowrap}>{formatMoney(balances.previous)}</span>
            </div>
            <div style={{ ...row, fontWeight: 'bold' }}>
              <span>New Balance:</span>
              <span style={nowrap}>{formatMoney(balances.current)}</span>
            </div>
          </>
        )}
        <div style={row}>
          <span>Payment:</span>
          <span>{sale.paymentLabel}</span>
        </div>

        {sale.loyalty && (
          <div style={{ marginTop: '12px', padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>LOYALTY POINTS</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Earned this visit: <strong>+{sale.loyalty.earned} pts</strong>
            </div>
            <div style={{ fontSize: '11px' }}>
              Total points: <strong>{sale.loyalty.total} pts</strong>
            </div>
            {sale.loyalty.rewardThreshold ? (
              <div style={{ fontSize: '9px', marginTop: '4px', color: '#555' }}>
                Reward at {sale.loyalty.rewardThreshold} pts = {formatMoney(sale.loyalty.rewardValue ?? 0)} free shopping
              </div>
            ) : null}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed #000', fontSize: '10px', fontStyle: 'italic', fontWeight: 'bold' }}>
          {shop.footer}
        </div>
      </div>
    </div>
  );
}
