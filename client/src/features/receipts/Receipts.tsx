import { Paper, Title, Text, Table, Button, Modal, Badge, Stack, Group, Select } from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { IconEye, IconPrinter } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import { formatMoney } from '../../utils/money';
import { useSettingsStore } from '../../store/settingsStore';
import PrintableSaleDocument from '../printing/PrintableSaleDocument';
import { printPageStyle } from '../printing/printPageStyle';
import { printableSaleFromOrder } from '../printing/printableSaleFromOrder';
import { useShopDetails } from '../printing/useShopDetails';

const Receipts = () => {
  const currentDate = new Date();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [month, setMonth] = useState<string>((currentDate.getMonth() + 1).toString());
  const [year, setYear] = useState<string>(currentDate.getFullYear().toString());
  const printRef = useRef<HTMLDivElement>(null);
  // Reprints follow the paper size set in Settings, like the till does.
  const settings = useSettingsStore((state) => state.settings);
  const receiptSize: 'Thermal' | 'A4' = settings?.receiptSize === 'A4' ? 'A4' : 'Thermal';
  const shop = useShopDetails();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    pageStyle: printPageStyle(receiptSize),
    // Receipts carry inline styles only; skipping the app's stylesheets opens the print window faster.
    ignoreGlobalStyles: true,
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
            <div style={{ overflowX: 'auto' }}>
              <div ref={printRef}>
                <PrintableSaleDocument
                  sale={printableSaleFromOrder(selectedReceipt)}
                  shop={shop}
                  size={receiptSize}
                />
              </div>
            </div>

            <Button fullWidth leftSection={<IconPrinter size={16} />} onClick={() => handlePrint()}>
              Print {receiptSize === 'A4' ? 'Invoice (A4)' : 'Receipt'}
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

export default Receipts;
