import { useEffect, useState } from 'react';
import { Table, Button, Group, Title, Modal, TextInput, Select, Paper, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconPlus } from '@tabler/icons-react';

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
      await api.post('/employees', values);
      notifications.show({
        title: 'Success',
        message: 'Employee saved successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      close();
      form.reset();
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

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2}>Employees</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
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
              </Table.Tr>
            ))}
            {employees.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7} ta="center" py="xl">
                  No employees found.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={opened} onClose={close} title="Add New Employee" size="md">
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
            <Button fullWidth type="submit" loading={loading} mt="md">Save Employee</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};

export default Employees;
