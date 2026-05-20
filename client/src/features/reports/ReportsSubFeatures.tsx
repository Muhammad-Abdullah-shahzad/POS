import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Paper, Text, Title, Table, Badge, Button, Group, Stack, 
  TextInput, Select, SimpleGrid, ThemeIcon, Box
} from '@mantine/core';
import { 
  IconFileSpreadsheet, IconPrinter, IconSearch, IconCalendar, 
  IconTrendingUp, IconTrendingDown, IconBuildingStore
} from '@tabler/icons-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

// Color Palette for charts
const COLORS = ['#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2', '#15aabf', '#fd7e14', '#e64980'];

interface ReportConfig {
  title: string;
  description: string;
  hasChart: 'bar' | 'area' | 'pie' | 'none';
  chartDataKey?: string;
  chartNameKey?: string;
  headers: string[];
  mockData: any[];
  summaryCards?: { label: string; value: string; isPositive?: boolean; isNegative?: boolean }[];
}

export const ReportsSubFeatures = () => {
  const { reportType } = useParams<{ reportType: string }>();
  const navigate = useNavigate();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('this-month');

  // Triggering Print & Export Simulation
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    alert(`Exporting ${reportType} report data to CSV...`);
  };

  // Full configuration dictionary for all 24 reports
  const reportsConfig: Record<string, ReportConfig> = useMemo(() => ({
    'sales-summary': {
      title: 'Sales Summary Report',
      description: 'Daily sales revenue, orders count, gross discounts, and net performance.',
      hasChart: 'area',
      chartDataKey: 'netRevenue',
      headers: ['Date', 'Orders Count', 'Gross Revenue', 'Discounts', 'Net Revenue', 'Avg Ticket Size'],
      mockData: [
        { date: '2026-05-14', orders: 48, gross: 72000, discounts: 2100, netRevenue: 69900, avg: 1456 },
        { date: '2026-05-15', orders: 55, gross: 91000, discounts: 3500, netRevenue: 87500, avg: 1590 },
        { date: '2026-05-16', orders: 62, gross: 104000, discounts: 4200, netRevenue: 99800, avg: 1609 },
        { date: '2026-05-17', orders: 41, gross: 58000, discounts: 1800, netRevenue: 56200, avg: 1370 },
        { date: '2026-05-18', orders: 50, gross: 78000, discounts: 2500, netRevenue: 75500, avg: 1510 },
        { date: '2026-05-19', orders: 58, gross: 89000, discounts: 3100, netRevenue: 85900, avg: 1481 },
      ],
      summaryCards: [
        { label: 'Total Net Sales', value: 'Rs. 474,800', isPositive: true },
        { label: 'Total Invoices', value: '314 Bills', isPositive: true },
        { label: 'Total Discounts Given', value: 'Rs. 17,200', isNegative: true },
      ]
    },
    'transaction-sales': {
      title: 'Transaction Sales Report',
      description: 'Detailed audit trail of all transactions processed through registers.',
      hasChart: 'none',
      headers: ['Invoice No', 'Time', 'Cashier', 'Customer', 'Items Qty', 'Total Amount', 'Payment Method'],
      mockData: [
        { invoice: 'TXN-10023', time: '10:14 AM', cashier: 'Zainab Bibi', customer: 'Muhammad Bilal', items: 6, total: 3450, method: 'Cash' },
        { invoice: 'TXN-10024', time: '11:05 AM', cashier: 'Bilal Khan', customer: 'Ayesha Omer', items: 3, total: 1200, method: 'Card' },
        { invoice: 'TXN-10025', time: '11:45 AM', cashier: 'Zainab Bibi', customer: 'Tariq Saeed', items: 12, total: 11400, method: 'Cash' },
        { invoice: 'TXN-10026', time: '12:30 PM', cashier: 'Ali Raza', customer: 'Hamza Shah', items: 2, total: 650, method: 'EasyPaisa' },
        { invoice: 'TXN-10027', time: '01:15 PM', cashier: 'Bilal Khan', customer: 'Sana Malik', items: 8, total: 5400, method: 'Card' },
      ],
      summaryCards: [
        { label: 'Cash Sales', value: 'Rs. 14,850' },
        { label: 'Card/Digital Sales', value: 'Rs. 7,250' },
        { label: 'Avg Basket Size', value: '6.2 items' },
      ]
    },
    'category-sale': {
      title: 'Category Sale Report',
      description: 'Revenue distribution across various product departments.',
      hasChart: 'pie',
      chartDataKey: 'revenue',
      chartNameKey: 'category',
      headers: ['Category Name', 'Items Sold (Qty)', 'Gross Sales', 'Tax Collected', 'Total Revenue'],
      mockData: [
        { category: 'Cooking Oil', qty: 240, gross: 145000, tax: 2900, revenue: 147900 },
        { category: 'Bakery & Dairy', qty: 580, gross: 92000, tax: 1840, revenue: 93840 },
        { category: 'Beverages', qty: 450, gross: 64000, tax: 1280, revenue: 65280 },
        { category: 'Grains & Spices', qty: 380, gross: 88000, tax: 1760, revenue: 89760 },
        { category: 'Fruits & Vegetables', qty: 290, gross: 42000, tax: 0, revenue: 42000 },
      ],
      summaryCards: [
        { label: 'Top Category', value: 'Cooking Oil (Rs. 147,900)' },
        { label: 'Total Tax Collected', value: 'Rs. 7,780' },
        { label: 'Items Sold Total', value: '1,940 Units' },
      ]
    },
    'top-sale-products': {
      title: 'Top Sale Products',
      description: 'Highest performing store products by units sold and revenue contribution.',
      hasChart: 'bar',
      chartDataKey: 'revenue',
      headers: ['Product Name', 'SKU', 'Units Sold', 'Total Revenue', 'Profit Contribution'],
      mockData: [
        { product: 'Sufi Cooking Oil (5L)', sku: 'SOIL-5L', qty: 84, revenue: 205800, profit: 21000 },
        { product: 'Tapal Danedar Tea (950g)', sku: 'TTEA-950G', qty: 112, revenue: 103040, profit: 11200 },
        { product: 'National Chili Sauce', sku: 'NFOOD-CS250', qty: 210, revenue: 37800, profit: 5400 },
        { product: 'Olpers Milk (1L)', sku: 'OLP-1L', qty: 180, revenue: 52200, profit: 4500 },
        { product: 'Supreme Tea (400g)', sku: 'SUP-400G', qty: 95, revenue: 47500, profit: 4750 },
      ],
      summaryCards: [
        { label: 'Top Seller', value: 'Sufi Cooking Oil (84 Units)' },
        { label: 'Total Product Sales', value: 'Rs. 446,340' },
        { label: 'Gross Product Margin', value: '10.5%' },
      ]
    },
    'products-sale': {
      title: 'Products Sale Report',
      description: 'Unit-by-unit ledger of product sales performance.',
      hasChart: 'none',
      headers: ['Product Name', 'SKU', 'Total Units Sold', 'Average Price', 'Net Revenue'],
      mockData: [
        { product: 'Sufi Cooking Oil (5L)', sku: 'SOIL-5L', qty: 84, avg: 2450, revenue: 205800 },
        { product: 'Tapal Danedar Tea (950g)', sku: 'TTEA-950G', qty: 112, avg: 920, revenue: 103040 },
        { product: 'National Chili Sauce', sku: 'NFOOD-CS250', qty: 210, avg: 180, revenue: 37800 },
        { product: 'Olpers Milk (1L)', sku: 'OLP-1L', qty: 180, avg: 290, revenue: 52200 },
        { product: 'Supreme Tea (400g)', sku: 'SUP-400G', qty: 95, avg: 500, revenue: 47500 },
        { product: 'Rooh Afza Syrup (800ml)', sku: 'ROOH-800', qty: 140, avg: 380, revenue: 53200 },
        { product: 'Shan Biryani Masala', sku: 'SHAN-BM', qty: 320, avg: 110, revenue: 35200 },
      ],
      summaryCards: [
        { label: 'Total SKU Volume', value: '1,141 Units' },
        { label: 'Total Net Revenue', value: 'Rs. 534,740' },
        { label: 'Active SKUs Sold', value: '7 SKUs' },
      ]
    },
    'category-ratio': {
      title: 'Category Ratio Report',
      description: 'Comparison of inventory volume vs sales velocity per category.',
      hasChart: 'pie',
      chartDataKey: 'velocity',
      chartNameKey: 'category',
      headers: ['Category', 'Inventory Share %', 'Sales Velocity %', 'Stock Turn Rate (Monthly)'],
      mockData: [
        { category: 'Cooking Oil', share: 15, velocity: 32, turnRate: 4.8 },
        { category: 'Bakery & Dairy', share: 22, velocity: 24, turnRate: 3.2 },
        { category: 'Beverages', share: 18, velocity: 16, turnRate: 2.5 },
        { category: 'Grains & Spices', share: 28, velocity: 18, turnRate: 1.8 },
        { category: 'Fruits & Vegetables', share: 17, velocity: 10, turnRate: 5.2 },
      ],
      summaryCards: [
        { label: 'Fastest Stock Turnover', value: 'Fruits & Vegetables (5.2x)' },
        { label: 'Bulk Capital Allocation', value: 'Grains & Spices (28% Share)' },
        { label: 'Optimal Category', value: 'Cooking Oil (High Velocity)' },
      ]
    },
    'category-profit': {
      title: 'Category Profit Report',
      description: 'Profit margins and return metrics broken down by product category.',
      hasChart: 'bar',
      chartDataKey: 'profit',
      headers: ['Category', 'Revenue Generated', 'Cost of Goods (COGS)', 'Gross Profit', 'Margin (%)'],
      mockData: [
        { category: 'Cooking Oil', revenue: 147900, cogs: 126900, profit: 21000, margin: 14.2 },
        { category: 'Bakery & Dairy', revenue: 93840, cogs: 81240, profit: 12600, margin: 13.4 },
        { category: 'Beverages', revenue: 65280, cogs: 52280, profit: 13000, margin: 19.9 },
        { category: 'Grains & Spices', revenue: 89760, cogs: 71760, profit: 18000, margin: 20.1 },
        { category: 'Fruits & Vegetables', revenue: 42000, cogs: 31000, profit: 11000, margin: 26.2 },
      ],
      summaryCards: [
        { label: 'Highest Margin Category', value: 'Fruits & Vegetables (26.2%)' },
        { label: 'Highest Total Profit', value: 'Cooking Oil (Rs. 21,000)' },
        { label: 'Total Gross Profit', value: 'Rs. 75,600' },
      ]
    },
    'expiry-items': {
      title: 'Expiry Items Report',
      description: 'Inventory batches approaching expiration within 60 days.',
      hasChart: 'none',
      headers: ['Product Name', 'Batch No', 'Stock on Hand', 'Cost Value', 'Expiry Date', 'Days to Expire'],
      mockData: [
        { product: 'Nestle Yogurt (400g)', batch: 'B-NYG-124', qty: 28, cost: 3500, expiry: '2026-06-05', days: 16 },
        { product: 'Olpers Cream (200ml)', batch: 'B-OLPC-88', qty: 45, cost: 6750, expiry: '2026-06-15', days: 26 },
        { product: 'Knorr Noodle Pack', batch: 'B-KNR-342', qty: 120, cost: 7200, expiry: '2026-06-28', days: 39 },
        { product: 'Sufi Sunflower Oil (1L)', batch: 'B-SUFI-09', qty: 14, cost: 7000, expiry: '2026-07-10', days: 51 },
      ],
      summaryCards: [
        { label: 'At-risk Batches', value: '4 Batches', isNegative: true },
        { label: 'Valuation at Risk', value: 'Rs. 24,450', isNegative: true },
        { label: 'Next Expiry Date', value: '2026-06-05 (16 days)' },
      ]
    },
    'employee-sales': {
      title: 'Employee Sales Report',
      description: 'Cashier transaction volume, register logs, and performance metrics.',
      hasChart: 'bar',
      chartDataKey: 'sales',
      headers: ['Employee Name', 'Shift Count', 'Total Transactions', 'Total Sales (Rs.)', 'Avg Order Value'],
      mockData: [
        { employee: 'Zainab Bibi', shifts: 18, transactions: 245, sales: 345000, avg: 1408 },
        { employee: 'Bilal Khan', shifts: 22, transactions: 280, sales: 412000, avg: 1471 },
        { employee: 'Ali Raza', shifts: 14, transactions: 165, sales: 218000, avg: 1321 },
        { employee: 'Sana Malik', shifts: 12, transactions: 110, sales: 154000, avg: 1400 },
      ],
      summaryCards: [
        { label: 'Top Performer', value: 'Bilal Khan (Rs. 412,000)' },
        { label: 'Active Clerks', value: '4 Cashiers' },
        { label: 'Total Logged Sales', value: 'Rs. 1,129,000' },
      ]
    },
    'purchase-sales-history': {
      title: 'Product Purchase - Sales History',
      description: 'Detailed history comparing bulk product purchase costs vs POS retail sales prices.',
      hasChart: 'none',
      headers: ['Product Name', 'Purchase Cost (Rs.)', 'POS Sale Price (Rs.)', 'Spread/Margin', 'Markup %', 'Last Updated'],
      mockData: [
        { product: 'Sufi Cooking Oil (5L)', purchase: 2200, sale: 2450, spread: 250, markup: 11.36, updated: '2026-05-10' },
        { product: 'Tapal Danedar Tea (950g)', purchase: 820, sale: 920, spread: 100, markup: 12.20, updated: '2026-05-12' },
        { product: 'National Chili Sauce', purchase: 154, sale: 180, spread: 26, markup: 16.88, updated: '2026-05-15' },
        { product: 'Olpers Milk (1L)', purchase: 265, sale: 290, spread: 25, markup: 9.43, updated: '2026-05-18' },
        { product: 'Supreme Tea (400g)', purchase: 450, sale: 500, spread: 50, markup: 11.11, updated: '2026-05-18' },
      ],
      summaryCards: [
        { label: 'Max Markup Margin', value: 'National Chili Sauce (16.88%)' },
        { label: 'Avg Store Markup', value: '12.2%' },
        { label: 'Last Supplier Sync', value: '2026-05-18' },
      ]
    },
    'z-report-print': {
      title: 'Z Report Print Report',
      description: 'End-of-day register closing summary, tax collections, and drawer logs.',
      hasChart: 'none',
      headers: ['Parameter / Register Account', 'Recorded Amount'],
      mockData: [
        { parameter: 'Date/Time Printed', value: '2026-05-20 11:09 AM' },
        { parameter: 'Open Cash Balance', value: 'Rs. 20,000' },
        { parameter: 'Total Cash Sales', value: 'Rs. 89,500' },
        { parameter: 'Total Card/POS Sales', value: 'Rs. 54,000' },
        { parameter: 'Refunds / Returns Out', value: 'Rs. -3,200' },
        { parameter: 'Total General Tax Collected (17%)', value: 'Rs. 18,200' },
        { parameter: 'Net Cash in Drawer', value: 'Rs. 106,300' },
        { parameter: 'Over / Short Variance', value: 'Rs. 0 (Perfect Match)' },
      ],
      summaryCards: [
        { label: 'Daily Net Receipts', value: 'Rs. 140,300' },
        { label: 'Drawer Match Status', value: 'Verified', isPositive: true },
        { label: 'Z-Report Serial', value: 'Z-2026-0520-01' },
      ]
    },
    'sales-analysis': {
      title: 'Sales Analysis Report',
      description: 'Hourly and weekly peak period analysis for optimized staffing and stocking.',
      hasChart: 'area',
      chartDataKey: 'sales',
      headers: ['Hour / Peak Period', 'Transaction Count', 'Average Basket Qty', 'Total Net Sales'],
      mockData: [
        { hour: '09:00 - 11:00 AM', transactions: 45, qty: 3.4, sales: 48000 },
        { hour: '11:00 - 01:00 PM', transactions: 88, qty: 5.6, sales: 112000 },
        { hour: '01:00 - 03:00 PM', transactions: 62, qty: 4.8, sales: 79000 },
        { hour: '03:00 - 05:00 PM', transactions: 74, qty: 5.2, sales: 94000 },
        { hour: '05:00 - 07:00 PM', transactions: 110, qty: 7.1, sales: 165000 },
        { hour: '07:00 - 09:00 PM', transactions: 95, qty: 6.8, sales: 138000 },
      ],
      summaryCards: [
        { label: 'Peak Hour Period', value: '05:00 - 07:00 PM (110 Txns)', isPositive: true },
        { label: 'Highest Basket Size', value: '7.1 items/ticket' },
        { label: 'Total Period Sales', value: 'Rs. 636,000' },
      ]
    },
    'profit-analysis': {
      title: 'Profit Analysis Report',
      description: 'Net operating profits after deduction of expenses, taxes, and log fees.',
      hasChart: 'area',
      chartDataKey: 'netProfit',
      headers: ['Month', 'Gross Sales', 'COGS', 'Operating Expenses', 'Net Profit', 'Profit Margin %'],
      mockData: [
        { month: 'Jan 2026', sales: 1200000, cogs: 940000, expenses: 110000, netProfit: 150000, margin: 12.5 },
        { month: 'Feb 2026', sales: 1350000, cogs: 1050000, expenses: 115000, netProfit: 185000, margin: 13.7 },
        { month: 'Mar 2026', sales: 1500000, cogs: 1160000, expenses: 120000, netProfit: 220000, margin: 14.6 },
        { month: 'Apr 2026', sales: 1420000, cogs: 1100000, expenses: 118000, netProfit: 202000, margin: 14.2 },
        { month: 'May 2026', sales: 1600000, cogs: 1230000, expenses: 125000, netProfit: 245000, margin: 15.3 },
      ],
      summaryCards: [
        { label: 'YTD Net Profit', value: 'Rs. 1,002,000', isPositive: true },
        { label: 'Avg Monthly Profit Margin', value: '14.1%' },
        { label: 'Growth Trend', value: '+18% since Jan', isPositive: true },
      ]
    },
    'product-stock': {
      title: 'Product Stock Report',
      description: 'Active stock-on-hand quantities, cost valuations, and reorder alerts.',
      hasChart: 'none',
      headers: ['Product Name', 'SKU', 'Available Stock', 'Unit Cost (Rs.)', 'Retail Price (Rs.)', 'Stock Value at Cost'],
      mockData: [
        { product: 'Sufi Cooking Oil (5L)', sku: 'SOIL-5L', qty: 150, cost: 2200, price: 2450, totalCost: 330000 },
        { product: 'Tapal Danedar Tea (950g)', sku: 'TTEA-950G', qty: 85, cost: 820, price: 920, totalCost: 69700 },
        { product: 'National Chili Sauce', sku: 'NFOOD-CS250', qty: 320, cost: 154, price: 180, totalCost: 49280 },
        { product: 'Olpers Milk (1L)', sku: 'OLP-1L', qty: 240, cost: 265, price: 290, totalCost: 63600 },
        { product: 'Supreme Tea (400g)', sku: 'SUP-400G', qty: 110, cost: 450, price: 500, totalCost: 49500 },
      ],
      summaryCards: [
        { label: 'Total Stock Valuation', value: 'Rs. 562,080' },
        { label: 'Total Units in Inventory', value: '905 Units' },
        { label: 'Critical Reorder Items', value: '0 Items', isPositive: true },
      ]
    },
    'posting': {
      title: 'Posting Report',
      description: 'Ledger posting audit trail logging synchronized records sent to primary accounting.',
      hasChart: 'none',
      headers: ['Posting Date', 'Record Type', 'Ref Number', 'Debit Amount', 'Credit Amount', 'Status'],
      mockData: [
        { date: '2026-05-19', type: 'Sales Register Sync', ref: 'POST-0519-01', debit: 85900, credit: 0, status: 'Completed' },
        { date: '2026-05-19', type: 'Supplier Payout', ref: 'POST-0519-02', debit: 0, credit: 30000, status: 'Completed' },
        { date: '2026-05-20', type: 'Daily Expense Post', ref: 'POST-0520-01', debit: 0, credit: 4500, status: 'Completed' },
        { date: '2026-05-20', type: 'Sales Register Sync', ref: 'POST-0520-02', debit: 140300, credit: 0, status: 'Pending Verification' },
      ],
      summaryCards: [
        { label: 'Total Ledger Debit', value: 'Rs. 226,200' },
        { label: 'Total Ledger Credit', value: 'Rs. 34,500' },
        { label: 'Verification Status', value: '1 Pending Review' },
      ]
    },
    'bag-levy': {
      title: 'Bag Levy Report',
      description: 'Environmental carrier bag taxation auditor logging quantities distributed and tax collected.',
      hasChart: 'none',
      headers: ['Date', 'Bags Count', 'Levy Per Bag (Rs.)', 'Total Levy Collected', 'Accounting Status'],
      mockData: [
        { date: '2026-05-15', count: 184, levy: 15, total: 2760, status: 'Paid' },
        { date: '2026-05-16', count: 215, levy: 15, total: 3225, status: 'Paid' },
        { date: '2026-05-17', count: 145, levy: 15, total: 2175, status: 'Paid' },
        { date: '2026-05-18', count: 172, levy: 15, total: 2580, status: 'Paid' },
        { date: '2026-05-19', count: 190, levy: 15, total: 2850, status: 'Accrued' },
      ],
      summaryCards: [
        { label: 'Bags Handed Out', value: '906 Bags' },
        { label: 'Levy Collected (May)', value: 'Rs. 13,590' },
        { label: 'Next Clearance Date', value: '2026-05-31' },
      ]
    },
    'drs': {
      title: 'DRS Report',
      description: 'Deposit Return Scheme recycling credits, deposits, and refunds logger.',
      hasChart: 'none',
      headers: ['Month', 'Containers Returned', 'Deposits Collected', 'Refunds Issued', 'Net Scheme Balance'],
      mockData: [
        { month: 'Jan 2026', count: 850, collected: 8500, refunds: 6800, balance: 1700 },
        { month: 'Feb 2026', count: 940, collected: 9400, refunds: 7900, balance: 1500 },
        { month: 'Mar 2026', count: 1100, collected: 11000, refunds: 9200, balance: 1800 },
        { month: 'Apr 2026', count: 1050, collected: 10500, refunds: 8800, balance: 1700 },
        { month: 'May 2026', count: 1250, collected: 12500, refunds: 10200, balance: 2300 },
      ],
      summaryCards: [
        { label: 'Recycled Units Total', value: '5,190 Bottles/Cans' },
        { label: 'Deposits Paid Back', value: 'Rs. 42,900', isPositive: true },
        { label: 'DRS Retained Spread', value: 'Rs. 9,000' },
      ]
    },
    'inventory': {
      title: 'Inventory Audit Report',
      description: 'Physical audit logs, stock level deviations, and balance adjustments.',
      hasChart: 'none',
      headers: ['Audit Date', 'Category Checked', 'Expected Stock', 'Physical Count', 'Discrepancy Qty', 'Valuation Loss'],
      mockData: [
        { date: '2026-05-01', category: 'Beverages', expected: 480, physical: 478, discrepancy: -2, loss: -580 },
        { date: '2026-05-05', category: 'Bakery & Dairy', expected: 320, physical: 320, discrepancy: 0, loss: 0 },
        { date: '2026-05-10', category: 'Cooking Oil', expected: 165, physical: 164, discrepancy: -1, loss: -2200 },
        { date: '2026-05-15', category: 'Grains & Spices', expected: 540, physical: 535, discrepancy: -5, loss: -1800 },
      ],
      summaryCards: [
        { label: 'Inventory Audited', value: '1,505 Items' },
        { label: 'Net Discrepancy Rate', value: '0.53% (Good)', isPositive: true },
        { label: 'Valuation Shrinkage Cost', value: 'Rs. -4,580', isNegative: true },
      ]
    },
    'invoice': {
      title: 'Invoice Report',
      description: 'B2B client wholesale invoices registry, credit accounts, and payments ledger.',
      hasChart: 'none',
      headers: ['Invoice No', 'Client Name', 'Due Date', 'Total Invoice', 'Amount Paid', 'Credit Status'],
      mockData: [
        { invoice: 'INV-B2B-008', client: 'Peshawar General Store', due: '2026-06-10', total: 85000, paid: 60000, status: 'Partial' },
        { invoice: 'INV-B2B-009', client: 'Lahore Mini Mart', due: '2026-06-15', total: 42000, paid: 42000, status: 'Paid' },
        { invoice: 'INV-B2B-010', client: 'Khyber Trading Co.', due: '2026-05-25', total: 128000, paid: 0, status: 'Overdue' },
        { invoice: 'INV-B2B-011', client: 'Balochistan Canteen', due: '2026-06-20', total: 65000, paid: 35000, status: 'Partial' },
      ],
      summaryCards: [
        { label: 'Total B2B Assets', value: 'Rs. 320,000' },
        { label: 'Wholesale Receivables', value: 'Rs. 183,000', isNegative: true },
        { label: 'Overdue Accounts', value: '1 Client Overdue', isNegative: true },
      ]
    },
    'wastage': {
      title: 'Wastage Report',
      description: 'Register of written-off inventory due to damage, contamination, or theft.',
      hasChart: 'none',
      headers: ['Write-Off Date', 'Product Name', 'SKU', 'Wastage Qty', 'Unit Cost (Rs.)', 'Total Cost Loss', 'Reason'],
      mockData: [
        { date: '2026-05-12', product: 'Olpers Milk (1L)', sku: 'OLP-1L', qty: 8, cost: 265, loss: 2120, reason: 'Leaked Carton' },
        { date: '2026-05-14', product: 'National Chili Sauce', sku: 'NFOOD-CS250', qty: 3, cost: 154, loss: 462, reason: 'Broken Bottle' },
        { date: '2026-05-16', product: 'Tapal Danedar Tea (950g)', sku: 'TTEA-950G', qty: 1, cost: 820, loss: 820, reason: 'Damaged Bag Packaging' },
      ],
      summaryCards: [
        { label: 'Total Waste Losses', value: 'Rs. 3,402', isNegative: true },
        { label: 'Wasted Qty', value: '12 Items', isNegative: true },
        { label: 'Primary Waste Cause', value: 'Handling Damage' },
      ]
    },
    'exchange-refund': {
      title: 'Exchange Refund Report',
      description: 'Customer return registry, exchange credits, and cash refunds ledger.',
      hasChart: 'none',
      headers: ['Return Date', 'Original Receipt', 'Items Returned', 'Refund Amount', 'Exchange Taken', 'Reason'],
      mockData: [
        { date: '2026-05-16', receipt: 'TXN-09941', items: 'Shan Biryani Masala (2)', refund: 220, exchange: 'Yes (Knorr Noodles)', reason: 'Purchased wrong spice variant' },
        { date: '2026-05-18', receipt: 'TXN-10008', items: 'Sufi Cooking Oil (1 Bottle)', refund: 2450, exchange: 'No (Cash Return)', reason: 'Customer changed mind' },
        { date: '2026-05-19', receipt: 'TXN-10022', items: 'Beverage Bottle', refund: 150, exchange: 'Yes (Rooh Afza)', reason: 'Expired stock slipped past' },
      ],
      summaryCards: [
        { label: 'Cash Refunds Paid', value: 'Rs. 2,450', isNegative: true },
        { label: 'Exchanged Items Value', value: 'Rs. 370' },
        { label: 'Total Returns Received', value: '3 Customer Claims' },
      ]
    },
    'expenses': {
      title: 'Expenses Report',
      description: 'Company operational costs categorized by business area.',
      hasChart: 'pie',
      chartDataKey: 'amount',
      chartNameKey: 'category',
      headers: ['Category Name', 'Total Transactions', 'Total Expenditures (Rs.)', '% of Total Expenses'],
      mockData: [
        { category: 'Rent & Leases', count: 1, amount: 80000, pct: 54.1 },
        { category: 'Utilities (Electricity)', count: 2, amount: 35000, pct: 23.6 },
        { category: 'Supplier Deliveries', count: 8, amount: 22000, pct: 14.9 },
        { category: 'Staff Refreshments', count: 12, amount: 6500, pct: 4.4 },
        { category: 'Store Cleaning Supplies', count: 4, amount: 4500, pct: 3.0 },
      ],
      summaryCards: [
        { label: 'Total Expenses (Month)', value: 'Rs. 148,000', isNegative: true },
        { label: 'Largest Outlet Expense', value: 'Rent (Rs. 80,000)', isNegative: true },
        { label: 'Expense Transactions', value: '27 Invoices', isNegative: true },
      ]
    },
    'stock-reconciliation': {
      title: 'Stock Reconciliation Report',
      description: 'Comparison of electronic stocks vs actual physical audit adjustments.',
      hasChart: 'none',
      headers: ['Adjustment ID', 'Date', 'Product Name', 'Adjustment Qty', 'Reason Code', 'Authorized By'],
      mockData: [
        { id: 'ADJ-102', date: '2026-05-02', product: 'Supreme Tea (400g)', qty: -4, reason: 'Physical Shortage Audit', staff: 'Zainab Bibi' },
        { id: 'ADJ-103', date: '2026-05-08', product: 'Olpers Milk (1L)', qty: 12, reason: 'Unregistered Supplier Gift Batch', staff: 'Muhammad Bilal' },
        { id: 'ADJ-104', date: '2026-05-15', product: 'National Chili Sauce', qty: -2, reason: 'Damaged during shelf stocking', staff: 'Ali Raza' },
      ],
      summaryCards: [
        { label: 'Manual Corrections', value: '3 Entries' },
        { label: 'Net Unit Adjustment', value: '+6 Units', isPositive: true },
        { label: 'Total Valuation Delta', value: 'Rs. +820', isPositive: true },
      ]
    },
    'stock-value': {
      title: 'Stock Value Report',
      description: 'Asset valuation sheet calculating store net assets at purchase cost vs retail value.',
      hasChart: 'bar',
      chartDataKey: 'costValue',
      headers: ['Category', 'Items Count', 'Total Stock Qty', 'Total Cost Value', 'Total Retail Value', 'Unrealized Profit'],
      mockData: [
        { category: 'Cooking Oil', items: 12, qty: 150, costValue: 330000, retailValue: 367500, profit: 37500 },
        { category: 'Bakery & Dairy', items: 35, qty: 420, costValue: 112000, retailValue: 128500, profit: 16500 },
        { category: 'Beverages', items: 24, qty: 380, costValue: 78000, retailValue: 92000, profit: 14000 },
        { category: 'Grains & Spices', items: 45, qty: 680, costValue: 145000, retailValue: 168000, profit: 23000 },
        { category: 'Fruits & Vegetables', items: 18, qty: 290, costValue: 31000, retailValue: 42000, profit: 11000 },
      ],
      summaryCards: [
        { label: 'Total Assets (At Cost)', value: 'Rs. 696,000' },
        { label: 'Total Assets (At Retail)', value: 'Rs. 798,000' },
        { label: 'Unrealized Profit Margin', value: 'Rs. 102,000 (14.6%)', isPositive: true },
      ]
    },
  }), []);

  // Fetch matched configuration
  const reportInfo = useMemo(() => {
    if (!reportType || !reportsConfig[reportType]) {
      return null;
    }
    return reportsConfig[reportType];
  }, [reportType, reportsConfig]);

  // Filter and search logic
  const filteredData = useMemo(() => {
    if (!reportInfo) return [];
    
    return reportInfo.mockData.filter(row => {
      // String representation of whole row to search across all columns
      const rowString = Object.values(row).join(' ').toLowerCase();
      return rowString.includes(searchQuery.toLowerCase());
    });
  }, [reportInfo, searchQuery]);

  if (!reportInfo) {
    return (
      <Paper p="xl" withBorder radius="md" style={{ textAlign: 'center' }}>
        <Title order={3} c="red" mb="md">Report Not Found</Title>
        <Text mb="lg">The requested report "{reportType}" is not configured in the POS system.</Text>
        <Button color="blue" onClick={() => navigate('/')}>Return to Dashboard</Button>
      </Paper>
    );
  }

  return (
    <Stack gap="md" style={{ height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      
      {/* 1. HEADER SECTION */}
      <Group justify="space-between" className="no-print">
        <div>
          <Group gap="xs">
            <ThemeIcon color="blue" size="lg" radius="md">
              <IconBuildingStore size={20} />
            </ThemeIcon>
            <Title order={2}>{reportInfo.title}</Title>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>{reportInfo.description}</Text>
        </div>
        <Group>
          <Button 
            variant="outline" 
            color="gray"
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button 
            color="blue"
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            Print Report
          </Button>
        </Group>
      </Group>

      {/* Print-only layout header */}
      <Box className="print-only" style={{ display: 'none', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
        <Title order={1} ta="center">STORE RETAIL POS - MANAGEMENT REPORT</Title>
        <Title order={3} ta="center" mt="xs">{reportInfo.title}</Title>
        <Group justify="space-between" mt="md">
          <Text size="sm">Date Range: {dateRange.toUpperCase()}</Text>
          <Text size="sm">Generated At: {new Date().toLocaleString()}</Text>
        </Group>
      </Box>

      {/* 2. DYNAMIC SUMMARY CARDS */}
      {reportInfo.summaryCards && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="no-print">
          {reportInfo.summaryCards.map((card, idx) => (
            <Paper key={idx} withBorder p="md" radius="md" style={{ display: 'flex', flexDirection: 'column' }}>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">{card.label}</Text>
              <Group justify="space-between" align="flex-end" mt="xs">
                <Text size="xl" fw={700}>{card.value}</Text>
                {card.isPositive && <IconTrendingUp size={22} style={{ color: 'var(--mantine-color-green-filled)' }} />}
                {card.isNegative && <IconTrendingDown size={22} style={{ color: 'var(--mantine-color-red-filled)' }} />}
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      {/* 3. CHART VISUALIZATION (IF APPLICABLE) */}
      {reportInfo.hasChart !== 'none' && (
        <Paper withBorder p="md" radius="md" shadow="xs" className="no-print" style={{ height: 260, display: 'flex', flexDirection: 'column' }}>
          <Text fw={600} size="sm" mb="xs">Visual Analytics Trend</Text>
          <Box style={{ flex: 1, minHeight: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              {reportInfo.hasChart === 'area' ? (
                <AreaChart data={reportInfo.mockData}>
                  <defs>
                    <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#228be6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#228be6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey={Object.keys(reportInfo.mockData[0])[0]} fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                  <Area 
                    type="monotone" 
                    dataKey={reportInfo.chartDataKey || ''} 
                    stroke="#228be6" 
                    fill="url(#reportGrad)" 
                    name="Valuation" 
                  />
                </AreaChart>
              ) : reportInfo.hasChart === 'bar' ? (
                <BarChart data={reportInfo.mockData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey={Object.keys(reportInfo.mockData[0])[0]} fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                  <Bar 
                    dataKey={reportInfo.chartDataKey || ''} 
                    fill="#228be6" 
                    radius={[4, 4, 0, 0]} 
                    name="Value" 
                  />
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={reportInfo.mockData}
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={60}
                    dataKey={reportInfo.chartDataKey || ''}
                    nameKey={reportInfo.chartNameKey || 'category'}
                    label={{ fontSize: 9 }}
                  >
                    {reportInfo.mockData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '9px' }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}

      {/* 4. DATA TABLE SECTION */}
      <Paper withBorder radius="md" p="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Table Search Filters */}
        <Group justify="space-between" mb="sm" className="no-print">
          <TextInput
            placeholder="Search report items..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            placeholder="Date Filter"
            value={dateRange}
            onChange={(val) => setDateRange(val || 'this-month')}
            data={[
              { label: 'Today', value: 'today' },
              { label: 'Yesterday', value: 'yesterday' },
              { label: 'Last 7 Days', value: 'last-7' },
              { label: 'This Month', value: 'this-month' },
            ]}
            leftSection={<IconCalendar size={16} />}
            style={{ width: 180 }}
          />
        </Group>

        <Box style={{ flex: 1, overflowY: 'auto' }}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
              <Table.Tr>
                {reportInfo.headers.map((h, i) => (
                  <Table.Th key={i} style={{ textAlign: i > 0 && i !== 3 ? 'right' : 'left' }}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredData.map((row, rowIdx) => {
                const values = Object.values(row);
                return (
                  <Table.Tr key={rowIdx}>
                    {values.slice(0, reportInfo.headers.length).map((val: any, colIdx) => {
                      const isNumber = typeof val === 'number';
                      const formattedVal = isNumber 
                        ? (val % 1 === 0 && val > 100 ? `Rs. ${val.toLocaleString()}` : val)
                        : String(val);

                      // Style badges for status columns
                      const isStatusCol = String(val) === 'Paid' || String(val) === 'Partial' || String(val) === 'Overdue' || String(val) === 'Accrued' || String(val) === 'Completed' || String(val) === 'Pending Verification';
                      
                      return (
                        <Table.Th key={colIdx} style={{ 
                          fontWeight: colIdx === 0 ? 600 : 400,
                          textAlign: colIdx > 0 && colIdx !== 3 ? 'right' : 'left'
                        }}>
                          {isStatusCol ? (
                            <Badge 
                              color={
                                val === 'Paid' || val === 'Completed' ? 'green' : 
                                val === 'Partial' || val === 'Accrued' ? 'yellow' : 'red'
                              }
                              variant="light"
                            >
                              {val}
                            </Badge>
                          ) : formattedVal}
                        </Table.Th>
                      );
                    })}
                  </Table.Tr>
                );
              })}
              {filteredData.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={reportInfo.headers.length} style={{ textAlign: 'center', padding: '24px 0' }}>
                    <Text c="dimmed">No matching report records found.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Paper>
    </Stack>
  );
};
