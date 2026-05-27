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
const employees_1 = require("./ipc/employees");
const expenses_1 = require("./ipc/expenses");
const employeeDamages_1 = require("./ipc/employeeDamages");
const suppliers_1 = require("./ipc/suppliers");
const banks_1 = require("./ipc/banks");
const settings_1 = require("./ipc/settings");
const syncManager_1 = require("./sync/syncManager");
const auth_1 = require("./ipc/auth");
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'POS Desktop',
    });
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
    mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => { mainWindow = null; });
}
electron_1.app.whenReady().then(async () => {
    // sql.js init is async — must await before registering handlers
    await (0, database_1.initDb)();
    // Seed default admin user if no users exist yet
    (0, auth_1.seedDefaultAdmin)();
    // Register all IPC handlers
    (0, auth_1.registerAuthHandlers)();
    (0, products_1.registerProductHandlers)();
    (0, categories_1.registerCategoryHandlers)();
    (0, orders_1.registerOrderHandlers)();
    (0, customers_1.registerCustomerHandlers)();
    (0, employees_1.registerEmployeeHandlers)();
    (0, expenses_1.registerExpenseHandlers)();
    (0, employeeDamages_1.registerEmployeeDamageHandlers)();
    (0, suppliers_1.registerSupplierHandlers)();
    (0, banks_1.registerBankHandlers)();
    (0, settings_1.registerSettingsHandlers)();
    (0, syncManager_1.registerSyncHandlers)();
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