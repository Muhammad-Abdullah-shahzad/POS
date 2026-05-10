import { Paper, Title, Text, Table, Button, Modal, Badge, Stack, Group, Divider } from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { IconReceipt2, IconEye, IconPrinter } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';

const Invoices = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  });

  const fetchInvoices = async () => {
    try {
      const { data } = await api.get('/orders');
      setInvoices(data.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Invoice Management</Title>
      </Group>

      <Paper withBorder radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice ID</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.map((inv) => (
              <Table.Tr key={inv._id}>
                <Table.Td fw={500}>{inv.invoiceId || 'N/A'}</Table.Td>
                <Table.Td>{new Date(inv.createdAt).toLocaleString()}</Table.Td>
                <Table.Td fw={700}>${inv.total.toFixed(2)}</Table.Td>
                <Table.Td><Badge color="green" variant="light">PAID</Badge></Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Button 
                    variant="subtle" 
                    size="xs" 
                    leftSection={<IconEye size={14} />}
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setModalOpened(true);
                    }}
                  >
                    View
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Invoice Detail Modal */}
      <Modal 
        opened={modalOpened} 
        onClose={() => setModalOpened(false)} 
        title="Invoice Details" 
        size="lg"
      >
        {selectedInvoice && (
          <Stack gap="md">
            <div ref={printRef} style={{ padding: '20px', fontFamily: 'Courier, monospace' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <Title order={3}>STORE POS - RECEIPT</Title>
                <Text size="xs">123 Business Road, Commerce City</Text>
              </div>
              
              <Divider mb="sm" />
              
              <Group justify="space-between" mb="xs">
                <Text size="sm"><strong>Receipt #:</strong> {selectedInvoice.invoiceId}</Text>
                <Text size="sm"><strong>Date:</strong> {new Date(selectedInvoice.createdAt).toLocaleString()}</Text>
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
                  {selectedInvoice.items.map((item: any, idx: number) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{item.name}</Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>{item.quantity}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>${item.totalPrice.toFixed(2)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Stack gap={4} align="flex-end">
                <Text size="sm">Subtotal: ${selectedInvoice.subtotal.toFixed(2)}</Text>
                <Text size="sm">Tax: ${selectedInvoice.totalVAT.toFixed(2)}</Text>
                <Text size="md" fw={700}>TOTAL: ${selectedInvoice.total.toFixed(2)}</Text>
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

export default Invoices;
