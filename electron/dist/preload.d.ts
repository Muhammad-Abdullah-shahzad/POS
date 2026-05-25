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
        register: (data: {
            name: string;
            email: string;
            password: string;
            role: string;
        }) => Promise<any>;
        getUsers: () => Promise<any>;
        changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<any>;
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
    expenses: {
        getAll: () => Promise<any>;
        create: (data: Record<string, unknown>) => Promise<any>;
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
    sync: {
        /** Sync all collections to the web server */
        all: (config: {
            baseUrl: string;
            token: string;
        }) => Promise<any>;
        /** Sync a single collection */
        collection: (config: {
            baseUrl: string;
            token: string;
        }, collection: string) => Promise<any>;
        /** Get count of unsynced records per collection */
        pendingCounts: () => Promise<any>;
    };
};
export type ElectronAPI = typeof api;
export {};
