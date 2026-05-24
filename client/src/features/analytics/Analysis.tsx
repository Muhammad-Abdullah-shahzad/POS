import { SimpleGrid, Paper, Title, Text, Group, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { IconChartAreaLine, IconTrophy, IconWallet, IconCategory } from '@tabler/icons-react';

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  orders: number;
}

interface TopProduct {
  name: string;
  totalQty: number;
  totalRevenue: number;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
}

interface ExpenseBreakdown {
  category: string;
  total: number;
  count: number;
}

const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#15aabf'];

const Analysis = () => {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdown[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const [summaryRes, productsRes, paymentRes, expenseRes] = await Promise.all([
          api.get('/analytics/monthly-summary'),
          api.get('/analytics/top-products'),
          api.get('/analytics/payment-methods'),
          api.get('/analytics/expense-categories')
        ]);

        setMonthlyData(summaryRes.data.data.monthly);
        setTopProducts(productsRes.data.data);
        setPaymentBreakdown(paymentRes.data.data);
        setExpenseBreakdown(expenseRes.data.data);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return <Text p="xl">Loading store insights...</Text>;

  return (
    <Stack gap="xs" p="xs" style={{ height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      <Group justify="space-between" px="xs">
        <Title order={3}>Store Analysis</Title>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs" verticalSpacing="xs" style={{ flex: 1 }}>
        {/* Row 1, Col 1: Trend */}
        <Paper withBorder p="sm" radius="md" shadow="xs" style={{ display: 'flex', flexDirection: 'column' }}>
          <Group gap="xs" mb="xs">
            <IconChartAreaLine size={18} color="#228be6" />
            <Text fw={600} size="sm">Revenue & Profit Trend</Text>
          </Group>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#228be6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#228be6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" fontSize={10} tickMargin={5} />
                <YAxis fontSize={10} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '4px' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '10px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#228be6" fill="url(#colorRev)" name="Revenue" />
                <Area type="monotone" dataKey="profit" stroke="#40c057" fillOpacity={0} name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Paper>

        {/* Row 1, Col 2: Top Products */}
        <Paper withBorder p="sm" radius="md" shadow="xs" style={{ display: 'flex', flexDirection: 'column' }}>
          <Group gap="xs" mb="xs">
            <IconTrophy size={18} color="#fab005" />
            <Text fw={600} size="sm">Top Sellers (by Revenue)</Text>
          </Group>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} fontSize={10} />
                <Tooltip cursor={{fill: '#f8f9fa'}} contentStyle={{ fontSize: '12px' }} />
                <Bar dataKey="totalRevenue" fill="#228be6" radius={[0, 4, 4, 0]} name="Revenue (€)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Paper>

        {/* Row 2, Col 1: Payment Methods */}
        <Paper withBorder p="sm" radius="md" shadow="xs" style={{ display: 'flex', flexDirection: 'column' }}>
          <Group gap="xs" mb="xs">
            <IconWallet size={18} color="#15aabf" />
            <Text fw={600} size="sm">Payment Sources</Text>
          </Group>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  cx="50%" cy="50%"
                  innerRadius={45} outerRadius={70}
                  dataKey="total" nameKey="method"
                  label={{ fontSize: 10 }}
                >
                  {paymentBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Paper>

        {/* Row 2, Col 2: Expense Categories */}
        <Paper withBorder p="sm" radius="md" shadow="xs" style={{ display: 'flex', flexDirection: 'column' }}>
          <Group gap="xs" mb="xs">
            <IconCategory size={18} color="#fa5252" />
            <Text fw={600} size="sm">Expense Distribution</Text>
          </Group>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%" cy="50%"
                  outerRadius={70}
                  dataKey="total" nameKey="category"
                  label={{ fontSize: 10 }}
                >
                  {expenseBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
};

export default Analysis;
