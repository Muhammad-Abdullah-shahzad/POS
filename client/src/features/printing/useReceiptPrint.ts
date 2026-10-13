/**
 * Print a receipt or invoice. On a desktop till with a printer set up, it goes
 * straight to that printer at the till's paper size; otherwise (the web, or no
 * printer chosen) the print dialog opens.
 */
import type { RefObject } from 'react';
import { useReactToPrint } from 'react-to-print';
import { notifications } from '@mantine/notifications';
import { printPageStyle } from './printPageStyle';
import { paperSize, resolveTillPrinter } from './tillPrinter';

/** The desktop app's IPC error, without Electron's "Error invoking remote method" wrapper. */
const printFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

export function useReceiptPrint(contentRef: RefObject<HTMLDivElement | null>, receiptSize: 'Thermal' | 'A4') {
  return useReactToPrint({
    contentRef,
    pageStyle: printPageStyle(receiptSize),
    // Receipts carry inline styles only; skipping the app's stylesheets opens the print window faster.
    ignoreGlobalStyles: true,
    print: async (iframe) => {
      // Read at print time, so a change in Settings applies to the next receipt.
      const printer = await resolveTillPrinter();
      const paper = paperSize(printer, receiptSize);
      const document = iframe.contentDocument;

      if (!window.electronAPI || !printer.deviceName || !paper || !document) {
        iframe.contentWindow?.print();
        return;
      }

      try {
        const { filePath } = await window.electronAPI.printer.printReceipt({
          html: `<!DOCTYPE html>${document.documentElement.outerHTML}`,
          deviceName: printer.deviceName,
          ...paper,
        });
        if (filePath) notifications.show({ title: 'Receipt saved as PDF', message: filePath, color: 'green' });
      } catch (error) {
        notifications.show({ title: 'Receipt not printed', message: printFailure(error), color: 'red' });
      }
    },
  });
}
