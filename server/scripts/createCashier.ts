import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const createCashier = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/store_pos');
    console.log('MongoDB Connected');

    const existing = await User.findOne({ email: 'cashier@store.com' });
    if (existing) {
      console.log('Cashier already exists, updating password...');
      const salt = await bcrypt.genSalt(10);
      existing.passwordHash = await bcrypt.hash('cashier123', salt);
      await existing.save();
      console.log('Password updated.');
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('cashier123', salt);
      await User.create({
        name: 'Cashier',
        email: 'cashier@store.com',
        passwordHash,
        role: 'cashier',
      });
      console.log('Cashier created: cashier@store.com / cashier123');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createCashier();
