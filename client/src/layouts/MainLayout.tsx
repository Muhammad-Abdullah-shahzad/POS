import { AppShell, Burger, Group, NavLink, Title, Button, Tooltip, Center } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { IconDashboard, IconReceipt2, IconCash, IconPackage, IconLogout, IconChartBar, IconTruck, IconUsers, IconBuildingBank } from '@tabler/icons-react';
import { useAuthStore } from '../store/authStore';

const MainLayout = () => {
  const [opened, { toggle }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
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
    { label: 'Receipts', icon: IconReceipt2, path: '/receipts' },
    { label: 'Products', icon: IconPackage, path: '/products' },
    { label: 'Expenses', icon: IconCash, path: '/expenses' },
    { label: 'Analysis', icon: IconChartBar, path: '/analysis' },
    { label: 'Suppliers', icon: IconTruck, path: '/suppliers' },
    { label: 'Employees', icon: IconUsers, path: '/employees' },
    { label: 'Bank', icon: IconBuildingBank, path: '/bank' },
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
      padding="md"
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

      <AppShell.Navbar p={showLabel ? "md" : "xs"} className="no-print">
        {navItems.map((item) => {
          const navLink = (
            <NavLink
              key={item.label}
              label={showLabel ? item.label : undefined}
              leftSection={
                <Center w={showLabel ? "auto" : "100%"}>
                  <item.icon size={24} stroke={1.5} />
                </Center>
              }
              active={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile && opened) toggle();
              }}
              variant="filled"
              mb={8}
              py={showLabel ? "sm" : "md"}
              style={{
                borderRadius: '8px',
                justifyContent: showLabel ? 'flex-start' : 'center',
              }}
            />
          );

          if (!showLabel) {
            return (
              <Tooltip key={item.label} label={item.label} position="right" transitionProps={{ duration: 0 }}>
                {navLink}
              </Tooltip>
            );
          }

          return navLink;
        })}
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};

export default MainLayout;
