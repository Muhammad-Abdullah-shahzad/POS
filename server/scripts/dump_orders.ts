import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pos_system');
  console.log('Connected to MongoDB');

  const orders = await Order.find({
    status: { $ne: 'voided' },
    createdAt: {
      $gte: new Date('2026-05-20T00:00:00.000Z'),
      $lte: new Date('2026-05-27T00:00:00.000Z')
    }
  }).sort({ createdAt: -1 });

  console.log(`Found ${orders.length} active orders in date range`);

  orders.forEach((o, index) => {
    console.log(`Order #${index} - ID: ${o._id}, invoiceId: ${o.invoiceId}, date: ${o.createdAt.toISOString()}`);
    o.items.forEach((item: any) => {
      console.log(`    * ${item.name} | product ID: ${item.product} | qty: ${item.quantity} | price: ${item.price}`);
    });
  });

  await mongoose.disconnect();
}

run().catch(console.error);
