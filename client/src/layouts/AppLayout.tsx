/**
 * The signed in app frame shared by the cashier and admin workspaces.
 *
 * A full-height sidebar with a white header to its right. The sidebar's colours
 * live in one place, the palette tokens in AppLayout.module.css. On desktop the sidebar starts collapsed to icons and the menu
 * button expands it; on phones it slides in over the page.
 */
import { AppShell, Anchor, Burger, Button, Center, Group, Menu, NavLink, ScrollArea, Text, Title, Tooltip } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconLogout } from '@tabler/icons-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import CartMark from '../components/CartMark';
import LicenseBadge from '../features/license/LicenseBadge';
import SyncButton from '../features/sync/SyncButton';
import { signOutEverywhere } from '../services/sessionService';
import { useAuthStore } from '../store/authStore';
import classes from './AppLayout.module.css';
import type { NavItem } from './navigation';

const HEADER_BORDER = '#e6eaf2';
const NAV_WIDTH = { expanded: 250, collapsed: 80 };

interface SidebarItemProps {
  item: NavItem;
  pathname: string;
  showLabel: boolean;
  onNavigate: (path: string) => void;
}

function SidebarItem({ item, pathname, showLabel, onNavigate }: SidebarItemProps) {
  const Icon = item.icon;
  const childActive = item.children?.some((child) => child.path === pathname) ?? false;
  const active = item.path ? item.path === pathname : childActive;
  const icon = <Icon size={21} stroke={1.8} />;
  const open = item.path ? () => onNavigate(item.path as string) : undefined;

  if (!showLabel) {
    // Icons only: a section opens as a flyout, a page shows its name on hover.
    const iconLink = (
      <NavLink
        aria-label={item.label}
        leftSection={icon}
        active={active}
        onClick={open}
        data-collapsed
        className={classes.link}
        classNames={{ section: classes.section, body: classes.body }}
      />
    );

    if (item.children) {
      return (
        <Menu trigger="hover" position="right-start" offset={10} withinPortal>
          <Menu.Target>{iconLink}</Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{item.label}</Menu.Label>
            {item.children.map((child) => (
              <Menu.Item
                key={child.label}
                className={classes.menuItem}
                data-active={child.path === pathname || undefined}
                onClick={() => onNavigate(child.path)}
              >
                {child.label}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      );
    }

    return (
      <Tooltip label={item.label} position="right" transitionProps={{ duration: 0 }}>
        {iconLink}
      </Tooltip>
    );
  }

  return (
    <NavLink
      label={item.label}
      leftSection={icon}
      active={active}
      defaultOpened={childActive}
      onClick={open}
      className={classes.link}
      classNames={{ section: classes.section, chevron: classes.chevron }}
    >
      {item.children?.map((child) => (
        <NavLink
          key={child.label}
          label={child.label}
          active={child.path === pathname}
          onClick={() => onNavigate(child.path)}
          className={`${classes.link} ${classes.child}`}
        />
      ))}
    </NavLink>
  );
}

interface AppLayoutProps {
  navItems: NavItem[];
}

export default function AppLayout({ navItems }: AppLayoutProps) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  const [desktopExpanded, { toggle: toggleDesktop }] = useDisclosure(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  const showLabels = Boolean(isMobile) || desktopExpanded;

  const goTo = (path: string) => {
    navigate(path);
    if (isMobile) closeMobile();
  };

  const signOut = async () => {
    await signOutEverywhere();
    navigate('/login', { replace: true });
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: { base: NAV_WIDTH.expanded, sm: desktopExpanded ? NAV_WIDTH.expanded : NAV_WIDTH.collapsed },
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      // "alt" runs the sidebar the full height of the screen, header to its right.
      layout="alt"
      transitionDuration={300}
      transitionTimingFunction="ease"
      styles={{
        header: { backgroundColor: '#ffffff', borderBottom: `1px solid ${HEADER_BORDER}` },
        // The component library's own navbar styles load after ours, so the
        // background is applied here, from the palette tokens on .navbar.
        navbar: { backgroundColor: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)' },
      }}
    >
      <AppShell.Header className="no-print">
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <Burger
              opened={desktopExpanded}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
              aria-label={desktopExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            />
          </Group>

          <Group gap="md" wrap="nowrap">
            {!isMobile && (
              <div className={classes.identity}>
                <Title order={6}>{user.tenantName}</Title>
                <Text size="xs" c="dimmed">
                  {user.name}
                </Text>
              </div>
            )}
            <LicenseBadge />
            <SyncButton />
            <Button variant="light" color="red" size="xs" onClick={signOut} leftSection={<IconLogout size={16} />}>
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={`no-print ${classes.navbar}`}>
        <AppShell.Section className={classes.brand} data-collapsed={!showLabels || undefined}>
          <CartMark size={showLabels ? 40 : 34} strokeWidth={4} />
          {/* On phones the sidebar covers the header's menu button, so it carries its own. */}
          <Burger opened onClick={closeMobile} hiddenFrom="sm" size="sm" color="var(--sidebar-text-strong)" aria-label="Close navigation" />
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} className={classes.menu} px={showLabels ? 'sm' : 6} pb="md" scrollbarSize={6} type="hover">
          {navItems.map((item) => (
            <SidebarItem key={item.label} item={item} pathname={pathname} showLabel={showLabels} onNavigate={goTo} />
          ))}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ flex: 1, padding: 'var(--mantine-spacing-md)' }}>
          <Outlet />
        </div>

        <Center className="no-print" py="xs">
          <Text size="xs" c="dimmed">
            Developed and maintained by{' '}
            <Anchor href="https://deviction.tech" target="_blank" size="xs" fw={500}>
              Deviction Technologies
            </Anchor>
          </Text>
        </Center>
      </AppShell.Main>
    </AppShell>
  );
}
