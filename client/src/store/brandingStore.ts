/**
 * The signed-in company's logo, shown on invoices, receipts and the sidebar.
 *
 * Kept in memory only and cleared on sign-out, so one company's logo can
 * never show for another company signing in on the same machine.
 */
import { create } from 'zustand';
import api from '../services/api';

export interface CompanyLogo {
  slug: string;
  url: string;
}

interface BrandingState {
  logo: CompanyLogo | null;
  fetchLogo: () => Promise<void>;
  /** After an upload or removal in Settings, so every screen updates at once. */
  setLogo: (logo: CompanyLogo | null) => void;
  clear: () => void;
}

export const useBrandingStore = create<BrandingState>()((set) => ({
  logo: null,

  fetchLogo: async () => {
    try {
      const { data } = await api.get('/company-logo');
      const logo = data?.data;
      // A company without a logo clears any logo shown before.
      set({ logo: logo?.url ? { slug: logo.slug, url: logo.url } : null });
    } catch (error) {
      // The shop name still shows; a missing logo must never block the till.
      console.warn('Company logo could not be loaded', error);
    }
  },

  setLogo: (logo) => set({ logo }),

  clear: () => set({ logo: null }),
}));
