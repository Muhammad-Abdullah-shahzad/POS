/**
 * Sync controls for the desktop till.
 *
 * Credentials live in the Electron main process, not in this page, so these
 * buttons carry no token. The till signs in to the server once and the main
 * process keeps that session alive from then on.
 */
import { useState } from 'react';
import { Badge, Button, Group, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconCloudDownload, IconCloudUpload } from '@tabler/icons-react';

type SyncMode = 'all' | 'pull';

interface SyncSummary {
  success: boolean;
  results: Array<{ collection: string; synced: number; errors: string[] }>;
  totalSynced: number;
  totalErrors: number;
}

const firstError = (summary: SyncSummary): string | undefined =>
  summary.results.flatMap((result) => result.errors)[0];

export default function SyncButton() {
  const [running, setRunning] = useState<SyncMode | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  // The web build talks to the API directly and has nothing to sync.
  if (!window.electronAPI) return null;

  const run = async (mode: SyncMode) => {
    setRunning(mode);
    setSummary(null);

    try {
      const result = mode === 'pull'
        ? await window.electronAPI!.sync.pull()
        : await window.electronAPI!.sync.all();

      setSummary(result);
    } catch {
      setSummary({
        success: false,
        results: [{ collection: 'sync', synced: 0, errors: ['Sync could not be started'] }],
        totalSynced: 0,
        totalErrors: 1,
      });
    } finally {
      setRunning(null);
    }
  };

  const statusBadge = summary && (
    <Tooltip
      label={
        summary.success
          ? `${summary.totalSynced} records synced`
          : firstError(summary) ?? `${summary.totalErrors} error(s) — click to dismiss`
      }
      withArrow
      multiline
      w={280}
    >
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
    <Group gap={6} align="center" wrap="nowrap">
      {statusBadge}

      <Tooltip label="Download the latest data from the server" withArrow>
        <Button
          size="xs"
          variant="default"
          loading={running === 'pull'}
          disabled={running !== null}
          leftSection={running !== 'pull' ? <IconCloudDownload size={14} /> : undefined}
          onClick={() => run('pull')}
        >
          {running === 'pull' ? 'Pulling…' : 'Pull'}
        </Button>
      </Tooltip>

      <Tooltip label="Send this till's changes, then download the server's" withArrow>
        <Button
          size="xs"
          variant="default"
          loading={running === 'all'}
          disabled={running !== null}
          leftSection={running !== 'all' ? <IconCloudUpload size={14} /> : undefined}
          onClick={() => run('all')}
        >
          {running === 'all' ? 'Syncing…' : 'Sync'}
        </Button>
      </Tooltip>
    </Group>
  );
}
