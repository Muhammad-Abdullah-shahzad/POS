/**
 * A supplier's price list, and the products it becomes. Shared by the npm
 * import script and the generated mongosh script, so both name products the
 * same way: "<size> <item> <company>", e.g. "25mm Socket Duraflow".
 */
export interface PriceList {
  source: string;
  company: string;
  category: string;
  barcodePrefix: string;
  items: { item: string; code: string; sizes: [string, number][] }[];
}

export interface PriceListProduct {
  name: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  vatRate: number;
  vatType: 'exclusive';
}

/** Letters and digits only, joined by dashes: `25x1-1/4"` becomes `25X1-1-4`. */
const codeOf = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The list price is the selling price; cost and stock start at zero. */
export function productsFrom(list: PriceList): PriceListProduct[] {
  const products = list.items.flatMap(({ item, code, sizes }) =>
    sizes.map(([size, price]) => ({
      // An item sold in one size only may leave the size empty.
      name: `${size} ${item} ${list.company}`.trim(),
      barcode: [list.barcodePrefix, code, codeOf(size)].filter(Boolean).join('-'),
      category: list.category,
      price,
      costPrice: 0,
      stock: 0,
      vatRate: 0,
      vatType: 'exclusive' as const,
    }))
  );
  if (new Set(products.map((p) => p.barcode)).size !== products.length) {
    throw new Error('The price list produces duplicate barcodes; fix the item codes');
  }
  return products;
}
