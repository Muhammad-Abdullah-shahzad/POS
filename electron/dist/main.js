"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_1 = require("./db/database");
const products_1 = require("./ipc/products");
const categories_1 = require("./ipc/categories");
const orders_1 = require("./ipc/orders");
const customers_1 = require("./ipc/customers");
const customerLedger_1 = require("./ipc/customerLedger");
const employees_1 = require("./ipc/employees");
const expenses_1 = require("./ipc/expenses");
const employeeDamages_1 = require("./ipc/employeeDamages");
const suppliers_1 = require("./ipc/suppliers");
const wastage_1 = require("./ipc/wastage");
const companyLogo_1 = require("./ipc/companyLogo");
const supplierInvoices_1 = require("./ipc/supplierInvoices");
const supplierLedger_1 = require("./ipc/supplierLedger");
const returns_1 = require("./ipc/returns");
const banks_1 = require("./ipc/banks");
const settings_1 = require("./ipc/settings");
const syncManager_1 = require("./sync/syncManager");
const auth_1 = require("./ipc/auth");
const analytics_1 = require("./ipc/analytics");
const license_1 = require("./ipc/license");
let mainWindow = null;
/** Window height at which the counter fits at full size. */
const FULL_SIZE_HEIGHT = 800;
/** Zooming out further than this leaves text too small to read at the till. */
const MIN_ZOOM = 0.8;
/**
 * Zoom out on short screens (a 1366×768 laptop, or 125% Windows scaling) so
 * more of the counter fits. Steps of 0.05 keep the text crisp.
 */
function fitZoomToWindow(win) {
    const [, height] = win.getContentSize();
    const fit = Math.floor((height / FULL_SIZE_HEIGHT) * 20) / 20;
    win.webContents.setZoomFactor(Math.min(1, Math.max(MIN_ZOOM, fit)));
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        // Small enough for a laptop screen: a minimum taller than the screen
        // pushes the bottom of the window behind the taskbar.
        minWidth: 800,
        minHeight: 500,
        // The File/Edit menu costs a row of the counter; Alt still shows it.
        autoHideMenuBar: true,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'POS Desktop',
    });
    mainWindow.maximize();
    const win = mainWindow;
    win.webContents.on('did-finish-load', () => fitZoomToWindow(win));
    win.on('resize', () => fitZoomToWindow(win));
    const isDev = !electron_1.app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        // In the packaged app, client/dist is copied into resources/ by electron-builder
        // via the extraResources config in package.json.
        mainWindow.loadFile(path_1.default.join(process.resourcesPath, 'client', 'dist', 'index.html'));
    }
    mainWindow.on('closed', () => { mainWindow = null; });
}
electron_1.app.whenReady().then(async () => {
    // sql.js init is async — must await before registering handlers
    await (0, database_1.initDb)();
    // Register all IPC handlers
    (0, auth_1.registerAuthHandlers)();
    (0, products_1.registerProductHandlers)();
    (0, categories_1.registerCategoryHandlers)();
    (0, orders_1.registerOrderHandlers)();
    (0, customers_1.registerCustomerHandlers)();
    (0, customerLedger_1.registerCustomerLedgerHandlers)();
    (0, employees_1.registerEmployeeHandlers)();
    (0, expenses_1.registerExpenseHandlers)();
    (0, employeeDamages_1.registerEmployeeDamageHandlers)();
    (0, suppliers_1.registerSupplierHandlers)();
    (0, wastage_1.registerWastageHandlers)();
    (0, companyLogo_1.registerCompanyLogoHandlers)();
    (0, supplierInvoices_1.registerSupplierInvoiceHandlers)();
    (0, supplierLedger_1.registerSupplierLedgerHandlers)();
    (0, returns_1.registerReturnHandlers)();
    (0, banks_1.registerBankHandlers)();
    (0, settings_1.registerSettingsHandlers)();
    (0, syncManager_1.registerSyncHandlers)();
    (0, analytics_1.registerAnalyticsHandlers)();
    (0, license_1.registerLicenseHandlers)();
    // Picks up a renewed licence while the till is open, so a paid customer is
    // never stuck on the lock screen waiting for a restart.
    (0, license_1.startLicenseRefreshLoop)();
    electron_1.ipcMain.handle('app:getVersion', () => electron_1.app.getVersion());
    electron_1.ipcMain.handle('app:getPlatform', () => process.platform);
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
// Save DB to disk before quitting
electron_1.app.on('before-quit', () => {
    (0, database_1.saveDb)();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
//# sourceMappingURL=main.js.map