// POS Server Entry Point
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded product images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Database
connectDB();

// Routes Placeholder
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import expenseRoutes from './routes/expenseRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import supplierRoutes from './routes/supplierRoutes';
import employeeRoutes from './routes/employeeRoutes';
import bankRoutes from './routes/bankRoutes';
import customerRoutes from './routes/customerRoutes';

// Import Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/customers', customerRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
