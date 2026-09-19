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
  // Staff accounts are created on the server by a company admin. `register`
  // creates a brand new company (and its first admin) from the till.
  auth: {
    login:          (email: string, password: string)                          => ipcRenderer.invoke('auth:login', email, password),
    register:       (input: { companyName: string; name: string; email: string; password: string; phone?: string }) =>
                                                                                  ipcRenderer.invoke('auth:register', input),
    logout:         ()                                                         => ipcRenderer.invoke('auth:logout'),
    getUsers:       ()                                                         => ipcRenderer.invoke('auth:getUsers'),
    changePassword: (userId: string, oldPassword: string, newPassword: string) => ipcRenderer.invoke('auth:changePassword', userId, oldPassword, newPassword),
    /** Which company this till is registered to. */
    getDevice:      ()                                                         => ipcRenderer.invoke('auth:getDevice'),
    /** Clear local data so the till can be handed to a different company. */
    resetDevice:    ()                                                         => ipcRenderer.invoke('auth:resetDevice'),
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
    /** Month-to-date KPIs with a 30 day series, for the admin dashboard. */
    kpis:              ()                 => ipcRenderer.invoke('analytics:kpis'),
  },

  // ── LICENCE ───────────────────────────────────────────────────────────────
  // The key is verified in the main process against the public key baked into
  // this build, so the till can lock or unlock with no connection at all.
  license: {
    /** Current state from the cached key and the clock. */
    status:   ()            => ipcRenderer.invoke('license:status'),
    /** Apply a key the operator sent. Works offline. */
    activate: (key: string) => ipcRenderer.invoke('license:activate', key),
    /** Ask the server for the latest licence (after a renewal), then re-check. */
    refresh:  ()            => ipcRenderer.invoke('license:refresh'),
  },

  // ── SYNC ──────────────────────────────────────────────────────────────────
  // Server credentials stay in the main process, so none of these take a token.
  sync: {
    /** Push local changes, then pull the server's. */
    all: () => ipcRenderer.invoke('sync:all'),

    /** Pull only: fetch server data into local SQLite. */
    pull: () => ipcRenderer.invoke('sync:pull'),

    /** Push a single collection. */
    collection: (collection: string) => ipcRenderer.invoke('sync:collection', collection),

    /** Count of records waiting to be pushed, per collection. */
    pendingCounts: () => ipcRenderer.invoke('sync:pendingCounts'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

// TypeScript type declaration for the renderer
export type ElectronAPI = typeof api;
