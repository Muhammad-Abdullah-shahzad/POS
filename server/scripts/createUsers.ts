import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const users = [
  { name: 'Admin',   email: 'admin@deviction.tech',  password: '12345678', role: 'admin'   as const },
  { name: 'Cashier', email: 'pos@deviction.tech',     password: '12345678', role: 'cashier' as const },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/store_pos');
  console.log('MongoDB Connected');

  for (const u of users) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);
    await User.findOneAndUpdate(
      { email: u.email },
      { name: u.name, email: u.email, passwordHash, role: u.role },
      { upsert: true, new: true }
    );
    console.log(`✓ ${u.role.toUpperCase()} — ${u.email} / ${u.password}`);
  }

  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
