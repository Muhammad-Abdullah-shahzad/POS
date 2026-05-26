"use strict";
/**
 * preload.ts
 *
 * Exposes a safe, typed API to the renderer process via contextBridge.
 * The renderer (React app) calls window.electronAPI.xxx() instead of
 * using ipcRenderer directly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // ── AUTH ──────────────────────────────────────────────────────────────────
    auth: {
        login: (email, password) => electron_1.ipcRenderer.invoke('auth:login', email, password),
        register: (data) => electron_1.ipcRenderer.invoke('auth:register', data),
        getUsers: () => electron_1.ipcRenderer.invoke('auth:getUsers'),
        changePassword: (userId, oldPassword, newPassword) => electron_1.ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword),
    },
    // ── PRODUCTS ──────────────────────────────────────────────────────────────
    products: {
        getAll: (search) => electron_1.ipcRenderer.invoke('products:getAll', search),
        getByBarcode: (barcode) => electron_1.ipcRenderer.invoke('products:getByBarcode', barcode),
        create: (data) => electron_1.ipcRenderer.invoke('products:create', data),
        update: (_id, data) => electron_1.ipcRenderer.invoke('products:update', _id, data),
        updateStock: (_id, quantity) => electron_1.ipcRenderer.invoke('products:updateStock', _id, quantity),
        delete: (_id) => electron_1.ipcRenderer.invoke('products:delete', _id),
    },
    // ── CATEGORIES ────────────────────────────────────────────────────────────
    categories: {
        getAll: () => electron_1.ipcRenderer.invoke('categories:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('categories:create', data),
        update: (_id, data) => electron_1.ipcRenderer.invoke('categories:update', _id, data),
        delete: (_id) => electron_1.ipcRenderer.invoke('categories:delete', _id),
    },
    // ── ORDERS ────────────────────────────────────────────────────────────────
    orders: {
        getAll: (month, year) => electron_1.ipcRenderer.invoke('orders:getAll', month, year),
        getVoided: () => electron_1.ipcRenderer.invoke('orders:getVoided'),
        create: (data) => electron_1.ipcRenderer.invoke('orders:create', data),
        void: (_id, reason, employeeId, employeeName) => electron_1.ipcRenderer.invoke('orders:void', _id, reason, employeeId, employeeName),
    },
    // ── CUSTOMERS ─────────────────────────────────────────────────────────────
    customers: {
        getAll: () => electron_1.ipcRenderer.invoke('customers:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('customers:create', data),
        update: (_id, data) => electron_1.ipcRenderer.invoke('customers:update', _id, data),
        delete: (_id) => electron_1.ipcRenderer.invoke('customers:delete', _id),
        updateStats: (_id, amount) => electron_1.ipcRenderer.invoke('customers:updateStats', _id, amount),
        resetPoints: (_id) => electron_1.ipcRenderer.invoke('customers:resetPoints', _id),
    },
    // ── EMPLOYEES ─────────────────────────────────────────────────────────────
    employees: {
        getAll: () => electron_1.ipcRenderer.invoke('employees:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('employees:create', data),
        update: (_id, data) => electron_1.ipcRenderer.invoke('employees:update', _id, data),
        delete: (_id) => electron_1.ipcRenderer.invoke('employees:delete', _id),
    },
    // ── EMPLOYEE DAMAGES ──────────────────────────────────────────────────────
    employeeDamages: {
        getAll: () => electron_1.ipcRenderer.invoke('employeeDamages:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('employeeDamages:create', data),
        update: (_id, data) => electron_1.ipcRenderer.invoke('employeeDamages:update', _id, data),
        delete: (_id) => electron_1.ipcRenderer.invoke('employeeDamages:delete', _id),
    },
    // ── EXPENSES ──────────────────────────────────────────────────────────────
    expenses: {
        getAll: () => electron_1.ipcRenderer.invoke('expenses:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('expenses:create', data),
    },
    // ── EXPENSE CATEGORIES ────────────────────────────────────────────────────
    expenseCategories: {
        getAll: () => electron_1.ipcRenderer.invoke('expenseCategories:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('expenseCategories:create', data),
        delete: (_id) => electron_1.ipcRenderer.invoke('expenseCategories:delete', _id),
    },
    // ── SUPPLIERS ─────────────────────────────────────────────────────────────
    suppliers: {
        getAll: () => electron_1.ipcRenderer.invoke('suppliers:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('suppliers:create', data),
    },
    // ── BANKS ─────────────────────────────────────────────────────────────────
    banks: {
        getNames: () => electron_1.ipcRenderer.invoke('banks:getNames'),
        addName: (data) => electron_1.ipcRenderer.invoke('banks:addName', data),
        getAccounts: () => electron_1.ipcRenderer.invoke('banks:getAccounts'),
        addAccount: (data) => electron_1.ipcRenderer.invoke('banks:addAccount', data),
        getCards: () => electron_1.ipcRenderer.invoke('banks:getCards'),
        addCard: (data) => electron_1.ipcRenderer.invoke('banks:addCard', data),
    },
    // ── SETTINGS ──────────────────────────────────────────────────────────────
    settings: {
        get: () => electron_1.ipcRenderer.invoke('settings:get'),
        update: (data) => electron_1.ipcRenderer.invoke('settings:update', data),
        getQuickProducts: () => electron_1.ipcRenderer.invoke('settings:getQuickProducts'),
        updateQuickProducts: (qp) => electron_1.ipcRenderer.invoke('settings:updateQuickProducts', qp),
    },
    // ── SYNC ──────────────────────────────────────────────────────────────────
    sync: {
        /** Push local changes + pull server changes (full two-way sync) */
        all: (config) => electron_1.ipcRenderer.invoke('sync:all', config),
        /** Pull only: fetch all server data into local SQLite */
        pull: (config) => electron_1.ipcRenderer.invoke('sync:pull', config),
        /** Sync a single collection (push) */
        collection: (config, collection) => electron_1.ipcRenderer.invoke('sync:collection', config, collection),
        /** Get count of unsynced records per collection */
        pendingCounts: () => electron_1.ipcRenderer.invoke('sync:pendingCounts'),
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
//# sourceMappingURL=preload.js.map