import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User';
import Product from '../models/Product';
import VatSettings from '../models/VatSettings';

dotenv.config();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/store_pos');
    console.log('MongoDB Connected for Seeding');

    // Clear existing
    await User.deleteMany();
    await Product.deleteMany();
    await VatSettings.deleteMany();

    // Create Admin User
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);
    await User.create({
      name: 'Admin User',
      email: 'admin@store.com',
      passwordHash,
      role: 'admin'
    });

    // Create VAT Settings
    await VatSettings.create({
      defaultVatRate: 20,
      isVatInclusiveDefault: false
    });

    // Create Demo Products
    await Product.create([
      {
        name: 'Wireless Mouse',
        sku: 'MS-WL-01',
        barcode: '123456789',
        category: 'Electronics',
        price: 25.00,
        vatRate: 20,
        vatType: 'exclusive',
        costPrice: 10.00,
        stock: 50
      },
      {
        name: 'Mechanical Keyboard',
        sku: 'KB-MC-02',
        barcode: '987654321',
        category: 'Electronics',
        price: 80.00,
        vatRate: 20,
        vatType: 'inclusive',
        costPrice: 40.00,
        stock: 30
      }
    ]);

    console.log('Data Seeded Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error with data seeding', error);
    process.exit(1);
  }
};

seedDB();
