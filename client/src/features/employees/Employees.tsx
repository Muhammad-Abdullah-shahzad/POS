import { useEffect, useState } from 'react';
import { Table, Button, Group, Title, Modal, TextInput, Select, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';

interface Employee {
  _id: string;
  name: string;
  contactNo: string;
  emailId: string;
  address: string;
  role: string;
  gender: string;
  dob: string;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get('/employees');
      setEmployees(data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const form = useForm({
    initialValues: {
      name: '',
      contactNo: '',
      emailId: '',
      address: '',
      role: '',
      gender: '',
      dob: '',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    if (loading) return;
    try {
      setLoading(true);
      if (editTarget) {
        await api.put(`/employees/${editTarget._id}`, values);
        notifications.show({
          title: 'Success',
          message: 'Employee updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        await api.post('/employees', values);
        notifications.show({
          title: 'Success',
          message: 'Employee saved successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      }
      handleCloseModal();
      fetchEmployees();
    } catch (error: any) {
      console.error('Submit Error:', error);
      const message = error.response?.data?.message || error.message;
      notifications.show({
        title: 'Error Saving Employee',
        message: message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.delete(`/employees/${deleteTarget._id}`);
      notifications.show({
        title: 'Success',
        message: 'Employee deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      setDeleteTarget(null);
      fetchEmployees();
    } catch (error: any) {
      console.error('Delete Error:', error);
      const message = error.response?.data?.message || error.message;
      notifications.show({
        title: 'Error Deleting Employee',
        message: message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseModal = () => {
    close();
    form.reset();
    setEditTarget(null);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Employees</Title>
        <Button 
          leftSection={<IconPlus size={16} />} 
          onClick={() => {
            setEditTarget(null);
            form.reset();
            open();
          }}
        >
          Add New Employee
        </Button>
      </Group>

      <Paper withBorder radius="md">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Contact No</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Gender</Table.Th>
              <Table.Th>DOB</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {employees.map((e) => (
              <Table.Tr key={e._id}>
                <Table.Td fw={500}>{e.name}</Table.Td>
                <Table.Td>{e.contactNo}</Table.Td>
                <Table.Td>{e.emailId}</Table.Td>
                <Table.Td>{e.address}</Table.Td>
                <Table.Td>{e.role}</Table.Td>
                <Table.Td>{e.gender}</Table.Td>
                <Table.Td>{new Date(e.dob).toLocaleDateString()}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Group gap="xs" justify="flex-end">
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="blue" 
                      leftSection={<IconEdit size={14} />}
                      onClick={() => {
                        setEditTarget(e);
                        form.setValues({
                          name: e.name,
                          contactNo: e.contactNo,
                          emailId: e.emailId,
                          address: e.address,
                          role: e.role,
                          gender: e.gender,
                          dob: e.dob ? new Date(e.dob).toISOString().split('T')[0] : '',
                        });
                        open();
                      }}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="red" 
                      leftSection={<IconTrash size={14} />}
                      onClick={() => setDeleteTarget(e)}
                    >
                      Delete
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {employees.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} ta="center" py="xl">
                  No employees found.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={opened} onClose={handleCloseModal} title={editTarget ? "Edit Employee" : "Add New Employee"} size="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="sm">
            <TextInput label="Employee Name" required {...form.getInputProps('name')} />
            <TextInput label="Contact No" required {...form.getInputProps('contactNo')} />
            <TextInput label="Email" type="email" required {...form.getInputProps('emailId')} />
            <TextInput label="Address" required {...form.getInputProps('address')} />
            <TextInput label="Employee Role" required {...form.getInputProps('role')} />
            <Select 
              label="Gender" 
              data={['Male', 'Female', 'Other']} 
              required 
              {...form.getInputProps('gender')} 
            />
            <TextInput 
              label="DOB" 
              type="date" 
              required 
              {...form.getInputProps('dob')} 
            />
            <Button fullWidth type="submit" loading={loading} mt="md">
              {editTarget ? "Update Employee" : "Save Employee"}
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal 
        opened={!!deleteTarget} 
        onClose={() => setDeleteTarget(null)} 
        title="Delete Employee" 
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete employee <strong>{deleteTarget?.name}</strong>? This action will permanently remove their records from the system.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" color="gray" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button color="red" loading={deleting} onClick={handleDelete}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default Employees;
