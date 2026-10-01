import { Paper, Title, Text, Table, Button, Badge, Stack, Group, Select, TextInput, CloseButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import api from '../../services/api';
import { IconEye, IconSearch } from '@tabler/icons-react';
import { formatMoney } from '../../utils/money';
import ReceiptViewer from '../printing/ReceiptViewer';

const Receipts = () => {
  const currentDate = new Date();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [month, setMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [year, setYear] = useState<string>(currentDate.getFullYear().toString());
  const [search, setSearch] = useState('');
  // Waits for a pause in typing, so each keystroke does not query every receipt.
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const searching = debouncedSearch.length > 0;
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    // Ignores a reply that arrives after the search or month has changed again.
    let current = true;
    setLoading(true);
    // A receipt ID search covers every receipt, so the month and year are left out.
    const params = searching ? { search: debouncedSearch } : { month, year };
    api.get('/orders', { params })
      .then(({ data }) => { if (current) setReceipts(data.data); })
      .catch((error) => console.error('Error fetching receipts:', error))
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [month, year, debouncedSearch, searching]);

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => ({
    value: (currentDate.getFullYear() - i).toString(),
    label: (currentDate.getFullYear() - i).toString(),
  }));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Receipt Management</Title>
        <Group align="flex-end">
          <TextInput
            label="Search Receipt ID"
            placeholder="e.g. INV-1024"
            leftSection={<IconSearch size={16} />}
            rightSection={search ? <CloseButton size="sm" aria-label="Clear search" onClick={() => setSearch('')} /> : null}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={240}
          />
          <Select
            label="Month"
            data={months}
            value={month}
            onChange={(val) => setMonth(val as string)}
            w={150}
            disabled={searching}
          />
          <Select
            label="Year"
            data={years}
            value={year}
            onChange={(val) => setYear(val as string)}
            w={100}
            disabled={searching}
          />
        </Group>
      </Group>

      {searching && (
        <Text size="sm" c="dimmed">
          {loading
            ? 'Searching all receipts…'
            : `${receipts.length} receipt${receipts.length !== 1 ? 's' : ''} matching "${debouncedSearch}" across all months`}
        </Text>
      )}

      <Paper withBorder radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Receipt ID</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {receipts.map((rec) => (
              <Table.Tr key={rec._id}>
                <Table.Td fw={500}>{rec.invoiceId || 'N/A'}</Table.Td>
                <Table.Td>{new Date(rec.createdAt).toLocaleString()}</Table.Td>
                <Table.Td fw={700}>{formatMoney(rec.total)}</Table.Td>
                <Table.Td><Badge color="green" variant="light">PAID</Badge></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    leftSection={<IconEye size={14} />}
                    onClick={() => {
                      setSelectedReceipt(rec);
                      setModalOpened(true);
                    }}
                  >
                    View
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
            {receipts.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} ta="center" py="xl">
                  <Text c="dimmed">
                    {searching ? `No receipt ID matches "${debouncedSearch}".` : 'No receipts found for this period.'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Receipt Detail: fills the screen so the whole receipt is readable. */}
      <ReceiptViewer order={selectedReceipt} opened={modalOpened} onClose={() => setModalOpened(false)} />
    </Stack>
  );
};

export default Receipts;
