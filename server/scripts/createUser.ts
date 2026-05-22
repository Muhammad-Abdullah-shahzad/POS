import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const createUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/store_pos');
    console.log('MongoDB Connected');

    const existing = await User.findOne({ email: 'deviction@gmail.com' });
    if (existing) {
      console.log('User already exists, updating password...');
      const salt = await bcrypt.genSalt(10);
      existing.passwordHash = await bcrypt.hash('12345678', salt);
      await existing.save();
      console.log('Password updated successfully.');
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('12345678', salt);
      await User.create({
        name: 'Deviction',
        email: 'deviction@gmail.com',
        passwordHash,
        role: 'admin',
      });
      console.log('User created: deviction@gmail.com / 12345678');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

createUser();
