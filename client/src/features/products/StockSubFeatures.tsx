import { useState, useEffect } from 'react';
import { 
  Paper, Text, Title, Grid, Table, Badge, Button, Group, Stack, 
  TextInput, Select, NumberInput, Card, SimpleGrid, Modal, Textarea, Autocomplete, Tabs, ActionIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { 
  IconCash, IconPrinter, IconPlus, IconTruck, 
  IconClipboardList, IconAlertCircle, IconCalendar, IconUser, IconHash,
  IconTrash, IconCheck, IconListDetails, IconSearch, IconPhone, IconMail, IconMapPin
} from '@tabler/icons-react';
import { currencySymbol, formatMoney } from '../../utils/money';
import api from '../../services/api';
import { errorMessage } from '../../utils/errorMessage';
import { useAuthStore } from '../../store/authStore';
import {
  ROUNDING_TOLERANCE,
  SUPPLIER_PAYMENT_METHODS,
  buildSupplierLedger,
  formatDate,
  formatDateTime,
  type SupplierPayment,
  type SupplierPaymentMethod,
} from '../suppliers/supplierStatement';
import SupplierStatementRow from '../suppliers/SupplierStatementRow';

export type { SupplierPayment, SupplierPaymentEntry } from '../suppliers/supplierStatement';

// ==========================================
// 1. SUPPLIER PAYMENTS
// ==========================================
/** A saved supplier from the Suppliers page. */
interface SupplierRecord {
  _id: string;
  name: string;
  contact?: string;
  emailId?: string;
  address?: string;
}

/** Everything about one supplier: their details, invoices and running totals. */
interface SupplierAccount {
  key: string;
  name: string;
  record?: SupplierRecord;
  invoices: SupplierPayment[];
  received: number;
  paid: number;
  balance: number;
  openInvoices: number;
  lastActivity?: string;
}

const nameKey = (name: string) => name.trim().toLowerCase();

const invoiceBalance = (invoice: SupplierPayment) => Math.max(0, (Number(invoice.amount) || 0) - (Number(invoice.paid) || 0));

const invoiceStatus = (invoice: SupplierPayment): 'Paid' | 'Partial' | 'Unpaid' =>
  invoiceBalance(invoice) <= ROUNDING_TOLERANCE ? 'Paid' : (Number(invoice.paid) || 0) > 0 ? 'Partial' : 'Unpaid';

/** One account per supplier: saved suppliers and any name used on an invoice, matched ignoring case. */
function groupBySupplier(records: SupplierRecord[], invoices: SupplierPayment[]): SupplierAccount[] {
  const accounts = new Map<string, SupplierAccount>();
  const accountFor = (name: string, record?: SupplierRecord) => {
    const key = nameKey(name);
    let account = accounts.get(key);
    if (!account) {
      account = { key, name: name.trim(), record, invoices: [], received: 0, paid: 0, balance: 0, openInvoices: 0 };
      accounts.set(key, account);
    }
    return account;
  };

  for (const record of records) if (record.name?.trim()) accountFor(record.name, record);

  for (const invoice of invoices) {
    if (!invoice.supplierName?.trim()) continue;
    const account = accountFor(invoice.supplierName);
    account.invoices.push(invoice);
    account.received += Number(invoice.amount) || 0;
    account.paid += Number(invoice.paid) || 0;
    account.balance += invoiceBalance(invoice);
    if (invoiceBalance(invoice) > ROUNDING_TOLERANCE) account.openInvoices += 1;
    const latest = [invoice.lastPaymentAt, invoice.createdAt, invoice.date]
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;
    if (latest && (!account.lastActivity || latest > account.lastActivity)) account.lastActivity = latest;
  }

  return Array.from(accounts.values()).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}

export const SupplierPayments = () => {
  const [invoices, setInvoices] = useState<SupplierPayment[]>([]);
  /** Saved supplier records, offered when entering an invoice. */
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [search, setSearch] = useState('');

  // Modal control states
  const [invoiceModalOpened, setInvoiceModalOpened] = useState(false);
  /** The supplier being paid, if the payment form is open. */
  const [payingKey, setPayingKey] = useState<string | null>(null);
  /** The supplier whose full ledger is open, if any. */
  const [ledgerKey, setLedgerKey] = useState<string | null>(null);
  const [ledgerTab, setLedgerTab] = useState<string | null>('statement');

  // Form states for recording a new invoice
  const [newSupplier, setNewSupplier] = useState('');
  const [newInvoiceNo, setNewInvoiceNo] = useState('');
  const [newAmount, setNewAmount] = useState<number | string>(0);
  const [newPaid, setNewPaid] = useState<number | string>(0);
  const [newDate, setNewDate] = useState(new Date().toISOString().substring(0, 10));
  const [newRemarks, setNewRemarks] = useState('');

  // Form states for paying a supplier
  const [payAmount, setPayAmount] = useState<number | string>('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payMethod, setPayMethod] = useState<SupplierPaymentMethod>('cash');
  /** Managers and admins may correct the ledger statement in place. */
  const canEdit = useAuthStore((state) => state.user?.role === 'admin' || state.user?.role === 'manager');
  const [paying, setPaying] = useState(false);

  const accounts = groupBySupplier(suppliers, invoices);
  const shownAccounts = search.trim()
    ? accounts.filter(a => a.name.toLowerCase().includes(search.trim().toLowerCase()))
    : accounts;
  const payingAccount = accounts.find(a => a.key === payingKey) ?? null;
  const ledgerAccount = accounts.find(a => a.key === ledgerKey) ?? null;
  const ledgerEntries = ledgerAccount ? buildSupplierLedger(ledgerAccount.invoices) : [];
  const ledgerPayments = ledgerEntries.filter(e => e.type === 'Payment');

  const totalOutstanding = accounts.reduce((acc, a) => acc + a.balance, 0);
  const totalPaid = accounts.reduce((acc, a) => acc + a.paid, 0);
  const owingSuppliers = accounts.filter(a => a.balance > ROUNDING_TOLERANCE).length;

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers');
      setSuppliers(data.data ?? []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data } = await api.get('/supplier-invoices');
      setInvoices(data.data ?? []);
    } catch (error) {
      console.error('Error fetching supplier invoices:', error);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchSuppliers();
  }, []);

  const openInvoiceForm = (supplierName = '') => {
    setNewSupplier(supplierName);
    setInvoiceModalOpened(true);
  };

  const openPayment = (account: SupplierAccount) => {
    setPayAmount('');
    setPayRemarks('');
    setPayMethod('cash');
    setPayingKey(account.key);
  };

  const handleRecordInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    // An invoice number is recorded once, so a bill cannot be entered twice.
    const duplicate = invoices.find(i => nameKey(i.invoiceNo) === nameKey(newInvoiceNo));
    if (duplicate) {
      notifications.show({
        title: 'Invoice already recorded',
        message: `Invoice ${duplicate.invoiceNo} is already recorded (supplier: ${duplicate.supplierName})`,
        color: 'red',
      });
      return;
    }
    // Uses a saved supplier's exact name, so the invoice joins that supplier's ledger.
    const supplier = suppliers.find(s => nameKey(s.name) === nameKey(newSupplier));

    try {
      await api.post('/supplier-invoices', {
        ...(supplier ? { supplierId: supplier._id } : {}),
        supplierName: supplier?.name ?? newSupplier.trim(),
        invoiceNo: newInvoiceNo || `INV-GEN-${Date.now().toString().slice(-4)}`,
        amount: Number(newAmount) || 0,
        paid: Number(newPaid) || 0,
        date: newDate,
        remarks: newRemarks.trim(),
      });

      notifications.show({ title: 'Success', message: 'Supplier invoice recorded.', color: 'teal', icon: <IconCheck size={16} /> });
      setInvoiceModalOpened(false);
      setNewSupplier('');
      setNewInvoiceNo('');
      setNewAmount(0);
      setNewPaid(0);
      setNewDate(new Date().toISOString().substring(0, 10));
      setNewRemarks('');
      fetchInvoices();
    } catch (error) {
      notifications.show({ title: 'Error', message: errorMessage(error, 'Failed to record invoice.'), color: 'red' });
    }
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingAccount) return;

    try {
      setPaying(true);
      const { data } = await api.post('/supplier-invoices/pay-supplier', {
        supplierName: payingAccount.name,
        amount: Number(payAmount) || 0,
        remarks: payRemarks.trim(),
        method: payMethod,
      });
      const applied: { invoiceNo: string }[] = data?.data?.applied ?? [];
      notifications.show({
        title: 'Payment recorded',
        message: `${formatMoney(Number(payAmount) || 0)} paid to ${payingAccount.name}${applied.length ? ` (cleared against ${applied.map(a => a.invoiceNo).join(', ')})` : ''}.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      setPayingKey(null);
      fetchInvoices();
    } catch (error) {
      notifications.show({ title: 'Error', message: errorMessage(error, 'Failed to record payment.'), color: 'red' });
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteInvoice = async (invoice: SupplierPayment) => {
    if (!window.confirm(`Delete invoice ${invoice.invoiceNo}? Its payments are removed from the ledger too.`)) return;
    try {
      await api.delete(`/supplier-invoices/${invoice._id}`);
      notifications.show({ title: 'Success', message: 'Invoice deleted.', color: 'teal', icon: <IconCheck size={16} /> });
      fetchInvoices();
    } catch (error) {
      notifications.show({ title: 'Error', message: errorMessage(error, 'Failed to delete invoice.'), color: 'red' });
    }
  };

  const handleDeleteSupplierAccount = async (account: SupplierAccount) => {
    const count = account.invoices.length;
    if (!window.confirm(`Delete ALL ${count} invoice(s) for "${account.name}"? This cannot be undone.`)) return;
    try {
      await Promise.all(account.invoices.map(inv => api.delete(`/supplier-invoices/${inv._id}`)));
      notifications.show({ title: 'Deleted', message: `All invoices for ${account.name} removed.`, color: 'teal', icon: <IconCheck size={16} /> });
      fetchInvoices();
    } catch (error) {
      notifications.show({ title: 'Error', message: errorMessage(error, 'Failed to delete supplier invoices.'), color: 'red' });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Supplier Payments Ledger</Title>
          <Text size="sm" c="dimmed">One account per supplier: goods received, payments made and what is still owed.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} color="teal" onClick={() => openInvoiceForm()}>
          Record Invoice
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Outstanding Balance</Text>
            <IconAlertCircle size={20} style={{ color: 'var(--mantine-color-red-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">{formatMoney(totalOutstanding)}</Text>
          <Text size="xs" c={owingSuppliers > 0 ? 'red' : 'green'} mt="xs" fw={500}>
            Owed to {owingSuppliers} supplier{owingSuppliers !== 1 ? 's' : ''}
          </Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Paid to Suppliers</Text>
            <IconCash size={20} style={{ color: 'var(--mantine-color-green-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">{formatMoney(totalPaid)}</Text>
          <Text size="xs" c="dimmed" mt="xs">All payments to date</Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Suppliers</Text>
            <IconTruck size={20} style={{ color: 'var(--mantine-color-blue-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">{accounts.length} Supplier{accounts.length !== 1 ? 's' : ''}</Text>
          <Text size="xs" c="dimmed" mt="xs">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} recorded</Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <TextInput
          placeholder="Search supplier…"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mb="md"
          maw={320}
        />
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Supplier</Table.Th>
                <Table.Th>Invoices</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Goods Received</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Paid</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Balance Owed</Table.Th>
                <Table.Th>Last Activity</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shownAccounts.map((account) => (
                <Table.Tr key={account.key}>
                  <Table.Td>
                    <Text fw={600}>{account.name}</Text>
                    {account.record?.contact && <Text size="xs" c="dimmed">{account.record.contact}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{account.invoices.length}</Text>
                    {account.openInvoices > 0 && <Text size="xs" c="orange.8">{account.openInvoices} unpaid</Text>}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatMoney(account.received)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} c="green.7" fw={600}>{formatMoney(account.paid)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }} c={account.balance > ROUNDING_TOLERANCE ? 'red.6' : 'dimmed'} fw={700}>
                    {formatMoney(account.balance)}
                  </Table.Td>
                  <Table.Td><Text size="xs">{formatDateTime(account.lastActivity)}</Text></Table.Td>
                  <Table.Td>
                    {account.invoices.length === 0 ? (
                      <Badge color="gray" variant="dot">No invoices</Badge>
                    ) : account.balance > ROUNDING_TOLERANCE ? (
                      <Badge color="red" variant="dot">Owed</Badge>
                    ) : (
                      <Badge color="teal" variant="dot">Settled</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Button
                        size="compact-xs"
                        variant="light"
                        color="gray"
                        leftSection={<IconListDetails size={12} />}
                        onClick={() => { setLedgerTab('statement'); setLedgerKey(account.key); }}
                      >
                        Details
                      </Button>
                      <Button
                        size="compact-xs"
                        variant="light"
                        color="blue"
                        disabled={account.balance <= ROUNDING_TOLERANCE}
                        onClick={() => openPayment(account)}
                      >
                        Pay
                      </Button>
                      <ActionIcon
                        size="sm"
                        variant="light"
                        color="red"
                        title="Delete all invoices for this supplier"
                        onClick={() => handleDeleteSupplierAccount(account)}
                      >
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {shownAccounts.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text ta="center" py="md" c="dimmed">
                      {search.trim() ? `No supplier matches "${search.trim()}".` : 'No suppliers or invoices recorded yet.'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {/* 1. Modal: Record a supplier invoice */}
      <Modal
        opened={invoiceModalOpened}
        onClose={() => setInvoiceModalOpened(false)}
        title={<Text size="lg" fw={700}>Record Supplier Invoice</Text>}
        centered
        size="md"
        zIndex={310}
      >
        <form onSubmit={handleRecordInvoice}>
          <Stack gap="md">
            <Autocomplete
              label="Supplier Name"
              placeholder="Click to pick a supplier or type a new name"
              data={accounts.map(a => a.name)}
              value={newSupplier}
              onChange={setNewSupplier}
              onFocus={(e) => {
                // Force-show all options when the field is focused (simulate a dropdown)
                e.target.dispatchEvent(new Event('input', { bubbles: true }));
              }}
              filter={({ options }) => options}
              required
              leftSection={<IconUser size={16} />}
              maxDropdownHeight={300}
              comboboxProps={{ withinPortal: true, zIndex: 400 }}
            />
            <TextInput
              label="Invoice Number"
              placeholder="e.g. INV-2026-99"
              value={newInvoiceNo}
              onChange={(e) => setNewInvoiceNo(e.target.value)}
              required
              leftSection={<IconHash size={16} />}
              error={(() => {
                const duplicate = newInvoiceNo.trim() && invoices.find(i => nameKey(i.invoiceNo) === nameKey(newInvoiceNo));
                return duplicate ? `Already recorded (supplier: ${duplicate.supplierName})` : undefined;
              })()}
            />
            <SimpleGrid cols={2}>
              <NumberInput
                label={`Total Invoice Amount (${currencySymbol()})`}
                placeholder="0"
                min={0}
                value={newAmount}
                onChange={(val) => setNewAmount(val)}
                required
              />
              <NumberInput
                label={`Amount Paid Now (${currencySymbol()})`}
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
            <Textarea
              label="Remarks"
              placeholder="e.g. 20 cartons of cooking oil, delivered by Ahmed"
              value={newRemarks}
              onChange={(e) => setNewRemarks(e.currentTarget.value)}
              maxLength={500}
              autosize
              minRows={2}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="gray" onClick={() => setInvoiceModalOpened(false)}>Cancel</Button>
              <Button type="submit" color="teal">Save Invoice</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* 2. Modal: Pay a supplier (cleared against their oldest invoices first) */}
      <Modal
        opened={payingAccount !== null}
        onClose={() => setPayingKey(null)}
        title={<Text size="lg" fw={700}>Pay Supplier - {payingAccount?.name}</Text>}
        centered
        size="md"
        zIndex={310}
      >
        {payingAccount && (
          <form onSubmit={handlePaySupplier}>
            <Stack gap="md">
              <Paper withBorder p="sm" bg="var(--mantine-color-gray-0)" radius="md">
                <SimpleGrid cols={3}>
                  <div>
                    <Text size="xs" c="dimmed">Goods Received</Text>
                    <Text fw={600} size="sm">{formatMoney(payingAccount.received)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Paid So Far</Text>
                    <Text fw={600} size="sm" c="green">{formatMoney(payingAccount.paid)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Balance Owed</Text>
                    <Text fw={700} size="sm" c="red">{formatMoney(payingAccount.balance)}</Text>
                  </div>
                </SimpleGrid>
                <Text size="xs" c="dimmed" mt="xs">
                  {payingAccount.openInvoices} unpaid invoice{payingAccount.openInvoices !== 1 ? 's' : ''}. The payment clears the oldest first.
                </Text>
              </Paper>

              <NumberInput
                label={`Amount to Pay (${currencySymbol()})`}
                placeholder="Enter amount to pay"
                min={0.01}
                max={Math.round(payingAccount.balance * 100) / 100}
                decimalScale={2}
                value={payAmount}
                onChange={(val) => setPayAmount(val)}
                required
                data-autofocus
              />
              <Group gap="xs">
                <Button size="xs" variant="outline" color="dark" onClick={() => setPayAmount(Math.round(payingAccount.balance * 100) / 100)}>
                  Pay Full ({formatMoney(payingAccount.balance)})
                </Button>
              </Group>

              <Select
                label="Paid by"
                data={SUPPLIER_PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
                value={payMethod}
                onChange={(value) => value && setPayMethod(value as SupplierPaymentMethod)}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
              />

              <Textarea
                label="Remarks"
                description="Shown in this supplier's ledger next to the payment."
                placeholder="e.g. Cash handed to driver, or bank transfer ref #1234"
                value={payRemarks}
                onChange={(e) => setPayRemarks(e.currentTarget.value)}
                maxLength={500}
                autosize
                minRows={2}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="subtle" color="gray" onClick={() => setPayingKey(null)}>Cancel</Button>
                <Button type="submit" color="blue" loading={paying}>Confirm Payment</Button>
              </Group>
            </Stack>
          </form>
        )}
      </Modal>

      {/* 3. Modal: Full ledger of one supplier */}
      <Modal
        opened={ledgerAccount !== null}
        onClose={() => setLedgerKey(null)}
        title={<Text size="lg" fw={700}>Supplier Ledger - {ledgerAccount?.name}</Text>}
        centered
        size="90%"
      >
        {ledgerAccount && (
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                {ledgerAccount.record ? (
                  <>
                    {ledgerAccount.record.contact && <Group gap={6}><IconPhone size={14} /><Text size="sm">{ledgerAccount.record.contact}</Text></Group>}
                    {ledgerAccount.record.emailId && <Group gap={6}><IconMail size={14} /><Text size="sm">{ledgerAccount.record.emailId}</Text></Group>}
                    {ledgerAccount.record.address && <Group gap={6}><IconMapPin size={14} /><Text size="sm">{ledgerAccount.record.address}</Text></Group>}
                  </>
                ) : (
                  <Text size="sm" c="dimmed">Not saved on the Suppliers page, so no contact details.</Text>
                )}
              </Stack>
              <Group gap="xs">
                <Button variant="light" color="teal" leftSection={<IconPlus size={14} />} onClick={() => openInvoiceForm(ledgerAccount.name)}>
                  Record Invoice
                </Button>
                <Button color="blue" leftSection={<IconCash size={14} />} disabled={ledgerAccount.balance <= ROUNDING_TOLERANCE} onClick={() => openPayment(ledgerAccount)}>
                  Pay Supplier
                </Button>
              </Group>
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Goods Received</Text>
                <Text fw={700} size="lg">{formatMoney(ledgerAccount.received)}</Text>
                <Text size="xs" c="dimmed">{ledgerAccount.invoices.length} invoice{ledgerAccount.invoices.length !== 1 ? 's' : ''}</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Paid to Supplier</Text>
                <Text fw={700} size="lg" c="green.7">{formatMoney(ledgerAccount.paid)}</Text>
                <Text size="xs" c="dimmed">{ledgerPayments.length} payment(s)</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Balance Owed</Text>
                <Text fw={700} size="lg" c={ledgerAccount.balance > ROUNDING_TOLERANCE ? 'red.6' : 'teal'}>{formatMoney(ledgerAccount.balance)}</Text>
                <Text size="xs" c="dimmed">{ledgerAccount.openInvoices} unpaid invoice(s)</Text>
              </Paper>
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Last Activity</Text>
                <Text fw={700} size="sm" mt={4}>{formatDateTime(ledgerAccount.lastActivity)}</Text>
              </Paper>
            </SimpleGrid>

            <Tabs value={ledgerTab} onChange={setLedgerTab}>
              <Tabs.List>
                <Tabs.Tab value="statement" leftSection={<IconListDetails size={14} />}>Statement ({ledgerEntries.length})</Tabs.Tab>
                <Tabs.Tab value="invoices" leftSection={<IconClipboardList size={14} />}>Invoices ({ledgerAccount.invoices.length})</Tabs.Tab>
                <Tabs.Tab value="payments" leftSection={<IconCash size={14} />}>Payments ({ledgerPayments.length})</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="statement" pt="md">
                {canEdit && (
                  <Text size="xs" c="dimmed" mb="xs">
                    Cells with a dashed outline can be corrected: click one, type, then press Enter (or click away) to save, or Esc to cancel.
                    A corrected payment stays on the invoices it covered and spills onto the oldest others if it grows. The balance and totals follow.
                  </Text>
                )}
                <Table.ScrollContainer minWidth={900}>
                  <Table striped withTableBorder withColumnBorders fz="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date &amp; Time</Table.Th>
                        <Table.Th w={110}>Type</Table.Th>
                        <Table.Th>Invoice No</Table.Th>
                        <Table.Th>Details</Table.Th>
                        <Table.Th>Remarks</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Goods Received</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Paid</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {ledgerEntries.map((entry) => (
                        <SupplierStatementRow key={entry.key} entry={entry} canEdit={canEdit} onSaved={fetchInvoices} />
                      ))}
                      {ledgerEntries.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Text ta="center" py="md" c="dimmed">No invoices or payments for this supplier yet.</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                    {ledgerEntries.length > 0 && (
                      <Table.Tfoot>
                        <Table.Tr>
                          <Table.Th colSpan={5}>Totals</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>{formatMoney(ledgerAccount.received)}</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>{formatMoney(ledgerAccount.paid)}</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>{formatMoney(ledgerAccount.balance)}</Table.Th>
                        </Table.Tr>
                      </Table.Tfoot>
                    )}
                  </Table>
                </Table.ScrollContainer>
              </Tabs.Panel>

              <Tabs.Panel value="invoices" pt="md">
                <Table.ScrollContainer minWidth={800}>
                  <Table striped highlightOnHover fz="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Invoice No</Table.Th>
                        <Table.Th>Remarks</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Paid</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Balance</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[...ledgerAccount.invoices]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((invoice) => {
                          const status = invoiceStatus(invoice);
                          return (
                            <Table.Tr key={invoice._id}>
                              <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(invoice.date)}</Table.Td>
                              <Table.Td><Badge variant="light" color="gray" size="sm">{invoice.invoiceNo}</Badge></Table.Td>
                              <Table.Td><Text size="sm" c={invoice.remarks ? undefined : 'dimmed'}>{invoice.remarks || '—'}</Text></Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>{formatMoney(invoice.amount)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }} c="green.7">{formatMoney(invoice.paid)}</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }} c={status === 'Paid' ? 'dimmed' : 'red.6'} fw={600}>{formatMoney(invoiceBalance(invoice))}</Table.Td>
                              <Table.Td>
                                <Badge color={status === 'Paid' ? 'teal' : status === 'Partial' ? 'orange' : 'red'} variant="dot">{status}</Badge>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <ActionIcon variant="subtle" color="red" aria-label={`Delete invoice ${invoice.invoiceNo}`} onClick={() => handleDeleteInvoice(invoice)}>
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      {ledgerAccount.invoices.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={8}><Text ta="center" py="md" c="dimmed">No invoices yet.</Text></Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Tabs.Panel>

              <Tabs.Panel value="payments" pt="md">
                <Table.ScrollContainer minWidth={700}>
                  <Table striped highlightOnHover fz="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date &amp; Time</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                        <Table.Th>Cleared Against</Table.Th>
                        <Table.Th>Remarks</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {[...ledgerPayments].reverse().map((payment) => (
                        <Table.Tr key={payment.key}>
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(payment.at)}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }} c="green.7" fw={600}>{formatMoney(payment.paid)}</Table.Td>
                          <Table.Td>
                            <Text size="sm">{payment.split ? payment.split.replace(/^Split: /, '') : payment.reference}</Text>
                          </Table.Td>
                          <Table.Td><Text size="sm" c={payment.remarks ? undefined : 'dimmed'}>{payment.remarks || '—'}</Text></Table.Td>
                        </Table.Tr>
                      ))}
                      {ledgerPayments.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={4}><Text ta="center" py="md" c="dimmed">No payments yet.</Text></Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Tabs.Panel>
            </Tabs>
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
                    <Text size="xs" fw={700} c="blue">{formatMoney(productData.find(p => p.name === selectedProduct)?.price)}</Text>
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
