import { useState } from 'react';
import { ActionIcon, Button, Modal, TextInput, PasswordInput, Text, Stack, Group, Badge, Tooltip } from '@mantine/core';
import { IconCloudUpload, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import axios from 'axios';

interface SyncResult { collection: string; synced: number; errors: string[]; }
interface SyncSummary { success: boolean; results: SyncResult[]; totalSynced: number; totalErrors: number; }

const WEB_API = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const TOKEN_KEY = 'sync_web_token';

export default function SyncButton() {
  const [loading, setLoading]             = useState(false);
  const [summary, setSummary]             = useState<SyncSummary | null>(null);
  const [loginOpen, setLoginOpen]         = useState(false);
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [loginErr, setLoginErr]           = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);

  if (!window.electronAPI) return null;

  const getWebToken = () => localStorage.getItem(TOKEN_KEY);

  const handleWebLogin = async () => {
    try {
      setLoginLoading(true);
      setLoginErr('');
      const { data } = await axios.post(`${WEB_API}/auth/login`, { email, password });
      localStorage.setItem(TOKEN_KEY, data.data.token);
      setLoginOpen(false);
      setEmail('');
      setPassword('');
      runSync(data.data.token);
    } catch (err: any) {
      setLoginErr(err.response?.data?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const runSync = async (token: string) => {
    setLoading(true);
    setSummary(null);
    try {
      const result: SyncSummary = await window.electronAPI!.sync.all({ baseUrl: WEB_API, token });
      const expired = result.results.some(r =>
        r.errors.some(e => e.toLowerCase().includes('token') || e.toLowerCase().includes('unauthorized'))
      );
      if (expired) {
        localStorage.removeItem(TOKEN_KEY);
        setLoginOpen(true);
        return;
      }
      setSummary(result);
    } catch {
      setSummary({ success: false, results: [], totalSynced: 0, totalErrors: 1 });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = () => {
    const token = getWebToken();
    if (!token) { setLoginOpen(true); return; }
    runSync(token);
  };

  const statusBadge = summary && (
    <Tooltip label={summary.success ? `${summary.totalSynced} records synced` : `${summary.totalErrors} error(s) — click to dismiss`} withArrow>
      <Badge
        size="xs"
        variant="light"
        color={summary.success ? 'teal' : 'red'}
        leftSection={summary.success ? <IconCheck size={10} /> : <IconAlertTriangle size={10} />}
        style={{ cursor: 'pointer' }}
        onClick={() => setSummary(null)}
      >
        {summary.success ? 'Synced' : 'Failed'}
      </Badge>
    </Tooltip>
  );

  return (
    <>
      <Group gap={6} align="center" wrap="nowrap">
        {statusBadge}
        <Button
          size="xs"
          variant="default"
          loading={loading}
          leftSection={!loading ? <IconCloudUpload size={14} /> : undefined}
          onClick={handleSync}
          styles={{
            root: {
              fontWeight: 500,
              borderColor: 'var(--mantine-color-default-border)',
            },
          }}
        >
          {loading ? 'Syncing…' : 'Sync'}
        </Button>
      </Group>

      <Modal
        opened={loginOpen}
        onClose={() => setLoginOpen(false)}
        title={
          <Group gap="xs">
            <IconCloudUpload size={18} />
            <Text fw={600} size="sm">Connect to Web Server</Text>
          </Group>
        }
        size="sm"
        centered
      >
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            Enter your web server credentials to authorise data sync.
          </Text>
          {loginErr && (
            <Text c="red" size="xs" fw={500}>{loginErr}</Text>
          )}
          <TextInput
            label="Email"
            placeholder="admin@example.com"
            value={email}
            onChange={e => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.currentTarget.value)}
            onKeyDown={e => e.key === 'Enter' && handleWebLogin()}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" size="sm" onClick={() => setLoginOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={loginLoading} onClick={handleWebLogin} leftSection={<IconCloudUpload size={14} />}>
              Sign in & Sync
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
