import { useEffect, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Title, Group, ThemeIcon, Stack,
  RingProgress, Box, Loader, Center
} from '@mantine/core';
import {
  IconCash, IconPackage, IconUsersGroup, IconReceipt,
  IconTrendingUp, IconShoppingCart, IconBuildingStore, IconAlertCircle
} from '@tabler/icons-react';
import api from '../../services/api';

interface StatCard {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  ring?: number; // 0-100
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalExpenses: 0,
    cashSales: 0,
    cardSales: 0,
    splitSales: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [ordersRes, productsRes, customersRes, expensesRes] = await Promise.all([
          api.get('/orders').catch(() => ({ data: { data: [] } })),
          api.get('/products').catch(() => ({ data: { data: [] } })),
          api.get('/customers').catch(() => ({ data: { data: [] } })),
          api.get('/expenses').catch(() => ({ data: { data: [] } })),
        ]);

        const orders: any[] = ordersRes.data?.data || [];
        const products: any[] = productsRes.data?.data || [];
        const customers: any[] = customersRes.data?.data || [];
        const expenses: any[] = expensesRes.data?.data || [];

        const totalSales = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
        const cashSales = orders
          .filter(o => (o.paymentMethod || '').toLowerCase() === 'cash')
          .reduce((s, o) => s + (Number(o.total) || 0), 0)
          + orders
            .filter(o => (o.paymentMethod || '').toLowerCase() === 'split')
            .reduce((s, o) => s + (Number(o.splitCash) || 0), 0);
        const cardSales = orders
          .filter(o => (o.paymentMethod || '').toLowerCase() === 'card')
          .reduce((s, o) => s + (Number(o.total) || 0), 0)
          + orders
            .filter(o => (o.paymentMethod || '').toLowerCase() === 'split')
            .reduce((s, o) => s + (Number(o.splitCard) || 0), 0);
        const splitSales = orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'split').length;
        const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const lowStockCount = products.filter(p => p.stock <= 10).length;

        setStats({
          totalSales,
          totalOrders: orders.length,
          totalProducts: products.length,
          totalCustomers: customers.length,
          totalExpenses,
          cashSales,
          cardSales,
          splitSales,
          lowStockCount,
        });
      } catch (err) {
        console.error('Admin dashboard load error', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <Center h={400}>
        <Stack align="center" gap="xs">
          <Loader size="lg" color="violet" />
          <Text c="dimmed">Loading admin overview...</Text>
        </Stack>
      </Center>
    );
  }

  const profit = stats.totalSales - stats.totalExpenses;
  const expenseRatio = stats.totalSales > 0
    ? Math.min(100, Math.round((stats.totalExpenses / stats.totalSales) * 100))
    : 0;

  const cards: StatCard[] = [
    {
      label: 'Total Sales',
      value: `Rs. ${stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: `${stats.totalOrders} orders`,
      icon: <IconTrendingUp size={22} />,
      color: 'violet',
    },
    {
      label: 'Cash Collected',
      value: `Rs. ${stats.cashSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: 'Cash + Split cash',
      icon: <IconCash size={22} />,
      color: 'green',
    },
    {
      label: 'Card Collected',
      value: `Rs. ${stats.cardSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: `${stats.splitSales} split txns`,
      icon: <IconShoppingCart size={22} />,
      color: 'blue',
    },
    {
      label: 'Total Expenses',
      value: `Rs. ${stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: `${expenseRatio}% of sales`,
      icon: <IconReceipt size={22} />,
      color: 'orange',
      ring: expenseRatio,
    },
    {
      label: 'Net Profit',
      value: `Rs. ${profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      sub: profit >= 0 ? 'Profitable' : 'Loss',
      icon: <IconBuildingStore size={22} />,
      color: profit >= 0 ? 'teal' : 'red',
    },
    {
      label: 'Products',
      value: String(stats.totalProducts),
      sub: `${stats.lowStockCount} low stock`,
      icon: <IconPackage size={22} />,
      color: stats.lowStockCount > 0 ? 'yellow' : 'cyan',
    },
    {
      label: 'Customers',
      value: String(stats.totalCustomers),
      sub: 'Registered',
      icon: <IconUsersGroup size={22} />,
      color: 'indigo',
    },
    {
      label: 'Low Stock Alert',
      value: String(stats.lowStockCount),
      sub: 'Items ≤ 10 units',
      icon: <IconAlertCircle size={22} />,
      color: stats.lowStockCount > 0 ? 'red' : 'gray',
    },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Admin Overview</Title>
          <Text size="sm" c="dimmed">Live snapshot of store performance</Text>
        </div>
        <Text size="xs" c="dimmed">{new Date().toLocaleString()}</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, sm: 2, md: 4 }} spacing="md">
        {cards.map((card) => (
          <Paper key={card.label} withBorder p="md" radius="md" shadow="xs">
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">{card.label}</Text>
              <ThemeIcon color={card.color} variant="light" size="lg" radius="md">
                {card.icon}
              </ThemeIcon>
            </Group>
            <Group align="flex-end" justify="space-between">
              <Box>
                <Text size="xl" fw={800} lh={1}>{card.value}</Text>
                {card.sub && <Text size="xs" c="dimmed" mt={4}>{card.sub}</Text>}
              </Box>
              {card.ring !== undefined && (
                <RingProgress
                  size={48}
                  thickness={5}
                  sections={[{ value: card.ring, color: card.color }]}
                  label={<Text size="9px" ta="center" fw={700}>{card.ring}%</Text>}
                />
              )}
            </Group>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
};

export default AdminDashboard;
