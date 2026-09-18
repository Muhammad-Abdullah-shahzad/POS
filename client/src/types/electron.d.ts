/**
 * Type declarations for the Electron contextBridge API.
 * Matches the API exposed in electron/src/preload.ts.
 */

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

interface DesktopUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  tenantId: string;
  tenantName: string;
}

/** What the main process knows about the licence, from the cached key and the clock. */
interface DesktopLicenseStatus {
  state: 'active' | 'expired' | 'missing' | 'invalid';
  expiresAt: string | null;
  daysLeft: number | null;
  message: string;
  checkedAt: string;
  keyHint: string | null;
}

interface DesktopLoginResult {
  success: boolean;
  message?: string;
  data: {
    user: DesktopUser;
    accessToken: string;
    refreshToken: string;
    /** True when the till authenticated against its local cache. */
    offline: boolean;
    license: DesktopLicenseStatus;
  };
}

interface DesktopRegisterInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

interface DeviceInfo {
  claimed: boolean;
  tenantId: string | null;
  tenantName: string | null;
}

interface ElectronAPI {
  auth: {
    login:          (email: string, password: string) => Promise<DesktopLoginResult>;
    register:       (input: DesktopRegisterInput) => Promise<DesktopLoginResult>;
    logout:         () => Promise<{ success: boolean }>;
    getUsers:       () => Promise<any[]>;
    changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
    getDevice:      () => Promise<DeviceInfo>;
    resetDevice:    () => Promise<{ success: boolean }>;
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
  analytics: {
    monthlySummary:    (months?: number) => Promise<any>;
    topProducts:       (limit?: number)  => Promise<any[]>;
    paymentMethods:    ()                => Promise<any[]>;
    expenseCategories: ()                => Promise<any[]>;
  };
  license: {
    status:   () => Promise<DesktopLicenseStatus>;
    activate: (key: string) => Promise<{ success: boolean; message: string; data: DesktopLicenseStatus }>;
    refresh:  () => Promise<DesktopLicenseStatus & { offline: boolean }>;
  };
  sync: {
    all:          () => Promise<SyncSummary>;
    pull:         () => Promise<SyncSummary>;
    collection:   (collection: string) => Promise<SyncResult>;
    pendingCounts:() => Promise<Record<string, number>>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
