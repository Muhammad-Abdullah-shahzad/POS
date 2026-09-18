/**
 * preload.ts
 *
 * Exposes a safe, typed API to the renderer process via contextBridge.
 * The renderer (React app) calls window.electronAPI.xxx() instead of
 * using ipcRenderer directly.
 */
declare const api: {
    auth: {
        login: (email: string, password: string) => Promise<any>;
        register: (input: {
            companyName: string;
            name: string;
            email: string;
            password: string;
            phone?: string;
        }) => Promise<any>;
        logout: () => Promise<any>;
        getUsers: () => Promise<any>;
        changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<any>;
        /** Which company this till is registered to. */
        getDevice: () => Promise<any>;
        /** Clear local data so the till can be handed to a different company. */
        resetDevice: () => Promise<any>;
    };
    products: {
        getAll: (search?: string) => Promise<any>;
        getByBarcode: (barcode: string) => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
        update: (_id: string, data: Record<string, unknown>) => Promise<any>;
        updateStock: (_id: string, quantity: number) => Promise<any>;
        delete: (_id: string) => Promise<any>;
    };
    categories: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
        update: (_id: string, data: Record<string, unknown>) => Promise<any>;
        delete: (_id: string) => Promise<any>;
    };
    orders: {
        getAll: (month?: number, year?: number) => Promise<any>;
        getVoided: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
        void: (_id: string, reason: string, employeeId?: string, employeeName?: string) => Promise<any>;
    };
    customers: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
        update: (_id: string, data: Record<string, unknown>) => Promise<any>;
        delete: (_id: string) => Promise<any>;
        updateStats: (_id: string, amount: number) => Promise<any>;
        resetPoints: (_id: string) => Promise<any>;
    };
    employees: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
        update: (_id: string, data: Record<string, unknown>) => Promise<any>;
        delete: (_id: string) => Promise<any>;
    };
    employeeDamages: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
        update: (_id: string, data: Record<string, unknown>) => Promise<any>;
        delete: (_id: string) => Promise<any>;
    };
    expenses: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
    };
    expenseCategories: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
        delete: (_id: string) => Promise<any>;
    };
    suppliers: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
    };
    banks: {
        getNames: () => Promise<any>;
        addName: (data: Record<string, unknown>) => Promise<any>;
        getAccounts: () => Promise<any>;
        addAccount: (data: Record<string, unknown>) => Promise<any>;
        getCards: () => Promise<any>;
        addCard: (data: Record<string, unknown>) => Promise<any>;
    };
    settings: {
        get: () => Promise<any>;
        update: (data: Record<string, unknown>) => Promise<any>;
        getQuickProducts: () => Promise<any>;
        updateQuickProducts: (qp: unknown[]) => Promise<any>;
    };
    analytics: {
        monthlySummary: (months?: number) => Promise<any>;
        topProducts: (limit?: number) => Promise<any>;
        paymentMethods: () => Promise<any>;
        expenseCategories: () => Promise<any>;
    };
    license: {
        /** Current state from the cached key and the clock. */
        status: () => Promise<any>;
        /** Apply a key the operator sent. Works offline. */
        activate: (key: string) => Promise<any>;
        /** Ask the server for the latest licence (after a renewal), then re-check. */
        refresh: () => Promise<any>;
    };
    sync: {
        /** Push local changes, then pull the server's. */
        all: () => Promise<any>;
        /** Pull only: fetch server data into local SQLite. */
        pull: () => Promise<any>;
        /** Push a single collection. */
        collection: (collection: string) => Promise<any>;
        /** Count of records waiting to be pushed, per collection. */
        pendingCounts: () => Promise<any>;
    };
};
export type ElectronAPI = typeof api;
export {};
