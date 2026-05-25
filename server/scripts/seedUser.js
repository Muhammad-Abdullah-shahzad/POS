/**
 * seedUser.js  —  Seeds default users into MongoDB
 *
 * Run with:
 *   node scripts/seedUser.js
 *
 * Users created:
 *   admin@pos.com    / admin123    (admin)
 *   manager@pos.com  / manager123  (manager)
 *   cashier@pos.com  / cashier123  (cashier)
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const path     = require('path');

// Load .env manually (no dotenv dependency needed — just read the file)
const fs = require('fs');
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length && !key.trim().startsWith('#')) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    });
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/store_pos';

const UserSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'manager', 'cashier'], default: 'cashier' },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const USERS = [
  { name: 'Admin',   email: 'admin@pos.com',   password: 'admin123',   role: 'admin'   },
  { name: 'Manager', email: 'manager@pos.com',  password: 'manager123', role: 'manager' },
  { name: 'Cashier', email: 'cashier@pos.com',  password: 'cashier123', role: 'cashier' },
];

async function seed() {
  console.log('\n🔌 Connecting to:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  for (const u of USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`⚠️  Skipped (already exists): ${u.email}`);
      continue;
    }
    const salt         = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);
    await User.create({ name: u.name, email: u.email, passwordHash, role: u.role });
    console.log(`✅ Created: ${u.email}  |  role: ${u.role}  |  password: ${u.password}`);
  }

  await mongoose.disconnect();
  console.log('\n🎉 Seeding complete!\n');
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
