/**
 * preload.ts
 *
 * Exposes a safe, typed API to the renderer process via contextBridge.
 * The renderer (React app) calls window.electronAPI.xxx() instead of
 * using ipcRenderer directly.
 */

import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // ── AUTH ──────────────────────────────────────────────────────────────────
  auth: {
    login:          (email: string, password: string)                                          => ipcRenderer.invoke('auth:login', email, password),
    register:       (data: { name: string; email: string; password: string; role: string })    => ipcRenderer.invoke('auth:register', data),
    getUsers:       ()                                                                         => ipcRenderer.invoke('auth:getUsers'),
    changePassword: (userId: string, oldPassword: string, newPassword: string)                => ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword),
  },

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  products: {
    getAll:      (search?: string)                          => ipcRenderer.invoke('products:getAll', search),
    getByBarcode:(barcode: string)                          => ipcRenderer.invoke('products:getByBarcode', barcode),
    create:      (data: Record<string, unknown>)            => ipcRenderer.invoke('products:create', data),
    update:      (_id: string, data: Record<string, unknown>) => ipcRenderer.invoke('products:update', _id, data),
    updateStock: (_id: string, quantity: number)            => ipcRenderer.invoke('products:updateStock', _id, quantity),
    delete:      (_id: string)                              => ipcRenderer.invoke('products:delete', _id),
  },

  // ── CATEGORIES ────────────────────────────────────────────────────────────
  categories: {
    getAll:  ()                                               => ipcRenderer.invoke('categories:getAll'),
    create:  (data: Record<string, unknown>)                  => ipcRenderer.invoke('categories:create', data),
    update:  (_id: string, data: Record<string, unknown>)     => ipcRenderer.invoke('categories:update', _id, data),
    delete:  (_id: string)                                    => ipcRenderer.invoke('categories:delete', _id),
  },

  // ── ORDERS ────────────────────────────────────────────────────────────────
  orders: {
    getAll:   (month?: number, year?: number)                 => ipcRenderer.invoke('orders:getAll', month, year),
    getVoided:()                                              => ipcRenderer.invoke('orders:getVoided'),
    create:   (data: Record<string, unknown>)                 => ipcRenderer.invoke('orders:create', data),
    void:     (_id: string, reason: string, employeeId?: string, employeeName?: string) =>
                ipcRenderer.invoke('orders:void', _id, reason, employeeId, employeeName),
  },

  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  customers: {
    getAll:       ()                                          => ipcRenderer.invoke('customers:getAll'),
    create:       (data: Record<string, unknown>)             => ipcRenderer.invoke('customers:create', data),
    update:       (_id: string, data: Record<string, unknown>) => ipcRenderer.invoke('customers:update', _id, data),
    delete:       (_id: string)                               => ipcRenderer.invoke('customers:delete', _id),
    updateStats:  (_id: string, amount: number)               => ipcRenderer.invoke('customers:updateStats', _id, amount),
    resetPoints:  (_id: string)                               => ipcRenderer.invoke('customers:resetPoints', _id),
  },

  // ── EMPLOYEES ─────────────────────────────────────────────────────────────
  employees: {
    getAll:  ()                                               => ipcRenderer.invoke('employees:getAll'),
    create:  (data: Record<string, unknown>)                  => ipcRenderer.invoke('employees:create', data),
    update:  (_id: string, data: Record<string, unknown>)     => ipcRenderer.invoke('employees:update', _id, data),
    delete:  (_id: string)                                    => ipcRenderer.invoke('employees:delete', _id),
  },

  // ── EMPLOYEE DAMAGES ──────────────────────────────────────────────────────
  employeeDamages: {
    getAll:  ()                                                 => ipcRenderer.invoke('employeeDamages:getAll'),
    create:  (data: Record<string, unknown>)                    => ipcRenderer.invoke('employeeDamages:create', data),
    update:  (_id: string, data: Record<string, unknown>)       => ipcRenderer.invoke('employeeDamages:update', _id, data),
    delete:  (_id: string)                                      => ipcRenderer.invoke('employeeDamages:delete', _id),
  },

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  expenses: {
    getAll:  ()                                               => ipcRenderer.invoke('expenses:getAll'),
    create:  (data: Record<string, unknown>)                  => ipcRenderer.invoke('expenses:create', data),
  },

  // ── EXPENSE CATEGORIES ────────────────────────────────────────────────────
  expenseCategories: {
    getAll:  ()                                               => ipcRenderer.invoke('expenseCategories:getAll'),
    create:  (data: Record<string, unknown>)                  => ipcRenderer.invoke('expenseCategories:create', data),
    delete:  (_id: string)                                    => ipcRenderer.invoke('expenseCategories:delete', _id),
  },

  // ── SUPPLIERS ─────────────────────────────────────────────────────────────
  suppliers: {
    getAll:  ()                                               => ipcRenderer.invoke('suppliers:getAll'),
    create:  (data: Record<string, unknown>)                  => ipcRenderer.invoke('suppliers:create', data),
  },

  // ── BANKS ─────────────────────────────────────────────────────────────────
  banks: {
    getNames:    ()                                           => ipcRenderer.invoke('banks:getNames'),
    addName:     (data: Record<string, unknown>)              => ipcRenderer.invoke('banks:addName', data),
    getAccounts: ()                                           => ipcRenderer.invoke('banks:getAccounts'),
    addAccount:  (data: Record<string, unknown>)              => ipcRenderer.invoke('banks:addAccount', data),
    getCards:    ()                                           => ipcRenderer.invoke('banks:getCards'),
    addCard:     (data: Record<string, unknown>)              => ipcRenderer.invoke('banks:addCard', data),
  },

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  settings: {
    get:                ()                                    => ipcRenderer.invoke('settings:get'),
    update:             (data: Record<string, unknown>)       => ipcRenderer.invoke('settings:update', data),
    getQuickProducts:   ()                                    => ipcRenderer.invoke('settings:getQuickProducts'),
    updateQuickProducts:(qp: unknown[])                       => ipcRenderer.invoke('settings:updateQuickProducts', qp),
  },

  // ── ANALYTICS ─────────────────────────────────────────────────────────────
  analytics: {
    monthlySummary:    (months?: number)  => ipcRenderer.invoke('analytics:monthlySummary', months),
    topProducts:       (limit?: number)   => ipcRenderer.invoke('analytics:topProducts', limit),
    paymentMethods:    ()                 => ipcRenderer.invoke('analytics:paymentMethods'),
    expenseCategories: ()                 => ipcRenderer.invoke('analytics:expenseCategories'),
  },

  // ── SYNC ──────────────────────────────────────────────────────────────────
  sync: {
    /** Push local changes + pull server changes (full two-way sync) */
    all: (config: { baseUrl: string; token: string }) =>
      ipcRenderer.invoke('sync:all', config),

    /** Pull only: fetch all server data into local SQLite */
    pull: (config: { baseUrl: string; token: string }) =>
      ipcRenderer.invoke('sync:pull', config),

    /** Sync a single collection (push) */
    collection: (config: { baseUrl: string; token: string }, collection: string) =>
      ipcRenderer.invoke('sync:collection', config, collection),

    /** Get count of unsynced records per collection */
    pendingCounts: () =>
      ipcRenderer.invoke('sync:pendingCounts'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

// TypeScript type declaration for the renderer
export type ElectronAPI = typeof api;
