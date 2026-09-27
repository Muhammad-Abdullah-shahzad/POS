/**
 * The A4 invoice, printed when Settings has the receipt size set to A4.
 *
 * It follows the wholesale invoice layout shops here expect: the shop's name
 * across the top, the customer's details, a ruled item table, then what was
 * paid on the left and the totals with the account balance on the right.
 *
 * Styles are inline on purpose: the print window only reliably carries inline
 * styles, and a shop must never get an unstyled invoice out of the printer.
 */
import type { CSSProperties, ReactNode } from 'react';
import { formatMoney } from '../../utils/money';
import type { PrintableSale, ShopDetails } from './printableSale';

const BORDER = '1px solid #000';

const page: CSSProperties = {
  width: '210mm',
  minHeight: '297mm',
  padding: '12mm 10mm',
  boxSizing: 'border-box',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Arial, Helvetica, sans-serif',
  color: '#000',
  backgroundColor: '#fff',
  fontSize: '12px',
  lineHeight: 1.35,
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
};

const cell: CSSProperties = { border: BORDER, padding: '5px 8px', verticalAlign: 'top' };
const headCell: CSSProperties = { ...cell, fontWeight: 'bold', textAlign: 'center', backgroundColor: '#fff' };
const numberCell: CSSProperties = { ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
const LOGO_COLUMN = '32mm';
const heading: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${LOGO_COLUMN} 1fr ${LOGO_COLUMN}`,
  alignItems: 'center',
  gap: '4mm',
  marginBottom: '10px',
};
const logo: CSSProperties = { display: 'block', maxWidth: LOGO_COLUMN, maxHeight: '28mm', objectFit: 'contain' };
const totalsLabel: CSSProperties = { ...cell, fontWeight: 'bold' };
const filler: CSSProperties = { ...cell, borderTop: 'none', padding: 0 };

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <p style={{ margin: '2px 0' }}>
      <span style={{ display: 'inline-block', minWidth: '118px' }}>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

function TotalsRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td style={{ ...totalsLabel, fontWeight: strong ? 'bold' : 'normal' }}>{label}</td>
      <td style={{ ...numberCell, fontWeight: strong ? 'bold' : 'normal' }}>{value}</td>
    </tr>
  );
}

interface A4InvoiceProps {
  sale: PrintableSale;
  shop: ShopDetails;
}

export default function A4Invoice({ sale, shop }: A4InvoiceProps) {
  const { payments, balances } = sale;

  return (
    <div style={page}>
      {/*
        ── Shop heading ───────────────────────────────────────────────
        Three columns: the logo top left, the shop details centred, and an
        empty column of the same width so the name stays centred on the page.
      */}
      <header style={heading}>
        <div style={{ alignSelf: 'start' }}>
          {shop.logoUrl && (
            <img
              src={shop.logoUrl}
              alt=""
              style={logo}
              // A logo that cannot load must not print a broken-image icon.
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{shop.name}</h1>
          {shop.address && <p style={{ margin: '4px 0 0', fontSize: '12px' }}>{shop.address}</p>}
          {shop.phone && <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 'bold' }}>MOB: {shop.phone}</p>}
          {shop.email && <p style={{ margin: '2px 0 0', fontSize: '11px' }}>{shop.email}</p>}
          <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: 'bold', letterSpacing: '2px' }}>INVOICE</p>
        </div>
        <div />
      </header>

      {/* ── Who it is for, and when ──────────────────────────────────── */}
      <section style={{ borderTop: BORDER, borderBottom: BORDER, padding: '6px 0', marginBottom: '8px' }}>
        <Field label="Customer Name:" value={sale.customer.name} />
        {sale.customer.phone && <Field label="Mobile No:" value={sale.customer.phone} />}
        {sale.customer.address && <Field label="Customer Address:" value={sale.customer.address} />}
        {sale.remarks && (
          <p style={{ display: 'flex', margin: '6px 0 2px' }}>
            <span style={{ flex: 'none', width: '118px' }}>Remarks:</span>
            {/* Keeps the line breaks the cashier typed. */}
            <strong style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sale.remarks}</strong>
          </p>
        )}
      </section>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
        <tbody>
          <tr>
            <td style={{ ...cell, width: '40%' }}>
              DATE: <strong>{sale.date}</strong>
            </td>
            <td style={{ ...cell, width: '25%' }}>
              TIME: <strong>{sale.time}</strong>
            </td>
            <td style={{ ...cell, width: '35%' }}>
              INVOICE NO: <strong>{sale.invoiceNo}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Items. The table stretches so the rules run down the page. ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', flex: 1, marginBottom: '8px' }}>
        <thead>
          <tr>
            <th style={{ ...headCell, width: '8%' }}>Sr#</th>
            <th style={{ ...headCell, width: '46%', textAlign: 'left' }}>Description</th>
            <th style={{ ...headCell, width: '12%' }}>Qty</th>
            <th style={{ ...headCell, width: '16%' }}>Rate</th>
            <th style={{ ...headCell, width: '18%' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line, index) => (
            <tr key={line.id} style={{ height: '1px' }}>
              <td style={{ ...cell, textAlign: 'center' }}>{index + 1}</td>
              <td style={cell}>
                {line.name}
                {line.discountAmount > 0 && (
                  <span style={{ fontSize: '10px', fontStyle: 'italic' }}>
                    {' '}
                    (discount {line.discountPct > 0 ? `${line.discountPct}% ` : ''}-{formatMoney(line.discountAmount)})
                  </span>
                )}
                {line.drsAmount > 0 && (
                  <span style={{ fontSize: '10px', fontStyle: 'italic' }}> (deposit +{formatMoney(line.drsAmount)})</span>
                )}
              </td>
              <td style={{ ...cell, textAlign: 'center' }}>{line.quantity}</td>
              <td style={numberCell}>{formatMoney(line.unitPrice)}</td>
              <td style={numberCell}>{formatMoney(line.lineTotal)}</td>
            </tr>
          ))}
          {/*
            An empty row takes the leftover height, so the ruled columns run
            down to the totals however few items were sold.
          */}
          <tr style={{ height: '100%' }}>
            <td style={filler} />
            <td style={filler} />
            <td style={filler} />
            <td style={filler} />
            <td style={filler} />
          </tr>
        </tbody>
      </table>

      {/* ── What was paid, and what is owed ──────────────────────────── */}
      <section style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-end' }}>
        <div style={{ minWidth: '45%' }}>
          <p style={{ margin: '0 0 6px', fontWeight: 'bold' }}>Items: {sale.itemCount}</p>
          <table style={{ borderCollapse: 'collapse', minWidth: '210px' }}>
            <tbody>
              <tr>
                <td style={{ ...cell, fontWeight: 'bold' }}>Cash</td>
                <td style={numberCell}>{formatMoney(payments.cash)}</td>
              </tr>
              {/* Card only appears when something was actually paid by card. */}
              {payments.card > 0 && (
                <tr>
                  <td style={{ ...cell, fontWeight: 'bold' }}>Card</td>
                  <td style={numberCell}>{formatMoney(payments.card)}</td>
                </tr>
              )}
              <tr>
                <td style={{ ...cell, fontWeight: 'bold' }}>Credit</td>
                <td style={numberCell}>{formatMoney(payments.credit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table style={{ borderCollapse: 'collapse', minWidth: '48%' }}>
          <tbody>
            <TotalsRow label="Sub Total" value={formatMoney(sale.subTotal)} />
            {sale.discount > 0 && <TotalsRow label="Discount" value={`-${formatMoney(sale.discount)}`} />}
            {sale.totalDRS > 0 && <TotalsRow label="Deposit (DRS)" value={formatMoney(sale.totalDRS)} />}
            <TotalsRow label="Grand Total" value={formatMoney(sale.grandTotal)} strong />
            <TotalsRow label="Cash Paid" value={formatMoney(payments.cash)} />
            {payments.card > 0 && <TotalsRow label="Card Paid" value={formatMoney(payments.card)} />}
            {payments.change > 0 && <TotalsRow label="Change" value={formatMoney(payments.change)} />}
            {balances && <TotalsRow label="OLD BAL." value={formatMoney(balances.previous)} />}
            {balances && <TotalsRow label="NEW BAL." value={formatMoney(balances.current)} strong />}
          </tbody>
        </table>
      </section>

      <footer style={{ marginTop: '10px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '12px', fontStyle: 'italic' }}>{shop.footer}</p>
      </footer>
    </div>
  );
}
