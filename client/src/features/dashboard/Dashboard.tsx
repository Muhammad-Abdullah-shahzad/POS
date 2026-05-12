import { SimpleGrid, Paper, Title, Text, Group, TextInput, Tabs, Table, Button, Modal, Badge, Stack, Divider } from '@mantine/core';
import { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { IconCoin, IconReceipt2, IconCash, IconChartBar, IconEye, IconPrinter } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';

interface Stats {
  totalRevenue: number;
  totalVATCollected: number;
  totalExpenses: number;
  netProfit: number;
  orderCount: number;
  lowStock: Array<{
    name: string;
    sku: string;
    stock: number;
    category: string;
  }>;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/dashboard/stats', { params: { month: selectedMonth } });
        setStats(data.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, [selectedMonth]);

  if (!stats) return <Text>Loading...</Text>;

  const statCards = [
    { title: 'Total Revenue', value: `Rs ${stats.totalRevenue.toFixed(2)}`, icon: IconCoin, color: 'blue' },
    { title: 'Net Profit', value: `Rs ${stats.netProfit.toFixed(2)}`, icon: IconChartBar, color: 'green' },
    { title: 'Expenses', value: `Rs ${stats.totalExpenses.toFixed(2)}`, icon: IconCash, color: 'red' },
  ];

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={2}>Business Dashboard</Title>
        <TextInput 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.currentTarget.value)}
          placeholder="Filter by month"
        />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {statCards.map((stat) => (
          <Paper withBorder p="md" radius="md" key={stat.title}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                {stat.title}
              </Text>
              <stat.icon size={20} color={`var(--mantine-color-${stat.color}-6)`} stroke={1.5} />
            </Group>
            <Group align="flex-end" gap="xs" mt={25}>
              <Text size="xl" fw={700}>
                {stat.value}
              </Text>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Paper withBorder p="md" radius="md" mt="lg" shadow="sm">
        <Group mb="md">
          <IconReceipt2 color="red" size={24} />
          <Title order={4}>Low Stock Alerts</Title>
        </Group>
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Product</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Stock Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {stats.lowStock.length > 0 ? stats.lowStock.map((product) => (
              <Table.Tr key={product.sku}>
                <Table.Td>
                  <Text size="sm" fw={500}>{product.name}</Text>
                  <Text size="xs" c="dimmed">{product.sku}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="outline" size="sm">{product.category}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text fw={700} c={product.stock <= 5 ? 'red' : 'orange'}>
                      {product.stock} units left
                    </Text>
                    {product.stock <= 5 && <Badge color="red" variant="filled">Critical</Badge>}
                  </Group>
                </Table.Td>
              </Table.Tr>
            )) : (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text size="sm" c="dimmed" ta="center" py="md">Inventory levels are healthy</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </div>
  );
};

export default Dashboard;
