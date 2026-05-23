import { AppShell, Burger, Group, NavLink, Title, Button, Tooltip, Center, Text, Anchor, Menu, ScrollArea } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { IconDashboard, IconReceipt2, IconCash, IconPackage, IconLogout, IconChartBar, IconUsers, IconBuildingBank, IconAddressBook, IconClipboardText, IconBan } from '@tabler/icons-react';
import { useAuthStore } from '../store/authStore';
import { usePosStore } from '../store/posStore';

const MainLayout = () => {
  const [opened, { toggle }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const clearCart = usePosStore((state) => state.clearCart);

  const handleLogout = () => {
    clearCart();
    logout();
    navigate('/login');
  };

  interface NavItem {
    label: string;
    icon: React.ComponentType<any>;
    path?: string;
    children?: { label: string; path: string }[];
  }

  const navItems: NavItem[] = [
    { label: 'Counter', icon: IconDashboard, path: '/' },
    { label: 'Receipts', icon: IconReceipt2, path: '/receipts' },
    { label: 'Void Transactions', icon: IconBan, path: '/void-transactions' },
    {
      label: 'Product',
      icon: IconPackage,
      children: [
        { label: 'Manage Category', path: '/products/category' },
        { label: 'Manage Products', path: '/products' },
        { label: 'Manage General Products', path: '/products/general' },
        { label: 'Edit Price', path: '/products/edit-price' },
        { label: 'Barcodes', path: '/products/codes' },
        { label: 'Wastage Management', path: '/products/wastage' },
        { label: 'Excel Sheet Load', path: '/products/excel-load' },
        { label: 'Stock Reconciliation', path: '/products/reconciliation' },
      ]
    },
    {
      label: 'Stock',
      icon: IconPackage,
      children: [
        { label: 'View Stock', path: '/products' },
        { label: 'Manage Suppliers', path: '/suppliers' },
        { label: 'Supplier Payments', path: '/suppliers/payments' },
        { label: 'Manage Product Codes', path: '/products/codes' },
      ]
    },
    { label: 'Expenses', icon: IconCash, path: '/expenses' },
    { label: 'Analysis', icon: IconChartBar, path: '/analysis' },
    {
      label: 'Reports',
      icon: IconClipboardText,
      children: [
        { label: 'Sales Summary Report', path: '/reports/sales-summary' },
        { label: 'Transaction Sales Report', path: '/reports/transaction-sales' },
        { label: 'Category Sale Report', path: '/reports/category-sale' },
        { label: 'Top Sale Products', path: '/reports/top-sale-products' },
        { label: 'Products Sale Report', path: '/reports/products-sale' },
        { label: 'Category Ratio Report', path: '/reports/category-ratio' },
        { label: 'Category Profit Report', path: '/reports/category-profit' },
        { label: 'Expiry Items Report', path: '/reports/expiry-items' },
        { label: 'Employee Sales Report', path: '/reports/employee-sales' },
        { label: 'Product Purchase - Sales History', path: '/reports/purchase-sales-history' },
        { label: 'Z Report Print Report', path: '/reports/z-report-print' },
        { label: 'Sales Analysis Report', path: '/reports/sales-analysis' },
        { label: 'Profit Analysis Report', path: '/reports/profit-analysis' },
        { label: 'Product Stock Report', path: '/reports/product-stock' },
        { label: 'Posting Report', path: '/reports/posting' },
        { label: 'Bag Levy Report', path: '/reports/bag-levy' },
        { label: 'DRS Report', path: '/reports/drs' },
        { label: 'Inventory Report', path: '/reports/inventory' },
        { label: 'Invoice Report', path: '/reports/invoice' },
        { label: 'Wastage Report', path: '/reports/wastage' },
        { label: 'Exchange Refund Report', path: '/reports/exchange-refund' },
        { label: 'Expenses Report', path: '/reports/expenses' },
        { label: 'Stock Reconciliation Report', path: '/reports/stock-reconciliation' },
        { label: 'Stock Value', path: '/reports/stock-value' },
      ]
    },
    {
      label: 'Employees',
      icon: IconUsers,
      children: [
        { label: 'Manage Employees', path: '/employees' },
        { label: 'Salary Management', path: '/employees/salary' },
        { label: 'Damages', path: '/employees/damages' },
        { label: 'Change Password', path: '/employees/change-password' },
        { label: 'Employee Access', path: '/employees/access' },
        { label: 'Duty Roaster', path: '/employees/duty-roaster' },
        { label: 'Attendence Report', path: '/employees/attendance-report' },
        { label: 'OverTime Details', path: '/employees/overtime' },
      ]
    },
    { label: 'Bank', icon: IconBuildingBank, path: '/bank' },
    { label: 'Customer Details', icon: IconAddressBook, path: '/customers' },
  ];

  if (!user) return null;

  const showLabel = isMobile || desktopOpened;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: { base: 250, sm: desktopOpened ? 250 : 80 },
        breakpoint: 'sm',
        collapsed: { mobile: !opened }
      }}
      transitionDuration={400}
      transitionTimingFunction="ease"
    >
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Burger opened={desktopOpened} onClick={toggleDesktop} visibleFrom="sm" size="sm" />
            <Title order={3} c="blue">Store POS</Title>
          </Group>
          <Group>
            {!isMobile && <Title order={6}>Welcome, {user.name}</Title>}
            <Button variant="light" color="red" size="xs" onClick={handleLogout} leftSection={<IconLogout size={16} />}>
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className="no-print">
        <ScrollArea h="100%" p={showLabel ? "md" : "xs"} scrollbarSize={6} type="hover">
          {navItems.map((item) => {
            const isChildActive = item.children ? item.children.some(c => location.pathname === c.path) : false;

            const navLink = (
              <NavLink
                key={item.label}
                label={showLabel ? item.label : undefined}
                leftSection={
                  <Center w={showLabel ? "auto" : "100%"}>
                    <item.icon size={24} stroke={1.5} />
                  </Center>
                }
                active={item.children ? isChildActive : (item.path ? location.pathname === item.path : false)}
                defaultOpened={isChildActive}
                onClick={item.path ? () => {
                  navigate(item.path as string);
                  if (isMobile && opened) toggle();
                } : undefined}
                variant={item.children && isChildActive ? "light" : "filled"}
                mb={8}
                py={showLabel ? "sm" : "md"}
                style={{
                  borderRadius: '8px',
                  justifyContent: showLabel ? 'flex-start' : 'center',
                }}
              >
                {item.children && showLabel && item.children.map((child) => (
                  <NavLink
                    key={child.label}
                    label={child.label}
                    active={location.pathname === child.path}
                    onClick={() => {
                      navigate(child.path);
                      if (isMobile && opened) toggle();
                    }}
                    py="xs"
                    style={{
                      borderRadius: '6px',
                      marginRight: '8px',
                      marginLeft: '8px',
                      marginTop: '4px',
                      marginBottom: '4px'
                    }}
                    variant="subtle"
                  />
                ))}
              </NavLink>
            );

            if (!showLabel) {
              if (item.children) {
                return (
                  <Menu key={item.label} trigger="hover" position="right-start" withinPortal>
                    <Menu.Target>
                      <NavLink
                        label={undefined}
                        leftSection={
                          <Center w="100%">
                            <item.icon size={24} stroke={1.5} />
                          </Center>
                        }
                        active={isChildActive}
                        mb={8}
                        py="md"
                        style={{
                          borderRadius: '8px',
                          justifyContent: 'center',
                        }}
                      />
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Label>{item.label}</Menu.Label>
                      {item.children.map((child) => (
                        <Menu.Item
                          key={child.label}
                          onClick={() => {
                            navigate(child.path);
                            if (isMobile && opened) toggle();
                          }}
                          style={{
                            fontWeight: location.pathname === child.path ? 600 : 400,
                            backgroundColor: location.pathname === child.path ? 'var(--mantine-color-blue-light)' : undefined,
                            color: location.pathname === child.path ? 'var(--mantine-color-blue-filled)' : undefined,
                          }}
                        >
                          {child.label}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                );
              }

              return (
                <Tooltip key={item.label} label={item.label} position="right" transitionProps={{ duration: 0 }}>
                  {navLink}
                </Tooltip>
              );
            }

            return navLink;
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

export default MainLayout;
