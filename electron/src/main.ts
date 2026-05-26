import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { initDb, saveDb } from './db/database';
import { registerProductHandlers } from './ipc/products';
import { registerCategoryHandlers } from './ipc/categories';
import { registerOrderHandlers } from './ipc/orders';
import { registerCustomerHandlers } from './ipc/customers';
import { registerEmployeeHandlers } from './ipc/employees';
import { registerExpenseHandlers } from './ipc/expenses';
import { registerEmployeeDamageHandlers } from './ipc/employeeDamages';
import { registerSupplierHandlers } from './ipc/suppliers';
import { registerBankHandlers } from './ipc/banks';
import { registerSettingsHandlers } from './ipc/settings';
import { registerSyncHandlers } from './sync/syncManager';
import { registerAuthHandlers, seedDefaultAdmin } from './ipc/auth';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'POS Desktop',
  });

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

  // Seed default admin user if no users exist yet
  seedDefaultAdmin();

  // Register all IPC handlers
  registerAuthHandlers();
  registerProductHandlers();
  registerCategoryHandlers();
  registerOrderHandlers();
  registerCustomerHandlers();
  registerEmployeeHandlers();
  registerExpenseHandlers();
  registerEmployeeDamageHandlers();
  registerSupplierHandlers();
  registerBankHandlers();
  registerSettingsHandlers();
  registerSyncHandlers();

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
