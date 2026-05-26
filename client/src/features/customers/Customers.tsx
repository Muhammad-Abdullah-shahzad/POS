import { useState, useEffect } from 'react';
import {
  Box, Button, Grid, Paper, Text, TextInput, Textarea,
  Table, Modal, Group, Title, ActionIcon, Stack, NumberInput
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconUserPlus, IconSearch, IconEdit, IconTrash,
  IconUser, IconPhone, IconMail, IconAddressBook, IconCheck, IconStar, IconSettings
} from '@tabler/icons-react';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';

interface Customer {
  _id?: string;
  name: string;
  contactNum1: string;
  contactNum2: string;
  email: string;
  address: string;
  eircode: string;
  qrCode: string;
  barcode: string;
  birthday: Date | null;
  anniversary: Date | null;
  timesVisited: number;
  totalAmount: number;
  lastVisit: string;
  loyaltyPoints: number;
}

const emptyForm = () => ({
  name: '', contactNum1: '', contactNum2: '', email: '',
  address: '', eircode: '', qrCode: '', barcode: '',
  birthday: null as Date | null, anniversary: null as Date | null,
});

const Customers = () => {
  const [customers, setCustomers]           = useState<Customer[]>([]);
  const [search, setSearch]                 = useState('');
  const [modalOpened, setModalOpened]       = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm]                     = useState(emptyForm());
  const [loading, setLoading]               = useState(false);

  const [loyaltyOpen, setLoyaltyOpen]       = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyPPE, setLoyaltyPPE]         = useState(1);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState(100);
  const [loyaltyReward, setLoyaltyReward]   = useState(5);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/customers');
      setCustomers((data.data || []).map((c: any) => ({
        ...c,
        birthday:    c.birthday    ? new Date(c.birthday)    : null,
        anniversary: c.anniversary ? new Date(c.anniversary) : null,
      })));
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' });
    } finally { setLoading(false); }
  };

  const fetchLoyalty = async () => {
    try {
      const { data } = await api.get('/settings');
      if (data.success && data.data) {
        setLoyaltyPPE(data.data.loyaltyPointsPerEuro ?? 1);
        setLoyaltyThreshold(data.data.loyaltyRewardThreshold ?? 100);
        setLoyaltyReward(data.data.loyaltyRewardValue ?? 5);
      }
    } catch { /* ignore */ }
  };

  const saveLoyalty = async () => {
    try {
      setLoyaltyLoading(true);
      await api.put('/settings', {
        loyaltyPointsPerEuro: loyaltyPPE,
        loyaltyRewardThreshold: loyaltyThreshold,
        loyaltyRewardValue: loyaltyReward,
      });
      notifications.show({ title: 'Saved', message: 'Loyalty settings updated', color: 'gray' });
      setLoyaltyOpen(false);
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' });
    } finally { setLoyaltyLoading(false); }
  };

  useEffect(() => { fetchCustomers(); fetchLoyalty(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactNum1.includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditingCustomer(null); setForm(emptyForm()); setModalOpened(true); };
  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name, contactNum1: c.contactNum1, contactNum2: c.contactNum2 || '',
      email: c.email || '', address: c.address || '', eircode: c.eircode || '',
      qrCode: c.qrCode || '', barcode: c.barcode || '',
      birthday: c.birthday, anniversary: c.anniversary,
    });
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.contactNum1.trim()) return;
    try {
      setLoading(true);
      if (editingCustomer?._id) {
        await api.put(`/customers/${editingCustomer._id}`, form);
      } else {
        await api.post('/customers', form);
      }
      setModalOpened(false);
      fetchCustomers();
    } catch (e: any) {
      notifications.show({ title: 'Error', message: e.message, color: 'red' });
    } finally { setLoading(false); }
  };

  const handleDelete = (customer: Customer) => {
    if (!customer._id) return;
    modals.openConfirmModal({
      title: 'Delete customer',
      centered: true,
      children: <Text size="sm">Delete <strong>{customer.name}</strong>? This cannot be undone.</Text>,
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'dark' },
      onConfirm: async () => {
        await api.delete(`/customers/${customer._id}`);
        fetchCustomers();
      },
    });
  };

  const handleResetPoints = (customer: Customer) => {
    if (!customer._id) return;
    modals.openConfirmModal({
      title: 'Reset loyalty points',
      centered: true,
      children: <Text size="sm">Reset <strong>{customer.loyaltyPoints}</strong> points for <strong>{customer.name}</strong>?</Text>,
      labels: { confirm: 'Reset', cancel: 'Cancel' },
      confirmProps: { color: 'dark' },
      onConfirm: async () => {
        await api.post(`/customers/${customer._id}/reset-points`);
        fetchCustomers();
      },
    });
  };

  const setField = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: any) =>
    setForm(f => ({ ...f, [k]: v }));

  // ── summary stats ──────────────────────────────────────────────────────────
  const totalRevenue = customers.reduce((s, c) => s + c.totalAmount, 0);
  const totalVisits  = customers.reduce((s, c) => s + c.timesVisited, 0);

  return (
    <Box p="md">

      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={3} fw={700}>Customer Details</Title>
          <Text size="sm" c="dimmed">Manage and view all customer records</Text>
        </div>
        <Group gap="xs">
          <Button
            size="sm" variant="default"
            leftSection={<IconSettings size={15} />}
            onClick={() => { fetchLoyalty(); setLoyaltyOpen(true); }}
          >
            Loyalty Settings
          </Button>
          <Button
            size="sm" color="dark"
            leftSection={<IconUserPlus size={15} />}
            onClick={openAdd}
          >
            Add Customer
          </Button>
        </Group>
      </Group>

      {/* Summary cards */}
      <Grid mb="lg">
        {[
          { label: 'Total Customers', value: customers.length },
          { label: 'Total Revenue',   value: `€ ${totalRevenue.toLocaleString('en', { minimumFractionDigits: 2 })}` },
          { label: 'Total Visits',    value: totalVisits },
        ].map(card => (
          <Grid.Col span={4} key={card.label}>
            <Paper withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>{card.label}</Text>
              <Text size="xl" fw={800} c="#111">{card.value}</Text>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>

      {/* Table */}
      <Paper withBorder radius="md" p="md">
        <TextInput
          placeholder="Search by name, phone or email…"
          leftSection={<IconSearch size={15} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          mb="md"
          styles={{ input: { borderColor: '#e5e7eb' } }}
        />

        <Table.ScrollContainer minWidth={860}>
          <Table highlightOnHover verticalSpacing="sm" fz="sm">
            <Table.Thead>
              <Table.Tr>
                {['Name', 'Phone', 'Email', 'Visits', 'Total Spent', 'Points', 'Last Visit', ''].map(h => (
                  <Table.Th key={h}>
                    <Text size="xs" fw={600} tt="uppercase" c="dimmed">{h}</Text>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading && customers.length === 0 ? (
                <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="xl">Loading…</Text></Table.Td></Table.Tr>
              ) : filtered.length === 0 ? (
                <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="xl">No customers found</Text></Table.Td></Table.Tr>
              ) : filtered.map(c => (
                <Table.Tr key={c._id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Box
                        w={28} h={28}
                        style={{ borderRadius: '50%', background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <Text size="xs" fw={700} c="#374151">{c.name[0]?.toUpperCase()}</Text>
                      </Box>
                      <Text fw={600}>{c.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td><Text c="dimmed">{c.contactNum1}</Text></Table.Td>
                  <Table.Td><Text c="dimmed">{c.email || '—'}</Text></Table.Td>
                  <Table.Td><Text fw={500}>{c.timesVisited}</Text></Table.Td>
                  <Table.Td><Text fw={500}>€{c.totalAmount.toFixed(2)}</Text></Table.Td>
                  <Table.Td>
                    <Text fw={500} c={(c.loyaltyPoints || 0) > 0 ? '#111' : 'dimmed'}>
                      {c.loyaltyPoints || 0} pts
                    </Text>
                  </Table.Td>
                  <Table.Td><Text c="dimmed">{c.lastVisit || '—'}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => openEdit(c)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      {(c.loyaltyPoints || 0) > 0 && (
                        <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => handleResetPoints(c)}>
                          <IconStar size={14} />
                        </ActionIcon>
                      )}
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => handleDelete(c)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Text fw={700}>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</Text>}
        centered size="lg"
      >
        {editingCustomer && (
          <Paper withBorder p="md" radius="md" mb="md" bg="gray.0">
            <Grid>
              {[
                { label: 'Visits',         value: editingCustomer.timesVisited },
                { label: 'Total Spent',    value: `€ ${editingCustomer.totalAmount.toFixed(2)}` },
                { label: 'Loyalty Points', value: `${editingCustomer.loyaltyPoints || 0} pts` },
                { label: 'Last Visit',     value: editingCustomer.lastVisit || '—' },
              ].map(s => (
                <Grid.Col span={3} key={s.label}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>{s.label}</Text>
                  <Text fw={700} size="md">{s.value}</Text>
                </Grid.Col>
              ))}
            </Grid>
            {(editingCustomer.loyaltyPoints || 0) > 0 && (
              <Button
                mt="sm" size="xs" variant="default"
                leftSection={<IconStar size={12} />}
                onClick={() => { handleResetPoints(editingCustomer); setModalOpened(false); }}
              >
                Reset Points
              </Button>
            )}
          </Paper>
        )}

        <Grid>
          <Grid.Col span={12}>
            <TextInput label="Customer Name *" placeholder="Full name" required
              leftSection={<IconUser size={14} />} value={form.name}
              onChange={e => setField('name', e.target.value)} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Contact 1 *" placeholder="+353 87 000 0000" required
              leftSection={<IconPhone size={14} />} value={form.contactNum1}
              onChange={e => setField('contactNum1', e.target.value)} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Contact 2" placeholder="+353 87 000 0000"
              leftSection={<IconPhone size={14} />} value={form.contactNum2}
              onChange={e => setField('contactNum2', e.target.value)} />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput label="Email" placeholder="email@example.com"
              leftSection={<IconMail size={14} />} value={form.email}
              onChange={e => setField('email', e.target.value)} />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea label="Address" placeholder="Street, City" value={form.address}
              onChange={e => setField('address', e.target.value)} minRows={2} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="Eircode" placeholder="D01 F5P2" value={form.eircode}
              onChange={e => setField('eircode', e.target.value)} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="QR Code" leftSection={<IconAddressBook size={14} />}
              value={form.qrCode} onChange={e => setField('qrCode', e.target.value)} />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput label="Barcode" value={form.barcode}
              onChange={e => setField('barcode', e.target.value)} />
          </Grid.Col>
          <Grid.Col span={6}>
            <DateInput label="Birthday" placeholder="DD/MM/YYYY" valueFormat="DD/MM/YYYY"
              value={form.birthday} onChange={v => setField('birthday', v)} />
          </Grid.Col>
          <Grid.Col span={6}>
            <DateInput label="Anniversary" placeholder="DD/MM/YYYY" valueFormat="DD/MM/YYYY"
              value={form.anniversary} onChange={v => setField('anniversary', v)} />
          </Grid.Col>
        </Grid>

        <Button mt="lg" color="dark" fullWidth size="md" loading={loading} onClick={handleSave}>
          {editingCustomer ? 'Save Changes' : 'Add Customer'}
        </Button>
      </Modal>

      {/* Loyalty Settings Modal */}
      <Modal
        opened={loyaltyOpen}
        onClose={() => setLoyaltyOpen(false)}
        title={<Text fw={700}>Loyalty Settings</Text>}
        centered size="sm"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">Configure how customers earn and redeem loyalty points.</Text>

          <NumberInput
            label="Points per €1 spent"
            description="e.g. 1 = 1 point per €1"
            min={0} decimalScale={2}
            value={loyaltyPPE}
            onChange={v => setLoyaltyPPE(Number(v) || 0)}
          />
          <NumberInput
            label="Points needed for reward"
            description="e.g. 100 = reward after 100 points"
            min={1}
            value={loyaltyThreshold}
            onChange={v => setLoyaltyThreshold(Number(v) || 1)}
          />
          <NumberInput
            label="Reward value (€)"
            description="e.g. 5 = €5 free shopping"
            min={0} decimalScale={2}
            value={loyaltyReward}
            onChange={v => setLoyaltyReward(Number(v) || 0)}
          />

          <Paper withBorder p="sm" radius="md" bg="gray.0">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Example</Text>
            <Text size="sm">
              Spend <strong>€{loyaltyPPE > 0 ? (loyaltyThreshold / loyaltyPPE).toFixed(2) : '—'}</strong>
              {' → '}<strong>{loyaltyThreshold} pts</strong>
              {' → '}<strong>€{loyaltyReward} reward</strong>
            </Text>
          </Paper>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLoyaltyOpen(false)}>Cancel</Button>
            <Button color="dark" loading={loyaltyLoading} leftSection={<IconCheck size={14} />} onClick={saveLoyalty}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
};

export default Customers;
