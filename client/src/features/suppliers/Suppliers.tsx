import { useEffect, useState } from 'react';
import { Table, Button, Group, Title, Modal, TextInput, Paper, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconPlus, IconTrash } from '@tabler/icons-react';
import { errorMessage } from '../../utils/errorMessage';

interface Supplier {
  _id: string;
  name: string;
  contact: string;
  emailId: string;
  address: string;
}

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);

  const fetchSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers');
      setSuppliers(data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const form = useForm({
    initialValues: {
      name: '',
      contact: '',
      emailId: '',
      address: '',
    },
    validate: {
      name: (value) => {
        const taken = suppliers.find((s) => s.name.trim().toLowerCase() === value.trim().toLowerCase());
        return taken ? `A supplier named "${taken.name}" already exists` : null;
      },
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    if (loading) return;
    try {
      setLoading(true);
      await api.post('/suppliers', values);
      notifications.show({ title: 'Success', message: 'Supplier saved successfully', color: 'green', icon: <IconCheck size={16} /> });
      close();
      form.reset();
      fetchSuppliers();
    } catch (error: any) {
      notifications.show({ title: 'Error Saving Supplier', message: errorMessage(error, 'The supplier could not be saved'), color: 'red', icon: <IconX size={16} /> });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!window.confirm(`Delete "${supplier.name}"? This removes the supplier record but does NOT delete their invoices.`)) return;
    try {
      await api.delete(`/suppliers/${supplier._id}`);
      notifications.show({ title: 'Deleted', message: `${supplier.name} has been removed.`, color: 'teal', icon: <IconCheck size={16} /> });
      fetchSuppliers();
    } catch (error) {
      notifications.show({ title: 'Error', message: errorMessage(error, 'Could not delete supplier.'), color: 'red', icon: <IconX size={16} /> });
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>Suppliers</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>Add New Supplier</Button>
      </Group>

      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Contact</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {suppliers.map((s) => (
              <Table.Tr key={s._id}>
                <Table.Td>{s.name}</Table.Td>
                <Table.Td>{s.contact}</Table.Td>
                <Table.Td>{s.emailId}</Table.Td>
                <Table.Td>{s.address}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <ActionIcon color="red" variant="light" title="Delete supplier" onClick={() => handleDelete(s)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={close} title="Add New Supplier" size="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput label="Name" required mb="md" {...form.getInputProps('name')} />
          <TextInput label="Contact" required mb="md" {...form.getInputProps('contact')} />
          <TextInput label="Email" type="email" required mb="md" {...form.getInputProps('emailId')} />
          <TextInput label="Address" required mb="xl" {...form.getInputProps('address')} />
          <Button fullWidth type="submit" loading={loading}>Save Supplier</Button>
        </form>
      </Modal>
    </Paper>
  );
};

export default Suppliers;
