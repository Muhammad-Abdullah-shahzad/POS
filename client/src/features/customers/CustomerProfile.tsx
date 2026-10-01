import { useState, useEffect } from 'react';
import { Button, Grid, Paper, Text, Table, Modal, Group, Title, Badge, Stack, NumberInput, Tabs, TextInput, Divider, Alert, SimpleGrid, Checkbox, List } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconReceipt, IconCash, IconUser, IconPhone, IconMail, IconMapPin, IconCheck, IconInfoCircle, IconEye, IconListDetails, IconTrash } from '@tabler/icons-react';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { currencySymbol, formatMoney } from '../../utils/money';
import ReceiptViewer from '../printing/ReceiptViewer';
import { useAuthStore } from '../../store/authStore';
import { ROUNDING_TOLERANCE, buildStatement, onAccountOf } from './accountStatement';
import StatementRow from './StatementRow';
import { deleteStatementLines, describeDeletion, isDeletable } from './deleteStatementLines';

interface CustomerProfileProps {
  customer: any;
  opened: boolean;
  onClose: () => void;
  onUpdate: () => void;
  /** Open straight on the payment form, as the customer list's Pay button does. */
  startWithPayment?: boolean;
}

export const CustomerProfile = ({ customer, opened, onClose, onUpdate, startWithPayment = false }: CustomerProfileProps) => {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [customerData, setCustomerData] = useState<any>(customer);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  /** Whether this customer's sales and payments have arrived; until then there is no statement. */
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  /** Managers and admins may correct the account statement in place. */
  const canEdit = useAuthStore((state) => state.user?.role === 'admin' || state.user?.role === 'manager');
  /** Statement lines ticked for deletion, by line key. */
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  /** The sale whose receipt is open, if any. */
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);

  useEffect(() => {
    setCustomerData(customer);
  }, [customer]);

  useEffect(() => {
    if (opened && customer?._id) {
      setLedgerLoaded(false);
      fetchLedger();
    }
  }, [opened, customer]);

  // Each time the profile opens it starts on the overview, or on the payment form when asked.
  useEffect(() => {
    if (!opened) return;
    setActiveTab(startWithPayment ? 'statement' : 'overview');
    setSelectedKeys(new Set());
    if (startWithPayment) {
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentMethod('cash');
      setPaymentModal(true);
    }
  }, [opened, startWithPayment]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/customers/${customer._id}/ledger`);
      if (data.success) {
        setOrders(data.data.orders || []);
        setPayments(data.data.payments || []);
        setReturns(data.data.returns || []);
        if (data.data.customer) {
          setCustomerData(data.data.customer);
        }
        setLedgerLoaded(true);
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
      // The desktop bridge prefixes its errors with the IPC channel; show only the reason.
      const message = e?.response?.data?.message
        || String(e?.message || 'Payment could not be recorded').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      notifications.show({ title: 'Error', message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  if (!customerData) return null;

  const statement = ledgerLoaded ? buildStatement(customerData, orders, payments, { alwaysShowOpening: canEdit, returns }) : [];

  /** After a correction: reload this account, and the customer list behind the dialog. */
  const reloadAfterCorrection = async () => {
    await fetchLedger();
    onUpdate();
  };

  const deletableLines = canEdit ? statement.filter(isDeletable) : [];
  const selectedLines = deletableLines.filter((line) => selectedKeys.has(line.key));
  const allSelected = deletableLines.length > 0 && selectedLines.length === deletableLines.length;

  const toggleSelected = (key: string) =>
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confirmDeleteSelected = () => {
    const lines = selectedLines;
    modals.openConfirmModal({
      title: `Delete ${lines.length} line${lines.length !== 1 ? 's' : ''} from ${customerData.name}'s account?`,
      centered: true,
      // Above the profile dialog it is opened from.
      zIndex: 1000,
      children: (
        <Stack gap="xs">
          <List size="sm" spacing={4}>
            {describeDeletion(lines, formatMoney).map((effect) => <List.Item key={effect}>{effect}</List.Item>)}
          </List>
          <Text size="xs" c="dimmed">Deleted payments cannot be brought back.</Text>
        </Stack>
      ),
      labels: { confirm: `Delete ${lines.length}`, cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setDeleting(true);
        try {
          const outcome = await deleteStatementLines({ _id: customerData._id, name: customerData.name }, lines);
          if (outcome.deleted.length > 0) {
            notifications.show({ title: 'Deleted', message: `${outcome.deleted.length} line(s) removed from the account.`, color: 'green', icon: <IconCheck size={16} /> });
          }
          for (const { line, reason } of outcome.failed) {
            notifications.show({ title: `${line.type} ${line.reference !== '—' ? line.reference : ''} not deleted`, message: reason, color: 'red' });
          }
          // Lines that failed stay ticked, so they can be retried or unticked.
          setSelectedKeys(new Set(outcome.failed.map(({ line }) => line.key)));
          await reloadAfterCorrection();
        } finally {
          setDeleting(false);
        }
      },
    });
  };
  const totals = statement.reduce(
    (sum, line) => ({
      sales: sum.sales + line.saleTotal,
      paidAtTill: sum.paidAtTill + line.paidAtTill,
      onAccount: sum.onAccount + line.onAccount,
      received: sum.received + line.received,
    }),
    { sales: 0, paidAtTill: 0, onAccount: 0, received: 0 }
  );

  const currentOutstanding = customerData.outstandingBalance || 0;
  const numPayAmount = Number(paymentAmount) || 0;
  const remainingAfterPayment = Math.max(0, currentOutstanding - numPayAmount);

  return (
    <Modal opened={opened} onClose={onClose} title={<Title order={4}>Customer Profile — {customerData.name}</Title>} size="90%" centered>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconUser size={14} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="statement" leftSection={<IconListDetails size={14} />}>Account Statement ({statement.length})</Tabs.Tab>
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

        <Tabs.Panel value="statement" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Purchases</Text>
                <Text fw={700} size="lg">{formatMoney(totals.sales)}</Text>
                <Text size="xs" c="dimmed">{orders.length} sale(s)</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Paid at Till</Text>
                <Text fw={700} size="lg" c="green.7">{formatMoney(totals.paidAtTill)}</Text>
                <Text size="xs" c="dimmed">Cash or card at the sale</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Put on Account</Text>
                <Text fw={700} size="lg" c="orange.8">{formatMoney(totals.onAccount)}</Text>
                <Text size="xs" c="dimmed">Credit given, incl. opening</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Payments Received</Text>
                <Text fw={700} size="lg" c="blue.7">{formatMoney(totals.received)}</Text>
                <Text size="xs" c="dimmed">{payments.length} payment(s)</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Balance Owed</Text>
                <Text fw={700} size="lg" c={currentOutstanding > ROUNDING_TOLERANCE ? 'red.6' : 'teal'}>{formatMoney(currentOutstanding)}</Text>
                <Button
                  size="compact-xs" color="dark" mt={4}
                  leftSection={<IconCash size={12} />}
                  disabled={currentOutstanding <= 0}
                  onClick={() => { setPaymentAmount(''); setPaymentNotes(''); setPaymentModal(true); }}
                >
                  Receive Payment
                </Button>
              </Paper>
            </SimpleGrid>

            {canEdit && (
              <Group justify="space-between" align="center" wrap="nowrap" gap="md">
                <Text size="xs" c="dimmed">
                  Cells with a dashed outline can be corrected: click one, type, then press Enter (or click away) to save, or Esc to cancel.
                  Tick lines and press Delete to remove them. The balance and every total follow the change.
                </Text>
                <Button
                  size="xs"
                  color="red"
                  variant={selectedLines.length ? 'filled' : 'light'}
                  leftSection={<IconTrash size={14} />}
                  disabled={selectedLines.length === 0}
                  loading={deleting}
                  onClick={confirmDeleteSelected}
                  style={{ flexShrink: 0 }}
                >
                  Delete selected{selectedLines.length ? ` (${selectedLines.length})` : ''}
                </Button>
              </Group>
            )}

            <Table.ScrollContainer minWidth={1100}>
              <Table striped withTableBorder withColumnBorders fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    {canEdit && (
                      <Table.Th w={36}>
                        <Checkbox
                          size="xs"
                          aria-label="Select every line that can be deleted"
                          checked={allSelected}
                          indeterminate={selectedLines.length > 0 && !allSelected}
                          disabled={deletableLines.length === 0}
                          onChange={() => setSelectedKeys(allSelected ? new Set() : new Set(deletableLines.map((line) => line.key)))}
                        />
                      </Table.Th>
                    )}
                    <Table.Th>Date &amp; Time</Table.Th>
                    <Table.Th miw={100}>Type</Table.Th>
                    <Table.Th>Invoice #</Table.Th>
                    <Table.Th>Details</Table.Th>
                    <Table.Th>Remarks</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Sale Total</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Paid at Till</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Added to Account</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Payment Received</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {!ledgerLoaded ? <Table.Tr><Table.Td colSpan={canEdit ? 12 : 11} align="center">Loading...</Table.Td></Table.Tr> : null}
                  {ledgerLoaded && statement.length === 0 ? <Table.Tr><Table.Td colSpan={canEdit ? 12 : 11} align="center">No transactions yet.</Table.Td></Table.Tr> : null}
                  {statement.map((line) => (
                    <StatementRow
                      key={line.key}
                      line={line}
                      customerId={customerData._id}
                      canEdit={canEdit}
                      onSaved={reloadAfterCorrection}
                      onViewReceipt={setViewingOrder}
                      deletable={canEdit ? isDeletable(line) : undefined}
                      selected={selectedKeys.has(line.key)}
                      onToggleSelected={() => toggleSelected(line.key)}
                    />
                  ))}
                </Table.Tbody>
                {statement.length > 0 && (
                  <Table.Tfoot>
                    <Table.Tr>
                      <Table.Th colSpan={canEdit ? 6 : 5}>Totals</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{formatMoney(totals.sales)}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{formatMoney(totals.paidAtTill)}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{formatMoney(totals.onAccount)}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{formatMoney(totals.received)}</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>{formatMoney(currentOutstanding)}</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Tfoot>
                )}
              </Table>
            </Table.ScrollContainer>
          </Stack>
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
                  <Table.Th>Remarks</Table.Th>
                  <Table.Th>On Account</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Receipt</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? <Table.Tr><Table.Td colSpan={8} align="center">Loading...</Table.Td></Table.Tr> : null}
                {!loading && orders.length === 0 ? <Table.Tr><Table.Td colSpan={8} align="center">No orders found.</Table.Td></Table.Tr> : null}
                {orders.map(o => (
                  <Table.Tr key={o._id}>
                    <Table.Td>{new Date(o.createdAt).toLocaleDateString()} {new Date(o.createdAt).toLocaleTimeString()}</Table.Td>
                    <Table.Td>{o.invoiceId}</Table.Td>
                    <Table.Td>{o.items?.length || 0} items</Table.Td>
                    <Table.Td><Badge color={o.paymentMethod === 'credit' ? 'red' : 'green'}>{o.paymentMethod}</Badge></Table.Td>
                    <Table.Td><Text size="sm" c={o.remarks ? undefined : 'dimmed'} lineClamp={2}>{o.remarks || '—'}</Text></Table.Td>
                    <Table.Td c={onAccountOf(o) > 0 ? 'orange.8' : 'dimmed'}>{onAccountOf(o) > 0 ? formatMoney(onAccountOf(o)) : '—'}</Table.Td>
                    <Table.Td fw={600}>{formatMoney(o.total)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Button size="compact-xs" variant="light" leftSection={<IconEye size={12} />} onClick={() => setViewingOrder(o)}>
                        View Receipt
                      </Button>
                    </Table.Td>
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
            label="Remarks / Reference (Optional)"
            description="Shown in the customer's account statement next to this payment."
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

      <ReceiptViewer order={viewingOrder} opened={viewingOrder !== null} onClose={() => setViewingOrder(null)} />
    </Modal>
  );
};
