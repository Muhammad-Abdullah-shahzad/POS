import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { useCurrencyStore, type CurrencyCode } from './currencyStore';

export interface SystemSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  shopWebsite: string;
  receiptFooter: string;
  receiptSize: 'Thermal' | 'A4';
  /** Ask for invoice remarks at checkout. Missing on older data, which means yes. */
  showRemarksPrompt?: boolean;
  currency: string;
  loyaltyPointsPerEuro: number;
  loyaltyRewardThreshold: number;
  loyaltyRewardValue: number;
  expenseCategories: string[];
}

interface SettingsStoreState {
  settings: SystemSettings | null;
  setSettings: (settings: SystemSettings) => void;
  fetchSettings: () => Promise<boolean>;
  clearSettings: () => void;
}

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      settings: null,

      setSettings: (settings) => set({ settings }),

      fetchSettings: async () => {
        try {
          const { data } = await api.get('/settings');
          if (data?.data) {
            set({ settings: data.data });
            if (data.data.currency) {
              useCurrencyStore.getState().setCurrency(data.data.currency as CurrencyCode);
            }
            return true;
          }
          return false;
        } catch (error) {
          console.error('Failed to fetch system settings', error);
          return false;
        }
      },

      clearSettings: () => set({ settings: null }),
    }),
    {
      name: 'pos.settings',
    }
  )
);
