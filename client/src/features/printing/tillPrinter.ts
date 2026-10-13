/**
 * This desktop till's receipt printer and paper, kept on the till itself:
 * each till has its own printer, so this is not a company setting.
 *
 * Receipts print straight to the chosen printer at this paper size, every
 * time. "Save as PDF" counts as a printer: the PDF is made at the same size.
 * Until a choice is saved, the computer's default printer is used, or Save as
 * PDF when it has none; the system print dialog (which falls back to A4) only
 * opens when "Ask every time" is chosen.
 */
export type PaperChoice = 'receipt' | 'roll80' | 'roll58' | 'A4' | 'custom';

/** The printer choice that saves a PDF (electron/src/ipc/printing.ts). */
export const SAVE_AS_PDF = '__save_as_pdf__';

export interface TillPrinter {
  /** Printer name, or SAVE_AS_PDF; empty means "show the print dialog". */
  deviceName: string;
  paper: PaperChoice;
  /** Custom paper only. */
  widthMm?: number | null;
  /** Custom paper only; empty for a roll, which is cut to the receipt. */
  heightMm?: number | null;
}

export interface PaperSize {
  widthMm: number;
  /** Null on roll paper: the page is as long as the receipt. */
  heightMm: number | null;
}

export const PAPER_OPTIONS: { value: PaperChoice; label: string }[] = [
  { value: 'receipt', label: 'Match the receipt size (80 mm roll or A4)' },
  { value: 'roll80', label: 'Thermal roll, 80 mm' },
  { value: 'roll58', label: 'Thermal roll, 58 mm' },
  { value: 'A4', label: 'A4 sheet' },
  { value: 'custom', label: 'Custom size' },
];

const A4: PaperSize = { widthMm: 210, heightMm: 297 };
const STORAGE_KEY = 'tillPrinter';
const ASK_EVERY_TIME: TillPrinter = { deviceName: '', paper: 'receipt' };

/** The choice saved on this till, or null when none has been made. */
export function readSavedTillPrinter(): TillPrinter | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...ASK_EVERY_TIME, ...(JSON.parse(saved) as TillPrinter) } : null;
  } catch {
    return null;
  }
}

/**
 * The printer receipts go to: the saved choice, else the default printer (or
 * the first one), else Save as PDF. On the web there is no choice: the
 * browser's dialog opens.
 */
export async function resolveTillPrinter(): Promise<TillPrinter> {
  const saved = readSavedTillPrinter();
  if (saved || !window.electronAPI) return saved ?? ASK_EVERY_TIME;

  const printers = await window.electronAPI.printer.list().catch(() => []);
  const fallback = printers.find((p) => p.isDefault) ?? printers[0];
  return { deviceName: fallback?.name ?? SAVE_AS_PDF, paper: 'receipt' };
}

export function saveTillPrinter(printer: TillPrinter): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(printer));
  } catch {
    // Storage unavailable: receipts keep using the print dialog.
  }
}

/** The paper to print on, or null when the custom size is incomplete. */
export function paperSize(printer: TillPrinter, receiptSize: 'Thermal' | 'A4'): PaperSize | null {
  switch (printer.paper) {
    case 'roll80': return { widthMm: 80, heightMm: null };
    case 'roll58': return { widthMm: 58, heightMm: null };
    case 'A4': return A4;
    case 'custom':
      return printer.widthMm ? { widthMm: printer.widthMm, heightMm: printer.heightMm || null } : null;
    default:
      return receiptSize === 'A4' ? A4 : { widthMm: 80, heightMm: null };
  }
}
