/**
 * Settings → Receipt Options on a desktop till: the printer receipts go to
 * and the paper it holds. Saved on this till as soon as it changes.
 */
import { useEffect, useState } from 'react';
import { Button, Divider, Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPrinter } from '@tabler/icons-react';
import { PAPER_OPTIONS, SAVE_AS_PDF, paperSize, readSavedTillPrinter, resolveTillPrinter, saveTillPrinter } from '../printing/tillPrinter';
import type { PaperChoice, TillPrinter } from '../printing/tillPrinter';

const TEST_RECEIPT = `<!DOCTYPE html><html><body style="margin:0">
  <div style="width:300px;padding:10px;font-family:monospace;font-size:12px;text-align:center">
    <div style="font-size:16px;font-weight:bold">TEST RECEIPT</div>
    <div>The printer and paper size are set up.</div>
    <div style="margin-top:8px">${'-'.repeat(32)}</div>
    <div>${new Date().toLocaleString()}</div>
  </div></body></html>`;

export default function TillPrinterSettings({ receiptSize }: { receiptSize: 'Thermal' | 'A4' }) {
  // Until a choice is saved, shows what receipts use now (default printer, or Save as PDF).
  const [printer, setPrinter] = useState<TillPrinter>(() => readSavedTillPrinter() ?? { deviceName: SAVE_AS_PDF, paper: 'receipt' });
  const [printers, setPrinters] = useState<{ value: string; label: string }[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!readSavedTillPrinter()) resolveTillPrinter().then(setPrinter);
    window.electronAPI?.printer
      .list()
      .then((list) => setPrinters(list.map((p) => ({ value: p.name, label: p.isDefault ? `${p.displayName} (default)` : p.displayName }))))
      .catch(() => setPrinters([]));
  }, []);

  const update = (changes: Partial<TillPrinter>) => {
    const next = { ...printer, ...changes };
    setPrinter(next);
    saveTillPrinter(next);
  };

  const paper = paperSize(printer, receiptSize);
  // A saved printer that is no longer installed still shows, so it can be changed.
  const printerOptions = [
    { value: '', label: 'Ask every time (print dialog)' },
    { value: SAVE_AS_PDF, label: 'Save as PDF' },
    ...printers,
    ...(printer.deviceName && printer.deviceName !== SAVE_AS_PDF && !printers.some((p) => p.value === printer.deviceName)
      ? [{ value: printer.deviceName, label: `${printer.deviceName} (not found)` }]
      : []),
  ];

  const printTest = async () => {
    if (!paper || !window.electronAPI) return;
    setTesting(true);
    try {
      const { filePath } = await window.electronAPI.printer.printReceipt({ html: TEST_RECEIPT, deviceName: printer.deviceName, ...paper });
      if (filePath) notifications.show({ title: 'Test receipt saved as PDF', message: filePath, color: 'green' });
      else if (printer.deviceName !== SAVE_AS_PDF) notifications.show({ message: 'Test receipt sent to the printer', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Test receipt not printed', message: String((error as Error)?.message ?? error), color: 'red' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Stack gap="md">
      <Divider label="This till's printer" labelPosition="left" />
      <Text size="sm" c="dimmed">
        Choose a printer (or Save as PDF) and every receipt uses this paper size, without the print dialog.
        Saved on this computer only.
      </Text>
      <Select
        label="Printer"
        data={printerOptions}
        value={printer.deviceName}
        onChange={(value) => update({ deviceName: value ?? '' })}
        allowDeselect={false}
        searchable
      />
      <Select
        label="Paper"
        data={PAPER_OPTIONS}
        value={printer.paper}
        onChange={(value) => update({ paper: (value as PaperChoice) ?? 'receipt' })}
        allowDeselect={false}
        disabled={!printer.deviceName}
      />
      {printer.paper === 'custom' && (
        <Group grow align="flex-start">
          <NumberInput
            label="Width (mm)"
            min={20}
            max={1000}
            value={printer.widthMm ?? ''}
            onChange={(value) => update({ widthMm: typeof value === 'number' ? value : null })}
            error={printer.deviceName && !printer.widthMm ? 'Enter the paper width' : undefined}
            disabled={!printer.deviceName}
          />
          <NumberInput
            label="Height (mm)"
            description="Leave empty for roll paper"
            min={20}
            max={5000}
            value={printer.heightMm ?? ''}
            onChange={(value) => update({ heightMm: typeof value === 'number' ? value : null })}
            disabled={!printer.deviceName}
          />
        </Group>
      )}
      <Group>
        <Button
          type="button"
          variant="light"
          leftSection={<IconPrinter size={16} />}
          onClick={printTest}
          loading={testing}
          disabled={!printer.deviceName || !paper}
        >
          {printer.deviceName === SAVE_AS_PDF ? 'Save test receipt as PDF' : 'Print test receipt'}
        </Button>
        {printer.deviceName && paper && (
          <Text size="sm" c="dimmed">
            Paper: {paper.widthMm} mm × {paper.heightMm ? `${paper.heightMm} mm` : 'receipt length'}
          </Text>
        )}
      </Group>
    </Stack>
  );
}
