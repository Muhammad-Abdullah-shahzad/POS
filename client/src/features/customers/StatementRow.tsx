/**
 * One line of a customer's account statement. For managers, the figures that
 * are recorded rather than worked out can be corrected in place:
 *
 *   Added to Account   a sale's amount on account, or the opening balance
 *   Payment Received   a payment's amount
 *   Details            a payment's method (cash or card)
 *   Remarks            a sale's remarks, or a payment's notes
 *
 * Everything else on the line (sale total, paid at till, balance) follows
 * from those and is recalculated once the change is saved.
 */
import { ActionIcon, Badge, Checkbox, Table, Text, Tooltip } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import EditableCell from '../../components/EditableCell';
import { correctPayment, correctSale, setOpeningBalance } from '../../services/customerLedgerService';
import { formatMoney } from '../../utils/money';
import { ROUNDING_TOLERANCE, formatDateTime, type StatementLine } from './accountStatement';

interface StatementRowProps {
  line: StatementLine;
  customerId: string;
  /** Whether this user may correct the account (managers and admins). */
  canEdit: boolean;
  /** Called after a correction is saved, to reload the account. */
  onSaved: () => Promise<void> | void;
  onViewReceipt: (order: any) => void;
  /** Whether this line can be ticked for deletion; omitted when deleting is not allowed at all. */
  deletable?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}

const money = (value: number, color?: string) =>
  value ? <Text size="sm" c={color} fw={600}>{formatMoney(value)}</Text> : null;

const remarksText = (remarks: string) => (
  <Text size="sm" c={remarks ? undefined : 'dimmed'} style={{ whiteSpace: 'pre-wrap' }}>{remarks || '—'}</Text>
);

export default function StatementRow({
  line,
  customerId,
  canEdit,
  onSaved,
  onViewReceipt,
  deletable,
  selected = false,
  onToggleSelected,
}: StatementRowProps) {
  const sale = line.type === 'Sale' ? line.order : null;
  const payment = line.type === 'Payment' ? line.payment : null;
  const isOpening = line.type === 'Opening';

  /** Save a correction, then reload the account so every figure follows it. */
  const save = async (correction: () => Promise<unknown>) => {
    await correction();
    await onSaved();
  };

  return (
    <Table.Tr bg={selected ? 'var(--mantine-color-red-light)' : undefined}>
      {deletable !== undefined && (
        <Table.Td w={36}>
          {deletable && (
            <Checkbox
              size="xs"
              checked={selected}
              onChange={() => onToggleSelected?.()}
              aria-label={`Select ${line.type.toLowerCase()} ${line.reference !== '—' ? line.reference : formatDateTime(line.at)} for deletion`}
            />
          )}
        </Table.Td>
      )}
      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(line.at)}</Table.Td>
      <Table.Td>
        <Badge size="sm" variant="light" style={{ flexShrink: 0 }} color={line.type === 'Sale' ? 'orange' : line.type === 'Payment' ? 'blue' : line.type === 'Return' ? 'teal' : 'gray'}>
          {line.type}
        </Badge>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>{line.reference}</Table.Td>

      {/* Details: a payment's method can be corrected; a sale's is worked out from how it was settled. */}
      <Table.Td miw={140}>
        {payment ? (
          <EditableCell
            kind="select"
            label={`payment method of the payment on ${formatDateTime(line.at)}`}
            editable={canEdit}
            value={payment.paymentMethod === 'card' ? 'card' : 'cash'}
            options={[
              { value: 'cash', label: 'Payment received · cash' },
              { value: 'card', label: 'Payment received · card' },
            ]}
            display={<Text size="sm">{line.details}</Text>}
            onSave={(method) => save(() => correctPayment(customerId, payment._id, { paymentMethod: method as 'cash' | 'card' }))}
          />
        ) : (
          <Text size="sm">{line.details}</Text>
        )}
      </Table.Td>

      <Table.Td miw={150}>
        {sale || payment ? (
          <EditableCell
            kind="text"
            label={sale ? `remarks of sale ${line.reference}` : `notes of the payment on ${formatDateTime(line.at)}`}
            editable={canEdit}
            value={line.remarks}
            maxLength={500}
            placeholder="Add remarks"
            display={remarksText(line.remarks)}
            onSave={(remarks) =>
              save(() => (sale ? correctSale(customerId, sale._id, { remarks }) : correctPayment(customerId, payment._id, { notes: remarks })))
            }
          />
        ) : (
          remarksText(line.remarks)
        )}
      </Table.Td>

      <Table.Td style={{ textAlign: 'right' }}>{line.saleTotal ? formatMoney(line.saleTotal) : ''}</Table.Td>
      <Table.Td style={{ textAlign: 'right' }} c="green.7">{line.paidAtTill ? formatMoney(line.paidAtTill) : ''}</Table.Td>

      {/* Added to Account: a sale's credit (at most its total), or the opening balance. */}
      <Table.Td style={{ textAlign: 'right' }} miw={96}>
        {sale || isOpening ? (
          <EditableCell
            kind="money"
            align="right"
            label={sale ? `amount on account for sale ${line.reference}` : 'opening balance'}
            editable={canEdit}
            value={line.onAccount}
            min={0}
            max={sale ? line.saleTotal : undefined}
            display={money(line.onAccount, 'orange.8') ?? <Text size="sm" c="dimmed">0</Text>}
            onSave={(amount) =>
              save(() => (sale ? correctSale(customerId, sale._id, { creditAmount: amount }) : setOpeningBalance(customerId, amount)))
            }
          />
        ) : (
          money(line.onAccount, 'orange.8')
        )}
      </Table.Td>

      {/* Payment Received: a payment's amount. */}
      <Table.Td style={{ textAlign: 'right' }} miw={96}>
        {payment ? (
          <EditableCell
            kind="money"
            align="right"
            label={`amount of the payment on ${formatDateTime(line.at)}`}
            editable={canEdit}
            value={line.received}
            validate={(amount) => (amount > 0 ? null : 'Must be more than zero')}
            display={money(line.received, 'blue.7')}
            onSave={(amount) => save(() => correctPayment(customerId, payment._id, { amountPaid: amount }))}
          />
        ) : (
          money(line.received, 'blue.7')
        )}
      </Table.Td>

      <Table.Td style={{ textAlign: 'right' }} fw={700} c={line.balance > ROUNDING_TOLERANCE ? 'red.6' : 'teal'}>
        {formatMoney(line.balance)}
      </Table.Td>
      <Table.Td>
        {sale && (
          <Tooltip label="View receipt" withArrow>
            <ActionIcon variant="subtle" size="sm" aria-label={`View receipt ${line.reference}`} onClick={() => onViewReceipt(sale)}>
              <IconEye size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
