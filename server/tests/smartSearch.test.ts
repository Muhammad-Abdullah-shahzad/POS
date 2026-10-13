/**
 * The smart product search used by the till and the products screen: words in
 * any order, a small typo forgiven, sizes kept exact.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { rankProducts, searchWords } from '../services/smartSearch';

const catalogue = [
  '1 1/2" Bend 90d, 45d (Grey) Popular',
  '1 1/2" Bend Long Radius (Grey) Popular',
  '1 1/2" Check valve Roma',
  '1 1/2" Elbow 90d (SCH.40 & Medium) Popular',
  '1/2" Bend 90d, 45d (Grey) Popular',
  '1/4" Bend 90d, 45d (Grey) Popular',
  '2" Bend 90d, 45d (White) Popular',
  '25mm Clamp Duraflow',
  '20mm Clamp Duraflow',
].map((name, i) => ({ name, barcode: `89000${i}`, sku: `SKU-${i}` }));

const names = (query: string) => rankProducts(catalogue, query).map((p) => p.name);

describe('smart product search', () => {
  it('finds a product from words in any order, forgiving 40d for 45d, with near matches after it', () => {
    const found = names('1 1/2 grey 40d');
    expect(found[0]).toBe('1 1/2" Bend 90d, 45d (Grey) Popular');
    // Similar products follow: same size and colour, or same size and angle.
    expect(found).toContain('1 1/2" Bend Long Radius (Grey) Popular');
    expect(found).toContain('1 1/2" Elbow 90d (SCH.40 & Medium) Popular');
    // Never a different size.
    expect(found).not.toContain('1/2" Bend 90d, 45d (Grey) Popular');
    expect(found).not.toContain('1/4" Bend 90d, 45d (Grey) Popular');
  });

  it('matches whatever order the words are typed in', () => {
    expect(names('grey bend 1 1/2')[0]).toBe('1 1/2" Bend 90d, 45d (Grey) Popular');
    expect(names('popular bend grey 1/2')[0]).toBe('1/2" Bend 90d, 45d (Grey) Popular');
  });

  it('forgives a typo in a word', () => {
    expect(names('1/2 gery bend')[0]).toBe('1/2" Bend 90d, 45d (Grey) Popular');
    expect(names('clamp durflow')).toEqual(['20mm Clamp Duraflow', '25mm Clamp Duraflow']);
  });

  it('keeps sizes exact: 1/2 is not 1 1/2 or 1/4, and 1-1/2 is the same size as 1 1/2', () => {
    expect(names('1/2 bend')).toEqual(['1/2" Bend 90d, 45d (Grey) Popular']);
    expect(names('1-1/2 bend')).toEqual(['1 1/2" Bend 90d, 45d (Grey) Popular', '1 1/2" Bend Long Radius (Grey) Popular']);
  });

  it('keeps mm sizes exact too: 25mm is not 20mm', () => {
    expect(names('25mm clamp')).toEqual(['25mm Clamp Duraflow']);
    expect(names('clamp duraflow')).toEqual(['20mm Clamp Duraflow', '25mm Clamp Duraflow']);
  });

  it('lists products matching every word before those matching most of them', () => {
    expect(names('grey bend 1 1/2')).toEqual(['1 1/2" Bend 90d, 45d (Grey) Popular', '1 1/2" Bend Long Radius (Grey) Popular']);
  });

  it('finds a product by its barcode or SKU, ahead of everything else', () => {
    expect(names('890007')).toEqual(['25mm Clamp Duraflow']);
    expect(names('sku-8')[0]).toBe('20mm Clamp Duraflow');
  });

  it('reads sizes and punctuation the same in names and searches', () => {
    expect(searchWords('1 1/2" Bend 90d, 45d (Grey)')).toEqual(['1-1/2', 'bend', '90d', '45d', 'grey']);
    expect(searchWords('1-1/2"x24" Pipe Nipple')).toEqual(['1-1/2', 'x24', 'pipe', 'nipple']);
    expect(searchWords('1 1/')).toEqual(['1-1/']);
  });

  it('is the same file on the desktop till, so both search alike', () => {
    const server = readFileSync(path.join(__dirname, '../services/smartSearch.ts'), 'utf8');
    const desktop = readFileSync(path.join(__dirname, '../../electron/src/search/smartSearch.ts'), 'utf8');
    expect(desktop).toBe(server);
  });
});
