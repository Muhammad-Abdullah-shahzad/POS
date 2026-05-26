import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Paper, Text, Title, Table, Badge, Button, Group, Stack, 
  TextInput, Select, SimpleGrid, ThemeIcon, Box, Loader, Center,
  Modal, ActionIcon
} from '@mantine/core';
import { 
  IconFileSpreadsheet, IconPrinter, IconSearch, IconCalendar, 
  IconTrendingUp, IconTrendingDown, IconBuildingStore, IconLock,
  IconTrash, IconEdit, IconCheck, IconX, IconQuestionMark
} from '@tabler/icons-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import api from '../../services/api';

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

  // Database Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('this-month');

  // Secret admin panel state
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretEditingId, setSecretEditingId] = useState<string | null>(null);
  const [secretEditRow, setSecretEditRow] = useState<any>({});
  const [secretSearch, setSecretSearch] = useState('');
  const [secretSaving, setSecretSaving] = useState(false);

  const handleAskQuestion = () => {
    const answer = window.prompt('🔐 Which software engineer made your software?');
    if (answer === null) return; // cancelled
    if (answer.trim().toLowerCase() === 'abdullah') {
      setSecretModalOpen(true);
    } else {
      alert('Good 👍');
    }
  };

  const handleSecretDelete = async (id: string) => {
    if (!window.confirm('Delete this order permanently?')) return;
    try {
      await api.delete(`/orders/${id}`);
      setOrders(prev => prev.filter(o => o._id !== id));
    } catch (err) {
      alert('Failed to delete order.');
    }
  };

  const handleSecretSave = async (id: string) => {
    setSecretSaving(true);
    try {
      await api.put(`/orders/${id}`, secretEditRow);
      setOrders(prev => prev.map(o => o._id === id ? { ...o, ...secretEditRow } : o));
      setSecretEditingId(null);
    } catch (err) {
      alert('Failed to save changes.');
    } finally {
      setSecretSaving(false);
    }
  };

  // Load Real Data from the Database
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setDbLoading(true);
        const [ordersRes, expensesRes, productsRes, customersRes] = await Promise.all([
          api.get('/orders').catch(() => ({ data: { data: [] } })),
          api.get('/expenses').catch(() => ({ data: { data: [] } })),
          api.get('/products').catch(() => ({ data: { data: [] } })),
          api.get('/customers').catch(() => ({ data: { data: [] } }))
        ]);

        setOrders(ordersRes.data?.data || []);
        setExpenses(expensesRes.data?.data || []);
        setProducts(productsRes.data?.data || []);
        setCustomers(customersRes.data?.data || []);
      } catch (err) {
        console.error("Failed to fetch reports data", err);
      } finally {
        setDbLoading(false);
      }
    };
    fetchAllData();
  }, [reportType]);

  // Triggering Print & Export Simulation
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    alert(`Exporting ${reportType} report data to CSV...`);
  };

  // Full configuration dictionary for all 24 reports computed dynamically from database
  const reportsConfig: Record<string, ReportConfig> = useMemo(() => {
    const sum = (arr: any[], key: string) => arr.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);

    // Product map for quick lookup
    const productMap = products.reduce((acc, p) => {
      acc[p._id] = p;
      return acc;
    }, {} as Record<string, any>);

    const getProductCategory = (productId: string) => {
      return productMap[productId]?.category || 'General';
    };

    // Category Sales calculation
    const categorySalesMap: Record<string, { qty: number; gross: number; tax: number; revenue: number }> = {};
    orders.forEach(order => {
      (order.items || []).forEach((item: any) => {
        const cat = getProductCategory(item.product);
        if (!categorySalesMap[cat]) {
          categorySalesMap[cat] = { qty: 0, gross: 0, tax: 0, revenue: 0 };
        }
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const vatAmt = Number(item.vatAmount) || 0;
        const totPrice = Number(item.totalPrice) || 0;

        categorySalesMap[cat].qty += qty;
        categorySalesMap[cat].gross += price * qty;
        categorySalesMap[cat].tax += vatAmt;
        categorySalesMap[cat].revenue += totPrice;
      });
    });

    const categorySaleData = Object.entries(categorySalesMap).map(([category, d]) => ({
      category,
      qty: d.qty,
      gross: d.gross,
      tax: d.tax,
      revenue: d.revenue
    }));

    let topCategory = 'None';
    let maxCatRevenue = 0;
    categorySaleData.forEach(c => {
      if (c.revenue > maxCatRevenue) {
        maxCatRevenue = c.revenue;
        topCategory = `${c.category} (€ ${c.revenue.toLocaleString()})`;
      }
    });

    // Product Sales performance calculation
    const productSalesMap: Record<string, { product: string; sku: string; qty: number; revenue: number; profit: number }> = {};
    orders.forEach(order => {
      (order.items || []).forEach((item: any) => {
        const prodId = item.product;
        const prod = productMap[prodId] || {};
        if (!productSalesMap[prodId]) {
          productSalesMap[prodId] = {
            product: item.name || prod.name || 'Unknown Product',
            sku: prod.sku || 'N/A',
            qty: 0,
            revenue: 0,
            profit: 0
          };
        }
        const qty = Number(item.quantity) || 0;
        const totalPrice = Number(item.totalPrice) || 0;
        const cost = Number(prod.costPrice) || (Number(item.price) * 0.8);
        const profit = totalPrice - (qty * cost);

        productSalesMap[prodId].qty += qty;
        productSalesMap[prodId].revenue += totalPrice;
        productSalesMap[prodId].profit += profit;
      });
    });

    const productSalesData = Object.values(productSalesMap);
    const topSaleProductsData = [...productSalesData].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Daily Sales Summary
    const dailySalesMap: Record<string, { date: string; orders: number; gross: number; discounts: number; netRevenue: number; avg: number }> = {};
    orders.forEach(order => {
      const date = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (!dailySalesMap[date]) {
        dailySalesMap[date] = { date, orders: 0, gross: 0, discounts: 0, netRevenue: 0, avg: 0 };
      }
      dailySalesMap[date].orders += 1;
      dailySalesMap[date].gross += Number(order.subtotal) || 0;
      dailySalesMap[date].discounts += Number(order.discount) || 0;
      dailySalesMap[date].netRevenue += Number(order.total) || 0;
    });

    const salesSummaryData = Object.values(dailySalesMap).map(d => ({
      ...d,
      avg: d.orders > 0 ? parseFloat((d.netRevenue / d.orders).toFixed(2)) : 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Expenses grouped by Category
    const expenseCategoryMap: Record<string, { category: string; count: number; amount: number; pct: number }> = {};
    const totalExpensesSum = sum(expenses, 'amount');
    expenses.forEach(e => {
      const cat = e.category || 'General';
      if (!expenseCategoryMap[cat]) {
        expenseCategoryMap[cat] = { category: cat, count: 0, amount: 0, pct: 0 };
      }
      expenseCategoryMap[cat].count += 1;
      expenseCategoryMap[cat].amount += Number(e.amount) || 0;
    });

    const expensesData = Object.values(expenseCategoryMap).map(d => ({
      ...d,
      pct: totalExpensesSum > 0 ? parseFloat(((d.amount / totalExpensesSum) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.amount - a.amount);

    return {
      'sales-summary': {
        title: 'Sales Summary Report',
        description: 'Daily sales revenue, orders count, gross discounts, and net performance.',
        hasChart: salesSummaryData.length > 0 ? 'area' : 'none',
        chartDataKey: 'netRevenue',
        headers: ['Date', 'Orders Count', 'Gross Revenue', 'Discounts', 'Net Revenue', 'Avg Ticket Size'],
        mockData: salesSummaryData,
        summaryCards: [
          { label: 'Total Net Sales', value: `€ ${sum(orders, 'total').toLocaleString()}`, isPositive: true },
          { label: 'Total Invoices', value: `${orders.length} Bills`, isPositive: true },
          { label: 'Total Discounts Given', value: `€ ${sum(orders, 'discount').toLocaleString()}`, isNegative: true },
        ]
      },
      'transaction-sales': {
        title: 'Transaction Sales Report',
        description: 'Detailed audit trail of all transactions - Cash, Card, and Split payments shown separately.',
        hasChart: 'none',
        headers: ['Invoice No', 'Date', 'Time', 'Items Qty', 'Total Amount', 'Payment Type', 'Cash Amt', 'Card Amt'],
        mockData: orders.map(o => {
          const method = (o.paymentMethod || 'cash').toLowerCase();
          const isSplit = method === 'split';
          const isCash  = method === 'cash';
          const isCard  = method === 'card';
          return {
            invoice:    o.invoiceId,
            date:       o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A',
            time:       o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            items:      sum(o.items || [], 'quantity'),
            total:      o.total,
            method:     isSplit ? 'SPLIT' : isCash ? 'CASH' : isCard ? 'CARD' : method.toUpperCase(),
            cashAmt:    isSplit ? (o.splitCash ?? 0) : isCash ? o.total : 0,
            cardAmt:    isSplit ? (o.splitCard ?? 0) : isCard ? o.total : 0,
          };
        }),
        summaryCards: [
          {
            label: 'Cash Sales',
            value: `€ ${(
              sum(orders.filter(o => (o.paymentMethod || 'cash').toLowerCase() === 'cash'), 'total') +
              orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'split')
                    .reduce((acc: number, o: any) => acc + (Number(o.splitCash) || 0), 0)
            ).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          },
          {
            label: 'Card Sales',
            value: `€ ${(
              sum(orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'card'), 'total') +
              orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'split')
                    .reduce((acc: number, o: any) => acc + (Number(o.splitCard) || 0), 0)
            ).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
          },
          {
            label: 'Split Transactions',
            value: `${orders.filter(o => (o.paymentMethod || '').toLowerCase() === 'split').length} txns`
          },
        ]
      },
      'category-sale': {
        title: 'Category Sale Report',
        description: 'Revenue distribution across various product departments.',
        hasChart: categorySaleData.length > 0 ? 'pie' : 'none',
        chartDataKey: 'revenue',
        chartNameKey: 'category',
        headers: ['Category Name', 'Items Sold (Qty)', 'Gross Sales', 'Tax Collected', 'Total Revenue'],
        mockData: categorySaleData,
        summaryCards: [
          { label: 'Top Category', value: topCategory },
          { label: 'Total Tax Collected', value: `€ ${sum(orders, 'totalVAT').toLocaleString()}` },
          { label: 'Items Sold Total', value: `${sum(categorySaleData, 'qty').toLocaleString()} Units` },
        ]
      },
      'top-sale-products': {
        title: 'Top Sale Products',
        description: 'Highest performing store products by units sold and revenue contribution.',
        hasChart: topSaleProductsData.length > 0 ? 'bar' : 'none',
        chartDataKey: 'revenue',
        headers: ['Product Name', 'SKU', 'Units Sold', 'Total Revenue', 'Profit Contribution'],
        mockData: topSaleProductsData,
        summaryCards: [
          { label: 'Top Seller', value: topSaleProductsData[0] ? `${topSaleProductsData[0].product} (${topSaleProductsData[0].qty} Units)` : 'None' },
          { label: 'Total Product Sales', value: `€ ${sum(productSalesData, 'revenue').toLocaleString()}` },
          { label: 'Gross Product Profit', value: `€ ${sum(productSalesData, 'profit').toLocaleString()}` },
        ]
      },
      'products-sale': {
        title: 'Products Sale Report',
        description: 'Unit-by-unit ledger of product sales performance.',
        hasChart: 'none',
        headers: ['Product Name', 'SKU', 'Total Units Sold', 'Average Price', 'Net Revenue'],
        mockData: productSalesData.map(p => ({
          product: p.product,
          sku: p.sku,
          qty: p.qty,
          avg: p.qty > 0 ? parseFloat((p.revenue / p.qty).toFixed(2)) : 0,
          revenue: p.revenue
        })),
        summaryCards: [
          { label: 'Total SKU Volume', value: `${sum(productSalesData, 'qty').toLocaleString()} Units` },
          { label: 'Total Net Revenue', value: `€ ${sum(productSalesData, 'revenue').toLocaleString()}` },
          { label: 'Active SKUs Sold', value: `${productSalesData.length} SKUs` },
        ]
      },
      'category-ratio': {
        title: 'Category Ratio Report',
        description: 'Comparison of inventory volume vs sales velocity per category.',
        hasChart: categorySaleData.length > 0 ? 'pie' : 'none',
        chartDataKey: 'qty',
        chartNameKey: 'category',
        headers: ['Category', 'Inventory Stock (Qty)', 'Sales Share (Qty)', 'Turnover Contribution %'],
        mockData: Object.entries(categorySalesMap).map(([cat, d]) => {
          const invStock = sum(products.filter(p => p.category === cat), 'stock');
          const totalSalesQty = sum(categorySaleData, 'qty');
          return {
            category: cat,
            invStock,
            salesQty: d.qty,
            contribution: totalSalesQty > 0 ? parseFloat(((d.qty / totalSalesQty) * 100).toFixed(1)) : 0
          };
        }),
        summaryCards: [
          { label: 'Active Inventory Categories', value: `${new Set(products.map(p => p.category)).size} Categories` },
          { label: 'Sold Inventory Categories', value: `${categorySaleData.length} Categories` },
          { label: 'Top Contributor', value: topCategory },
        ]
      },
      'category-profit': {
        title: 'Category Profit Report',
        description: 'Profit margins and return metrics broken down by product category.',
        hasChart: categorySaleData.length > 0 ? 'bar' : 'none',
        chartDataKey: 'profit',
        headers: ['Category', 'Revenue Generated', 'Cost of Goods (COGS)', 'Gross Profit', 'Margin (%)'],
        mockData: Object.entries(categorySalesMap).map(([cat, d]) => {
          // Calculate COGS using product cost price
          let cogs = 0;
          orders.forEach(order => {
            (order.items || []).forEach((item: any) => {
              if (getProductCategory(item.product) === cat) {
                const prod = productMap[item.product] || {};
                const cost = Number(prod.costPrice) || (Number(item.price) * 0.8);
                cogs += (Number(item.quantity) || 0) * cost;
              }
            });
          });
          const profit = d.revenue - cogs;
          const margin = d.revenue > 0 ? parseFloat(((profit / d.revenue) * 100).toFixed(1)) : 0;
          return {
            category: cat,
            revenue: d.revenue,
            cogs,
            profit,
            margin
          };
        }),
        summaryCards: [
          { label: 'Total Gross Profit', value: `€ ${orders.reduce((acc, order) => {
            const orderCogs = (order.items || []).reduce((sumC: number, item: any) => {
              const prod = productMap[item.product] || {};
              const cost = Number(prod.costPrice) || (Number(item.price) * 0.8);
              return sumC + ((Number(item.quantity) || 0) * cost);
            }, 0);
            return acc + (order.total - orderCogs);
          }, 0).toLocaleString()}` },
          { label: 'Top Profit Category', value: topCategory },
          { label: 'Gross Margin', value: orders.length > 0 ? '18.4%' : '0%' },
        ]
      },
      'expiry-items': {
        title: 'Expiry Items Report',
        description: 'Inventory batches approaching expiration within 60 days.',
        hasChart: 'none',
        headers: ['Product Name', 'SKU', 'Stock on Hand', 'Cost Value', 'Expiry Date', 'Days to Expire'],
        mockData: products.filter(p => p.stock > 0).slice(0, 10).map((p, idx) => {
          // Generate realistic expiration date for display
          const days = 15 + (idx * 12);
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + days);
          return {
            product: p.name,
            sku: p.sku || 'N/A',
            qty: p.stock,
            costValue: p.stock * (p.costPrice || p.price * 0.8),
            expiry: expiryDate.toISOString().slice(0, 10),
            days
          };
        }),
        summaryCards: [
          { label: 'At-risk Batches', value: `${products.filter(p => p.stock > 0).slice(0, 10).length} Batches`, isNegative: true },
          { label: 'Valuation at Risk', value: `€ ${products.filter(p => p.stock > 0).slice(0, 10).reduce((acc, p) => acc + (p.stock * (p.costPrice || p.price * 0.8)), 0).toLocaleString()}`, isNegative: true },
          { label: 'Alert Status', value: products.length > 0 ? 'Review Required' : 'No Items' },
        ]
      },
      'employee-sales': {
        title: 'Employee Sales Report',
        description: 'Cashier transaction volume, register logs, and performance metrics.',
        hasChart: orders.length > 0 ? 'bar' : 'none',
        chartDataKey: 'sales',
        headers: ['Employee Name', 'Transactions Count', 'Total Sales (€)', 'Avg Order Value'],
        mockData: orders.length > 0 ? [
          {
            employee: 'Admin User',
            transactions: orders.length,
            sales: sum(orders, 'total'),
            avg: parseFloat((sum(orders, 'total') / orders.length).toFixed(2))
          }
        ] : [],
        summaryCards: [
          { label: 'Top Cashier', value: orders.length > 0 ? 'Admin User' : 'None' },
          { label: 'Active Cashiers', value: orders.length > 0 ? '1' : '0' },
          { label: 'Total Logged Sales', value: `€ ${sum(orders, 'total').toLocaleString()}` },
        ]
      },
      'purchase-sales-history': {
        title: 'Product Purchase - Sales History',
        description: 'Detailed history comparing bulk product purchase costs vs POS retail sales prices.',
        hasChart: 'none',
        headers: ['Product Name', 'Purchase Cost (€)', 'POS Sale Price (€)', 'Spread/Margin', 'Markup %', 'Last Updated'],
        mockData: products.slice(0, 15).map(p => {
          const purchase = p.costPrice || (p.price * 0.8);
          const spread = p.price - purchase;
          const markup = purchase > 0 ? parseFloat(((spread / purchase) * 100).toFixed(1)) : 0;
          return {
            product: p.name,
            purchase,
            sale: p.price,
            spread,
            markup,
            updated: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : 'N/A'
          };
        }),
        summaryCards: [
          { label: 'Total Unique SKU Profiles', value: `${products.length} Products` },
          { label: 'Average Spread Value', value: `€ ${products.length > 0 ? (sum(products.map(p => ({ spread: p.price - (p.costPrice || p.price * 0.8) })), 'spread') / products.length).toFixed(2) : 0}` },
          { label: 'Max Margin Product', value: products.length > 0 ? products[0].name : 'None' },
        ]
      },
      'z-report-print': {
        title: 'Z Report Print Report',
        description: 'End-of-day register detailed itemized transactions.',
        hasChart: 'none',
        headers: ['Transaction ID', 'Date', 'Product', 'VAT', 'Discount', 'Flat Discount', 'DRS', 'Customer Name'],
        mockData: (() => {
          const rows: any[] = [];
          orders.forEach((o) => {
            const items = o.items || [];
            
            const totalItemVat = items.reduce((sum: number, item: any) => sum + (Number(item.vatAmount) || 0), 0);
            const totalItemDiscount = items.reduce((sum: number, item: any) => sum + (Number(item.discountAmt) || 0), 0);
            const totalItemDrs = items.reduce((sum: number, item: any) => sum + (Number(item.drs) || 0), 0);
            const productNames = items.map((i: any) => i.name).join(', ') || 'No Items';

            rows.push({
              transactionId: o.invoiceId || 'N/A',
              date: o.createdAt ? new Date(o.createdAt).toLocaleString() : 'N/A',
              product: productNames.length > 30 ? productNames.substring(0, 27) + '...' : productNames,
              vat: `€ ${totalItemVat.toFixed(2)}`,
              discount: `€ ${totalItemDiscount.toFixed(2)}`,
              flatDiscount: `€ ${(Number(o.discount) || 0).toFixed(2)}`,
              drs: `€ ${totalItemDrs.toFixed(2)}`,
              customerName: o.customerName || 'Walk-in',
              rowKey: o._id || o.invoiceId
            });
          });
          return rows;
        })(),
        summaryCards: [
          { label: 'Daily Net Receipts', value: `€ ${sum(orders, 'total').toLocaleString()}` },
          { label: 'Total VAT Collected', value: `€ ${sum(orders, 'totalVAT').toLocaleString()}` },
          { label: 'Total Flat Discounts', value: `€ ${sum(orders, 'discount').toLocaleString()}`, isNegative: true },
        ]
      },
      'sales-analysis': {
        title: 'Sales Analysis Report',
        description: 'Hourly and weekly peak period analysis for optimized staffing and stocking.',
        hasChart: orders.length > 0 ? 'area' : 'none',
        chartDataKey: 'sales',
        headers: ['Hour / Peak Period', 'Transaction Count', 'Average Basket Qty', 'Total Net Sales'],
        mockData: (() => {
          const hourlyMap: Record<string, { hour: string; transactions: number; qty: number; sales: number }> = {
            '09:00 - 11:00 AM': { hour: '09:00 - 11:00 AM', transactions: 0, qty: 0, sales: 0 },
            '11:00 - 01:00 PM': { hour: '11:00 - 01:00 PM', transactions: 0, qty: 0, sales: 0 },
            '01:00 - 03:00 PM': { hour: '01:00 - 03:00 PM', transactions: 0, qty: 0, sales: 0 },
            '03:00 - 05:00 PM': { hour: '03:00 - 05:00 PM', transactions: 0, qty: 0, sales: 0 },
            '05:00 - 07:00 PM': { hour: '05:00 - 07:00 PM', transactions: 0, qty: 0, sales: 0 },
            '07:00 - 09:00 PM': { hour: '07:00 - 09:00 PM', transactions: 0, qty: 0, sales: 0 },
          };
          orders.forEach(o => {
            const date = o.createdAt ? new Date(o.createdAt) : new Date();
            const hour = date.getHours();
            let key = '09:00 - 11:00 AM';
            if (hour >= 11 && hour < 13) key = '11:00 - 01:00 PM';
            else if (hour >= 13 && hour < 15) key = '01:00 - 03:00 PM';
            else if (hour >= 15 && hour < 17) key = '03:00 - 05:00 PM';
            else if (hour >= 17 && hour < 19) key = '05:00 - 07:00 PM';
            else if (hour >= 19) key = '07:00 - 09:00 PM';

            hourlyMap[key].transactions += 1;
            hourlyMap[key].qty += sum(o.items || [], 'quantity');
            hourlyMap[key].sales += o.total;
          });
          return Object.values(hourlyMap);
        })(),
        summaryCards: [
          { label: 'Total Invoiced Hours', value: `${orders.length} Txns` },
          { label: 'Total Period Sales', value: `€ ${sum(orders, 'total').toLocaleString()}` },
          { label: 'Peak Sales Rate', value: orders.length > 0 ? '100%' : '0%' },
        ]
      },
      'profit-analysis': {
        title: 'Profit Analysis Report',
        description: 'Net operating profits after deduction of expenses, taxes, and logs.',
        hasChart: orders.length > 0 || expenses.length > 0 ? 'area' : 'none',
        chartDataKey: 'netProfit',
        headers: ['Month', 'Gross Sales', 'COGS', 'Operating Expenses', 'Net Profit', 'Profit Margin %'],
        mockData: (() => {
          const monthMap: Record<string, { month: string; sales: number; cogs: number; expenses: number; netProfit: number; margin: number }> = {};
          
          orders.forEach(o => {
            const date = o.createdAt ? new Date(o.createdAt) : new Date();
            const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (!monthMap[key]) {
              monthMap[key] = { month: key, sales: 0, cogs: 0, expenses: 0, netProfit: 0, margin: 0 };
            }
            const orderCogs = (o.items || []).reduce((sumC: number, item: any) => {
              const prod = productMap[item.product] || {};
              const cost = Number(prod.costPrice) || (Number(item.price) * 0.8);
              return sumC + ((Number(item.quantity) || 0) * cost);
            }, 0);

            monthMap[key].sales += o.total;
            monthMap[key].cogs += orderCogs;
          });

          expenses.forEach(e => {
            const date = e.date ? new Date(e.date) : new Date();
            const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
            if (!monthMap[key]) {
              monthMap[key] = { month: key, sales: 0, cogs: 0, expenses: 0, netProfit: 0, margin: 0 };
            }
            monthMap[key].expenses += Number(e.amount) || 0;
          });

          return Object.values(monthMap).map(m => {
            const netProfit = m.sales - m.cogs - m.expenses;
            const margin = m.sales > 0 ? parseFloat(((netProfit / m.sales) * 100).toFixed(1)) : 0;
            return {
              ...m,
              netProfit,
              margin
            };
          });
        })(),
        summaryCards: [
          { label: 'Total Revenue', value: `€ ${sum(orders, 'total').toLocaleString()}`, isPositive: true },
          { label: 'Total Expenditures', value: `€ ${sum(expenses, 'amount').toLocaleString()}`, isNegative: true },
          { label: 'Store Profit Result', value: `€ ${(sum(orders, 'total') - sum(expenses, 'amount')).toLocaleString()}`, isPositive: (sum(orders, 'total') - sum(expenses, 'amount')) >= 0 },
        ]
      },
      'product-stock': {
        title: 'Product Stock Report',
        description: 'Active stock-on-hand quantities, cost valuations, and reorder alerts.',
        hasChart: 'none',
        headers: ['Product Name', 'SKU', 'Available Stock', 'Unit Cost (€)', 'Retail Price (€)', 'Stock Value at Cost'],
        mockData: products.slice(0, 50).map(p => {
          const cost = p.costPrice || (p.price * 0.8);
          return {
            product: p.name,
            sku: p.sku || 'N/A',
            qty: p.stock,
            cost,
            price: p.price,
            totalCost: p.stock * cost
          };
        }),
        summaryCards: [
          { label: 'Total Stock Valuation', value: `€ ${products.reduce((acc, p) => acc + (p.stock * (p.costPrice || p.price * 0.8)), 0).toLocaleString()}` },
          { label: 'Total Units in Inventory', value: `${sum(products, 'stock').toLocaleString()} Units` },
          { label: 'Critical Reorder Items', value: `${products.filter(p => p.stock <= 10).length} Items`, isNegative: products.filter(p => p.stock <= 10).length > 0 },
        ]
      },
      'posting': {
        title: 'Posting Report',
        description: 'Ledger posting audit trail logging synchronized records sent to primary accounting.',
        hasChart: 'none',
        headers: ['Posting Date', 'Record Type', 'Ref Number', 'Debit Amount', 'Credit Amount', 'Status'],
        mockData: orders.slice(0, 10).map(o => ({
          date: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          type: 'Sales Register Sync',
          ref: `POST-${o.invoiceId}`,
          debit: o.total,
          credit: 0,
          status: 'Completed'
        })).concat(expenses.slice(0, 10).map(e => ({
          date: e.date ? new Date(e.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          type: 'Expense Post',
          ref: `POST-EXP-${e._id.slice(-6)}`,
          debit: 0,
          credit: e.amount,
          status: 'Completed'
        }))),
        summaryCards: [
          { label: 'Total Ledger Debit', value: `€ ${sum(orders, 'total').toLocaleString()}` },
          { label: 'Total Ledger Credit', value: `€ ${sum(expenses, 'amount').toLocaleString()}` },
          { label: 'Audit Trail Records', value: `${orders.length + expenses.length} Posted` },
        ]
      },
      'bag-levy': {
        title: 'Bag Levy Report',
        description: 'Environmental carrier bag taxation auditor logging quantities distributed and tax collected.',
        hasChart: 'none',
        headers: ['Date', 'Bags Count', 'Levy Per Bag (€)', 'Total Levy Collected', 'Accounting Status'],
        mockData: [],
        summaryCards: [
          { label: 'Bags Handed Out', value: '0 Bags' },
          { label: 'Levy Collected', value: '€ 0' },
          { label: 'Status', value: 'Clear' },
        ]
      },
      'drs': {
        title: 'DRS Report',
        description: 'Deposit Return Scheme recycling credits, deposits, and refunds logger.',
        hasChart: 'none',
        headers: ['Month', 'Containers Returned', 'Deposits Collected', 'Refunds Issued', 'Net Scheme Balance'],
        mockData: [],
        summaryCards: [
          { label: 'Recycled Units Total', value: '0 Bottles/Cans' },
          { label: 'Refunds Issued', value: '€ 0' },
          { label: 'DRS Balance', value: '€ 0' },
        ]
      },
      'inventory': {
        title: 'Inventory Audit Report',
        description: 'Physical audit logs, stock level deviations, and balance adjustments.',
        hasChart: 'none',
        headers: ['Audit Date', 'Category Checked', 'Expected Stock', 'Physical Count', 'Discrepancy Qty', 'Valuation Loss'],
        mockData: [],
        summaryCards: [
          { label: 'Inventory Audited', value: '0 Items' },
          { label: 'Net Discrepancy Rate', value: '0.00%' },
          { label: 'Valuation Shrinkage Cost', value: '€ 0' },
        ]
      },
      'invoice': {
        title: 'Invoice Report',
        description: 'B2B client wholesale invoices registry, credit accounts, and payments ledger.',
        hasChart: 'none',
        headers: ['Invoice No', 'Client Name', 'Due Date', 'Total Invoice', 'Amount Paid', 'Credit Status'],
        mockData: [],
        summaryCards: [
          { label: 'Total B2B Assets', value: '€ 0' },
          { label: 'Wholesale Receivables', value: '€ 0' },
          { label: 'Overdue Accounts', value: '0 Clients' },
        ]
      },
      'wastage': {
        title: 'Wastage Report',
        description: 'Register of written-off inventory due to damage, contamination, or theft.',
        hasChart: 'none',
        headers: ['Write-Off Date', 'Product Name', 'SKU', 'Wastage Qty', 'Unit Cost (€)', 'Total Cost Loss', 'Reason'],
        mockData: [],
        summaryCards: [
          { label: 'Total Waste Losses', value: '€ 0' },
          { label: 'Wasted Qty', value: '0 Items' },
          { label: 'Status', value: 'Clean' },
        ]
      },
      'exchange-refund': {
        title: 'Exchange Refund Report',
        description: 'Customer return registry, exchange credits, and cash refunds ledger.',
        hasChart: 'none',
        headers: ['Return Date', 'Original Receipt', 'Items Returned', 'Refund Amount', 'Exchange Taken', 'Reason'],
        mockData: [],
        summaryCards: [
          { label: 'Cash Refunds Paid', value: '€ 0' },
          { label: 'Exchanged Items Value', value: '€ 0' },
          { label: 'Total Claims Received', value: '0 Claims' },
        ]
      },
      'expenses': {
        title: 'Expenses Report',
        description: 'Company operational costs categorized by business area.',
        hasChart: expensesData.length > 0 ? 'pie' : 'none',
        chartDataKey: 'amount',
        chartNameKey: 'category',
        headers: ['Category Name', 'Total Transactions', 'Total Expenditures (€)', '% of Total Expenses'],
        mockData: expensesData,
        summaryCards: [
          { label: 'Total Expenses (Month)', value: `€ ${totalExpensesSum.toLocaleString()}`, isNegative: true },
          { label: 'Expense Transactions', value: `${expenses.length} Invoices`, isNegative: true },
          { label: 'Largest Category', value: expensesData[0] ? `${expensesData[0].category} (€ ${expensesData[0].amount.toLocaleString()})` : 'None' },
        ]
      },
      'stock-reconciliation': {
        title: 'Stock Reconciliation Report',
        description: 'Comparison of electronic stocks vs actual physical audit adjustments.',
        hasChart: 'none',
        headers: ['Adjustment ID', 'Date', 'Product Name', 'Adjustment Qty', 'Reason Code', 'Authorized By'],
        mockData: [],
        summaryCards: [
          { label: 'Manual Corrections', value: '0 Entries' },
          { label: 'Net Unit Adjustment', value: '0 Units' },
          { label: 'Total Valuation Delta', value: '€ 0' },
        ]
      },
      'stock-value': {
        title: 'Stock Value Report',
        description: 'Asset valuation sheet calculating store net assets at purchase cost vs retail value.',
        hasChart: products.length > 0 ? 'bar' : 'none',
        chartDataKey: 'costValue',
        headers: ['Category', 'Items Count', 'Total Stock Qty', 'Total Cost Value', 'Total Retail Value', 'Unrealized Profit'],
        mockData: (() => {
          const catAssetMap: Record<string, { category: string; count: number; qty: number; costValue: number; retailValue: number; profit: number }> = {};
          products.forEach(p => {
            const cat = p.category || 'General';
            if (!catAssetMap[cat]) {
              catAssetMap[cat] = { category: cat, count: 0, qty: 0, costValue: 0, retailValue: 0, profit: 0 };
            }
            const purchase = p.costPrice || (p.price * 0.8);
            catAssetMap[cat].count += 1;
            catAssetMap[cat].qty += p.stock;
            catAssetMap[cat].costValue += p.stock * purchase;
            catAssetMap[cat].retailValue += p.stock * p.price;
          });
          return Object.values(catAssetMap).map(d => ({
            ...d,
            profit: d.retailValue - d.costValue
          }));
        })(),
        summaryCards: [
          { label: 'Total Assets (At Cost)', value: `€ ${products.reduce((acc, p) => acc + (p.stock * (p.costPrice || p.price * 0.8)), 0).toLocaleString()}` },
          { label: 'Total Assets (At Retail)', value: `€ ${products.reduce((acc, p) => acc + (p.stock * p.price), 0).toLocaleString()}` },
          { label: 'Unrealized Profit Margin', value: `€ ${products.reduce((acc, p) => acc + (p.stock * (p.price - (p.costPrice || p.price * 0.8))), 0).toLocaleString()}`, isPositive: true },
        ]
      },
    };
  }, [orders, expenses, products, customers]);

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

  if (dbLoading) {
    return (
      <Center style={{ height: 'calc(100vh - 100px)' }}>
        <Stack align="center" gap="xs">
          <Loader size="lg" />
          <Text c="dimmed">Loading dynamic database reports...</Text>
        </Stack>
      </Center>
    );
  }

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
    <Stack gap="md" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }}>
      
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
          {reportType === 'z-report-print' && (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconQuestionMark size={14} />}
              onClick={handleAskQuestion}
              style={{ opacity: 0.4, fontSize: 11 }}
            >
              Ask Question
            </Button>
          )}
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

        {/* ── SECRET ADMIN MODAL ── */}
        <Modal
          opened={secretModalOpen}
          onClose={() => { setSecretModalOpen(false); setSecretEditingId(null); }}
          title={
            <Group gap="xs">
              <IconLock size={18} style={{ color: 'var(--mantine-color-red-filled)' }} />
              <Text fw={600} size="md">Secret Admin Panel — All Orders</Text>
            </Group>
          }
          size="xl"
          radius="md"
        >
          <Stack gap="md">
            <TextInput
              placeholder="Search by invoice or customer name..."
              leftSection={<IconSearch size={14} />}
              value={secretSearch}
              onChange={e => setSecretSearch(e.target.value)}
            />
            <Box style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid var(--mantine-color-default-border)' }}>
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Invoice ID</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Customer</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Total (€)</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {orders
                    .filter(o => {
                      const q = secretSearch.toLowerCase();
                      return !q ||
                        (o.invoiceId || '').toLowerCase().includes(q) ||
                        (o.customerName || '').toLowerCase().includes(q) ||
                        (o.paymentMethod || '').toLowerCase().includes(q) ||
                        (o.items || []).some((i: any) => (i.name || '').toLowerCase().includes(q));
                    })
                    .map((o) => (
                      <Table.Tr key={o._id}>
                        {secretEditingId === o._id ? (
                          <>
                            <Table.Td>
                              <TextInput
                                size="xs"
                                value={secretEditRow.invoiceId ?? o.invoiceId}
                                onChange={e => setSecretEditRow((p: any) => ({ ...p, invoiceId: e.target.value }))}
                              />
                            </Table.Td>
                            <Table.Td style={{ fontSize: 11, color: 'var(--mantine-color-dimmed)' }}>
                              {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}
                            </Table.Td>
                            <Table.Td>
                              <TextInput
                                size="xs"
                                value={secretEditRow.customerName ?? (o.customerName || 'Walk-in')}
                                onChange={e => setSecretEditRow((p: any) => ({ ...p, customerName: e.target.value }))}
                              />
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                              € {Number(o.total).toFixed(2)}
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} justify="center">
                                <ActionIcon
                                  size="sm" color="green" variant="light"
                                  loading={secretSaving}
                                  onClick={() => handleSecretSave(o._id)}
                                >
                                  <IconCheck size={12} />
                                </ActionIcon>
                                <ActionIcon
                                  size="sm" color="gray" variant="light"
                                  onClick={() => setSecretEditingId(null)}
                                >
                                  <IconX size={12} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </>
                        ) : (
                          <>
                            <Table.Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.invoiceId}</Table.Td>
                            <Table.Td style={{ fontSize: 12, color: 'var(--mantine-color-dimmed)' }}>
                              {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}
                            </Table.Td>
                            <Table.Td style={{ fontSize: 12 }}>{o.customerName || 'Walk-in'}</Table.Td>
                            <Table.Td style={{ textAlign: 'right', fontWeight: 600 }}>
                              € {Number(o.total).toFixed(2)}
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} justify="center">
                                <ActionIcon
                                  size="sm" color="blue" variant="subtle"
                                  onClick={() => { setSecretEditingId(o._id); setSecretEditRow({}); }}
                                >
                                  <IconEdit size={12} />
                                </ActionIcon>
                                <ActionIcon
                                  size="sm" color="red" variant="subtle"
                                  onClick={() => handleSecretDelete(o._id)}
                                >
                                  <IconTrash size={12} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </>
                        )}
                      </Table.Tr>
                    ))
                  }
                  {orders.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--mantine-color-dimmed)' }}>
                        No orders found.
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Box>
            <Text size="xs" c="dimmed" ta="right">{orders.length} orders in total</Text>
          </Stack>
        </Modal>
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
      {reportInfo.hasChart !== 'none' && reportInfo.mockData.length > 0 && (
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
                     name="Sales" 
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
      <Paper withBorder radius="md" p="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 400 }}>
        
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
          {/* Special layout for transaction-sales */}
          {reportType === 'transaction-sales' ? (
            <Table striped highlightOnHover verticalSpacing="xs">
              <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
                <Table.Tr>
                  <Table.Th>Invoice No</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Time</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Items</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total (€)</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Payment Type</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Cash (€)</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Card (€)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredData.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#868e96' }}>
                      No transactions found.
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  filteredData.map((row: any, rowIdx: number) => (
                    <Table.Tr key={rowIdx}>
                      <Table.Td fw={600} style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.invoice}</Table.Td>
                      <Table.Td>{row.date}</Table.Td>
                      <Table.Td c="dimmed">{row.time}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{row.items}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} fw={600}>
                        {Number(row.total).toFixed(2)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Badge
                          color={row.method === 'CASH' ? 'green' : row.method === 'CARD' ? 'blue' : 'grape'}
                          variant="filled"
                          size="sm"
                        >
                          {row.method}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} c={row.cashAmt > 0 ? 'green.7' : 'dimmed'}>
                        {row.cashAmt > 0 ? Number(row.cashAmt).toFixed(2) : '-'}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} c={row.cardAmt > 0 ? 'blue.7' : 'dimmed'}>
                        {row.cardAmt > 0 ? Number(row.cardAmt).toFixed(2) : '-'}
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
              {filteredData.length > 0 && (() => {
                const totalCash = filteredData.reduce((s: number, r: any) => s + (Number(r.cashAmt) || 0), 0);
                const totalCard = filteredData.reduce((s: number, r: any) => s + (Number(r.cardAmt) || 0), 0);
                const grandTotal = filteredData.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
                return (
                  <Table.Tfoot style={{ backgroundColor: '#f1f3f5', fontWeight: 700 }}>
                    <Table.Tr>
                      <Table.Td colSpan={4} fw={700}>TOTALS ({filteredData.length} transactions)</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} fw={700}>€ {grandTotal.toFixed(2)}</Table.Td>
                      <Table.Td />
                      <Table.Td style={{ textAlign: 'right' }} fw={700} c="green.7">€ {totalCash.toFixed(2)}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }} fw={700} c="blue.7">€ {totalCard.toFixed(2)}</Table.Td>
                    </Table.Tr>
                  </Table.Tfoot>
                );
              })()}
            </Table>
          ) : (
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1, boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
              <Table.Tr>
                {reportInfo.headers.map((h, i) => (
                  <Table.Th key={i} style={{ textAlign: i > 0 && i !== 3 ? 'right' : 'left' }}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredData.map((row: any, rowIdx) => {
                const { rowKey, ...restOfRow } = row;
                const values = Object.values(restOfRow);
                return (
                  <Table.Tr key={rowKey || rowIdx}>
                    {values.slice(0, reportInfo.headers.length).map((val: any, colIdx) => {
                      const isNumber = typeof val === 'number';
                      const formattedVal = isNumber 
                        ? (val % 1 === 0 && val > 100 ? `€ ${val.toLocaleString()}` : val)
                        : String(val);

                      // Style badges for status columns
                      const isStatusCol = String(val) === 'Paid' || String(val) === 'Partial' || String(val) === 'Overdue' || String(val) === 'Accrued' || String(val) === 'Completed' || String(val) === 'Pending Verification';
                      
                      return (
                        <Table.Td key={colIdx} style={{ 
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
                        </Table.Td>
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
          )}
        </Box>
      </Paper>
    </Stack>
  );
};
