import { useEffect, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Title, Group, ThemeIcon, Stack,
  RingProgress, Box, Loader, Center, Modal, Table, Badge,
  Divider, Progress, ScrollArea
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconCash, IconPackage, IconUsersGroup, IconReceipt,
  IconTrendingUp, IconShoppingCart, IconBuildingStore, IconAlertCircle
} from '@tabler/icons-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import api from '../../services/api';

const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#15aabf', '#fd7e14'];
const fmt = (n: number) => `€ ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `€ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€ ${(n / 1_000).toFixed(1)}K`;
  return `€ ${n.toFixed(2)}`;
};

// Responsive stat mini-card used inside modals
const MiniCard = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <Paper withBorder p="sm" radius="md">
    <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>{label}</Text>
    <Text fw={800} size="md" c={color} style={{ wordBreak: 'break-word' }}>{value}</Text>
  </Paper>
);

const AdminDashboard = () => {
  const isMobile = useMediaQuery('(max-width: 600px)');
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [oR, pR, cR, eR] = await Promise.all([
          api.get('/orders').catch(() => ({ data: { data: [] } })),
          api.get('/products').catch(() => ({ data: { data: [] } })),
          api.get('/customers').catch(() => ({ data: { data: [] } })),
          api.get('/expenses').catch(() => ({ data: { data: [] } })),
        ]);
        setOrders(oR.data?.data || []);
        setProducts(pR.data?.data || []);
        setCustomers(cR.data?.data || []);
        setExpenses(eR.data?.data || []);
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
      <Center h={300}>
        <Stack align="center" gap="xs">
          <Loader size="lg" color="violet" />
          <Text c="dimmed" size="sm">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  // -- Derived stats --
  const totalSales = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalOrders = orders.length;
  const cashOrders = orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'cash');
  const cardOrders = orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'card');
  const splitOrders = orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'split');
  const cashSales = cashOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    + splitOrders.reduce((s, o) => s + (Number(o.splitCash) || 0), 0);
  const cardSales = cardOrders.reduce((s, o) => s + (Number(o.total) || 0), 0)
    + splitOrders.reduce((s, o) => s + (Number(o.splitCard) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const profit = totalSales - totalExpenses;
  const expenseRatio = totalSales > 0 ? Math.min(100, Math.round((totalExpenses / totalSales) * 100)) : 0;
  const lowStock = products.filter(p => p.stock <= 10);

  // Daily sales (last 14 days)
  const dailyMap: Record<string, number> = {};
  orders.forEach(o => {
    const d = o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : 'Unknown';
    dailyMap[d] = (dailyMap[d] || 0) + (Number(o.total) || 0);
  });
  const dailyData = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
    .slice(-14).map(([date, total]) => ({ date: date.slice(5), total }));

  // Expense by category
  const expCatMap: Record<string, number> = {};
  expenses.forEach(e => { const c = e.category || 'General'; expCatMap[c] = (expCatMap[c] || 0) + (Number(e.amount) || 0); });
  const expCatData = Object.entries(expCatMap).map(([name, value]) => ({ name, value }));

  // Top products by revenue
  const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach(o => (o.items || []).forEach((item: any) => {
    const k = item.name || 'Unknown';
    if (!prodMap[k]) prodMap[k] = { name: k, qty: 0, revenue: 0 };
    prodMap[k].qty += Number(item.quantity) || 0;
    prodMap[k].revenue += Number(item.totalPrice) || 0;
  }));
  const topProducts = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const payData = [
    { name: 'Cash', value: cashSales },
    { name: 'Card', value: cardSales },
  ].filter(d => d.value > 0);

  const cards = [
    { key: 'total-sales', label: 'Total Sales',     value: fmtShort(totalSales),   sub: `${totalOrders} orders`,            icon: <IconTrendingUp size={28} />, color: 'violet' },
    { key: 'cash',        label: 'Cash',             value: fmtShort(cashSales),    sub: 'Cash + Split cash',                icon: <IconCash size={28} />,        color: 'green'  },
    { key: 'card',        label: 'Card',             value: fmtShort(cardSales),    sub: `${splitOrders.length} split`,      icon: <IconShoppingCart size={28} />, color: 'blue'   },
    { key: 'expenses',    label: 'Expenses',         value: fmtShort(totalExpenses),sub: `${expenseRatio}% of sales`,        icon: <IconReceipt size={28} />,      color: 'orange', ring: expenseRatio },
    { key: 'profit',      label: 'Net Profit',       value: fmtShort(profit),       sub: profit >= 0 ? 'Profitable' : 'Loss', icon: <IconBuildingStore size={28} />, color: profit >= 0 ? 'teal' : 'red' },
    { key: 'products',    label: 'Products',         value: String(products.length),sub: `${lowStock.length} low stock`,     icon: <IconPackage size={28} />,      color: lowStock.length > 0 ? 'yellow' : 'cyan' },
    { key: 'customers',   label: 'Customers',        value: String(customers.length), sub: 'Registered',                    icon: <IconUsersGroup size={28} />,   color: 'indigo' },
    { key: 'low-stock',   label: 'Low Stock',        value: String(lowStock.length),  sub: 'Items <= 10 units',              icon: <IconAlertCircle size={28} />,  color: lowStock.length > 0 ? 'red' : 'gray' },
  ];

  // Modal props - fullScreen on mobile for all modals
  const modalProps = { fullScreen: !!isMobile, centered: !isMobile, scrollAreaComponent: ScrollArea.Autosize };

  return (
    <Stack gap="md">

      {/* Cards grid - 2 cols on mobile, 4 on desktop */}
      <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="sm">
        {cards.map((card) => (
          <Paper
            key={card.key}
            withBorder p="sm" radius="md" shadow="xs"
            onClick={() => setActiveModal(card.key)}
            style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
          >
            <Group justify="space-between" mb={6} wrap="nowrap">
              <Text size="10px" c="dimmed" fw={700} tt="uppercase" style={{ lineHeight: 1.2 }}>{card.label}</Text>
              <ThemeIcon color={card.color} variant="light" size="xl" radius="md" style={{ flexShrink: 0 }}>
                {card.icon}
              </ThemeIcon>
            </Group>
            <Group align="flex-end" justify="space-between" wrap="nowrap">
              <Box style={{ minWidth: 0 }}>
                <Text fw={800} size={isMobile ? 'md' : 'lg'} lh={1} style={{ wordBreak: 'break-word' }}>{card.value}</Text>
                {card.sub && <Text size="10px" c="dimmed" mt={2} lineClamp={1}>{card.sub}</Text>}
              </Box>
              {(card as any).ring !== undefined && (
                <RingProgress size={40} thickness={4}
                  sections={[{ value: (card as any).ring, color: card.color }]}
                  label={<Text size="8px" ta="center" fw={700}>{(card as any).ring}%</Text>}
                  style={{ flexShrink: 0 }}
                />
              )}
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      {/* -- MODAL: Total Sales -- */}
      <Modal {...modalProps} size="lg" opened={activeModal === 'total-sales'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg">Total Sales Analysis</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <MiniCard label="Total Revenue" value={fmt(totalSales)} color="violet" />
            <MiniCard label="Total Orders" value={String(totalOrders)} />
            <MiniCard label="Avg Order" value={totalOrders > 0 ? fmt(totalSales / totalOrders) : fmt(0)} />
          </SimpleGrid>
          <Divider label="Daily Sales - Last 14 days" labelPosition="center" />
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={9} interval="preserveStartEnd" />
                <YAxis fontSize={9} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Bar dataKey="total" fill="#7950f2" radius={[3, 3, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          ) : <Text c="dimmed" ta="center" py="md" size="sm">No sales data yet.</Text>}
          <Divider label="Recent Orders" labelPosition="center" />
          <ScrollArea h={220}>
            <Table striped highlightOnHover fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                  <Table.Th>Method</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orders.slice(0, 20).map((o, i) => (
                  <Table.Tr key={i}>
                    <Table.Td style={{ fontFamily: 'monospace', fontSize: 11 }}>{(o.invoiceId || '').slice(-10)}</Table.Td>
                    <Table.Td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }} fw={600}>{fmt(o.total)}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={(o.paymentMethod || '').toLowerCase() === 'cash' ? 'green' : (o.paymentMethod || '').toLowerCase() === 'card' ? 'blue' : 'grape'} variant="light">
                        {(o.paymentMethod || 'cash').toUpperCase()}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* -- MODAL: Cash -- */}
      <Modal {...modalProps} size="md" opened={activeModal === 'cash'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg">Cash Collections</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={2} spacing="sm">
            <MiniCard label="Pure Cash" value={fmt(cashOrders.reduce((s, o) => s + (Number(o.total) || 0), 0))} color="green" />
            <MiniCard label="Cash from Split" value={fmt(splitOrders.reduce((s, o) => s + (Number(o.splitCash) || 0), 0))} color="grape" />
          </SimpleGrid>
          <Paper withBorder p="sm" radius="md" style={{ backgroundColor: '#f0fdf4' }}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={700} size="sm">Total Cash in Hand</Text>
              <Text fw={900} size="lg" c="green">{fmt(cashSales)}</Text>
            </Group>
          </Paper>
          {payData.length > 0 && (
            <>
              <Divider label="Payment Split" labelPosition="center" />
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={payData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {payData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </>
          )}
        </Stack>
      </Modal>

      {/* -- MODAL: Card -- */}
      <Modal {...modalProps} size="md" opened={activeModal === 'card'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg">Card Collections</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={2} spacing="sm">
            <MiniCard label="Pure Card" value={fmt(cardOrders.reduce((s, o) => s + (Number(o.total) || 0), 0))} color="blue" />
            <MiniCard label="Card from Split" value={fmt(splitOrders.reduce((s, o) => s + (Number(o.splitCard) || 0), 0))} color="grape" />
          </SimpleGrid>
          <Paper withBorder p="sm" radius="md" style={{ backgroundColor: '#eff6ff' }}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={700} size="sm">Total Card Revenue</Text>
              <Text fw={900} size="lg" c="blue">{fmt(cardSales)}</Text>
            </Group>
          </Paper>
          {splitOrders.length > 0 && (
            <>
              <Divider label={`Split Transactions (${splitOrders.length})`} labelPosition="center" />
              <ScrollArea h={180}>
                <Table striped fz="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Invoice</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Cash</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Card</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {splitOrders.map((o, i) => (
                      <Table.Tr key={i}>
                        <Table.Td style={{ fontFamily: 'monospace', fontSize: 11 }}>{(o.invoiceId || '').slice(-10)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} c="green">{fmt(Number(o.splitCash) || 0)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} c="blue">{fmt(Number(o.splitCard) || 0)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={600}>{fmt(o.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}
          {splitOrders.length === 0 && <Text c="dimmed" ta="center" py="sm" size="sm">No split transactions yet.</Text>}
        </Stack>
      </Modal>

      {/* -- MODAL: Expenses -- */}
      <Modal {...modalProps} size="lg" opened={activeModal === 'expenses'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg">Expenses Breakdown</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <MiniCard label="Total Expenses" value={fmt(totalExpenses)} color="orange" />
            <MiniCard label="% of Sales" value={`${expenseRatio}%`} />
            <MiniCard label="Transactions" value={String(expenses.length)} />
          </SimpleGrid>
          {expCatData.length > 0 && (
            <>
              <Divider label="By Category" labelPosition="center" />
              <Stack gap="xs">
                {expCatData.map((c, i) => (
                  <Box key={i}>
                    <Group justify="space-between" mb={3}>
                      <Text size="sm" fw={500}>{c.name}</Text>
                      <Text size="sm" fw={700}>{fmt(c.value)}</Text>
                    </Group>
                    <Progress value={totalExpenses > 0 ? (c.value / totalExpenses) * 100 : 0} color={COLORS[i % COLORS.length]} size="md" radius="xl" />
                  </Box>
                ))}
              </Stack>
            </>
          )}
          <Divider label="Recent Expenses" labelPosition="center" />
          <ScrollArea h={200}>
            <Table striped fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {expenses.slice(0, 20).map((e, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{e.description || e.name || '-'}</Table.Td>
                    <Table.Td><Badge size="xs" variant="light" color="orange">{e.category || 'General'}</Badge></Table.Td>
                    <Table.Td style={{ textAlign: 'right' }} fw={600} c="orange">{fmt(Number(e.amount) || 0)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* -- MODAL: Profit -- */}
      <Modal {...modalProps} size="md" opened={activeModal === 'profit'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg">Profit & Loss</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <MiniCard label="Revenue" value={fmt(totalSales)} color="violet" />
            <MiniCard label="Expenses" value={fmt(totalExpenses)} color="orange" />
            <Paper withBorder p="sm" radius="md" style={{ backgroundColor: profit >= 0 ? '#f0fdf4' : '#fff5f5' }}>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4}>Net Profit</Text>
              <Text fw={900} size="md" c={profit >= 0 ? 'teal' : 'red'} style={{ wordBreak: 'break-word' }}>{fmt(profit)}</Text>
            </Paper>
          </SimpleGrid>
          <Paper withBorder p="sm" radius="md">
            <Text size="xs" fw={600} mb="xs">Profit Margin</Text>
            <Progress value={totalSales > 0 ? Math.max(0, Math.min(100, (profit / totalSales) * 100)) : 0} color={profit >= 0 ? 'teal' : 'red'} size="lg" radius="xl" />
            <Text size="xs" c="dimmed" mt={4}>{totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : 0}% margin</Text>
          </Paper>
          <Divider label="Overview Chart" labelPosition="center" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={[{ name: 'Store', Revenue: totalSales, Expenses: totalExpenses, Profit: Math.max(0, profit) }]}
              margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={9} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="#7950f2" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Expenses" fill="#fd7e14" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Profit" fill="#12b886" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Stack>
      </Modal>

      {/* -- MODAL: Products -- */}
      <Modal {...modalProps} size="lg" opened={activeModal === 'products'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg">Products Overview</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <MiniCard label="Total Products" value={String(products.length)} />
            <MiniCard label="Low Stock <=10" value={String(lowStock.length)} color="yellow" />
            <MiniCard label="Out of Stock" value={String(products.filter(p => p.stock === 0).length)} color="red" />
          </SimpleGrid>
          {topProducts.length > 0 && (
            <>
              <Divider label="Top Products by Revenue" labelPosition="center" />
              <ResponsiveContainer width="100%" height={Math.max(160, topProducts.length * 30)}>
                <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={9} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" fontSize={9} width={90} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="revenue" fill="#15aabf" radius={[0, 3, 3, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
          {lowStock.length > 0 && (
            <>
              <Divider label="Low Stock Items" labelPosition="center" />
              <ScrollArea h={200}>
                <Table striped fz="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Stock</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lowStock.map((p, i) => (
                      <Table.Tr key={i}>
                        <Table.Td fw={600}>{p.name}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Badge color={p.stock === 0 ? 'red' : 'yellow'} variant="filled" size="xs">{p.stock}</Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{fmt(p.price)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}
          {lowStock.length === 0 && <Text c="green" ta="center" py="sm" size="sm">All products well stocked.</Text>}
        </Stack>
      </Modal>

      {/* -- MODAL: Customers -- */}
      <Modal {...modalProps} size="md" opened={activeModal === 'customers'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg">Customer Overview</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={2} spacing="sm">
            <MiniCard label="Total Registered" value={String(customers.length)} />
            <MiniCard label="With Transactions" value={String(customers.filter(c => (c.totalVisits || 0) > 0 || (c.totalSpent || 0) > 0).length)} />
          </SimpleGrid>
          <Divider label="Top Customers by Spend" labelPosition="center" />
          <ScrollArea h={300}>
            <Table striped highlightOnHover fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>#</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Visits</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Spent</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[...customers].sort((a, b) => (Number(b.totalSpent) || 0) - (Number(a.totalSpent) || 0)).slice(0, 20).map((c, i) => (
                  <Table.Tr key={i}>
                    <Table.Td c="dimmed">{i + 1}</Table.Td>
                    <Table.Td fw={600}>{c.name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{c.totalVisits || 0}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }} fw={600} c="indigo">{fmt(Number(c.totalSpent) || 0)}</Table.Td>
                  </Table.Tr>
                ))}
                {customers.length === 0 && (
                  <Table.Tr><Table.Td colSpan={4} style={{ textAlign: 'center' }}><Text c="dimmed" py="md" size="sm">No customers yet.</Text></Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* -- MODAL: Low Stock Alert -- */}
      <Modal {...modalProps} size="md" opened={activeModal === 'low-stock'} onClose={() => setActiveModal(null)} title={<Text fw={700} size="lg" c="red">Low Stock Alert</Text>}>
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <MiniCard label="Low Stock" value={String(lowStock.filter(p => p.stock > 0).length)} color="yellow" />
            <MiniCard label="Out of Stock" value={String(products.filter(p => p.stock === 0).length)} color="red" />
            <MiniCard label="Total Affected" value={String(lowStock.length)} />
          </SimpleGrid>
          {lowStock.length > 0 ? (
            <ScrollArea h={340}>
              <Table striped highlightOnHover fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Stock</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...lowStock].sort((a, b) => a.stock - b.stock).map((p, i) => (
                    <Table.Tr key={i}>
                      <Table.Td fw={600}>{p.name}</Table.Td>
                      <Table.Td><Badge size="xs" variant="light">{p.category || '-'}</Badge></Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Badge color={p.stock === 0 ? 'red' : 'yellow'} variant="filled" size="xs">{p.stock}</Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : <Text c="green" ta="center" py="xl" fw={600} size="sm">All products are well stocked.</Text>}
        </Stack>
      </Modal>

    </Stack>
  );
};

export default AdminDashboard;
