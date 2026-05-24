import { useState, useEffect } from 'react';
import {
  Box, Button, Flex, Grid, Paper, Text, TextInput, Textarea, Table, Badge, Modal,
  Group, Title, ActionIcon, Divider
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconUserPlus, IconSearch, IconEdit, IconTrash, IconUser,
  IconPhone, IconMail, IconAddressBook, IconCheck, IconX, IconStar
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

const emptyForm = (): Omit<Customer, '_id' | 'timesVisited' | 'totalAmount' | 'lastVisit'> => ({
  name: '',
  contactNum1: '',
  contactNum2: '',
  email: '',
  address: '',
  eircode: '',
  qrCode: '',
  barcode: '',
  birthday: null,
  anniversary: null,
});

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [modalOpened, setModalOpened] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<Omit<Customer, '_id' | 'timesVisited' | 'totalAmount' | 'lastVisit'>>(emptyForm());
  const [loading, setLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/customers');
      const parsed = (data.data || []).map((c: any) => ({
        ...c,
        birthday: c.birthday ? new Date(c.birthday) : null,
        anniversary: c.anniversary ? new Date(c.anniversary) : null,
      }));
      setCustomers(parsed);
    } catch (error: any) {
      console.error(error);
      notifications.show({
        title: 'Error Fetching Customers',
        message: error.response?.data?.message || error.message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactNum1.includes(search) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
    (c.eircode && c.eircode.toLowerCase().includes(search.toLowerCase()))
  );

  const openAdd = () => {
    setEditingCustomer(null);
    setForm(emptyForm());
    setModalOpened(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setForm({
      name: c.name,
      contactNum1: c.contactNum1,
      contactNum2: c.contactNum2 || '',
      email: c.email || '',
      address: c.address || '',
      eircode: c.eircode || '',
      qrCode: c.qrCode || '',
      barcode: c.barcode || '',
      birthday: c.birthday,
      anniversary: c.anniversary,
    });
    setModalOpened(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.contactNum1.trim()) return;
    try {
      setLoading(true);
      if (editingCustomer && editingCustomer._id) {
        await api.put(`/customers/${editingCustomer._id}`, form);
        notifications.show({
          title: 'Success',
          message: 'Customer details updated',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        await api.post('/customers', form);
        notifications.show({
          title: 'Success',
          message: 'Customer added successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
      setModalOpened(false);
      fetchCustomers();
    } catch (error: any) {
      console.error(error);
      notifications.show({
        title: 'Error Saving Customer',
        message: error.response?.data?.message || error.message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      await api.delete(`/customers/${id}`);
      notifications.show({
        title: 'Success',
        message: 'Customer deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      fetchCustomers();
    } catch (error: any) {
      console.error(error);
      notifications.show({
        title: 'Error Deleting Customer',
        message: error.response?.data?.message || error.message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPoints = async (customer: Customer) => {
    if (!customer._id) return;
    modals.openConfirmModal({
      title: 'Reset Loyalty Points',
      centered: true,
      children: (
        <Text size="sm">
          Reset <strong>{customer.loyaltyPoints}</strong> loyalty points for <strong>{customer.name}</strong>? Do this after giving the reward.
        </Text>
      ),
      labels: { confirm: 'Reset Points', cancel: 'Cancel' },
      confirmProps: { color: 'orange' },
      onConfirm: async () => {
        try {
          await api.post(`/customers/${customer._id}/reset-points`);
          notifications.show({ title: 'Points Reset', message: `${customer.name}'s points have been reset to 0.`, color: 'orange', icon: <IconStar size={16} /> });
          fetchCustomers();
        } catch (err: any) {
          notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed to reset points', color: 'red' });
        }
      },
    });
  };

  const openDeleteModal = (customer: Customer) => {
    if (!customer._id) return;
    modals.openConfirmModal({
      title: 'Delete Customer',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{customer.name}</strong>? This action is irreversible.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => handleDelete(customer._id!),
    });
  };

  const setField = <K extends keyof typeof form>(key: K, val: typeof form[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  return (
    <Box p="md">
      {/* Header */}
      <Flex align="center" justify="space-between" mb="xl">
        <Box>
          <Title order={2} fw={800} c="#2c3e50">Customer Details</Title>
          <Text c="dimmed" size="sm">Manage and view all customer records</Text>
        </Box>
        <Button leftSection={<IconUserPlus size={16} />} color="teal" radius="md" size="md" onClick={openAdd}>
          Add Customer
        </Button>
      </Flex>

      {/* Summary Cards */}
      <Grid mb="xl">
        {[
          { label: 'Total Customers', value: customers.length, color: 'teal' },
          { label: 'Total Revenue', value: `€ ${customers.reduce((s, c) => s + c.totalAmount, 0).toLocaleString('en', { minimumFractionDigits: 2 })}`, color: 'blue' },
          { label: 'Total Visits', value: customers.reduce((s, c) => s + c.timesVisited, 0), color: 'orange' },
        ].map(card => (
          <Grid.Col span={4} key={card.label}>
            <Paper radius="lg" p="lg" withBorder style={{ borderLeft: `4px solid var(--mantine-color-${card.color}-6)` }}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">{card.label}</Text>
              <Text size="xl" fw={800} c="#2c3e50">{card.value}</Text>
            </Paper>
          </Grid.Col>
        ))}
      </Grid>

      {/* Table */}
      <Paper radius="lg" withBorder shadow="sm" p="lg">
        <TextInput
          placeholder="Search by name, phone or email..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          mb="md" radius="md"
          styles={{ input: { border: '1px solid #e0e0e0' } }}
        />
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead bg="gray.1">
            <Table.Tr>
              {['Name', 'Contact Num1', 'Email', 'Eircode', 'Times Visited', 'Total Amount', 'Points', 'Last Visit', 'Actions'].map(h => (
                <Table.Th key={h}><Text size="xs" fw={700} tt="uppercase" c="dimmed">{h}</Text></Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading && customers.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}><Text ta="center" c="dimmed" py="xl">Loading customers...</Text></Table.Td>
              </Table.Tr>
            ) : filtered.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}><Text ta="center" c="dimmed" py="xl">No customers found</Text></Table.Td>
              </Table.Tr>
            ) : filtered.map(c => (
              <Table.Tr key={c._id}>
                <Table.Td>
                  <Flex align="center" gap="sm">
                    <Box w={32} h={32} bg="teal.6" style={{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Text c="white" size="sm" fw={700}>{c.name[0]}</Text>
                    </Box>
                    <Text fw={600} size="sm">{c.name}</Text>
                  </Flex>
                </Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{c.contactNum1}</Text></Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{c.email || '—'}</Text></Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{c.eircode || '—'}</Text></Table.Td>
                <Table.Td><Badge color="blue" variant="light" radius="sm">{c.timesVisited}</Badge></Table.Td>
                <Table.Td><Badge color="green" variant="light" radius="sm">€ {c.totalAmount.toFixed(2)}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Badge color={(c.loyaltyPoints || 0) > 0 ? 'yellow' : 'gray'} variant="filled" radius="sm">
                      ⭐ {c.loyaltyPoints || 0}
                    </Badge>
                    {(c.loyaltyPoints || 0) > 0 && (
                      <ActionIcon size="xs" variant="light" color="orange" title="Reset points after giving reward" onClick={() => handleResetPoints(c)}>
                        <IconStar size={11} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td><Text size="sm" c="dimmed">{c.lastVisit || '—'}</Text></Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="light" color="blue" radius="md" onClick={() => openEdit(c)}><IconEdit size={15} /></ActionIcon>
                    <ActionIcon variant="light" color="red" radius="md" onClick={() => openDeleteModal(c)}><IconTrash size={15} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Text fw={700} size="lg">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</Text>}
        centered radius="lg" size="lg"
      >
        {/* Stats row (read-only when editing) */}
        {editingCustomer && (
          <Paper bg="gray.0" p="md" radius="md" withBorder mb="md">
            <Grid>
              <Grid.Col span={3}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Times Visited</Text>
                <Text size="xl" fw={800} c="blue.7">{editingCustomer.timesVisited}</Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Total Amount</Text>
                <Text size="xl" fw={800} c="green.7">€ {editingCustomer.totalAmount.toFixed(2)}</Text>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Loyalty Points</Text>
                <Group gap="xs" align="center">
                  <Text size="xl" fw={800} c="yellow.7">⭐ {editingCustomer.loyaltyPoints || 0}</Text>
                  {(editingCustomer.loyaltyPoints || 0) > 0 && (
                    <ActionIcon size="sm" variant="light" color="orange" title="Reset points" onClick={() => { handleResetPoints(editingCustomer); setModalOpened(false); }}>
                      <IconStar size={13} />
                    </ActionIcon>
                  )}
                </Group>
              </Grid.Col>
              <Grid.Col span={3}>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Last Visit</Text>
                <Text size="xl" fw={800} c="orange.7">{editingCustomer.lastVisit || '—'}</Text>
              </Grid.Col>
            </Grid>
          </Paper>
        )}

        <Divider mb="md" label="Customer Information" labelPosition="left" />

        <Grid>
          <Grid.Col span={12}>
            <TextInput
              label="*Customer Name"
              placeholder="Full Name"
              required
              leftSection={<IconUser size={15} />}
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="*Contact Num1"
              placeholder="+92 300 0000000"
              required
              leftSection={<IconPhone size={15} />}
              value={form.contactNum1}
              onChange={e => setField('contactNum1', e.target.value)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Contact Num2"
              placeholder="+92 300 0000000"
              leftSection={<IconPhone size={15} />}
              value={form.contactNum2}
              onChange={e => setField('contactNum2', e.target.value)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <TextInput
              label="Email Id"
              placeholder="email@example.com"
              leftSection={<IconMail size={15} />}
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Textarea
              label="Address"
              placeholder="Street, City, Country"
              value={form.address}
              onChange={e => setField('address', e.target.value)}
              radius="md"
              minRows={3}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="Eircode"
              placeholder="D01 F5P2"
              value={form.eircode}
              onChange={e => setField('eircode', e.target.value)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="QR Code"
              placeholder="QR Code"
              leftSection={<IconAddressBook size={15} />}
              value={form.qrCode}
              onChange={e => setField('qrCode', e.target.value)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="Barcode"
              placeholder="Barcode"
              value={form.barcode}
              onChange={e => setField('barcode', e.target.value)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <DateInput
              label="Birthday"
              placeholder="DD/MM/YYYY"
              valueFormat="DD/MM/YYYY"
              value={form.birthday ? new Date(form.birthday) : null}
              onChange={val => setField('birthday', val as any)}
              radius="md"
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <DateInput
              label="Anniversary"
              placeholder="DD/MM/YYYY"
              valueFormat="DD/MM/YYYY"
              value={form.anniversary ? new Date(form.anniversary) : null}
              onChange={val => setField('anniversary', val as any)}
              radius="md"
            />
          </Grid.Col>
        </Grid>

        <Button mt="xl" color="teal" radius="md" onClick={handleSave} fullWidth size="md" loading={loading}>
          {editingCustomer ? 'Save Changes' : 'Add Customer'}
        </Button>
      </Modal>
    </Box>
  );
};

export default Customers;
