import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order';
import Expense from '../models/Expense';
import Customer from '../models/Customer';

dotenv.config();

const wipeTransactions = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/store_pos';
    console.log(`Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected for transaction wiping');

    // 1. Wipe Orders
    console.log('Deleting all orders...');
    const orderDeleteResult = await Order.deleteMany({});
    console.log(`Successfully deleted ${orderDeleteResult.deletedCount} orders.`);

    // 2. Wipe Expenses
    console.log('Deleting all expenses...');
    const expenseDeleteResult = await Expense.deleteMany({});
    console.log(`Successfully deleted ${expenseDeleteResult.deletedCount} expenses.`);

    // 3. Reset Customer transaction metrics
    console.log('Resetting customer transaction metrics...');
    const customerResetResult = await Customer.updateMany(
      {},
      {
        $set: {
          timesVisited: 0,
          totalAmount: 0,
          lastVisit: ''
        }
      }
    );
    console.log(`Successfully reset metrics for ${customerResetResult.modifiedCount} customers.`);

    console.log('\n--- Transaction Wiping Complete! ---');
    console.log('Reports and transaction histories are now empty and ready for fresh transactions.');
    process.exit(0);
  } catch (error) {
    console.error('Error during transaction wiping:', error);
    process.exit(1);
  }
};

wipeTransactions();
