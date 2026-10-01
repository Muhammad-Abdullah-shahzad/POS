/**
 * Return against a recorded sale. The sale is found by its invoice number, or
 * by choosing the customer and one of their sales. The cashier ticks what
 * comes back and how many; each item is refunded at what was paid for it, and
 * never more of a line than was sold less what came back before.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Checkbox, Group, NumberInput, Paper, SegmentedControl, Select, Stack, Table, Text, TextInput, Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconInfoCircle, IconSearch } from '@tabler/icons-react';
import api from '../../services/api';
import { createReturn, describeRefund, getReturnableSale, type RefundMethod, type ReturnableLine } from '../../services/returnService';
import { errorMessage } from '../../utils/errorMessage';
import { formatMoney } from '../../utils/money';

type FindBy = 'invoice' | 'customer';

interface Customer {
  _id: string;
  name: string;
  contactNum1?: string;
  outstandingBalance?: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

export default function InvoiceReturn({ onSaved }: { onSaved?: () => void }) {
  const [findBy, setFindBy] = useState<FindBy>('invoice');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSales, setCustomerSales] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [sale, setSale] = useState<any | null>(null);
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  /** Quantity coming back per sale line, for the ticked lines. */
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers').then(({ data }) => setCustomers(data.data ?? [])).catch(() => setCustomers([]));
  }, []);

  const saleCustomer = sale?.customerId ? customers.find((c) => c._id === String(sale.customerId)) : undefined;

  const openSale = async (orderId: string) => {
    try {
      const { order, lines: returnable } = await getReturnableSale(orderId);
      setSale(order);
      setLines(returnable);
      setPicked({});
      setReason('');
      // A sale on credit is refunded to the customer's account by default.
      setRefundMethod(order.customerId && Number(order.creditAmount) > 0 ? 'account' : 'cash');
    } catch (error) {
      notifications.show({ title: 'Sale not opened', message: errorMessage(error, 'The sale could not be loaded'), color: 'red' });
    }
  };

  const findInvoice = async () => {
    const wanted = invoiceNo.trim();
    if (!wanted) return;
    setSearching(true);
    setSale(null);
    try {
      const { data } = await api.get('/orders', { params: { search: wanted } });
      const found: any[] = data.data ?? [];
      const exact = found.find((order) => String(order.invoiceId).toLowerCase() === wanted.toLowerCase());
      if (exact) {
        setMatches([]);
        await openSale(exact._id);
      } else {
        setMatches(found.slice(0, 10));
        if (found.length === 0) notifications.show({ title: 'Not found', message: `No sale with invoice number "${wanted}"`, color: 'yellow' });
      }
    } catch (error) {
      notifications.show({ title: 'Search failed', message: errorMessage(error, 'Sales could not be searched'), color: 'red' });
    } finally {
      setSearching(false);
    }
  };

  const chooseCustomer = async (id: string | null) => {
    setCustomerId(id);
    setSale(null);
    setCustomerSales([]);
    if (!id) return;
    try {
      const { data } = await api.get(`/customers/${id}/ledger`);
      setCustomerSales(data.data?.orders ?? []);
    } catch (error) {
      notifications.show({ title: 'Sales not loaded', message: errorMessage(error, "The customer's sales could not be loaded"), color: 'red' });
    }
  };

  const toggleLine = (line: ReturnableLine) =>
    setPicked((current) => {
      const next = { ...current };
      if (next[line.orderLine] !== undefined) delete next[line.orderLine];
      else next[line.orderLine] = line.sold - line.returned;
      return next;
    });

  const chosen = useMemo(
    () => lines.filter((line) => picked[line.orderLine] !== undefined && picked[line.orderLine] > 0),
    [lines, picked]
  );
  const refundTotal = round2(
    chosen.reduce((sum, line) => {
      const quantity = picked[line.orderLine];
      const left = line.sold - line.returned;
      return sum + (quantity === left ? line.lineTotal - line.refunded : line.unitPrice * quantity);
    }, 0)
  );
  const owed = round2(Math.max(0, Number(saleCustomer?.outstandingBalance) || 0));
  const toAccount = refundMethod === 'account' ? round2(Math.min(refundTotal, owed)) : 0;

  const save = async () => {
    if (!sale || chosen.length === 0) return;
    setSaving(true);
    try {
      const saved = await createReturn({
        type: 'invoice',
        orderId: sale._id,
        items: chosen.map((line) => ({ orderLine: line.orderLine, quantity: picked[line.orderLine] })),
        refundMethod,
        reason: reason.trim(),
      });
      notifications.show({
        title: `Return ${saved.returnNo} saved`,
        message: `Refund ${formatMoney(saved.total)}: ${describeRefund(saved, formatMoney)}. Stock updated.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      // Reload the sale, so what has now come back shows and cannot be returned twice.
      await openSale(sale._id);
      if (saved.refundToAccount > 0) {
        api.get('/customers').then(({ data }) => setCustomers(data.data ?? [])).catch(() => undefined);
      }
      onSaved?.();
    } catch (error) {
      notifications.show({ title: 'Return not saved', message: errorMessage(error, 'The return could not be saved'), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const refundOptions = sale?.customerId
    ? [
        { value: 'account', label: 'Customer account' },
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
      ]
    : [
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
      ];

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <SegmentedControl
            value={findBy}
            onChange={(value) => { setFindBy(value as FindBy); setSale(null); setMatches([]); }}
            data={[
              { value: 'invoice', label: 'By invoice number' },
              { value: 'customer', label: 'By customer (credit sales)' },
            ]}
            w="fit-content"
          />

          {findBy === 'invoice' ? (
            <Group align="flex-end">
              <TextInput
                label="Invoice number"
                placeholder="e.g. 1024 or REC-1790…"
                leftSection={<IconSearch size={16} />}
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && findInvoice()}
                w={280}
              />
              <Button onClick={findInvoice} loading={searching}>Find sale</Button>
            </Group>
          ) : (
            <Select
              label="Customer"
              placeholder="Search a customer"
              searchable
              clearable
              data={customers.map((c) => ({
                value: c._id,
                label: `${c.name}${c.contactNum1 ? ` · ${c.contactNum1}` : ''}${(c.outstandingBalance ?? 0) > 0 ? ` · owes ${formatMoney(c.outstandingBalance ?? 0)}` : ''}`,
              }))}
              value={customerId}
              onChange={chooseCustomer}
              w={420}
              comboboxProps={{ withinPortal: true }}
            />
          )}

          {/* Several partial matches for an invoice number, or a customer's sales: pick one. */}
          {((findBy === 'invoice' && matches.length > 0) || (findBy === 'customer' && customerId && !sale)) && (
            <Table striped highlightOnHover fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th>Paid by</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(findBy === 'invoice' ? matches : customerSales).map((order) => (
                  <Table.Tr key={order._id}>
                    <Table.Td fw={600}>{order.invoiceId}</Table.Td>
                    <Table.Td>{formatDateTime(order.createdAt)}</Table.Td>
                    <Table.Td>{order.items?.length ?? 0}</Table.Td>
                    <Table.Td><Badge size="sm" variant="light" color={order.paymentMethod === 'credit' ? 'red' : 'green'}>{order.paymentMethod}</Badge></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{formatMoney(order.total)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Button size="compact-xs" onClick={() => openSale(order._id)}>Return items</Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {findBy === 'customer' && customerSales.length === 0 && (
                  <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="sm">This customer has no sales.</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>

      {sale && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={700} size="lg">Invoice {sale.invoiceId}</Text>
                <Text size="sm" c="dimmed">
                  {formatDateTime(sale.createdAt)} · {formatMoney(sale.total)} · {sale.paymentMethod}
                  {sale.customerName ? ` · ${sale.customerName}` : ''}
                </Text>
              </div>
              {sale.status === 'voided' && <Badge color="red">Voided: nothing can be returned</Badge>}
            </Group>

            <Table withTableBorder fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={36} />
                  <Table.Th>Item</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Sold</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Already returned</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Refund per unit</Table.Th>
                  <Table.Th w={130}>Return qty</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Refund</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lines.map((line) => {
                  const left = line.sold - line.returned;
                  const quantity = picked[line.orderLine];
                  const ticked = quantity !== undefined;
                  const refund = ticked ? (quantity === left ? line.lineTotal - line.refunded : line.unitPrice * quantity) : 0;
                  return (
                    <Table.Tr key={line.orderLine} bg={ticked ? 'var(--mantine-color-blue-light)' : undefined}>
                      <Table.Td>
                        <Checkbox
                          size="xs"
                          checked={ticked}
                          disabled={left <= 0 || sale.status === 'voided'}
                          onChange={() => toggleLine(line)}
                          aria-label={`Return ${line.name}`}
                        />
                      </Table.Td>
                      <Table.Td fw={500}>{line.name}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{line.sold}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} c={line.returned ? 'orange.8' : 'dimmed'}>
                        {left <= 0 ? 'All returned' : line.returned}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{formatMoney(line.unitPrice)}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          min={1}
                          max={left}
                          allowDecimal={!Number.isInteger(line.sold)}
                          disabled={!ticked}
                          value={ticked ? quantity : ''}
                          onChange={(value) => setPicked((current) => ({ ...current, [line.orderLine]: Math.min(left, Math.max(0, Number(value) || 0)) }))}
                          aria-label={`Quantity of ${line.name} to return`}
                        />
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} fw={ticked ? 700 : undefined}>{ticked ? formatMoney(round2(refund)) : ''}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            <Group align="flex-start" grow>
              <Stack gap={6}>
                <Text size="sm" fw={500}>Refund to</Text>
                <SegmentedControl value={refundMethod} onChange={(value) => setRefundMethod(value as RefundMethod)} data={refundOptions} />
                {refundMethod === 'account' && (
                  <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
                    <Text size="xs">
                      {saleCustomer?.name ?? 'The customer'} owes {formatMoney(owed)}. {formatMoney(toAccount)} comes off their balance
                      {refundTotal - toAccount > 0.005 ? ` and ${formatMoney(round2(refundTotal - toAccount))} is paid in cash` : ''}.
                    </Text>
                  </Alert>
                )}
              </Stack>
              <Textarea label="Reason" placeholder="e.g. Damaged, wrong size" value={reason} onChange={(e) => setReason(e.currentTarget.value)} maxLength={500} autosize minRows={2} />
            </Group>

            <Group justify="space-between">
              <Text fw={700} size="lg">Refund: {formatMoney(refundTotal)}</Text>
              <Button color="red" onClick={save} loading={saving} disabled={chosen.length === 0}>
                Save return
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
