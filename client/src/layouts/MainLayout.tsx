import { AppShell, Burger, Group, NavLink, Title, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { IconDashboard, IconReceipt2, IconCash, IconPackage, IconLogout } from '@tabler/icons-react';
import { useAuthStore } from '../store/authStore';

const MainLayout = () => {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: IconDashboard, path: '/' },
    { label: 'POS Terminal', icon: IconReceipt2, path: '/pos' },
    { label: 'Invoices', icon: IconReceipt2, path: '/invoices' },
    { label: 'Products', icon: IconPackage, path: '/products' },
    { label: 'Expenses', icon: IconCash, path: '/expenses' },
  ];

  if (!user) return null;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3} c="blue">Store POS</Title>
          </Group>
          <Group>
            <Title order={6}>Welcome, {user.name}</Title>
            <Button variant="light" color="red" size="xs" onClick={handleLogout} leftSection={<IconLogout size={16} />}>
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" className="no-print">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            label={item.label}
            leftSection={<item.icon size={20} stroke={1.5} />}
            active={location.pathname === item.path}
            onClick={() => {
              navigate(item.path);
              if (opened) toggle();
            }}
            variant="filled"
            mb={5}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};

export default MainLayout;
