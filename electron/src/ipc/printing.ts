/**
 * Receipt printing straight to this till's printer, on the paper it uses.
 *
 * The print dialog forgets its paper size after every receipt, so a custom
 * size had to be picked again for each sale. Once a till has a printer set
 * up (Settings → Receipt Options), receipts go to it directly at that size.
 *
 * The receipt is laid out in a hidden window. A receipt wider than the paper
 * is scaled down to fit, and on roll paper (no fixed height) the page is cut
 * to the receipt's length.
 *
 * "Save as PDF" is offered as a printer too, so a PDF is made at the same
 * remembered size instead of whatever the dialog last defaulted to.
 */
import { BrowserWindow, app, dialog, type IpcMainInvokeEvent } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { handleLicensed } from '../license/licenseGuard';

/** The printer name that means "save a PDF" (client: features/printing/tillPrinter.ts). */
export const SAVE_AS_PDF = '__save_as_pdf__';

export interface ReceiptPrintJob {
  /** The whole receipt document, styles inline. */
  html: string;
  /** The printer, as listed by `printer:list`, or SAVE_AS_PDF. */
  deviceName: string;
  widthMm: number;
  /** Fixed sheet height; empty for roll paper, which is cut to the receipt. */
  heightMm?: number | null;
}

const PX_PER_MM = 96 / 25.4;
const MICRONS_PER_MM = 1000;
/** Paper fed past the last line on a roll, so the cutter doesn't clip it. */
const ROLL_TAIL_MM = 4;

function assertJob(job: ReceiptPrintJob): void {
  if (!job || typeof job.html !== 'string' || !job.html) throw new Error('Nothing to print');
  if (!job.deviceName) throw new Error('Choose a printer in Settings → Receipt Options');
  if (!(job.widthMm >= 20 && job.widthMm <= 1000)) throw new Error('Paper width must be between 20 and 1000 mm');
  if (job.heightMm != null && !(job.heightMm >= 20 && job.heightMm <= 5000)) {
    throw new Error('Paper height must be between 20 and 5000 mm');
  }
}

/** Fit the receipt to the paper width and return its height in mm. */
const LAYOUT_SCRIPT = (pageWidthPx: number) => `
  (async () => {
    await Promise.all(Array.from(document.images).map((img) =>
      img.complete ? null : new Promise((done) => { img.onload = img.onerror = done; })));
    const contentWidth = document.documentElement.scrollWidth;
    if (contentWidth > ${pageWidthPx}) document.body.style.zoom = String(${pageWidthPx} / contentWidth);
    return document.documentElement.getBoundingClientRect().height / ${PX_PER_MM};
  })()
`;

export interface ReceiptPrintResult {
  /** Where the PDF was saved; absent when printed, or the save was cancelled. */
  filePath?: string;
}

/** Ask where to save the PDF, next to the till's window. */
async function savePdf(event: IpcMainInvokeEvent, pdf: Buffer): Promise<ReceiptPrintResult> {
  const at = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  // Local time, as the shop reads it.
  const stamp = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}-${two(at.getMinutes())}`;
  const options = {
    title: 'Save receipt as PDF',
    defaultPath: path.join(app.getPath('documents'), `Receipt ${stamp}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  };
  const owner = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
  if (canceled || !filePath) return {};
  await fs.writeFile(filePath, pdf);
  return { filePath };
}

async function printReceipt(event: IpcMainInvokeEvent, job: ReceiptPrintJob): Promise<ReceiptPrintResult> {
  assertJob(job);

  const pageWidthPx = Math.floor(job.widthMm * PX_PER_MM);
  const win = new BrowserWindow({
    show: false,
    width: pageWidthPx,
    height: 800,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  // A file, not a data: URL: an inline logo can make the receipt too long for a URL.
  const file = path.join(app.getPath('temp'), `pos-receipt-${process.pid}-${Date.now()}.html`);

  try {
    await fs.writeFile(file, job.html, 'utf8');
    await win.loadFile(file);

    const contentHeightMm: number = await win.webContents.executeJavaScript(LAYOUT_SCRIPT(pageWidthPx));
    const heightMm = job.heightMm || Math.ceil(contentHeightMm) + ROLL_TAIL_MM;

    // The page's own @page rule must agree with the size sent to the printer.
    await win.webContents.executeJavaScript(`
      document.head.insertAdjacentHTML('beforeend',
        '<style>@page { size: ${job.widthMm}mm ${heightMm}mm; margin: 0; } html, body { margin: 0; }</style>');
    `);

    if (job.deviceName === SAVE_AS_PDF) {
      const MM_PER_INCH = 25.4;
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        pageSize: { width: job.widthMm / MM_PER_INCH, height: heightMm / MM_PER_INCH },
      });
      return await savePdf(event, pdf);
    }

    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: job.deviceName,
          margins: { marginType: 'none' },
          pageSize: { width: Math.round(job.widthMm * MICRONS_PER_MM), height: Math.round(heightMm * MICRONS_PER_MM) },
        },
        (success, failureReason) => (success ? resolve() : reject(new Error(failureReason || 'The printer did not accept the receipt')))
      );
    });
    return {};
  } finally {
    win.destroy();
    fs.unlink(file).catch(() => undefined);
  }
}

export function registerPrintingHandlers(): void {
  handleLicensed('printer:list', async (event) => {
    const printers = await event.sender.getPrintersAsync();
    return printers.map((printer) => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      isDefault: printer.isDefault,
    }));
  });

  handleLicensed('printer:printReceipt', (event, job: ReceiptPrintJob) => printReceipt(event, job));
}
