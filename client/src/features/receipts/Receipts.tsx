import { Paper, Title, Text, Table, Button, Modal, Badge, Stack, Group, Divider, Select } from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { IconEye, IconPrinter } from '@tabler/icons-react';
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
                <Table.Td fw={700}>€ {rec.total.toFixed(2)}</Table.Td>
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
            <div ref={printRef} style={{ width: '300px', padding: '8px', boxSizing: 'border-box', margin: '0 auto', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', fontSize: '12px', fontWeight: 500, lineHeight: 1.4, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '1px solid #000', paddingBottom: '12px' }}>
                <Title order={3} style={{ margin: '0 0 4px', fontSize: '20px', fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 'bold', letterSpacing: 0, textTransform: 'uppercase' }}>Castlebar Halal Foods</Title>
              </div>
              
              <Divider mb="sm" color="dark" size="md" />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', fontSize: '10px', color: '#333' }}>
                <p style={{ margin: '2px 0' }}><strong>Receipt #:</strong> {selectedReceipt.invoiceId}</p>
                <p style={{ margin: '2px 0' }}><strong>Date:</strong> {new Date(selectedReceipt.createdAt).toLocaleString()}</p>
              </div>

              <Table withTableBorder withColumnBorders mb="md" style={{ fontSize: '11px' }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: '50%', textAlign: 'left', padding: '4px 0', fontWeight: 'bold' }}>Item</Table.Th>
                    <Table.Th style={{ width: '10%', textAlign: 'center', padding: '4px 0', fontWeight: 'bold' }}>Qty</Table.Th>
                    <Table.Th style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>Price</Table.Th>
                    <Table.Th style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                   {selectedReceipt.items.map((item: any, idx: number) => (
                    <Table.Tr key={idx}>
                      <Table.Td style={{ width: '50%', textAlign: 'left', padding: '6px 0', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 'bold', color: '#000' }}>{item.name}</div>
                        {item.discountAmt > 0 && (
                          <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>
                            Discount: {item.discountPct > 0 ? `-${item.discountPct}% ` : ''}(-€{item.discountAmt.toFixed(2)})
                          </div>
                        )}
                        {item.drs > 0 && (
                          <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>
                            DRS Deposit: +€{(item.drs * item.quantity).toFixed(2)}
                          </div>
                        )}
                      </Table.Td>
                      <Table.Td style={{ width: '10%', textAlign: 'center', padding: '6px 0', verticalAlign: 'top' }}>{item.quantity}</Table.Td>
                      <Table.Td style={{ width: '20%', textAlign: 'right', padding: '6px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>€ {(item.price || 0).toFixed(2)}</Table.Td>
                      <Table.Td style={{ width: '20%', textAlign: 'right', padding: '6px 0', verticalAlign: 'top', fontWeight: 'bold', whiteSpace: 'nowrap' }}>€ {(item.finalPrice || item.totalPrice).toFixed(2)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <div style={{ width: '100%', fontSize: '11px', color: '#333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>Subtotal:</span>
                  <span style={{ whiteSpace: 'nowrap' }}>€ {selectedReceipt.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>Tax:</span>
                  <span style={{ whiteSpace: 'nowrap' }}>€ {selectedReceipt.totalVAT.toFixed(2)}</span>
                </div>
                {selectedReceipt.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#000' }}>
                    <span>Discount:</span>
                    <span style={{ whiteSpace: 'nowrap' }}>- € {selectedReceipt.discount.toFixed(2)}</span>
                  </div>
                )}
                {selectedReceipt.totalDRS > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>Total DRS:</span>
                    <span style={{ whiteSpace: 'nowrap' }}>€ {selectedReceipt.totalDRS.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', borderTop: '1px solid #000', fontWeight: 'bold', fontSize: '15px', color: '#000' }}>
                  <span>TOTAL:</span>
                  <span style={{ whiteSpace: 'nowrap' }}>€ {selectedReceipt.total.toFixed(2)}</span>
                </div>
              </div>
              
              <Text ta="center" mt="xl" size="xs" c="dimmed">THANK YOU FOR YOUR BUSINESS!</Text>
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
