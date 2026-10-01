/**
 * A table cell that edits in place, like a spreadsheet: click it (or press
 * Enter on it) to edit, Enter or clicking away saves, Escape cancels. While it
 * saves the input is locked; if saving fails, the reason is shown on the cell
 * and it stays in edit mode with what was typed, so nothing is lost.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Box, Loader, NumberInput, Select, TextInput, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { errorMessage } from '../utils/errorMessage';

interface CommonProps {
  /** What the cell shows when it is not being edited. */
  display: ReactNode;
  /** Names the cell for screen readers, e.g. "Payment received for INV-12". */
  label: string;
  /** Read-only cells show `display` and cannot be clicked. */
  editable?: boolean;
  /** Text alignment, so money stays right-aligned while it is edited. */
  align?: 'left' | 'right';
}

interface MoneyCellProps extends CommonProps {
  kind: 'money';
  value: number;
  min?: number;
  max?: number;
  /** A reason the amount cannot be saved, or null when it can. */
  validate?: (value: number) => string | null;
  onSave: (value: number) => Promise<void>;
}

interface TextCellProps extends CommonProps {
  kind: 'text';
  value: string;
  maxLength?: number;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
}

interface SelectCellProps extends CommonProps {
  kind: 'select';
  value: string;
  options: { value: string; label: string }[];
  onSave: (value: string) => Promise<void>;
}

export type EditableCellProps = MoneyCellProps | TextCellProps | SelectCellProps;

const round2 = (value: number) => Math.round(value * 100) / 100;

export default function EditableCell(props: EditableCellProps) {
  const { display, label, editable = true, align = 'left' } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Stops the blur that follows Enter or Escape from saving a second time. */
  const settled = useRef(false);

  const start = () => {
    if (!editable || saving) return;
    setDraft(props.kind === 'money' ? String(round2(props.value)) : props.value ?? '');
    setError(null);
    settled.current = false;
    setEditing(true);
  };

  const cancel = () => {
    settled.current = true;
    setEditing(false);
    setError(null);
  };

  // Leaving edit mode (or the row changing underneath) always clears a stale error.
  useEffect(() => {
    if (!editing) setError(null);
  }, [editing]);

  /** The typed value in the cell's own type, or a reason it cannot be saved. */
  const parse = (): { value: number | string } | { problem: string } => {
    if (props.kind !== 'money') return { value: props.kind === 'text' ? draft.trim() : draft };

    const amount = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(amount)) return { problem: 'Enter an amount' };
    if (props.min !== undefined && amount < props.min) return { problem: `Must be at least ${props.min}` };
    if (props.max !== undefined && amount > props.max) return { problem: `Must be at most ${props.max}` };
    const problem = props.validate?.(round2(amount));
    return problem ? { problem } : { value: round2(amount) };
  };

  const commit = async (next?: string) => {
    if (settled.current || saving) return;
    const parsed = next === undefined ? parse() : { value: next };
    if ('problem' in parsed) {
      setError(parsed.problem);
      return;
    }

    const unchanged = props.kind === 'money' ? round2(props.value) === parsed.value : (props.value ?? '') === parsed.value;
    if (unchanged) {
      cancel();
      return;
    }

    settled.current = true;
    setSaving(true);
    try {
      await (props.onSave as (value: number | string) => Promise<void>)(parsed.value);
      setEditing(false);
    } catch (failure) {
      // Stay in edit mode with what was typed, so it can be corrected and saved again.
      settled.current = false;
      setError(errorMessage(failure, 'The change could not be saved'));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };

  if (!editing) {
    if (!editable) return <>{display}</>;
    return (
      <Tooltip label="Click to edit" openDelay={600} withArrow>
        <Box
          role="button"
          tabIndex={0}
          aria-label={`Edit ${label}`}
          onClick={start}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              start();
            }
          }}
          style={{
            cursor: 'text',
            borderRadius: 4,
            padding: '2px 4px',
            margin: '-2px -4px',
            minHeight: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: align === 'right' ? 'flex-end' : 'space-between',
            gap: 6,
            outline: '1px dashed var(--mantine-color-gray-4)',
            outlineOffset: -1,
          }}
        >
          {display}
          {align !== 'right' && <IconPencil size={12} style={{ opacity: 0.45, flexShrink: 0 }} />}
        </Box>
      </Tooltip>
    );
  }

  const shared = {
    size: 'xs' as const,
    autoFocus: true,
    disabled: saving,
    error,
    'aria-label': label,
    rightSection: saving ? <Loader size={12} /> : undefined,
    onKeyDown,
    styles: { input: { textAlign: align } },
    // Escape cancels the edit; this tells the dialog around the table not to close on it too.
    'data-mantine-stop-propagation': true,
  };

  if (props.kind === 'select') {
    return (
      <Select
        {...shared}
        data={props.options}
        value={draft}
        defaultDropdownOpened
        allowDeselect={false}
        onChange={(value) => {
          if (!value) return;
          setDraft(value);
          void commit(value);
        }}
        onBlur={() => !saving && !settled.current && cancel()}
        comboboxProps={{ withinPortal: true }}
      />
    );
  }

  if (props.kind === 'money') {
    return (
      <NumberInput
        {...shared}
        value={draft}
        onChange={(value) => setDraft(String(value))}
        onBlur={() => void commit()}
        decimalScale={2}
        hideControls
        onFocus={(event) => event.currentTarget.select()}
      />
    );
  }

  return (
    <TextInput
      {...shared}
      value={draft}
      maxLength={props.maxLength}
      placeholder={props.placeholder}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => void commit()}
      onFocus={(event) => event.currentTarget.select()}
    />
  );
}
