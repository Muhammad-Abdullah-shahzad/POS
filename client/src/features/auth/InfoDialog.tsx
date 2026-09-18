/**
 * A small information card that pops up over the auth screens, with a single
 * "Got it" to close it. Used for help such as "Forgot your password?".
 */
import type { ReactNode } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import { AUTH_BRAND, authClasses, authDialogProps } from './authFieldClasses';

interface InfoDialogProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  /** One or more <p> elements. */
  children: ReactNode;
}

export default function InfoDialog({ opened, onClose, title, children }: InfoDialogProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={600}>{title}</Text>} size={380} {...authDialogProps}>
      <div className={authClasses.infoBody}>{children}</div>
      <Group justify="flex-end" mt="lg">
        <Button size="sm" radius={2} color={AUTH_BRAND} onClick={onClose}>
          Got it
        </Button>
      </Group>
    </Modal>
  );
}
