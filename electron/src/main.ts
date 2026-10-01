import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDb, saveDb } from './db/database';
import { registerProductHandlers } from './ipc/products';
import { registerCategoryHandlers } from './ipc/categories';
import { registerOrderHandlers } from './ipc/orders';
import { registerCustomerHandlers } from './ipc/customers';
import { registerCustomerLedgerHandlers } from './ipc/customerLedger';
import { registerEmployeeHandlers } from './ipc/employees';
import { registerExpenseHandlers } from './ipc/expenses';
import { registerEmployeeDamageHandlers } from './ipc/employeeDamages';
import { registerSupplierHandlers } from './ipc/suppliers';
import { registerWastageHandlers } from './ipc/wastage';
import { registerCompanyLogoHandlers } from './ipc/companyLogo';
import { registerSupplierInvoiceHandlers } from './ipc/supplierInvoices';
import { registerSupplierLedgerHandlers } from './ipc/supplierLedger';
import { registerReturnHandlers } from './ipc/returns';
import { registerBankHandlers } from './ipc/banks';
import { registerSettingsHandlers } from './ipc/settings';
import { registerSyncHandlers } from './sync/syncManager';
import { registerAuthHandlers } from './ipc/auth';
import { registerAnalyticsHandlers } from './ipc/analytics';
import { registerLicenseHandlers, startLicenseRefreshLoop } from './ipc/license';

let mainWindow: BrowserWindow | null = null;

/** Window height at which the counter fits at full size. */
const FULL_SIZE_HEIGHT = 800;
/** Zooming out further than this leaves text too small to read at the till. */
const MIN_ZOOM = 0.8;

/**
 * Zoom out on short screens (a 1366×768 laptop, or 125% Windows scaling) so
 * more of the counter fits. Steps of 0.05 keep the text crisp.
 */
function fitZoomToWindow(win: BrowserWindow): void {
  const [, height] = win.getContentSize();
  const fit = Math.floor((height / FULL_SIZE_HEIGHT) * 20) / 20;
  win.webContents.setZoomFactor(Math.min(1, Math.max(MIN_ZOOM, fit)));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    // Small enough for a laptop screen: a minimum taller than the screen
    // pushes the bottom of the window behind the taskbar.
    minWidth: 800,
    minHeight: 500,
    // The File/Edit menu costs a row of the counter; Alt still shows it.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'POS Desktop',
  });
  mainWindow.maximize();

  const win = mainWindow;
  win.webContents.on('did-finish-load', () => fitZoomToWindow(win));
  win.on('resize', () => fitZoomToWindow(win));

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In the packaged app, client/dist is copied into resources/ by electron-builder
    // via the extraResources config in package.json.
    mainWindow.loadFile(
      path.join(process.resourcesPath, 'client', 'dist', 'index.html')
    );
  }
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  // sql.js init is async — must await before registering handlers
  await initDb();

  // Register all IPC handlers
  registerAuthHandlers();
  registerProductHandlers();
  registerCategoryHandlers();
  registerOrderHandlers();
  registerCustomerHandlers();
  registerCustomerLedgerHandlers();
  registerEmployeeHandlers();
  registerExpenseHandlers();
  registerEmployeeDamageHandlers();
  registerSupplierHandlers();
  registerWastageHandlers();
  registerCompanyLogoHandlers();
  registerSupplierInvoiceHandlers();
  registerSupplierLedgerHandlers();
  registerReturnHandlers();
  registerBankHandlers();
  registerSettingsHandlers();
  registerSyncHandlers();
  registerAnalyticsHandlers();
  registerLicenseHandlers();

  // Picks up a renewed licence while the till is open, so a paid customer is
  // never stuck on the lock screen waiting for a restart.
  startLicenseRefreshLoop();

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:getPlatform', () => process.platform);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Save DB to disk before quitting
app.on('before-quit', () => {
  saveDb();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
