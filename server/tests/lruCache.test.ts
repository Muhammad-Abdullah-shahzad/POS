import { describe, expect, it } from 'vitest';
import { LruCache } from '../utils/lruCache';

const cache = () => new LruCache<string>(10, (value) => value.length);

describe('size-limited cache', () => {
  it('drops the least recently used entries once full', () => {
    const images = cache();
    images.set('a', 'aaaa');
    images.set('b', 'bbbb');
    images.get('a'); // a is now more recent than b
    images.set('c', 'cccc');

    expect(images.get('b')).toBeUndefined();
    expect(images.get('a')).toBe('aaaa');
    expect(images.get('c')).toBe('cccc');
    expect(images.size).toBe(8);
  });

  it('never keeps something larger than the whole cache', () => {
    const images = cache();
    images.set('a', 'aaaa');
    images.set('huge', 'x'.repeat(11));

    expect(images.get('huge')).toBeUndefined();
    expect(images.get('a')).toBe('aaaa');
  });

  it('counts a replaced entry once', () => {
    const images = cache();
    images.set('a', 'aaaa');
    images.set('a', 'aa');

    expect(images.size).toBe(2);
  });
});
