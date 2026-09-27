/**
 * The company logo in Settings: upload, replace or remove it. Changes save at
 * once, and every open invoice and screen picks up the new logo straight away.
 */
import { useRef, useState } from 'react';
import { Box, Button, FileButton, Group, Image, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPhoto, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import api from '../../services/api';
import { useBrandingStore } from '../../store/brandingStore';
import { assetUrl } from '../../utils/assetUrl';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

function errorMessage(error: unknown, fallback: string): string {
  const failure = error as { response?: { data?: { message?: string } }; message?: string };
  return failure.response?.data?.message || failure.message || fallback;
}

export default function CompanyLogoSetting() {
  const logo = useBrandingStore((state) => state.logo);
  const setLogo = useBrandingStore((state) => state.setLogo);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  // Clears the picker so choosing the same file again still triggers an upload.
  const resetPicker = useRef<() => void>(null);

  const notifyFailure = (title: string, error: unknown, fallback: string) =>
    notifications.show({ title, message: errorMessage(error, fallback), color: 'red', icon: <IconX size={16} /> });

  const upload = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      notifications.show({ title: 'Logo too large', message: 'Choose an image of 5 MB or less.', color: 'red', icon: <IconX size={16} /> });
      resetPicker.current?.();
      return;
    }

    const body = new FormData();
    body.append('logo', file);

    try {
      setBusy('upload');
      const { data } = await api.post('/company-logo', body);
      setLogo(data?.data ? { slug: data.data.slug, url: data.data.url } : null);
      notifications.show({ title: 'Logo updated', message: 'It now prints on your A4 invoices.', color: 'teal', icon: <IconCheck size={16} /> });
    } catch (error) {
      notifyFailure('Upload failed', error, 'The logo could not be uploaded.');
    } finally {
      setBusy(null);
      resetPicker.current?.();
    }
  };

  const remove = async () => {
    try {
      setBusy('remove');
      await api.delete('/company-logo');
      setLogo(null);
      notifications.show({ title: 'Logo removed', message: 'Invoices now show the shop name only.', color: 'teal', icon: <IconCheck size={16} /> });
    } catch (error) {
      notifyFailure('Could not remove the logo', error, 'Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  const preview = assetUrl(logo?.url);

  return (
    <Paper withBorder p="lg" radius="md">
      <Group align="flex-start" gap="lg" wrap="nowrap">
        <Box
          w={120}
          h={120}
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed var(--mantine-color-gray-4)',
            borderRadius: 8,
            background: 'var(--mantine-color-gray-0)',
            overflow: 'hidden',
          }}
        >
          {preview ? (
            <Image src={preview} alt="Company logo" fit="contain" w={112} h={112} />
          ) : (
            <Stack align="center" gap={4}>
              <IconPhoto size={28} color="var(--mantine-color-gray-5)" />
              <Text size="xs" c="dimmed">No logo</Text>
            </Stack>
          )}
        </Box>

        <Stack gap={6}>
          <Text fw={600}>Company logo</Text>
          <Text size="sm" c="dimmed">
            Printed at the top left of your A4 invoices. PNG, JPG or WebP, up to 5 MB. A logo on a white or transparent
            background prints best.
          </Text>
          <Group gap="xs" mt={4}>
            <FileButton onChange={upload} accept={ACCEPTED_TYPES} resetRef={resetPicker}>
              {(props) => (
                <Button {...props} leftSection={<IconUpload size={16} />} loading={busy === 'upload'} disabled={busy === 'remove'}>
                  {logo ? 'Replace logo' : 'Upload logo'}
                </Button>
              )}
            </FileButton>
            {logo && (
              <Button
                variant="default"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={remove}
                loading={busy === 'remove'}
                disabled={busy === 'upload'}
              >
                Remove
              </Button>
            )}
          </Group>
        </Stack>
      </Group>
    </Paper>
  );
}
