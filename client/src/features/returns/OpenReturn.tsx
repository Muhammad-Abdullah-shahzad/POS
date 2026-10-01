/**
 * Return without a sale or a customer. The cashier adds the products coming
 * back, the quantity, and the price refunded for each (the shelf price to
 * start with, editable, with an optional discount). Refunded in cash or by
 * card; every item goes back into stock.
 */
import { useEffect, useState } from 'react';
import { ActionIcon, Button, Group, NumberInput, Paper, SegmentedControl, Select, Stack, Table, Text, Textarea } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconSearch, IconTrash } from '@tabler/icons-react';
import api from '../../services/api';
import { createReturn } from '../../services/returnService';
import { errorMessage } from '../../utils/errorMessage';
import { formatMoney } from '../../utils/money';

interface Product {
  _id: string;
  name: string;
  barcode?: string;
  price: number;
}

interface OpenLine {
  product: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Refunded for a line: the price after its discount, times the quantity. */
export const openLineTotal = (line: Pick<OpenLine, 'quantity' | 'unitPrice' | 'discountPct'>) =>
  round2(round2(line.unitPrice * (1 - line.discountPct / 100)) * line.quantity);

export default function OpenReturn({ onSaved }: { onSaved?: () => void }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search.trim(), 250);
  const [results, setResults] = useState<Product[]>([]);
  const [lines, setLines] = useState<OpenLine[]>([]);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card'>('cash');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    api
      .get('/products', { params: { search: debouncedSearch || undefined, limit: 30 } })
      .then(({ data }) => current && setResults(Array.isArray(data.data) ? data.data : data.data?.items ?? []))
      .catch(() => current && setResults([]));
    return () => { current = false; };
  }, [debouncedSearch]);

  const addProduct = (productId: string | null) => {
    const product = results.find((p) => p._id === productId);
    if (!product) return;
    setLines((current) => {
      // The same product again adds one more rather than a second line.
      const existing = current.find((line) => line.product === product._id);
      if (existing) return current.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line));
      return [...current, { product: product._id, name: product.name, quantity: 1, unitPrice: Number(product.price) || 0, discountPct: 0 }];
    });
    setSearch('');
  };

  const update = (index: number, changes: Partial<OpenLine>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...changes } : line)));

  const total = round2(lines.reduce((sum, line) => sum + openLineTotal(line), 0));
  const valid = lines.length > 0 && lines.every((line) => line.quantity > 0 && line.unitPrice >= 0 && line.discountPct >= 0 && line.discountPct <= 100);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const saved = await createReturn({
        type: 'open',
        items: lines.map(({ product, quantity, unitPrice, discountPct }) => ({ product, quantity, unitPrice, discountPct })),
        refundMethod,
        reason: reason.trim(),
      });
      notifications.show({
        title: `Return ${saved.returnNo} saved`,
        message: `Refunded ${formatMoney(saved.total)} by ${refundMethod}. Stock updated.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      setLines([]);
      setReason('');
      onSaved?.();
    } catch (error) {
      notifications.show({ title: 'Return not saved', message: errorMessage(error, 'The return could not be saved'), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Select
          label="Add a product"
          placeholder="Type a product name or scan a barcode"
          leftSection={<IconSearch size={16} />}
          searchable
          value={null}
          searchValue={search}
          onSearchChange={setSearch}
          data={results.map((p) => ({ value: p._id, label: `${p.name}${p.barcode ? ` · ${p.barcode}` : ''} · ${formatMoney(p.price)}` }))}
          filter={({ options }) => options}
          onChange={addProduct}
          nothingFoundMessage={debouncedSearch ? 'No product found' : undefined}
          maw={520}
          comboboxProps={{ withinPortal: true }}
        />

        <Table withTableBorder fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Product</Table.Th>
              <Table.Th w={110}>Qty</Table.Th>
              <Table.Th w={140}>Price</Table.Th>
              <Table.Th w={110}>Discount %</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Refund</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((line, index) => (
              <Table.Tr key={line.product}>
                <Table.Td fw={500}>{line.name}</Table.Td>
                <Table.Td>
                  <NumberInput size="xs" min={0.001} value={line.quantity} onChange={(v) => update(index, { quantity: Number(v) || 0 })} aria-label={`Quantity of ${line.name}`} />
                </Table.Td>
                <Table.Td>
                  <NumberInput size="xs" min={0} decimalScale={2} value={line.unitPrice} onChange={(v) => update(index, { unitPrice: Number(v) || 0 })} aria-label={`Price of ${line.name}`} />
                </Table.Td>
                <Table.Td>
                  <NumberInput size="xs" min={0} max={100} decimalScale={2} value={line.discountPct} onChange={(v) => update(index, { discountPct: Number(v) || 0 })} aria-label={`Discount on ${line.name}`} />
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }} fw={700}>{formatMoney(openLineTotal(line))}</Table.Td>
                <Table.Td>
                  <ActionIcon variant="subtle" color="red" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${line.name}`}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            {lines.length === 0 && (
              <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="sm">Add the products being returned.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        <Group align="flex-start" grow>
          <Stack gap={6}>
            <Text size="sm" fw={500}>Refund by</Text>
            <SegmentedControl value={refundMethod} onChange={(value) => setRefundMethod(value as 'cash' | 'card')} data={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
          </Stack>
          <Textarea label="Reason" placeholder="e.g. No receipt, damaged" value={reason} onChange={(e) => setReason(e.currentTarget.value)} maxLength={500} autosize minRows={2} />
        </Group>

        <Group justify="space-between">
          <Text fw={700} size="lg">Refund: {formatMoney(total)}</Text>
          <Button color="red" onClick={save} loading={saving} disabled={!valid}>Save return</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
