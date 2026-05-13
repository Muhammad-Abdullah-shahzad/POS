import { Paper, Title, Text, Table, Button, Modal, Badge, Stack, Group, Divider, Select } from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { IconReceipt2, IconEye, IconPrinter } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';

const Receipts = () => {
  const currentDate = new Date();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [month, setMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [year, setYear] = useState<string>(currentDate.getFullYear().toString());
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const fetchReceipts = async () => {
    try {
      const { data } = await api.get('/orders', {
        params: { month, year }
      });
      setReceipts(data.data);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [month, year]);

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
        <Group>
          <Select
            label="Month"
            data={months}
            value={month}
            onChange={(val) => setMonth(val as string)}
            w={150}
          />
          <Select
            label="Year"
            data={years}
            value={year}
            onChange={(val) => setYear(val as string)}
            w={100}
          />
        </Group>
      </Group>

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
                <Table.Td fw={700}>Rs {rec.total.toFixed(2)}</Table.Td>
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
                  <Text c="dimmed">No receipts found for this period.</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Receipt Detail Modal */}
      <Modal 
        opened={modalOpened} 
        onClose={() => setModalOpened(false)} 
        title="Receipt Details" 
        size="lg"
      >
        {selectedReceipt && (
          <Stack gap="md">
            <div ref={printRef} style={{ padding: '20px', fontFamily: 'Courier, monospace' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <Title order={3}>STORE POS - RECEIPT</Title>
                <Text size="xs">123 Business Road, Commerce City</Text>
              </div>
              
              <Divider mb="sm" />
              
              <Group justify="space-between" mb="xs">
                <Text size="sm"><strong>Receipt #:</strong> {selectedReceipt.invoiceId}</Text>
                <Text size="sm"><strong>Date:</strong> {new Date(selectedReceipt.createdAt).toLocaleString()}</Text>
              </Group>

              <Table withTableBorder withColumnBorders mb="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Item</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedReceipt.items.map((item: any, idx: number) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{item.name}</Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>{item.quantity}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>Rs {item.totalPrice.toFixed(2)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Stack gap={4} align="flex-end">
                <Text size="sm">Subtotal: Rs {selectedReceipt.subtotal.toFixed(2)}</Text>
                <Text size="sm">Tax: Rs {selectedReceipt.totalVAT.toFixed(2)}</Text>
                <Text size="md" fw={700}>TOTAL: Rs {selectedReceipt.total.toFixed(2)}</Text>
              </Stack>
              
              <Text ta="center" mt="xl" size="xs">THANK YOU FOR YOUR BUSINESS!</Text>
            </div>

            <Button fullWidth leftSection={<IconPrinter size={16} />} onClick={() => handlePrint()}>
              Print Receipt
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default Receipts;
