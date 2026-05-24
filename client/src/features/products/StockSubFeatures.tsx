import { useState } from 'react';
import { 
  Paper, Text, Title, Grid, Table, Badge, Button, Group, Stack, 
  TextInput, Select, NumberInput, Card, SimpleGrid, Modal
} from '@mantine/core';
import { 
  IconCash, IconPrinter, IconPlus, IconTruck, 
  IconClipboardList, IconAlertCircle, IconCalendar, IconUser, IconHash,
  IconTrash
} from '@tabler/icons-react';

// ==========================================
// 1. SUPPLIER PAYMENTS
// ==========================================
export interface SupplierPayment {
  id: string;
  supplier: string;
  invoiceNo: string;
  amount: number;
  paid: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  date: string;
}

export const SupplierPayments = () => {
  const [payments, setPayments] = useState<SupplierPayment[]>([
    { id: '1', supplier: 'Sufi Oil Mill', invoiceNo: 'INV-2026-08', amount: 45000, paid: 30000, balance: 15000, status: 'Partial', date: '2026-05-10' },
    { id: '2', supplier: 'National Foods Ltd', invoiceNo: 'INV-2026-14', amount: 82000, paid: 82000, balance: 0, status: 'Paid', date: '2026-05-15' },
    { id: '3', supplier: 'Korangi Packaging', invoiceNo: 'INV-2026-03', amount: 12500, paid: 0, balance: 12500, status: 'Unpaid', date: '2026-05-18' },
  ]);

  // Modal control states
  const [newPaymentModalOpened, setNewPaymentModalOpened] = useState(false);
  const [payoutModalOpened, setPayoutModalOpened] = useState(false);
  const [viewDetailsOpened, setViewDetailsOpened] = useState(false);

  // Form states for Recording a New Invoice / Payment
  const [newSupplier, setNewSupplier] = useState('');
  const [newInvoiceNo, setNewInvoiceNo] = useState('');
  const [newAmount, setNewAmount] = useState<number | string>(0);
  const [newPaid, setNewPaid] = useState<number | string>(0);
  const [newDate, setNewDate] = useState(new Date().toISOString().substring(0, 10));

  // States for Recording a Payout against an invoice
  const [selectedPayment, setSelectedPayment] = useState<SupplierPayment | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number | string>(0);

  // Derived metrics
  const totalOutstanding = payments.reduce((acc, p) => acc + p.balance, 0);
  const totalPaid = payments.reduce((acc, p) => acc + p.paid, 0);
  const activeSuppliers = new Set(payments.map(p => p.supplier)).size;
  const pendingInvoicesCount = payments.filter(p => p.balance > 0).length;

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(newAmount) || 0;
    const paidNum = Number(newPaid) || 0;
    const balanceNum = Math.max(0, amountNum - paidNum);
    
    let statusVal: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
    if (paidNum >= amountNum) statusVal = 'Paid';
    else if (paidNum > 0) statusVal = 'Partial';

    const newPaymentItem: SupplierPayment = {
      id: String(Date.now()),
      supplier: newSupplier || 'Unknown Supplier',
      invoiceNo: newInvoiceNo || `INV-GEN-${Date.now().toString().slice(-4)}`,
      amount: amountNum,
      paid: paidNum,
      balance: balanceNum,
      status: statusVal,
      date: newDate,
    };

    setPayments([newPaymentItem, ...payments]);
    setNewPaymentModalOpened(false);

    // Reset Form
    setNewSupplier('');
    setNewInvoiceNo('');
    setNewAmount(0);
    setNewPaid(0);
    setNewDate(new Date().toISOString().substring(0, 10));
  };

  const handleRecordPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;

    const payoutNum = Number(payoutAmount) || 0;
    const newPaidNum = selectedPayment.paid + payoutNum;
    const newBalanceNum = Math.max(0, selectedPayment.amount - newPaidNum);

    let statusVal: 'Paid' | 'Partial' | 'Unpaid' = 'Unpaid';
    if (newPaidNum >= selectedPayment.amount) statusVal = 'Paid';
    else if (newPaidNum > 0) statusVal = 'Partial';

    setPayments(payments.map(p => {
      if (p.id === selectedPayment.id) {
        return {
          ...p,
          paid: newPaidNum,
          balance: newBalanceNum,
          status: statusVal
        };
      }
      return p;
    }));

    setPayoutModalOpened(false);
    setSelectedPayment(null);
    setPayoutAmount(0);
  };

  const handleDeletePayment = (id: string) => {
    if (window.confirm("Are you sure you want to delete this supplier payment record?")) {
      setPayments(prev => prev.filter(p => p.id !== id));
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Supplier Payments Ledger</Title>
          <Text size="sm" c="dimmed">Track outstanding liabilities, payment schedules, and history for all suppliers.</Text>
        </div>
        <Button 
          leftSection={<IconPlus size={16} />} 
          color="teal"
          onClick={() => setNewPaymentModalOpened(true)}
        >
          Record Payment
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Outstanding Balance</Text>
            <IconAlertCircle size={20} style={{ color: 'var(--mantine-color-red-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">€ {totalOutstanding.toLocaleString()}</Text>
          <Text size="xs" c={pendingInvoicesCount > 0 ? 'red' : 'green'} mt="xs" fw={500}>
            {pendingInvoicesCount} Invoice{pendingInvoicesCount !== 1 ? 's' : ''} Pending
          </Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Paid to Suppliers</Text>
            <IconCash size={20} style={{ color: 'var(--mantine-color-green-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">€ {totalPaid.toLocaleString()}</Text>
          <Text size="xs" c="green" mt="xs" fw={500}>All clear payouts</Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Active Suppliers</Text>
            <IconTruck size={20} style={{ color: 'var(--mantine-color-blue-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">{activeSuppliers} Supplier{activeSuppliers !== 1 ? 's' : ''}</Text>
          <Text size="xs" c="dimmed" mt="xs">With active trade accounts</Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Supplier Name</Table.Th>
              <Table.Th>Invoice No</Table.Th>
              <Table.Th>Total Amount</Table.Th>
              <Table.Th>Amount Paid</Table.Th>
              <Table.Th>Remaining Balance</Table.Th>
              <Table.Th>Payment Status</Table.Th>
              <Table.Th>Invoice Date</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {payments.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td fw={500}>{row.supplier}</Table.Td>
                <Table.Td>{row.invoiceNo}</Table.Td>
                <Table.Td>€ {row.amount.toLocaleString()}</Table.Td>
                <Table.Td c="green">€ {row.paid.toLocaleString()}</Table.Td>
                <Table.Td c={row.balance > 0 ? 'red' : 'dimmed'} fw={row.balance > 0 ? 600 : 400}>
                  € {row.balance.toLocaleString()}
                </Table.Td>
                <Table.Td>
                  <Badge 
                    color={
                      row.status === 'Paid' ? 'green' : 
                      row.status === 'Partial' ? 'yellow' : 'red'
                    } 
                    variant="light"
                  >
                    {row.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{row.date}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Group gap="xs" justify="flex-end">
                    <Button 
                      size="xs" 
                      variant="light" 
                      color={row.status === 'Paid' ? 'gray' : 'blue'}
                      onClick={() => {
                        setSelectedPayment(row);
                        if (row.status === 'Paid') {
                          setViewDetailsOpened(true);
                        } else {
                          setPayoutAmount(row.balance);
                          setPayoutModalOpened(true);
                        }
                      }}
                    >
                      {row.status === 'Paid' ? 'View Details' : 'Record Payout'}
                    </Button>
                    <Button 
                      size="xs" 
                      variant="subtle" 
                      color="red"
                      onClick={() => handleDeletePayment(row.id)}
                      title="Delete payment record"
                    >
                      <IconTrash size={16} />
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* 1. Modal: Record New Payment/Invoice */}
      <Modal
        opened={newPaymentModalOpened}
        onClose={() => setNewPaymentModalOpened(false)}
        title={<Text size="lg" fw={700}>Record Supplier Invoice & Payment</Text>}
        centered
        size="md"
      >
        <form onSubmit={handleRecordPayment}>
          <Stack gap="md">
            <TextInput
              label="Supplier Name"
              placeholder="e.g. Sufi Oil Mill"
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              required
              leftSection={<IconUser size={16} />}
            />
            <TextInput
              label="Invoice Number"
              placeholder="e.g. INV-2026-99"
              value={newInvoiceNo}
              onChange={(e) => setNewInvoiceNo(e.target.value)}
              required
              leftSection={<IconHash size={16} />}
            />
            <SimpleGrid cols={2}>
              <NumberInput
                label="Total Invoice Amount (€)"
                placeholder="0"
                min={0}
                value={newAmount}
                onChange={(val) => setNewAmount(val)}
                required
              />
              <NumberInput
                label="Amount Paid (€)"
                placeholder="0"
                min={0}
                value={newPaid}
                onChange={(val) => setNewPaid(val)}
                required
              />
            </SimpleGrid>
            <TextInput
              type="date"
              label="Invoice Date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              leftSection={<IconCalendar size={16} />}
            />
            
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="gray" onClick={() => setNewPaymentModalOpened(false)}>Cancel</Button>
              <Button type="submit" color="teal">Save Invoice</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* 2. Modal: Record Payout against Pending Balance */}
      <Modal
        opened={payoutModalOpened}
        onClose={() => {
          setPayoutModalOpened(false);
          setSelectedPayment(null);
        }}
        title={<Text size="lg" fw={700}>Record Payout - {selectedPayment?.supplier}</Text>}
        centered
        size="sm"
      >
        {selectedPayment && (
          <form onSubmit={handleRecordPayout}>
            <Stack gap="md">
              <Paper withBorder p="sm" bg="var(--mantine-color-gray-0)" radius="md">
                <Text size="xs" c="dimmed">Invoice Number</Text>
                <Text fw={600} size="sm">{selectedPayment.invoiceNo}</Text>
                
                <SimpleGrid cols={2} mt="xs">
                  <div>
                    <Text size="xs" c="dimmed">Total Amount</Text>
                    <Text fw={600} size="sm">€ {selectedPayment.amount.toLocaleString()}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Remaining Balance</Text>
                    <Text fw={600} size="sm" c="red">€ {selectedPayment.balance.toLocaleString()}</Text>
                  </div>
                </SimpleGrid>
              </Paper>

              <NumberInput
                label="Payout Amount (€)"
                placeholder="Enter amount to pay"
                min={1}
                max={selectedPayment.balance}
                value={payoutAmount}
                onChange={(val) => setPayoutAmount(val)}
                required
              />

              <Group justify="flex-end" mt="md">
                <Button variant="subtle" color="gray" onClick={() => {
                  setPayoutModalOpened(false);
                  setSelectedPayment(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" color="blue">Confirm Payout</Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      {/* 3. Modal: View Paid Invoice Details */}
      <Modal
        opened={viewDetailsOpened}
        onClose={() => {
          setViewDetailsOpened(false);
          setSelectedPayment(null);
        }}
        title={<Text size="lg" fw={700}>Invoice Details - {selectedPayment?.supplier}</Text>}
        centered
        size="sm"
      >
        {selectedPayment && (
          <Stack gap="md">
            <Paper withBorder p="md" bg="var(--mantine-color-green-0)" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed">Payment Status</Text>
                  <Badge color="green" variant="filled">Fully Paid</Badge>
                </div>
                <IconCash size={32} style={{ color: 'var(--mantine-color-green-filled)' }} />
              </Group>
            </Paper>

            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="xs" c="dimmed">Invoice Number</Text>
                <Text fw={600}>{selectedPayment.invoiceNo}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Invoice Date</Text>
                <Text fw={600}>{selectedPayment.date}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Total Invoice Amount</Text>
                <Text fw={600}>€ {selectedPayment.amount.toLocaleString()}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Total Paid Amount</Text>
                <Text fw={600} c="green">€ {selectedPayment.paid.toLocaleString()}</Text>
              </div>
            </SimpleGrid>

            <Group justify="flex-end" mt="md">
              <Button color="gray" onClick={() => {
                setViewDetailsOpened(false);
                setSelectedPayment(null);
              }}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
};

// ==========================================
// 2. MANAGE PRODUCT CODES
// ==========================================
export const ManageProductCodes = () => {
  const [selectedProduct, setSelectedProduct] = useState<string | null>('Sufi Cooking Oil (5L)');
  const [barcodePreview, setBarcodePreview] = useState('8901030753114');
  const [labelQty, setLabelQty] = useState(24);

  const productData = [
    { name: 'Sufi Cooking Oil (5L)', barcode: '8901030753114', sku: 'SOIL-5L', price: 2450 },
    { name: 'National Chili Sauce (250g)', barcode: '5010020300450', sku: 'NFOOD-CS250', price: 180 },
    { name: 'Tapal Danedar Tea (950g)', barcode: '8964000325411', sku: 'TTEA-950G', price: 920 },
  ];

  const handleProductChange = (val: string | null) => {
    setSelectedProduct(val);
    const match = productData.find(p => p.name === val);
    if (match) {
      setBarcodePreview(match.barcode);
    }
  };

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Product Codes & Barcode Printing</Title>
        <Text size="sm" c="dimmed">Generate product SKUs, assign barcodes, and print bulk product labels.</Text>
      </div>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Title order={4} mb="xs">Barcode Generator Settings</Title>
              <Select 
                label="Select Product" 
                placeholder="Choose product..."
                data={productData.map(p => p.name)}
                value={selectedProduct}
                onChange={handleProductChange}
                required
              />
              <SimpleGrid cols={2} spacing="sm">
                <TextInput 
                  label="Generated SKU" 
                  value={productData.find(p => p.name === selectedProduct)?.sku || ''} 
                  disabled 
                />
                <TextInput 
                  label="Barcode Number" 
                  value={barcodePreview} 
                  onChange={(e) => setBarcodePreview(e.target.value)}
                  required 
                />
              </SimpleGrid>

              <SimpleGrid cols={2} spacing="sm">
                <NumberInput 
                  label="Labels to Print (Qty)" 
                  min={1} 
                  max={500} 
                  value={labelQty}
                  onChange={(val) => setLabelQty(Number(val) || 1)}
                  required
                />
                <Select 
                  label="Paper Template Size" 
                  defaultValue="3-col-30" 
                  data={[
                    { label: '3-Column Barcode Sheet (A4 - 30 labels)', value: '3-col-30' },
                    { label: '2-Column Barcode Sheet (A4 - 24 labels)', value: '2-col-24' },
                    { label: 'Single Label (Thermal roll 50mm x 25mm)', value: 'single-thermal' },
                  ]}
                />
              </SimpleGrid>

              <Group justify="flex-end" mt="md">
                <Button variant="outline" leftSection={<IconClipboardList size={16} />}>Export Code Sheet</Button>
                <Button color="blue" leftSection={<IconPrinter size={16} />}>Print Labels Now</Button>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm" align="center">
              <Title order={4} style={{ width: '100%' }} ta="left">Label Print Preview</Title>
              <Text size="xs" c="dimmed" style={{ width: '100%' }} ta="left">
                Simulated appearance on the selected paper template.
              </Text>
              
              <Card withBorder radius="md" p="md" style={{ width: '100%', maxWidth: 280, borderStyle: 'dashed' }} bg="var(--mantine-color-gray-0)">
                <Stack gap="xs" align="center" ta="center">
                  <Text fw={700} size="sm" truncate>{selectedProduct}</Text>
                  
                  {/* Mock Barcode Graphic */}
                  <Stack gap={2} align="center" style={{ width: '100%' }} my="xs">
                    <div style={{ display: 'flex', width: '100%', height: 60, justifyContent: 'center', alignItems: 'flex-end', gap: '2px' }}>
                      {barcodePreview.split('').map((char, index) => (
                        <div 
                          key={index} 
                          style={{ 
                            width: (Number(char) % 3 === 0 ? '4px' : Number(char) % 2 === 0 ? '2px' : '1px'), 
                            height: '100%', 
                            backgroundColor: 'black' 
                          }} 
                        />
                      ))}
                    </div>
                    <Text size="xs" fw={500} style={{ letterSpacing: 2 }}>{barcodePreview}</Text>
                  </Stack>

                  <Group justify="space-between" style={{ width: '100%' }} mt="xs">
                    <Text size="xs" fw={700}>SKU: {productData.find(p => p.name === selectedProduct)?.sku}</Text>
                    <Text size="xs" fw={700} c="blue">€ {productData.find(p => p.name === selectedProduct)?.price.toLocaleString()}</Text>
                  </Group>
                </Stack>
              </Card>
              <Text size="xs" c="dimmed" fs="italic">Standard GS1 EAN-13 format preview</Text>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
};
