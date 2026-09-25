import { useState, useEffect } from 'react';
import { Button, Grid, Paper, Text, Table, Modal, Group, Title, Badge, Stack, NumberInput, Tabs, TextInput, Box, Divider, Alert } from '@mantine/core';
import { IconReceipt, IconCash, IconUser, IconPhone, IconMail, IconMapPin, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { currencySymbol, formatMoney } from '../../utils/money';

interface CustomerProfileProps {
  customer: any;
  opened: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const CustomerProfile = ({ customer, opened, onClose, onUpdate }: CustomerProfileProps) => {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [customerData, setCustomerData] = useState<any>(customer);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    setCustomerData(customer);
  }, [customer]);

  useEffect(() => {
    if (opened && customer?._id) {
      fetchLedger();
    }
  }, [opened, customer]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/customers/${customer._id}/ledger`);
      if (data.success) {
        setOrders(data.data.orders || []);
        setPayments(data.data.payments || []);
        if (data.data.customer) {
          setCustomerData(data.data.customer);
        }
      }
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const handleReceivePayment = async () => {
    const amount = Number(paymentAmount) || 0;
    if (amount <= 0) {
      notifications.show({ title: 'Invalid Amount', message: 'Please enter a valid payment amount.', color: 'red' });
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/customers/${customerData._id}/payments`, {
        amountPaid: amount,
        paymentMethod,
        customerName: customerData.name,
        notes: paymentNotes,
      });

      const updatedCust = res.data?.data?.customer;
      const newBalance = updatedCust ? updatedCust.outstandingBalance : Math.max(0, (customerData.outstandingBalance || 0) - amount);

      setCustomerData((prev: any) => ({
        ...prev,
        outstandingBalance: newBalance,
      }));

      notifications.show({
        title: 'Payment Received',
        message: `Successfully received ${formatMoney(amount)}. Remaining balance: ${formatMoney(newBalance)}.`,
        color: 'green',
        icon: <IconCheck size={16} />
      });

      setPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchLedger();
      onUpdate(); // refresh customer list in background
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  if (!customerData) return null;

  const currentOutstanding = customerData.outstandingBalance || 0;
  const numPayAmount = Number(paymentAmount) || 0;
  const remainingAfterPayment = Math.max(0, currentOutstanding - numPayAmount);

  return (
    <Modal opened={opened} onClose={onClose} title={<Title order={4}>Customer Profile — {customerData.name}</Title>} size="xl" centered>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconUser size={14} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="orders" leftSection={<IconReceipt size={14} />}>Purchase History ({orders.length})</Tabs.Tab>
          <Tabs.Tab value="payments" leftSection={<IconCash size={14} />}>Payment Ledger ({payments.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Grid>
            <Grid.Col span={4}>
              <Paper withBorder p="md" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Outstanding Balance</Text>
                <Text size="xl" fw={800} c={currentOutstanding > 0 ? 'red' : 'green'}>
                  {formatMoney(currentOutstanding)}
                </Text>
                <Button 
                  mt="md" fullWidth color="dark" 
                  onClick={() => {
                    setPaymentAmount('');
                    setPaymentNotes('');
                    setPaymentModal(true);
                  }}
                  disabled={currentOutstanding <= 0}
                >
                  Receive Payment
                </Button>
                {currentOutstanding > 0 && (
                  <Text size="xs" c="dimmed" mt={6} ta="center">
                    Accept full or partial installment payment
                  </Text>
                )}
              </Paper>
            </Grid.Col>
            
            <Grid.Col span={8}>
              <Paper withBorder p="md" radius="md" h="100%">
                <Text fw={600} mb="sm">Contact Info</Text>
                <Stack gap="xs">
                  <Group gap="xs"><IconUser size={16} /><Text size="sm">{customerData.name}</Text></Group>
                  <Group gap="xs"><IconPhone size={16} /><Text size="sm">{customerData.contactNum1} {customerData.contactNum2 && `, ${customerData.contactNum2}`}</Text></Group>
                  {customerData.email && <Group gap="xs"><IconMail size={16} /><Text size="sm">{customerData.email}</Text></Group>}
                  {customerData.address && <Group gap="xs"><IconMapPin size={16} /><Text size="sm">{customerData.address} {customerData.eircode}</Text></Group>}
                </Stack>
                
                <Grid mt="lg">
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Opening Balance</Text>
                    <Text fw={500}>{formatMoney(customerData.openingBalance || 0)}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Credit Limit</Text>
                    <Text fw={500}>{(customerData.creditLimit || 0) > 0 ? formatMoney(customerData.creditLimit) : 'No Limit'}</Text>
                  </Grid.Col>
                  <Grid.Col span={4}>
                    <Text size="xs" c="dimmed">Total Spent</Text>
                    <Text fw={500}>{formatMoney(customerData.totalAmount || 0)}</Text>
                  </Grid.Col>
                </Grid>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="orders" pt="md">
          <Table.ScrollContainer minWidth={600}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Invoice #</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th>Payment Method</Table.Th>
                  <Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? <Table.Tr><Table.Td colSpan={5} align="center">Loading...</Table.Td></Table.Tr> : null}
                {!loading && orders.length === 0 ? <Table.Tr><Table.Td colSpan={5} align="center">No orders found.</Table.Td></Table.Tr> : null}
                {orders.map(o => (
                  <Table.Tr key={o._id}>
                    <Table.Td>{new Date(o.createdAt).toLocaleDateString()} {new Date(o.createdAt).toLocaleTimeString()}</Table.Td>
                    <Table.Td>{o.invoiceId}</Table.Td>
                    <Table.Td>{o.items?.length || 0} items</Table.Td>
                    <Table.Td><Badge color={o.paymentMethod === 'credit' ? 'red' : 'green'}>{o.paymentMethod}</Badge></Table.Td>
                    <Table.Td fw={600}>{formatMoney(o.total)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>

        <Tabs.Panel value="payments" pt="md">
          <Table.ScrollContainer minWidth={600}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Notes</Table.Th>
                  <Table.Th>Amount Paid</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? <Table.Tr><Table.Td colSpan={4} align="center">Loading...</Table.Td></Table.Tr> : null}
                {!loading && payments.length === 0 ? <Table.Tr><Table.Td colSpan={4} align="center">No payments recorded yet.</Table.Td></Table.Tr> : null}
                {payments.map(p => (
                  <Table.Tr key={p._id}>
                    <Table.Td>{new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString()}</Table.Td>
                    <Table.Td><Badge color="blue">{p.paymentMethod}</Badge></Table.Td>
                    <Table.Td>{p.notes || '—'}</Table.Td>
                    <Table.Td fw={600} c="green">+{formatMoney(p.amountPaid)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Tabs.Panel>
      </Tabs>

      {/* Payment Modal */}
      <Modal 
        opened={paymentModal} 
        onClose={() => setPaymentModal(false)} 
        title={<Text fw={700} size="md">Receive Customer Payment</Text>} 
        centered 
        size="md"
      >
        <Stack gap="sm">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" p="xs">
            <Text size="xs">
              Partial installment payments are supported (e.g. pay 400, then 300, then 800). Each payment is logged into the ledger and reduces the total debt.
            </Text>
          </Alert>

          <Paper withBorder p="xs" radius="sm" bg="gray.0">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Current Balance Owed:</Text>
              <Text size="md" fw={700} c="red">{formatMoney(currentOutstanding)}</Text>
            </Group>
          </Paper>

          <NumberInput
            label="Amount to Receive"
            placeholder="e.g. 400"
            value={paymentAmount}
            onChange={v => setPaymentAmount(v ?? '')}
            min={0}
            max={currentOutstanding}
            decimalScale={2}
            leftSection={<Text size="sm" fw={700}>{currencySymbol()}</Text>}
            size="md"
          />

          <Group gap="xs">
            <Button 
              size="xs" 
              variant="outline" 
              color="dark" 
              onClick={() => setPaymentAmount(currentOutstanding)}
            >
              Pay Full ({formatMoney(currentOutstanding)})
            </Button>
            {currentOutstanding > 500 && (
              <>
                <Button size="xs" variant="subtle" color="gray" onClick={() => setPaymentAmount(100)}>+100</Button>
                <Button size="xs" variant="subtle" color="gray" onClick={() => setPaymentAmount(200)}>+200</Button>
                <Button size="xs" variant="subtle" color="gray" onClick={() => setPaymentAmount(500)}>+500</Button>
              </>
            )}
          </Group>

          {numPayAmount > 0 && (
            <Paper withBorder p="xs" radius="sm" bg={remainingAfterPayment === 0 ? 'green.0' : 'blue.0'}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Remaining Balance After Payment:</Text>
                <Text size="sm" fw={700} c={remainingAfterPayment === 0 ? 'green' : 'blue'}>
                  {formatMoney(remainingAfterPayment)} {remainingAfterPayment === 0 ? '(Fully Cleared!)' : ''}
                </Text>
              </Group>
            </Paper>
          )}

          <Divider my={4} />

          <Text size="xs" fw={600} c="dimmed">PAYMENT METHOD</Text>
          <Group grow>
            <Button variant={paymentMethod === 'cash' ? 'filled' : 'outline'} color="dark" onClick={() => setPaymentMethod('cash')}>Cash</Button>
            <Button variant={paymentMethod === 'card' ? 'filled' : 'outline'} color="dark" onClick={() => setPaymentMethod('card')}>Card</Button>
          </Group>

          <TextInput
            label="Notes / Reference (Optional)"
            placeholder="e.g. Installment 1 of 3, Cheque #, etc."
            value={paymentNotes}
            onChange={e => setPaymentNotes(e.currentTarget.value)}
            size="sm"
          />

          <Button 
            fullWidth 
            color="dark" 
            onClick={handleReceivePayment} 
            loading={loading}
            disabled={numPayAmount <= 0}
            mt="xs"
          >
            Confirm {numPayAmount > 0 ? formatMoney(numPayAmount) : ''} Payment
          </Button>
        </Stack>
      </Modal>
    </Modal>
  );
};
