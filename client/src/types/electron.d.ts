/**
 * Type declarations for the Electron contextBridge API.
 * Matches the API exposed in electron/src/preload.ts.
 */

interface SyncConfig {
  baseUrl: string;
  token: string;
}

interface SyncResult {
  collection: string;
  synced: number;
  errors: string[];
}

interface SyncSummary {
  success: boolean;
  results: SyncResult[];
  totalSynced: number;
  totalErrors: number;
}

interface ElectronAPI {
  auth: {
    login:          (email: string, password: string) => Promise<{ success: boolean; message?: string; data: { token: string; user: { id: string; name: string; role: string } } }>;
    register:       (data: { name: string; email: string; password: string; role: string }) => Promise<{ success: boolean; message?: string; data?: any }>;
    getUsers:       () => Promise<any[]>;
    changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
  };
  products: {
    getAll: (search?: string) => Promise<any[]>;
    getByBarcode: (barcode: string) => Promise<any | null>;
    create: (data: Record<string, unknown>) => Promise<any>;
    update: (_id: string, data: Record<string, unknown>) => Promise<any>;
    updateStock: (_id: string, quantity: number) => Promise<any>;
    delete: (_id: string) => Promise<{ success: boolean }>;
  };
  categories: {
    getAll: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
    update: (_id: string, data: Record<string, unknown>) => Promise<any>;
    delete: (_id: string) => Promise<{ success: boolean }>;
  };
  orders: {
    getAll: (month?: number, year?: number) => Promise<any[]>;
    getVoided: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
    void: (_id: string, reason: string, employeeId?: string, employeeName?: string) => Promise<any>;
  };
  customers: {
    getAll: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
    update: (_id: string, data: Record<string, unknown>) => Promise<any>;
    delete: (_id: string) => Promise<{ success: boolean }>;
    updateStats: (_id: string, amount: number) => Promise<any>;
    resetPoints: (_id: string) => Promise<any>;
  };
  employees: {
    getAll: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
    update: (_id: string, data: Record<string, unknown>) => Promise<any>;
    delete: (_id: string) => Promise<{ success: boolean }>;
  };
  expenses: {
    getAll: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
  };
  expenseCategories: {
    getAll: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
    delete: (_id: string) => Promise<{ success: boolean }>;
  };
  employeeDamages: {
    getAll: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
    update: (_id: string, data: Record<string, unknown>) => Promise<any>;
    delete: (_id: string) => Promise<{ success: boolean }>;
  };
  suppliers: {
    getAll: () => Promise<any[]>;
    create: (data: Record<string, unknown>) => Promise<any>;
  };
  banks: {
    getNames: () => Promise<any[]>;
    addName: (data: Record<string, unknown>) => Promise<any>;
    getAccounts: () => Promise<any[]>;
    addAccount: (data: Record<string, unknown>) => Promise<any>;
    getCards: () => Promise<any[]>;
    addCard: (data: Record<string, unknown>) => Promise<any>;
  };
  settings: {
    get: () => Promise<any>;
    update: (data: Record<string, unknown>) => Promise<any>;
    getQuickProducts: () => Promise<any[]>;
    updateQuickProducts: (qp: unknown[]) => Promise<any[]>;
  };
  sync: {
    all:          (config: SyncConfig) => Promise<SyncSummary>;
    pull:         (config: SyncConfig) => Promise<SyncSummary>;
    collection:   (config: SyncConfig, collection: string) => Promise<SyncResult>;
    pendingCounts:() => Promise<Record<string, number>>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
