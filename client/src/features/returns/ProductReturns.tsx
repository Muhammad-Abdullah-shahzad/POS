/**
 * Product Return page: a return against a sale (by invoice number or through
 * the customer), an open return (no sale, no customer), and the history of
 * returns taken.
 */
import { useEffect, useState } from 'react';
import { Badge, Paper, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconArrowBackUp, IconFileInvoice, IconHistory, IconSearch } from '@tabler/icons-react';
import { describeRefund, listReturns, type ProductReturn } from '../../services/returnService';
import { formatMoney } from '../../utils/money';
import InvoiceReturn from './InvoiceReturn';
import OpenReturn from './OpenReturn';

function ReturnHistory({ refreshKey }: { refreshKey: number }) {
  const [returns, setReturns] = useState<ProductReturn[]>([]);
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 250);

  useEffect(() => {
    let current = true;
    listReturns(debounced ? { search: debounced } : {})
      .then((rows) => current && setReturns(rows))
      .catch(() => current && setReturns([]));
    return () => { current = false; };
  }, [debounced, refreshKey]);

  return (
    <Paper withBorder p="md" radius="md">
      <TextInput
        placeholder="Search return or invoice number"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="md"
        maw={320}
      />
      <Table.ScrollContainer minWidth={900}>
        <Table striped highlightOnHover fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Return #</Table.Th>
              <Table.Th miw={100}>Type</Table.Th>
              <Table.Th>Invoice</Table.Th>
              <Table.Th>Customer</Table.Th>
              <Table.Th>Items</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Refund</Table.Th>
              <Table.Th>Paid out</Table.Th>
              <Table.Th>Reason</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {returns.map((ret) => (
              <Table.Tr key={ret._id}>
                <Table.Td style={{ whiteSpace: 'nowrap' }}>{new Date(ret.createdAt).toLocaleString()}</Table.Td>
                <Table.Td fw={600}>{ret.returnNo}</Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light" color={ret.type === 'invoice' ? 'blue' : 'grape'}>{ret.type === 'invoice' ? 'Invoice' : 'Open'}</Badge>
                </Table.Td>
                <Table.Td>{ret.invoiceId || '—'}</Table.Td>
                <Table.Td>{ret.customerName || '—'}</Table.Td>
                <Table.Td>
                  {ret.items.map((item, i) => (
                    <Text key={i} size="xs">
                      {item.quantity} × {item.name} @ {formatMoney(item.unitPrice)}{item.discountPct ? ` (−${item.discountPct}%)` : ''}
                    </Text>
                  ))}
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }} fw={700}>{formatMoney(ret.total)}</Table.Td>
                <Table.Td><Text size="xs">{describeRefund(ret, formatMoney)}</Text></Table.Td>
                <Table.Td><Text size="xs" c={ret.reason ? undefined : 'dimmed'}>{ret.reason || '—'}</Text></Table.Td>
              </Table.Tr>
            ))}
            {returns.length === 0 && (
              <Table.Tr><Table.Td colSpan={9}><Text ta="center" c="dimmed" py="md">{debounced ? `No return matches "${debounced}".` : 'No returns yet.'}</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

export default function ProductReturns() {
  const [tab, setTab] = useState<string | null>('invoice');
  /** Bumped after each saved return, so the history reloads. */
  const [refreshKey, setRefreshKey] = useState(0);
  const saved = () => setRefreshKey((key) => key + 1);

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Product Return</Title>
        <Text size="sm" c="dimmed">Returned items go back into stock. Credit sales can be refunded to the customer's account.</Text>
      </div>
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="invoice" leftSection={<IconFileInvoice size={16} />}>Invoice Return</Tabs.Tab>
          <Tabs.Tab value="open" leftSection={<IconArrowBackUp size={16} />}>Open Return</Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>Return History</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="invoice" pt="md"><InvoiceReturn onSaved={saved} /></Tabs.Panel>
        <Tabs.Panel value="open" pt="md"><OpenReturn onSaved={saved} /></Tabs.Panel>
        <Tabs.Panel value="history" pt="md"><ReturnHistory refreshKey={refreshKey} /></Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
