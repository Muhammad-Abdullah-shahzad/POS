import { AppShell, Burger, Group, NavLink, Title, Button, Text, Anchor, ScrollArea, Box, Badge, Center } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  IconAddressBook,
  IconBan,
  IconBuildingBank,
  IconCash,
  IconChartDonut3,
  IconLayoutDashboard,
  IconLogout,
  IconPackage,
  IconPackages,
  IconReceipt,
  IconReportAnalytics,
  IconSettings,
  IconShieldLock,
  IconUsersGroup,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { useAuthStore } from '../store/authStore';
import { usePosStore } from '../store/posStore';

const AdminLayout = () => {
  const [opened, { toggle }] = useDisclosure();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const clearCart = usePosStore((state) => state.clearCart);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'manager') return <Navigate to="/" replace />;

  const handleLogout = () => {
    clearCart();
    logout();
    navigate('/login');
  };

  interface NavItem {
    label: string;
    icon: TablerIcon;
    path?: string;
    children?: { label: string; path: string }[];
  }

  const navItems: NavItem[] = [
    { label: 'Dashboard', icon: IconLayoutDashboard, path: '/admin' },
    { label: 'Receipts', icon: IconReceipt, path: '/admin/receipts' },
    { label: 'Void Transactions', icon: IconBan, path: '/admin/void-transactions' },
    {
      label: 'Product',
      icon: IconPackage,
      children: [
        { label: 'Manage Category', path: '/admin/products/category' },
        { label: 'Manage Products', path: '/admin/products' },
        { label: 'Manage Quick Products', path: '/admin/products/quick' },
        { label: 'Manage General Products', path: '/admin/products/general' },
        { label: 'Edit Price', path: '/admin/products/edit-price' },
        { label: 'Barcodes', path: '/admin/products/codes' },
        { label: 'Wastage Management', path: '/admin/products/wastage' },
        { label: 'Excel Sheet Load', path: '/admin/products/excel-load' },
        { label: 'Stock Reconciliation', path: '/admin/products/reconciliation' },
      ]
    },
    {
      label: 'Stock',
      icon: IconPackages,
      children: [
        { label: 'View Stock', path: '/admin/products' },
        { label: 'Manage Suppliers', path: '/admin/suppliers' },
        { label: 'Supplier Payments', path: '/admin/suppliers/payments' },
        { label: 'Manage Product Codes', path: '/admin/products/codes' },
      ]
    },
    { label: 'Expenses', icon: IconCash, path: '/admin/expenses' },
    { label: 'Analysis', icon: IconChartDonut3, path: '/admin/analysis' },
    {
      label: 'Reports',
      icon: IconReportAnalytics,
      children: [
        { label: 'Sales Summary Report', path: '/admin/reports/sales-summary' },
        { label: 'Transaction Sales Report', path: '/admin/reports/transaction-sales' },
        { label: 'Category Sale Report', path: '/admin/reports/category-sale' },
        { label: 'Top Sale Products', path: '/admin/reports/top-sale-products' },
        { label: 'Products Sale Report', path: '/admin/reports/products-sale' },
        { label: 'Category Ratio Report', path: '/admin/reports/category-ratio' },
        { label: 'Category Profit Report', path: '/admin/reports/category-profit' },
        { label: 'Expiry Items Report', path: '/admin/reports/expiry-items' },
        { label: 'Employee Sales Report', path: '/admin/reports/employee-sales' },
        { label: 'Product Purchase - Sales History', path: '/admin/reports/purchase-sales-history' },
        { label: 'Z Report Print Report', path: '/admin/reports/z-report-print' },
        { label: 'Sales Analysis Report', path: '/admin/reports/sales-analysis' },
        { label: 'Profit Analysis Report', path: '/admin/reports/profit-analysis' },
        { label: 'Product Stock Report', path: '/admin/reports/product-stock' },
        { label: 'Posting Report', path: '/admin/reports/posting' },
        { label: 'Bag Levy Report', path: '/admin/reports/bag-levy' },
        { label: 'DRS Report', path: '/admin/reports/drs' },
        { label: 'Inventory Report', path: '/admin/reports/inventory' },
        { label: 'Invoice Report', path: '/admin/reports/invoice' },
        { label: 'Wastage Report', path: '/admin/reports/wastage' },
        { label: 'Exchange Refund Report', path: '/admin/reports/exchange-refund' },
        { label: 'Expenses Report', path: '/admin/reports/expenses' },
        { label: 'Stock Reconciliation Report', path: '/admin/reports/stock-reconciliation' },
        { label: 'Stock Value', path: '/admin/reports/stock-value' },
      ]
    },
    {
      label: 'Employees',
      icon: IconUsersGroup,
      children: [
        { label: 'Manage Employees', path: '/admin/employees' },
        { label: 'Salary Management', path: '/admin/employees/salary' },
        { label: 'Damages', path: '/admin/employees/damages' },
        { label: 'Change Password', path: '/admin/employees/change-password' },
        { label: 'Employee Access', path: '/admin/employees/access' },
        { label: 'Duty Roaster', path: '/admin/employees/duty-roaster' },
        { label: 'Attendance Report', path: '/admin/employees/attendance-report' },
        { label: 'OverTime Details', path: '/admin/employees/overtime' },
      ]
    },
    { label: 'Bank', icon: IconBuildingBank, path: '/admin/bank' },
    { label: 'Customer Details', icon: IconAddressBook, path: '/admin/customers' },
    { label: 'Settings', icon: IconSettings, path: '/admin/settings' },
  ];

  const renderNavIcon = (Icon: TablerIcon, active: boolean) => (
    <Box className="nav-icon-badge" data-active={active || undefined} aria-hidden="true">
      <Icon size={21} stroke={1.9} />
    </Box>
  );

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened }
      }}
      transitionDuration={400}
      transitionTimingFunction="ease"
    >
      {/* Header — same structure as cashier, violet accent */}
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap={6}>
              <IconShieldLock size={20} color="var(--mantine-color-violet-6)" />
              <Title order={3} c="violet">Store POS</Title>
              <Badge color="violet" variant="filled" size="sm" radius="sm">ADMIN</Badge>
            </Group>
          </Group>
          <Group>
            {!isMobile && <Title order={6}>Welcome, {user.name}</Title>}
            <Button variant="light" color="red" size="xs" onClick={handleLogout} leftSection={<IconLogout size={16} />}>
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      {/* Navbar — identical structure to cashier */}
      <AppShell.Navbar className="no-print main-navbar">
        <ScrollArea h="100%" p="md" scrollbarSize={6} type="hover">
          {navItems.map((item) => {
            const isChildActive = item.children
              ? item.children.some(c => location.pathname === c.path)
              : false;
            const isActive = item.children
              ? isChildActive
              : item.path
                ? (item.path === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname === item.path)
                : false;

            return (
              <NavLink
                key={item.label}
                label={item.label}
                leftSection={renderNavIcon(item.icon, isActive)}
                active={isActive}
                defaultOpened={isChildActive}
                onClick={item.path ? () => {
                  navigate(item.path as string);
                  if (isMobile && opened) toggle();
                } : undefined}
                variant="subtle"
                mb={8}
                py="sm"
                style={{ borderRadius: '8px' }}
                color="violet"
              >
                {item.children && item.children.map((child) => (
                  <NavLink
                    key={child.label}
                    label={child.label}
                    active={location.pathname === child.path}
                    onClick={() => {
                      navigate(child.path);
                      if (isMobile && opened) toggle();
                    }}
                    py="xs"
                    style={{ borderRadius: '6px', marginRight: '8px', marginLeft: '8px', marginTop: '4px', marginBottom: '4px' }}
                    variant="subtle"
                    color="violet"
                  />
                ))}
              </NavLink>
            );
          })}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1, padding: 'var(--mantine-spacing-md)' }}>
          <Outlet />
        </div>
        <Center className="no-print" py="xs">
          <Text size="xs" c="dimmed">
            Developed and maintained by{' '}
            <Anchor href="https://deviction.tech" target="_blank" size="xs" fw={500}>
              Deviction Technologies .
            </Anchor>
          </Text>
        </Center>
      </AppShell.Main>
    </AppShell>
  );
};

export default AdminLayout;
