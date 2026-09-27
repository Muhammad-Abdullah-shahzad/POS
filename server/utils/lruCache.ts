/**
 * An in-memory cache limited by total size rather than entry count, dropping
 * the least recently used entries first. A Map keeps insertion order, so
 * moving an entry to the end on every read makes the first key the oldest.
 */
export class LruCache<V> {
  private readonly entries = new Map<string, { value: V; size: number }>();
  private totalSize = 0;

  constructor(
    private readonly maxSize: number,
    private readonly sizeOf: (value: V) => number
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    const size = this.sizeOf(value);
    this.delete(key);
    // Something bigger than the whole cache would only push everything else out.
    if (size > this.maxSize) return;

    this.entries.set(key, { value, size });
    this.totalSize += size;
    for (const [oldestKey] of this.entries) {
      if (this.totalSize <= this.maxSize) break;
      this.delete(oldestKey);
    }
  }

  delete(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.totalSize -= entry.size;
  }

  get size(): number {
    return this.totalSize;
  }
}
