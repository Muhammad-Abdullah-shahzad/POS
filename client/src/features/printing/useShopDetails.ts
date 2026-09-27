/** The shop as printed on invoices and receipts: settings plus the company logo. */
import { useBrandingStore } from '../../store/brandingStore';
import { assetUrl } from '../../utils/assetUrl';
import { useSettingsStore } from '../../store/settingsStore';
import { shopDetailsFrom, type ShopDetails } from './printableSale';

export function useShopDetails(): ShopDetails {
  const settings = useSettingsStore((state) => state.settings);
  const logoUrl = useBrandingStore((state) => assetUrl(state.logo?.url));
  return shopDetailsFrom(settings, logoUrl);
}
