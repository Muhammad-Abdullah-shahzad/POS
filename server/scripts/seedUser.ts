/**
 * seedUser.ts
 * Seeds a default admin user into MongoDB.
 *
 * Run with:
 *   npx ts-node scripts/seedUser.ts
 *
 * Credentials seeded:
 *   name:     Admin
 *   email:    admin@pos.com
 *   password: admin123
 *   role:     admin
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/store_pos';

const UserSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'manager', 'cashier'], default: 'cashier' },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
  console.log('Connecting to:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const users = [
    { name: 'Admin',   email: 'admin@pos.com',   password: 'admin123',   role: 'admin'   },
    { name: 'Manager', email: 'manager@pos.com',  password: 'manager123', role: 'manager' },
    { name: 'Cashier', email: 'cashier@pos.com',  password: 'cashier123', role: 'cashier' },
  ];

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`⚠️  Skipped (already exists): ${u.email}`);
      continue;
    }
    const salt         = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);
    await User.create({ name: u.name, email: u.email, passwordHash, role: u.role });
    console.log(`✅  Created: ${u.email}  (${u.role})  password: ${u.password}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
