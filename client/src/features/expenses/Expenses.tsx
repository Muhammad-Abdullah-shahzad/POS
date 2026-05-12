import { useEffect, useState } from 'react';
import { Table, Button, Group, Title, Modal, TextInput, NumberInput, Select, Paper, Autocomplete } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';

interface Expense {
  _id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod: string;
}

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [categoryOpened, { open: openCategory, close: closeCategory }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('customExpenseCategories');
    return saved ? JSON.parse(saved) : [];
  });

  const fetchExpenses = async () => {
    try {
      const { data } = await api.get('/expenses');
      setExpenses(data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const form = useForm({
    initialValues: {
      title: '',
      amount: 0,
      category: '',
      paymentMethod: 'cash',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      await api.post('/expenses', values);
      close();
      form.reset();
      fetchExpenses();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      const updated = [...customCategories, newCategory.trim()];
      setCustomCategories(updated);
      localStorage.setItem('customExpenseCategories', JSON.stringify(updated));
      setNewCategory('');
      closeCategory();
    }
  };

  const uniqueCategories = Array.from(new Set([
    ...customCategories,
    ...expenses.map(e => e.category),
    'Rent', 'Utilities', 'Salaries', 'Supplies', 'Marketing', 'Other'
  ])).filter(Boolean);

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>Expenses Tracker</Title>
        <Group>
          <Button variant="light" color="red" onClick={openCategory}>Add Category</Button>
          <Button color="red" onClick={open}>Add Expense</Button>
        </Group>
      </Group>

      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Title</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Method</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {expenses.map((e) => (
              <Table.Tr key={e._id}>
                <Table.Td>{new Date(e.date).toLocaleDateString()}</Table.Td>
                <Table.Td>{e.title}</Table.Td>
                <Table.Td>{e.category}</Table.Td>
                <Table.Td c="red">Rs -{e.amount.toFixed(2)}</Table.Td>
                <Table.Td>{e.paymentMethod}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={close} title="Record Expense" size="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput label="Title" required mb="md" {...form.getInputProps('title')} />
          <NumberInput label="Amount" required min={0} mb="md" {...form.getInputProps('amount')} />
          <Autocomplete
            label="Category"
            data={uniqueCategories}
            required
            mb="md"
            {...form.getInputProps('category')}
          />
          <Select
            label="Payment Method"
            data={['cash', 'bank', 'card']}
            required
            mb="xl"
            {...form.getInputProps('paymentMethod')}
          />
          <Button fullWidth color="red" type="submit" loading={loading}>Save Expense</Button>
        </form>
      </Modal>

      <Modal opened={categoryOpened} onClose={closeCategory} title="Add Expense Category" size="sm">
        <TextInput 
          label="Category Name" 
          placeholder="e.g. Travel" 
          value={newCategory} 
          onChange={(e) => setNewCategory(e.currentTarget.value)}
          mb="md"
        />
        <Button fullWidth color="red" onClick={handleAddCategory}>Save Category</Button>
      </Modal>
    </Paper>
  );
};

export default Expenses;
