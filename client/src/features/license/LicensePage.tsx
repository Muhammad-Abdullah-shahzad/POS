/**
 * The licence screen.
 *
 * Doubles as the lock screen: when the licence has run out the route guard
 * sends every page here, and the only ways forward are pasting the key the
 * operator sent, checking whether a renewal has been recorded, or signing
 * out. With a valid licence it simply shows the expiry and lets an admin
 * apply a new key ahead of time.
 */
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconKey, IconLogout, IconRefresh } from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { isLicenseBlocking, useLicenseStore } from '../../store/licenseStore';
import type { LicenseStatus } from '../../store/licenseStore';
import { activateLicense, fetchLicenseStatus, refreshLicenseStatus } from '../../services/licenseService';
import { signOutEverywhere } from '../../services/sessionService';

const STATE_LABEL: Record<LicenseStatus['state'], { label: string; color: string }> = {
  active: { label: 'Active', color: 'teal' },
  expired: { label: 'Expired', color: 'red' },
  missing: { label: 'No licence', color: 'red' },
  invalid: { label: 'Invalid', color: 'red' },
  unknown: { label: 'Checking…', color: 'gray' },
};

const formatDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : '—');

const LicensePage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const status = useLicenseStore((state) => state.status);

  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'activate' | 'refresh' | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (user) fetchLicenseStatus().catch(() => undefined);
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  const locked = isLicenseBlocking(status);
  const home = isAdmin() ? '/admin' : '/';

  const handleActivate = async () => {
    if (!key.trim()) {
      setNotice({ ok: false, text: 'Paste the licence key first' });
      return;
    }

    setBusy('activate');
    setNotice(null);
    try {
      const result = await activateLicense(key);
      setNotice({ ok: result.success, text: result.message });
      if (result.success) setKey('');
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy('refresh');
    setNotice(null);
    try {
      const refreshed = await refreshLicenseStatus();
      setNotice({
        ok: refreshed.state === 'active',
        text: refreshed.offline
          ? 'Could not reach the server. Paste the key you were sent to renew offline.'
          : refreshed.message,
      });
    } catch {
      setNotice({ ok: false, text: 'Could not check the licence right now' });
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    await signOutEverywhere();
    navigate('/login', { replace: true });
  };

  const badge = STATE_LABEL[status.state];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--mantine-color-gray-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <Paper p="xl" radius="md" style={{ width: '100%', maxWidth: 520 }}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={3}>{locked ? 'Licence needed' : 'Licence'}</Title>
              <Text size="sm" c="dimmed">
                {user.tenantName}
              </Text>
            </div>
            <Badge color={badge.color} variant="light" size="lg" leftSection={<IconKey size={12} />}>
              {badge.label}
            </Badge>
          </Group>

          <Alert
            color={locked ? 'red' : status.state === 'active' && (status.daysLeft ?? 99) <= 7 ? 'orange' : 'blue'}
            icon={locked ? <IconAlertTriangle size={18} /> : <IconCheck size={18} />}
            variant="light"
          >
            <Text size="sm">{status.message}</Text>
            {status.expiresAt && (
              <Text size="xs" c="dimmed" mt={4}>
                {status.state === 'active' ? 'Expires' : 'Expired'} on {formatDate(status.expiresAt)}
                {status.daysLeft !== null && status.daysLeft >= 0 ? ` · ${status.daysLeft} day(s) left` : ''}
                {status.kind === 'trial' ? ' · trial' : ''}
              </Text>
            )}
          </Alert>

          {locked && (
            <Text size="sm">
              To renew, contact Deviction Technologies. Once your payment is confirmed you will receive a licence
              key; paste it below, or press <b>Check for renewal</b> if this device is online.
            </Text>
          )}

          <Textarea
            label="Licence key"
            placeholder="POS1.…"
            description="Paste the full key exactly as it was sent to you"
            autosize
            minRows={3}
            value={key}
            onChange={(event) => setKey(event.currentTarget.value)}
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          />

          {notice && (
            <Text size="sm" c={notice.ok ? 'teal' : 'red'}>
              {notice.text}
            </Text>
          )}

          <Group grow>
            <Button
              leftSection={<IconKey size={16} />}
              onClick={handleActivate}
              loading={busy === 'activate'}
              disabled={busy !== null}
            >
              Activate key
            </Button>
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={handleRefresh}
              loading={busy === 'refresh'}
              disabled={busy !== null}
            >
              Check for renewal
            </Button>
          </Group>

          <Group justify="space-between" mt="xs">
            <Button variant="subtle" color="red" leftSection={<IconLogout size={16} />} onClick={handleSignOut}>
              Sign out
            </Button>
            {!locked && (
              <Button variant="light" onClick={() => navigate(home)}>
                Back to the app
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>
    </div>
  );
};

export default LicensePage;
