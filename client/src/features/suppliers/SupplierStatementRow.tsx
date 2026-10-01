/**
 * One line of a supplier's ledger statement. For managers, the figures that
 * are recorded rather than worked out can be corrected in place:
 *
 *   Goods Received   an invoice's amount (never below what was paid on it)
 *   Paid             a payment's amount, spread again over the invoices
 *   Details          how a payment was made (cash, card, bank, cheque)
 *   Remarks          an invoice's or a payment's remarks
 *
 * The balance and every total follow once the change is saved. An "earlier
 * payment" was never itemised, so it has nothing to correct.
 */
import { Badge, Stack, Table, Text } from '@mantine/core';
import EditableCell from '../../components/EditableCell';
import { correctSupplierInvoice, correctSupplierPayment } from '../../services/supplierLedgerService';
import { formatMoney } from '../../utils/money';
import {
  ROUNDING_TOLERANCE,
  SUPPLIER_PAYMENT_METHODS,
  formatDate,
  formatDateTime,
  type LedgerEntry,
  type SupplierPaymentMethod,
} from './supplierStatement';

interface SupplierStatementRowProps {
  entry: LedgerEntry;
  /** Whether this user may correct the ledger (managers and admins). */
  canEdit: boolean;
  /** Called after a correction is saved, to reload the ledger. */
  onSaved: () => Promise<void> | void;
}

const amount = (value: number, color: string) => (value ? <Text size="sm" c={color} fw={600}>{formatMoney(value)}</Text> : null);

const remarksText = (remarks: string) => (
  <Text size="sm" c={remarks ? undefined : 'dimmed'} style={{ whiteSpace: 'pre-wrap' }}>{remarks || '—'}</Text>
);

export default function SupplierStatementRow({ entry, canEdit, onSaved }: SupplierStatementRowProps) {
  const invoice = entry.type === 'Invoice' ? entry.invoice : undefined;
  const payment = entry.type === 'Payment' ? entry.payment : undefined;
  const when = entry.type === 'Invoice' ? `invoice ${entry.reference}` : `the payment on ${formatDateTime(entry.at)}`;

  /** Save a correction, then reload the ledger so every figure follows it. */
  const save = async (correction: () => Promise<unknown>) => {
    await correction();
    await onSaved();
  };

  const details = (
    <Stack gap={0}>
      <Text size="sm">{entry.details}</Text>
      {entry.split && <Text size="xs" c="dimmed">{entry.split}</Text>}
    </Stack>
  );

  return (
    <Table.Tr>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        {invoice ? (
          <>
            <Text size="sm">{formatDate(entry.at)}</Text>
            {entry.recordedAt && <Text size="xs" c="dimmed">Recorded {formatDateTime(entry.recordedAt)}</Text>}
          </>
        ) : (
          <Text size="sm">{formatDateTime(entry.at)}</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge size="sm" variant="light" color={entry.type === 'Invoice' ? 'orange' : 'green'} style={{ flexShrink: 0 }}>
          {entry.type}
        </Badge>
      </Table.Td>
      <Table.Td>{entry.reference}</Table.Td>

      {/* Details: how a payment was made. An invoice's details are always "Goods received". */}
      <Table.Td miw={150}>
        {payment ? (
          <EditableCell
            kind="select"
            label={`payment method of ${when}`}
            editable={canEdit}
            value={payment.method ?? 'cash'}
            options={SUPPLIER_PAYMENT_METHODS.map((m) => ({ value: m.value, label: `Payment to supplier · ${m.label}` }))}
            display={details}
            onSave={(method) => save(() => correctSupplierPayment(payment.ref, { method: method as SupplierPaymentMethod }))}
          />
        ) : (
          details
        )}
      </Table.Td>

      <Table.Td miw={150}>
        {invoice || payment ? (
          <EditableCell
            kind="text"
            label={`remarks of ${when}`}
            editable={canEdit}
            value={entry.remarks}
            maxLength={500}
            placeholder="Add remarks"
            display={remarksText(entry.remarks)}
            onSave={(remarks) =>
              save(() => (invoice ? correctSupplierInvoice(invoice._id, { remarks }) : correctSupplierPayment(payment!.ref, { remarks })))
            }
          />
        ) : (
          remarksText(entry.remarks)
        )}
      </Table.Td>

      {/* Goods Received: an invoice's amount, never below what has been paid on it. */}
      <Table.Td style={{ textAlign: 'right' }} miw={110}>
        {invoice ? (
          <EditableCell
            kind="money"
            align="right"
            label={`amount of ${when}`}
            editable={canEdit}
            value={entry.received}
            validate={(value) => {
              if (value <= 0) return 'Must be more than zero';
              const paid = Number(invoice.paid) || 0;
              return value < paid - ROUNDING_TOLERANCE ? `${formatMoney(paid)} is already paid on this invoice` : null;
            }}
            display={amount(entry.received, 'orange.8')}
            onSave={(value) => save(() => correctSupplierInvoice(invoice._id, { amount: value }))}
          />
        ) : (
          amount(entry.received, 'orange.8')
        )}
      </Table.Td>

      {/* Paid: a payment's amount; the server spreads it again over the invoices. */}
      <Table.Td style={{ textAlign: 'right' }} miw={110}>
        {payment ? (
          <EditableCell
            kind="money"
            align="right"
            label={`amount of ${when}`}
            editable={canEdit}
            value={entry.paid}
            validate={(value) => (value > 0 ? null : 'Must be more than zero')}
            display={amount(entry.paid, 'green.7')}
            onSave={(value) => save(() => correctSupplierPayment(payment.ref, { amount: value }))}
          />
        ) : (
          amount(entry.paid, 'green.7')
        )}
      </Table.Td>

      <Table.Td style={{ textAlign: 'right' }} fw={700} c={entry.balance > ROUNDING_TOLERANCE ? 'red.6' : 'teal'}>
        {formatMoney(entry.balance)}
      </Table.Td>
    </Table.Tr>
  );
}
