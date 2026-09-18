/**
 * Money formatting for every screen and receipt.
 *
 * Always format amounts with these helpers instead of writing a currency sign
 * by hand, so the shop's chosen currency shows up everywhere at once:
 * "€1,234.50", "£1,234.50", "Rs 1,234.50".
 */
import { CURRENCIES, useCurrencyStore } from '../store/currencyStore';
import type { CurrencyCode } from '../store/currencyStore';

type Amount = number | string | null | undefined;
type Variant = 'standard' | 'compact';

// Building a formatter is comparatively slow and receipts format many lines.
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(variant: Variant, code: CurrencyCode = useCurrencyStore.getState().code): Intl.NumberFormat {
  const cacheKey = `${code}:${variant}`;

  let cached = formatters.get(cacheKey);
  if (!cached) {
    const { locale } = CURRENCIES[code];
    cached = new Intl.NumberFormat(
      locale,
      variant === 'compact'
        ? { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 }
        : { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }
    );
    formatters.set(cacheKey, cached);
  }
  return cached;
}

/** Missing or unparsable amounts print as zero rather than "NaN". */
const toNumber = (amount: Amount): number => {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
};

/** A full amount with two decimals, e.g. "£1,234.50". */
export const formatMoney = (amount: Amount): string => formatter('standard').format(toNumber(amount));

/** An amount in a specific currency, e.g. to preview a currency before it is saved. */
export const formatMoneyAs = (code: CurrencyCode, amount: Amount): string =>
  formatter('standard', code).format(toNumber(amount));

/** A short amount for dashboard tiles, e.g. "Rs 1.5M". Small amounts keep full precision. */
export const formatMoneyCompact = (amount: Amount): string => {
  const value = toNumber(amount);
  return Math.abs(value) >= 1000 ? formatter('compact').format(value) : formatMoney(value);
};

/** The bare sign, for labels such as "Price (£)" and input adornments. */
export const currencySymbol = (): string =>
  formatter('standard')
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? useCurrencyStore.getState().code;
