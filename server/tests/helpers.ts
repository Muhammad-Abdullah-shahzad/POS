import mongoose from 'mongoose';
import { provisionTenant } from '../services/tenantService';
import '../models/registry';

/** Empty every collection so each test file starts from a known state. */
export async function resetDatabase(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

let sequence = 0;

/** Create a company with an admin login, ready to act as. */
export async function createCompany(name = 'Test Company') {
  sequence += 1;
  const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${sequence}`;

  return provisionTenant({
    company: { name, slug, contactEmail: `owner+${slug}@example.com` },
    admin: { name: 'Owner', email: `owner+${slug}@example.com`, password: 'correct horse battery' },
  });
}
