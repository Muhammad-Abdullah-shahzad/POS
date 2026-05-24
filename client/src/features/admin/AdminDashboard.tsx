import { useEffect, useState } from 'react';
import {
  SimpleGrid, Paper, Text, Title, Group, ThemeIcon, Stack,
  RingProgress, Box, Loader, Center, Modal, Table, Badge,
  Divider, Progress, ScrollArea
} from '@mantine/core';
import {
  IconCash, IconPackage, IconUsersGroup, IconReceipt,
  IconTrendingUp, IconShoppingCart, IconBuildingStore, IconAlertCircle
} from '@tabler/icons-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import api from '../../services/api';

const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#15aabf', '#fd7e14'];
const fmt = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

const AdminDashboard = () => {
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
      <Center h={400}>
        <Stack align="center" gap="xs">
          <Loader size="lg" color="violet" />
          <Text c="dimmed">Loading admin overview...</Text>
        </Stack>
      </Center>
    );
  }

  // ── Derived stats ──
  const totalSales = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalOrders = orders.length;
  const cashSales = orders.filter(o => (o.paymentMethod||'').toLowerCase()==='cash').reduce((s,o)=>s+(Number(o.total)||0),0)
    + orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='split').reduce((s,o)=>s+(Number(o.splitCash)||0),0);
  const cardSales = orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='card').reduce((s,o)=>s+(Number(o.total)||0),0)
    + orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='split').reduce((s,o)=>s+(Number(o.splitCard)||0),0);
  const splitOrders = orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='split');
  const totalExpenses = expenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const profit = totalSales - totalExpenses;
  const expenseRatio = totalSales > 0 ? Math.min(100, Math.round((totalExpenses/totalSales)*100)) : 0;
  const lowStock = products.filter(p => p.stock <= 10);

  // Daily sales for chart
  const dailyMap: Record<string, number> = {};
  orders.forEach(o => {
    const d = o.createdAt ? new Date(o.createdAt).toISOString().slice(0,10) : 'Unknown';
    dailyMap[d] = (dailyMap[d]||0) + (Number(o.total)||0);
  });
  const dailyData = Object.entries(dailyMap).sort(([a],[b])=>a.localeCompare(b))
    .slice(-14).map(([date, total]) => ({ date: date.slice(5), total }));

  // Expense by category
  const expCatMap: Record<string, number> = {};
  expenses.forEach(e => { const c = e.category||'General'; expCatMap[c]=(expCatMap[c]||0)+(Number(e.amount)||0); });
  const expCatData = Object.entries(expCatMap).map(([name, value]) => ({ name, value }));

  // Top products by revenue
  const prodMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach(o => (o.items||[]).forEach((item: any) => {
    const k = item.name||'Unknown';
    if (!prodMap[k]) prodMap[k] = { name: k, qty: 0, revenue: 0 };
    prodMap[k].qty += Number(item.quantity)||0;
    prodMap[k].revenue += Number(item.totalPrice)||0;
  }));
  const topProducts = Object.values(prodMap).sort((a,b)=>b.revenue-a.revenue).slice(0,8);

  // Payment method breakdown
  const payData = [
    { name: 'Cash', value: cashSales },
    { name: 'Card', value: cardSales },
  ].filter(d => d.value > 0);

  const cards = [
    { key: 'total-sales',   label: 'Total Sales',      value: fmt(totalSales),   sub: `${totalOrders} orders`,          icon: <IconTrendingUp size={22}/>,   color: 'violet' },
    { key: 'cash',          label: 'Cash Collected',   value: fmt(cashSales),    sub: 'Cash + Split cash',              icon: <IconCash size={22}/>,         color: 'green'  },
    { key: 'card',          label: 'Card Collected',   value: fmt(cardSales),    sub: `${splitOrders.length} split txns`, icon: <IconShoppingCart size={22}/>, color: 'blue'   },
    { key: 'expenses',      label: 'Total Expenses',   value: fmt(totalExpenses),sub: `${expenseRatio}% of sales`,      icon: <IconReceipt size={22}/>,      color: 'orange', ring: expenseRatio },
    { key: 'profit',        label: 'Net Profit',       value: fmt(profit),       sub: profit>=0?'Profitable':'Loss',    icon: <IconBuildingStore size={22}/>, color: profit>=0?'teal':'red' },
    { key: 'products',      label: 'Products',         value: String(products.length), sub: `${lowStock.length} low stock`, icon: <IconPackage size={22}/>,  color: lowStock.length>0?'yellow':'cyan' },
    { key: 'customers',     label: 'Customers',        value: String(customers.length), sub: 'Registered',             icon: <IconUsersGroup size={22}/>,   color: 'indigo' },
    { key: 'low-stock',     label: 'Low Stock Alert',  value: String(lowStock.length),  sub: 'Items ≤ 10 units',       icon: <IconAlertCircle size={22}/>,  color: lowStock.length>0?'red':'gray' },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Admin Overview</Title>
          <Text size="sm" c="dimmed">Click any card for detailed analysis</Text>
        </div>
        <Text size="xs" c="dimmed">{new Date().toLocaleString()}</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, sm: 2, md: 4 }} spacing="md">
        {cards.map((card) => (
          <Paper
            key={card.key}
            withBorder p="md" radius="md" shadow="xs"
            onClick={() => setActiveModal(card.key)}
            style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=''; }}
          >
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={600} tt="uppercase">{card.label}</Text>
              <ThemeIcon color={card.color} variant="light" size="lg" radius="md">{card.icon}</ThemeIcon>
            </Group>
            <Group align="flex-end" justify="space-between">
              <Box>
                <Text size="xl" fw={800} lh={1}>{card.value}</Text>
                {card.sub && <Text size="xs" c="dimmed" mt={4}>{card.sub}</Text>}
              </Box>
              {(card as any).ring !== undefined && (
                <RingProgress size={48} thickness={5}
                  sections={[{ value: (card as any).ring, color: card.color }]}
                  label={<Text size="9px" ta="center" fw={700}>{(card as any).ring}%</Text>}
                />
              )}
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      {/* ── MODAL: Total Sales ── */}
      <Modal opened={activeModal==='total-sales'} onClose={()=>setActiveModal(null)} title={<Title order={4}>Total Sales Analysis</Title>} size="xl" centered>
        <Stack gap="md">
          <SimpleGrid cols={3}>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Total Revenue</Text><Text fw={800} size="lg">{fmt(totalSales)}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Total Orders</Text><Text fw={800} size="lg">{totalOrders}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Avg Order Value</Text><Text fw={800} size="lg">{totalOrders>0?fmt(totalSales/totalOrders):fmt(0)}</Text></Paper>
          </SimpleGrid>
          <Divider label="Daily Sales (Last 14 days)" labelPosition="center"/>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="date" fontSize={11}/>
                <YAxis fontSize={11}/>
                <Tooltip formatter={(v:any)=>fmt(Number(v))}/>
                <Bar dataKey="total" fill="#7950f2" radius={[4,4,0,0]} name="Sales"/>
              </BarChart>
            </ResponsiveContainer>
          ) : <Text c="dimmed" ta="center" py="md">No sales data yet.</Text>}
          <Divider label="Recent Orders" labelPosition="center"/>
          <ScrollArea h={200}>
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Invoice</Table.Th><Table.Th>Date</Table.Th><Table.Th style={{textAlign:'right'}}>Total</Table.Th><Table.Th>Method</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {orders.slice(0,20).map((o,i)=>(
                  <Table.Tr key={i}>
                    <Table.Td style={{fontFamily:'monospace',fontSize:12}}>{o.invoiceId}</Table.Td>
                    <Table.Td>{o.createdAt?new Date(o.createdAt).toLocaleDateString():'N/A'}</Table.Td>
                    <Table.Td style={{textAlign:'right'}} fw={600}>{fmt(o.total)}</Table.Td>
                    <Table.Td><Badge size="sm" color={(o.paymentMethod||'').toLowerCase()==='cash'?'green':(o.paymentMethod||'').toLowerCase()==='card'?'blue':'grape'} variant="light">{(o.paymentMethod||'cash').toUpperCase()}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* ── MODAL: Cash Collected ── */}
      <Modal opened={activeModal==='cash'} onClose={()=>setActiveModal(null)} title={<Title order={4}>Cash Collections</Title>} size="lg" centered>
        <Stack gap="md">
          <SimpleGrid cols={2}>
            <Paper withBorder p="sm" radius="md" style={{borderColor:'var(--mantine-color-green-4)'}}>
              <Text size="xs" c="dimmed">Pure Cash Orders</Text>
              <Text fw={800} size="lg" c="green">{fmt(orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='cash').reduce((s,o)=>s+(Number(o.total)||0),0))}</Text>
              <Text size="xs" c="dimmed">{orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='cash').length} transactions</Text>
            </Paper>
            <Paper withBorder p="sm" radius="md" style={{borderColor:'var(--mantine-color-grape-4)'}}>
              <Text size="xs" c="dimmed">Cash from Split Payments</Text>
              <Text fw={800} size="lg" c="grape">{fmt(splitOrders.reduce((s,o)=>s+(Number(o.splitCash)||0),0))}</Text>
              <Text size="xs" c="dimmed">{splitOrders.length} split transactions</Text>
            </Paper>
          </SimpleGrid>
          <Paper withBorder p="md" radius="md" style={{backgroundColor:'#f0fdf4'}}>
            <Group justify="space-between">
              <Text fw={700}>Total Cash in Hand</Text>
              <Text fw={900} size="xl" c="green">{fmt(cashSales)}</Text>
            </Group>
          </Paper>
          <Divider label="Payment Method Breakdown" labelPosition="center"/>
          {payData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={payData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                  {payData.map((_,i)=><Cell key={i} fill={COLORS[i]}/>)}
                </Pie>
                <Tooltip formatter={(v:any)=>fmt(Number(v))}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <Text c="dimmed" ta="center" py="md">No payment data yet.</Text>}
        </Stack>
      </Modal>

      {/* ── MODAL: Card Collected ── */}
      <Modal opened={activeModal==='card'} onClose={()=>setActiveModal(null)} title={<Title order={4}>Card Collections</Title>} size="lg" centered>
        <Stack gap="md">
          <SimpleGrid cols={2}>
            <Paper withBorder p="sm" radius="md" style={{borderColor:'var(--mantine-color-blue-4)'}}>
              <Text size="xs" c="dimmed">Pure Card Orders</Text>
              <Text fw={800} size="lg" c="blue">{fmt(orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='card').reduce((s,o)=>s+(Number(o.total)||0),0))}</Text>
              <Text size="xs" c="dimmed">{orders.filter(o=>(o.paymentMethod||'').toLowerCase()==='card').length} transactions</Text>
            </Paper>
            <Paper withBorder p="sm" radius="md" style={{borderColor:'var(--mantine-color-grape-4)'}}>
              <Text size="xs" c="dimmed">Card from Split Payments</Text>
              <Text fw={800} size="lg" c="grape">{fmt(splitOrders.reduce((s,o)=>s+(Number(o.splitCard)||0),0))}</Text>
              <Text size="xs" c="dimmed">{splitOrders.length} split transactions</Text>
            </Paper>
          </SimpleGrid>
          <Paper withBorder p="md" radius="md" style={{backgroundColor:'#eff6ff'}}>
            <Group justify="space-between">
              <Text fw={700}>Total Card Revenue</Text>
              <Text fw={900} size="xl" c="blue">{fmt(cardSales)}</Text>
            </Group>
          </Paper>
          <Divider label="Split Transactions Detail" labelPosition="center"/>
          {splitOrders.length > 0 ? (
            <ScrollArea h={180}>
              <Table striped>
                <Table.Thead><Table.Tr><Table.Th>Invoice</Table.Th><Table.Th style={{textAlign:'right'}}>Cash</Table.Th><Table.Th style={{textAlign:'right'}}>Card</Table.Th><Table.Th style={{textAlign:'right'}}>Total</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {splitOrders.map((o,i)=>(
                    <Table.Tr key={i}>
                      <Table.Td style={{fontFamily:'monospace',fontSize:12}}>{o.invoiceId}</Table.Td>
                      <Table.Td style={{textAlign:'right'}} c="green">{fmt(Number(o.splitCash)||0)}</Table.Td>
                      <Table.Td style={{textAlign:'right'}} c="blue">{fmt(Number(o.splitCard)||0)}</Table.Td>
                      <Table.Td style={{textAlign:'right'}} fw={600}>{fmt(o.total)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : <Text c="dimmed" ta="center" py="md">No split transactions yet.</Text>}
        </Stack>
      </Modal>

      {/* ── MODAL: Expenses ── */}
      <Modal opened={activeModal==='expenses'} onClose={()=>setActiveModal(null)} title={<Title order={4}>Expenses Breakdown</Title>} size="xl" centered>
        <Stack gap="md">
          <SimpleGrid cols={3}>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Total Expenses</Text><Text fw={800} size="lg" c="orange">{fmt(totalExpenses)}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">% of Sales</Text><Text fw={800} size="lg">{expenseRatio}%</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Transactions</Text><Text fw={800} size="lg">{expenses.length}</Text></Paper>
          </SimpleGrid>
          {expCatData.length > 0 && (
            <>
              <Divider label="By Category" labelPosition="center"/>
              <Group align="flex-start" gap="xl">
                <ResponsiveContainer width="45%" height={180}>
                  <PieChart>
                    <Pie data={expCatData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                      {expCatData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v:any)=>fmt(Number(v))}/>
                  </PieChart>
                </ResponsiveContainer>
                <Stack gap="xs" style={{flex:1}}>
                  {expCatData.map((c,i)=>(
                    <Box key={i}>
                      <Group justify="space-between" mb={2}>
                        <Text size="sm">{c.name}</Text>
                        <Text size="sm" fw={600}>{fmt(c.value)}</Text>
                      </Group>
                      <Progress value={totalExpenses>0?(c.value/totalExpenses)*100:0} color={COLORS[i%COLORS.length]} size="sm" radius="xl"/>
                    </Box>
                  ))}
                </Stack>
              </Group>
            </>
          )}
          <Divider label="Recent Expenses" labelPosition="center"/>
          <ScrollArea h={180}>
            <Table striped>
              <Table.Thead><Table.Tr><Table.Th>Description</Table.Th><Table.Th>Category</Table.Th><Table.Th>Date</Table.Th><Table.Th style={{textAlign:'right'}}>Amount</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {expenses.slice(0,20).map((e,i)=>(
                  <Table.Tr key={i}>
                    <Table.Td>{e.description||e.name||'—'}</Table.Td>
                    <Table.Td><Badge size="sm" variant="light" color="orange">{e.category||'General'}</Badge></Table.Td>
                    <Table.Td>{e.date?new Date(e.date).toLocaleDateString():'N/A'}</Table.Td>
                    <Table.Td style={{textAlign:'right'}} fw={600} c="orange">{fmt(Number(e.amount)||0)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* ── MODAL: Net Profit ── */}
      <Modal opened={activeModal==='profit'} onClose={()=>setActiveModal(null)} title={<Title order={4}>Profit & Loss Summary</Title>} size="lg" centered>
        <Stack gap="md">
          <SimpleGrid cols={3}>
            <Paper withBorder p="sm" radius="md" style={{borderColor:'var(--mantine-color-violet-4)'}}>
              <Text size="xs" c="dimmed">Total Revenue</Text><Text fw={800} size="lg" c="violet">{fmt(totalSales)}</Text>
            </Paper>
            <Paper withBorder p="sm" radius="md" style={{borderColor:'var(--mantine-color-orange-4)'}}>
              <Text size="xs" c="dimmed">Total Expenses</Text><Text fw={800} size="lg" c="orange">{fmt(totalExpenses)}</Text>
            </Paper>
            <Paper withBorder p="md" radius="md" style={{borderColor:profit>=0?'var(--mantine-color-teal-4)':'var(--mantine-color-red-4)', backgroundColor:profit>=0?'#f0fdf4':'#fff5f5'}}>
              <Text size="xs" c="dimmed">Net Profit</Text><Text fw={900} size="xl" c={profit>=0?'teal':'red'}>{fmt(profit)}</Text>
            </Paper>
          </SimpleGrid>
          <Paper withBorder p="md" radius="md">
            <Text size="sm" fw={600} mb="xs">Profit Margin</Text>
            <Progress value={totalSales>0?Math.max(0,Math.min(100,(profit/totalSales)*100)):0} color={profit>=0?'teal':'red'} size="xl" radius="xl" striped={profit<0}/>
            <Text size="xs" c="dimmed" mt={4}>{totalSales>0?((profit/totalSales)*100).toFixed(1):0}% margin</Text>
          </Paper>
          <Divider label="Revenue vs Expenses" labelPosition="center"/>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{name:'Overview', Revenue:totalSales, Expenses:totalExpenses, Profit:Math.max(0,profit)}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="name" fontSize={11}/>
              <YAxis fontSize={11}/>
              <Tooltip formatter={(v:any)=>fmt(Number(v))}/>
              <Legend/>
              <Bar dataKey="Revenue" fill="#7950f2" radius={[4,4,0,0]}/>
              <Bar dataKey="Expenses" fill="#fd7e14" radius={[4,4,0,0]}/>
              <Bar dataKey="Profit" fill="#12b886" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Stack>
      </Modal>

      {/* ── MODAL: Products ── */}
      <Modal opened={activeModal==='products'} onClose={()=>setActiveModal(null)} title={<Title order={4}>Products Overview</Title>} size="xl" centered>
        <Stack gap="md">
          <SimpleGrid cols={3}>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Total Products</Text><Text fw={800} size="lg">{products.length}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Low Stock (≤10)</Text><Text fw={800} size="lg" c="yellow">{lowStock.length}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Out of Stock</Text><Text fw={800} size="lg" c="red">{products.filter(p=>p.stock===0).length}</Text></Paper>
          </SimpleGrid>
          <Divider label="Top Products by Revenue" labelPosition="center"/>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                <XAxis type="number" fontSize={10}/>
                <YAxis type="category" dataKey="name" fontSize={10} width={120}/>
                <Tooltip formatter={(v:any)=>fmt(Number(v))}/>
                <Bar dataKey="revenue" fill="#15aabf" radius={[0,4,4,0]} name="Revenue"/>
              </BarChart>
            </ResponsiveContainer>
          ) : <Text c="dimmed" ta="center" py="md">No sales data yet.</Text>}
          <Divider label="Low Stock Items" labelPosition="center"/>
          {lowStock.length > 0 ? (
            <ScrollArea h={180}>
              <Table striped>
                <Table.Thead><Table.Tr><Table.Th>Product</Table.Th><Table.Th>Category</Table.Th><Table.Th style={{textAlign:'right'}}>Stock</Table.Th><Table.Th style={{textAlign:'right'}}>Price</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {lowStock.map((p,i)=>(
                    <Table.Tr key={i}>
                      <Table.Td fw={600}>{p.name}</Table.Td>
                      <Table.Td><Badge size="sm" variant="light">{p.category||'—'}</Badge></Table.Td>
                      <Table.Td style={{textAlign:'right'}}><Badge color={p.stock===0?'red':'yellow'} variant="filled" size="sm">{p.stock}</Badge></Table.Td>
                      <Table.Td style={{textAlign:'right'}}>{fmt(p.price)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : <Text c="green" ta="center" py="md">✓ All products have sufficient stock.</Text>}
        </Stack>
      </Modal>

      {/* ── MODAL: Customers ── */}
      <Modal opened={activeModal==='customers'} onClose={()=>setActiveModal(null)} title={<Title order={4}>Customer Overview</Title>} size="lg" centered>
        <Stack gap="md">
          <SimpleGrid cols={2}>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Total Registered</Text><Text fw={800} size="lg">{customers.length}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">With Transactions</Text><Text fw={800} size="lg">{customers.filter(c=>c.totalVisits>0||c.totalSpent>0).length}</Text></Paper>
          </SimpleGrid>
          <Divider label="Top Customers by Spend" labelPosition="center"/>
          <ScrollArea h={280}>
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>Name</Table.Th><Table.Th>Phone</Table.Th><Table.Th style={{textAlign:'right'}}>Visits</Table.Th><Table.Th style={{textAlign:'right'}}>Total Spent</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {[...customers].sort((a,b)=>(Number(b.totalSpent)||0)-(Number(a.totalSpent)||0)).slice(0,20).map((c,i)=>(
                  <Table.Tr key={i}>
                    <Table.Td c="dimmed">{i+1}</Table.Td>
                    <Table.Td fw={600}>{c.name}</Table.Td>
                    <Table.Td c="dimmed">{c.contactNum1||'—'}</Table.Td>
                    <Table.Td style={{textAlign:'right'}}>{c.totalVisits||0}</Table.Td>
                    <Table.Td style={{textAlign:'right'}} fw={600} c="indigo">{fmt(Number(c.totalSpent)||0)}</Table.Td>
                  </Table.Tr>
                ))}
                {customers.length===0 && <Table.Tr><Table.Td colSpan={5} style={{textAlign:'center'}}><Text c="dimmed" py="md">No customers registered yet.</Text></Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {/* ── MODAL: Low Stock Alert ── */}
      <Modal opened={activeModal==='low-stock'} onClose={()=>setActiveModal(null)} title={<Title order={4} c="red">Low Stock Alert</Title>} size="lg" centered>
        <Stack gap="md">
          <SimpleGrid cols={3}>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Low Stock Items</Text><Text fw={800} size="lg" c="yellow">{lowStock.filter(p=>p.stock>0).length}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Out of Stock</Text><Text fw={800} size="lg" c="red">{products.filter(p=>p.stock===0).length}</Text></Paper>
            <Paper withBorder p="sm" radius="md"><Text size="xs" c="dimmed">Total Affected</Text><Text fw={800} size="lg">{lowStock.length}</Text></Paper>
          </SimpleGrid>
          {lowStock.length > 0 ? (
            <ScrollArea h={320}>
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Product</Table.Th><Table.Th>SKU</Table.Th><Table.Th>Category</Table.Th><Table.Th style={{textAlign:'right'}}>Stock</Table.Th><Table.Th style={{textAlign:'right'}}>Price</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {[...lowStock].sort((a,b)=>a.stock-b.stock).map((p,i)=>(
                    <Table.Tr key={i}>
                      <Table.Td fw={600}>{p.name}</Table.Td>
                      <Table.Td c="dimmed" style={{fontFamily:'monospace',fontSize:12}}>{p.sku||'—'}</Table.Td>
                      <Table.Td><Badge size="sm" variant="light">{p.category||'—'}</Badge></Table.Td>
                      <Table.Td style={{textAlign:'right'}}><Badge color={p.stock===0?'red':'yellow'} variant="filled" size="sm">{p.stock}</Badge></Table.Td>
                      <Table.Td style={{textAlign:'right'}}>{fmt(p.price)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : <Text c="green" ta="center" py="xl" fw={600}>✓ All products are well stocked.</Text>}
        </Stack>
      </Modal>

    </Stack>
  );
};

export default AdminDashboard;
