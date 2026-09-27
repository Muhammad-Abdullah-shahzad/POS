/**
 * Asks the cashier for remarks before a sale is completed, e.g. delivery
 * notes. Remarks are optional and print under the customer details.
 *
 * Built for speed at the till: it opens instantly with the cursor in the box,
 * Enter confirms, Shift+Enter starts a new line, and Escape cancels the sale.
 */
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button, Group, Modal, Text, Textarea } from '@mantine/core';

/** Matches the limit the server enforces. */
const MAX_REMARKS_LENGTH = 500;

interface RemarksPromptProps {
  opened: boolean;
  onConfirm: (remarks: string) => void;
  onCancel: () => void;
}

export default function RemarksPrompt({ opened, onConfirm, onCancel }: RemarksPromptProps) {
  const [remarks, setRemarks] = useState('');

  // Each sale starts with an empty box.
  const confirm = () => {
    const value = remarks.trim();
    setRemarks('');
    onConfirm(value);
  };

  const cancel = () => {
    setRemarks('');
    onCancel();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      confirm();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={cancel}
      title={<Text fw={700}>Remarks for this invoice</Text>}
      centered
      size="md"
      transitionProps={{ duration: 0 }}
    >
      <Textarea
        data-autofocus
        value={remarks}
        onChange={(event) => setRemarks(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Deliver to site on Monday"
        description="Optional. Printed under the customer details. Enter to continue, Shift+Enter for a new line."
        autosize
        minRows={3}
        maxRows={6}
        maxLength={MAX_REMARKS_LENGTH}
      />
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={cancel}>
          Cancel
        </Button>
        <Button onClick={confirm}>OK</Button>
      </Group>
    </Modal>
  );
}
