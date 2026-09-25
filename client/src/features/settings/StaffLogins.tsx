import { useState, useEffect } from 'react';
import { 
  Paper, Stack, Group, Title, Button, Table, ActionIcon, 
  Text, Badge, Modal, TextInput, PasswordInput, Select, Loader 
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconEdit, IconTrash, IconUserPlus } from '@tabler/icons-react';
import api from '../../services/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  createdAt: string;
}

const StaffLogins = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      password: '',
      role: 'cashier',
    },
    validate: {
      name: (val) => (val.trim().length >= 2 ? null : 'Name must be at least 2 characters'),
      email: (val) => (/^\S+@\S+\.\S+$/.test(val) ? null : 'Invalid email'),
      password: (val) => {
        if (editUser && !val) return null;
        return val.length >= 8 ? null : 'Password must be at least 8 characters';
      },
      role: (val) => (['admin', 'manager', 'cashier'].includes(val) ? null : 'Invalid role'),
    },
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/users');
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to fetch staff logins',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditUser(user);
      form.setValues({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
      });
    } else {
      setEditUser(null);
      form.reset();
    }
    setModalOpened(true);
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    form.reset();
    setEditUser(null);
  };

  const handleSubmit = async (values: typeof form.values) => {
    setIsSubmitting(true);
    try {
      if (editUser) {
        const payload: any = {
          name: values.name,
          role: values.role,
        };
        if (values.password) {
          payload.password = values.password;
        }

        const { data } = await api.patch(`/users/${editUser._id}`, payload);
        if (data.success) {
          notifications.show({
            title: 'Updated',
            message: 'User account updated successfully',
            color: 'teal',
            icon: <IconCheck size={16} />,
          });
        }
      } else {
        const { data } = await api.post('/users', values);
        if (data.success) {
          notifications.show({
            title: 'Created',
            message: 'User account created successfully',
            color: 'teal',
            icon: <IconCheck size={16} />,
          });
        }
      }
      handleCloseModal();
      fetchUsers();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to save user account',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpened(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      setIsSubmitting(true);
      const { data } = await api.delete(`/users/${userToDelete._id}`);
      if (data.success) {
        notifications.show({
          title: 'Deleted',
          message: 'User account deleted successfully',
          color: 'teal',
          icon: <IconCheck size={16} />,
        });
        fetchUsers();
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete user account',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setIsSubmitting(false);
      setDeleteModalOpened(false);
      setUserToDelete(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'manager': return 'blue';
      case 'cashier': return 'green';
      default: return 'gray';
    }
  };

  return (
    <Paper withBorder p="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Title order={4}>Manage Staff Logins</Title>
            <Text size="sm" c="dimmed">Add, update, or remove system access credentials for your employees.</Text>
          </div>
          <Button leftSection={<IconUserPlus size={16} />} onClick={() => handleOpenModal()}>
            Add Account
          </Button>
        </Group>

        {loading ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email (Login)</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Created Date</Table.Th>
                <Table.Th ta="right">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <Table.Tr key={user._id}>
                    <Table.Td>{user.name}</Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>
                      <Badge color={getRoleColor(user.role)} variant="light">
                        {user.role}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{new Date(user.createdAt).toLocaleDateString()}</Table.Td>
                    <Table.Td ta="right">
                      <Group gap="xs" justify="flex-end">
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenModal(user)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" onClick={() => confirmDelete(user)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} ta="center" py="xl">
                    <Text c="dimmed">No staff accounts found.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={handleCloseModal}
        title={editUser ? 'Edit Staff Account' : 'Create Staff Account'}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="sm">
            <TextInput
              label="Name"
              placeholder="e.g. John Doe"
              required
              {...form.getInputProps('name')}
            />
            <TextInput
              label="Email Address"
              placeholder="e.g. john@shop.com"
              type="email"
              required
              disabled={!!editUser}
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Password"
              placeholder={editUser ? 'Leave blank to keep unchanged' : 'At least 6 characters'}
              required={!editUser}
              {...form.getInputProps('password')}
            />
            <Select
              label="Role"
              data={[
                { value: 'cashier', label: 'Cashier' },
                { value: 'manager', label: 'Manager' },
                { value: 'admin', label: 'Admin' },
              ]}
              required
              {...form.getInputProps('role')}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={handleCloseModal}>Cancel</Button>
              <Button type="submit" loading={isSubmitting}>
                {editUser ? 'Save Changes' : 'Create Account'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Confirm Deletion"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete the account for <strong>{userToDelete?.name}</strong>? 
            They will no longer be able to log in to the system.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setDeleteModalOpened(false)}>Cancel</Button>
            <Button color="red" onClick={handleDelete} loading={isSubmitting}>Delete Account</Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
};

export default StaffLogins;
