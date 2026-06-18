import {
  Grid, Paper, Text, Flex, TextInput, Table, Tabs, Select, Button,
  Box, Checkbox, Modal, SimpleGrid, NumberInput, Divider, Autocomplete, ActionIcon
} from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../services/api';
import { fetchQuickProducts, loadQuickProducts, type QuickProductButton } from '../products/QuickProducts';
import SyncButton from '../sync/SyncButton';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

const resolveProductImageUrl = (image?: string | null): string | null => {
  if (!image) return null;
  const driveId = image.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || image.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
  if (image.startsWith('http')) return image;
  if (image.startsWith('/')) return `${API_ORIGIN}${image}`;
  return `${API_ORIGIN}/uploads/products/${image}`;
};

interface CartItem {
  id: string;
  product?: string;
  name: string;
  barcode: string;
  qty: number;
  price: number;
  stock?: number;
  originalPrice?: number;
  discountPct?: number;
  discountAmt?: number;
  drs?: number;
}

interface Transaction {
  transactionNo: number;
  items: CartItem[];
  subTotal: number;
  deposit: number;
  total: number;
  date: string;
  paymentMethod: string;
  discount?: number;
  totalDRS?: number;
}

interface CustomerCart {
  id: string;
  name: string;
  items: CartItem[];
  selectedItemId: string;
  customerId?: string;
  customerPhone?: string;
}

interface StagingItem {
  id?: string;
  product?: string;
  name: string;
  barcode: string;
  qty: number | string;
  price: number | string;
  stock?: number;
  originalPrice?: number;
  discountPct?: number;
  discountAmt?: number;
  drs?: number;
}

// Read active offers from localStorage
interface Offer {
  id: string;
  code: string;
  type: string;   // 'Category Discount' | 'Flat Percentage' | 'BOGO Free'
  target: string; // category name or product name
  value: number;  // discount %
  status: string; // 'Active' | 'Inactive'
}

const getActiveOffers = (): Offer[] => {
  try {
    const saved = localStorage.getItem('customProductOffers');
    if (!saved) return [];
    return JSON.parse(saved).filter((o: Offer) => o.status === 'Active');
  } catch {
    return [];
  }
};

// Find best applicable discount for a product
const getDiscountForProduct = (productName: string, category: string): { pct: number; label: string } => {
  const offers = getActiveOffers();
  let bestPct = 0;
  let bestLabel = '';

  const normName = productName.trim().toLowerCase();
  const normCat = category.trim().toLowerCase();

  for (const offer of offers) {
    const target = (offer.target || '').trim().toLowerCase();
    const pct = Math.min(Number(offer.value) || 0, 100);
    if (pct <= 0) continue;

    const matchesCategory =
      (offer.type === 'Category Discount' || offer.type === 'Flat Percentage') &&
      normCat === target;
    const matchesProduct = normName === target;
    const partialCatMatch =
      (offer.type === 'Category Discount' || offer.type === 'Flat Percentage') &&
      (normCat.includes(target) || target.includes(normCat));

    if ((matchesCategory || matchesProduct || partialCatMatch) && pct > bestPct) {
      bestPct = pct;
      bestLabel = `${offer.code} (${pct}% off)`;
    }
  }

  return { pct: bestPct, label: bestLabel };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [carts, setCarts] = useState<CustomerCart[]>([
    { id: 'customer1', name: 'CUSTOMER 1', items: [], selectedItemId: '' },
    { id: 'customer2', name: 'CUSTOMER 2', items: [], selectedItemId: '' },
    { id: 'customer3', name: 'CUSTOMER 3', items: [], selectedItemId: '' }
  ]);
  const [activeCartId, setActiveCartId] = useState<string>('customer1');

  const [transactionNo, setTransactionNo] = useState<number>(1);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  const [stagingItem, setStagingItem] = useState<StagingItem>({ name: '', barcode: '', qty: '', price: '' });

  const [apiCategories, setApiCategories] = useState<{ name: string; vatRate: number; vatType: string; loyaltyPoints?: number }[]>([]);
  const [categoryModalOpened, setCategoryModalOpened] = useState(false);
  const [optionsModalOpened, setOptionsModalOpened] = useState(false);
  const [voidModalOpened, setVoidModalOpened] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [voidReason, setVoidReason] = useState<string>('');
  const [openedCategoryName, setOpenedCategoryName] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryDbProducts, setCategoryDbProducts] = useState<any[]>([]);
  const [categoryDbLoading, setCategoryDbLoading] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [productNameSearch, setProductNameSearch] = useState('');
  const [productNameResults, setProductNameResults] = useState<{ value: string; _id: string; barcode: string; price: number; category: string; vatRate: number; vatType: string; stock: number }[]>([]);
  const productNameResultsRef = useRef<{ value: string; _id: string; barcode: string; price: number; category: string; vatRate: number; vatType: string; stock: number }[]>([]);
  const [activeProductIndex, setActiveProductIndex] = useState<number>(-1);
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [quickSaveModalOpened, setQuickSaveModalOpened] = useState(false);
  const [quickSaveName, setQuickSaveName] = useState('');
  const [quickSavePhone, setQuickSavePhone] = useState('');
  const [quickSaveLoading, setQuickSaveLoading] = useState(false);

  const [quickProductModalOpened, setQuickProductModalOpened] = useState(false);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductSku, setQuickProductSku] = useState('');
  const [quickProductBarcode, setQuickProductBarcode] = useState('');
  const [quickProductCategory, setQuickProductCategory] = useState('FISH AND SEAFOOD');
  const [quickProductPrice, setQuickProductPrice] = useState<number | string>(0);
  const [quickProductCostPrice, setQuickProductCostPrice] = useState<number | string>(0);
  const [quickProductVatRate, setQuickProductVatRate] = useState<number | string>(0);
  const [quickProductVatType, setQuickProductVatType] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [quickProductStock, setQuickProductStock] = useState<number | string>(10);
  const [quickProductLoading, setQuickProductLoading] = useState(false);

  const [payDuesModalOpened, setPayDuesModalOpened] = useState(false);
  const [showOffersModalOpened, setShowOffersModalOpened] = useState(false);
  const [openTillModalOpened, setOpenTillModalOpened] = useState(false);
  const [payBillModalOpened, setPayBillModalOpened] = useState(false);
  const [payBillMethod, setPayBillMethod] = useState<string>('MIXED');
  const [enablePrinting, setEnablePrinting] = useState(true);
  const [calculatorValue, setCalculatorValue] = useState('0');
  const [quickProducts, setQuickProducts] = useState<QuickProductButton[]>(() => loadQuickProducts());

  // Helper to find a customer match across several fields (case‑insensitive)
  const findCustomerMatch = (val: string) => {
    const trimmed = val.trim();
    const lowered = trimmed.toLowerCase();
    return dbCustomers.find(c =>
      `${c.name} (${c.contactNum1})`.toLowerCase() === lowered ||
      c.name.toLowerCase() === lowered ||
      c.contactNum1 === trimmed ||
      (c.contactNum2 && c.contactNum2 === trimmed) ||
      (c.email && c.email.toLowerCase() === lowered) ||
      (c.eircode && c.eircode.toLowerCase() === lowered)
    );
  };

  // Split payment state
  const [splitModalOpened, setSplitModalOpened] = useState(false);
  const [splitCashAmount, setSplitCashAmount] = useState<number | string>('');
  const [splitCardAmount, setSplitCardAmount] = useState<number | string>('');

  // Employee state
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  useEffect(() => {
    const fetchDbData = async () => {
      try {
        const [custRes, orderRes, empRes, catRes] = await Promise.all([
          api.get('/customers'),
          api.get('/orders'),
          api.get('/employees'),
          api.get('/categories'),
        ]);
        setDbCustomers(custRes.data.data || []);
        setOrders(orderRes.data.data || []);
        setApiCategories((catRes.data.data || []).map((c: any) => ({
          name: c.name, vatRate: c.vatRate ?? 0, vatType: c.vatType ?? 'exclusive', loyaltyPoints: c.loyaltyPoints ?? 0,
        })));
        const empList = (empRes.data.data || []).map((e: any) => ({
          value: e._id,
          label: `${e.name}${e.role ? ` (${e.role})` : ''}`,
        }));
        setEmployees(empList);
        if (empList.length > 0) setSelectedEmployee(empList[0].value);
      } catch (err) {
        console.error("Failed to fetch initial POS data", err);
      }
    };
    fetchDbData();
  }, []);

  useEffect(() => {
    fetchQuickProducts().then(setQuickProducts);
  }, [location.pathname]);

  useEffect(() => {
    const refreshQuickProducts = () => {
      fetchQuickProducts().then(setQuickProducts);
    };
    window.addEventListener('quick-products-updated', refreshQuickProducts);
    window.addEventListener('focus', refreshQuickProducts);
    return () => {
      window.removeEventListener('quick-products-updated', refreshQuickProducts);
      window.removeEventListener('focus', refreshQuickProducts);
    };
  }, []);

  // Load last transaction and transaction count from the database on mount
  useEffect(() => {
    const loadLastOrder = async () => {
      try {
        const { data } = await api.get('/orders');
        const orders = data.data || [];
        if (orders.length > 0) {
          const lastOrder = orders[0]; // Most recent (sorted by createdAt desc)
          setLastTransaction({
            transactionNo: orders.length,
            items: (lastOrder.items || []).map((item: any) => ({
              id: item._id || Date.now().toString(),
              name: item.name,
              barcode: '',
              qty: item.quantity,
              price: item.price,
              originalPrice: item.price + (item.discountAmt || 0) / (item.quantity || 1),
              discountPct: item.discountPct || 0,
              discountAmt: item.discountAmt ? (item.discountAmt / item.quantity) : 0,
              drs: item.drs || 0,
            })),
            subTotal: lastOrder.subtotal,
            deposit: 0,
            total: lastOrder.total,
            date: new Date(lastOrder.createdAt).toLocaleString(),
            paymentMethod: lastOrder.paymentMethod || 'MIXED',
            discount: lastOrder.discount || 0,
            totalDRS: lastOrder.totalDRS || 0,
          });
          setTransactionNo(orders.length + 1);
        }
      } catch (err) {
        console.error('Failed to load last order from database', err);
      }
    };
    loadLastOrder();
  }, []);

  const handleBarcodeSubmit = async () => {
    if (!barcodeSearch.trim()) return;
    try {
      const { data } = await api.get(`/products?search=${barcodeSearch}`);
      const product = (data.data || []).find((p: any) => p.barcode === barcodeSearch.trim());

      if (product) {
        // Read latest catalog discount percentages directly from localStorage
        const savedDiscounts = localStorage.getItem('productDiscounts');
        const productDiscounts = savedDiscounts ? JSON.parse(savedDiscounts) : {};
        const catalogDiscountPct = productDiscounts[product._id] || 0;

        // Retrieve offer discount
        const offerDiscount = getDiscountForProduct(product.name, product.category || '');

        // Find max discount percentage
        const discountPct = Math.max(offerDiscount.pct, catalogDiscountPct);

        // Calculate discounted price
        const discountedPrice = parseFloat((product.price * (1 - discountPct / 100)).toFixed(2));

        const drs = product.drs || 0;
        const discountAmt = parseFloat((product.price * (discountPct / 100)).toFixed(2));

        const newItem: CartItem = {
          id: Date.now().toString(),
          product: product._id,
          name: product.name,
          barcode: product.barcode,
          qty: 1,
          price: discountedPrice,
          stock: product.stock,
          originalPrice: product.price,
          discountPct: discountPct,
          discountAmt: discountAmt,
          drs: drs,
        };
        updateCartItems([...cartItems, newItem]);
        updateSelectedItemId(newItem.id);
        setStagingItem({ id: newItem.id, product: newItem.product, name: newItem.name, barcode: newItem.barcode, qty: 1, price: newItem.price, stock: newItem.stock, originalPrice: product.price, discountPct, discountAmt, drs });
        setBarcodeSearch('');

        if (discountPct > 0) {
          notifications.show({
            title: 'Discount Applied!',
            message: `${discountPct}% discount applied to ${product.name}. Price: € ${discountedPrice.toFixed(2)}`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          });
        }
      } else {
        // Open quick product save modal
        const targetBarcode = barcodeSearch.trim();
        setQuickProductBarcode(targetBarcode);
        setQuickProductSku(`SKU-${targetBarcode.slice(-6) || Date.now().toString().slice(-6)}`);
        setQuickProductName('');
        setQuickProductCategory('FISH AND SEAFOOD');
        setQuickProductPrice(0);
        setQuickProductCostPrice(0);
        setQuickProductVatRate(0);
        setQuickProductVatType('inclusive');
        setQuickProductStock(10);
        setQuickProductModalOpened(true);
        notifications.show({
          title: 'Product Not Found',
          message: `No product found with barcode ${targetBarcode}. Opening quick-add modal.`,
          color: 'orange'
        });
      }
    } catch (err) {
      console.error("Barcode search failed", err);
      notifications.show({ title: 'Error', message: 'Failed to search barcode', color: 'red' });
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBarcodeSubmit();
    }
  };

  // Fetch products from DB for a given general category
  const fetchCategoryProducts = async (catName: string) => {
    try {
      setCategoryDbLoading(true);
      const { data } = await api.get('/products');
      const all = data.data || [];
      setCategoryDbProducts(all.filter((p: any) => p.category.toUpperCase() === catName.toUpperCase()));
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load category products', color: 'red' });
    } finally {
      setCategoryDbLoading(false);
    }
  };

  // Shared helper: add a product object (from API) to the active cart
  const addProductToCart = (product: any) => {
    const savedDiscounts = localStorage.getItem('productDiscounts');
    const productDiscounts = savedDiscounts ? JSON.parse(savedDiscounts) : {};
    const catalogDiscountPct = productDiscounts[product._id] || 0;
    const offerDiscount = getDiscountForProduct(product.name, product.category || '');
    const discountPct = Math.max(offerDiscount.pct, catalogDiscountPct);
    const discountedPrice = parseFloat((product.price * (1 - discountPct / 100)).toFixed(2));
    const drs = product.drs || 0;
    const discountAmt = parseFloat((product.price * (discountPct / 100)).toFixed(2));
    const newItem: CartItem = {
      id: Date.now().toString(),
      product: product._id,
      name: product.name,
      barcode: product.barcode,
      qty: 1,
      price: discountedPrice,
      stock: product.stock,
      originalPrice: product.price,
      discountPct: discountPct,
      discountAmt: discountAmt,
      drs: drs,
    };
    updateCartItems([...cartItems, newItem]);
    updateSelectedItemId(newItem.id);
    setStagingItem({ id: newItem.id, product: newItem.product, name: newItem.name, barcode: newItem.barcode, qty: 1, price: newItem.price, stock: newItem.stock, originalPrice: product.price, discountPct, discountAmt, drs });
    if (discountPct > 0) {
      notifications.show({
        title: 'Discount Applied!',
        message: `${discountPct}% discount applied to ${product.name}. Price: € ${discountedPrice.toFixed(2)}`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
    }
  };

  // Handle product-name search: fetch matching products from the API
  const handleProductNameChange = async (val: string) => {
    setProductNameSearch(val);
    if (!val.trim() || val.trim().length < 2) {
      setProductNameResults([]);
      productNameResultsRef.current = [];
      setActiveProductIndex(-1);
      return;
    }
    // If the typed value exactly matches an item already in results,
    // the user just picked from the dropdown - don't re-fetch
    const exactMatch = productNameResultsRef.current.find(p => p.value === val);
    if (exactMatch) return;
    try {
      const { data } = await api.get(`/products?search=${encodeURIComponent(val.trim())}`);
      const results = (data.data || []).slice(0, 10).map((p: any) => ({
        value: p.name,
        name: p.name,
        _id: p._id,
        barcode: p.barcode,
        price: p.price,
        category: p.category || '',
        vatRate: p.vatRate,
        vatType: p.vatType,
        stock: p.stock,
        drs: p.drs || 0,
      }));
      setProductNameResults(results);
      productNameResultsRef.current = results;
      setActiveProductIndex(-1);
    } catch (err) {
      console.error('Product name search failed', err);
    }
  };

  const handleProductNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (productNameResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveProductIndex(prev => (prev + 1) % productNameResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveProductIndex(prev => (prev - 1 + productNameResults.length) % productNameResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeProductIndex >= 0 && activeProductIndex < productNameResults.length) {
        const selectedProduct = productNameResults[activeProductIndex];
        addProductToCart(selectedProduct);
        setProductNameSearch('');
        setProductNameResults([]);
        productNameResultsRef.current = [];
        setActiveProductIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setProductNameResults([]);
      productNameResultsRef.current = [];
      setActiveProductIndex(-1);
    }
  };

  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  const activeCart = carts.find(c => c.id === activeCartId)!;
  const cartItems = activeCart.items;
  const selectedItemId = activeCart.selectedItemId;

  const updateCartItems = (updater: React.SetStateAction<CartItem[]>) => {
    setCarts(prev => prev.map(c => {
      if (c.id === activeCartId) {
        const newItems = typeof updater === 'function' ? updater(c.items) : updater;
        return { ...c, items: newItems };
      }
      return c;
    }));
  };

  const updateSelectedItemId = (updater: React.SetStateAction<string>) => {
    setCarts(prev => prev.map(c => {
      if (c.id === activeCartId) {
        const newId = typeof updater === 'function' ? updater(c.selectedItemId) : updater;
        return { ...c, selectedItemId: newId };
      }
      return c;
    }));
  };

  const handleCategoryItem = (categoryName: string, defaultBarcode: string) => {
    updateSelectedItemId('');
    setStagingItem({
      name: categoryName,
      barcode: defaultBarcode,
      qty: 1,
      price: 1.00
    });
  };

  const handleAddItem = () => {
    if (!stagingItem.name) return;
    const newItem = {
      id: Date.now().toString(),
      product: stagingItem.product,
      name: stagingItem.name,
      barcode: stagingItem.barcode,
      qty: Number(stagingItem.qty) || 1,
      price: Number(stagingItem.price) || 0,
      stock: stagingItem.stock,
      originalPrice: stagingItem.originalPrice !== undefined ? stagingItem.originalPrice : (Number(stagingItem.price) || 0),
      discountPct: stagingItem.discountPct || 0,
      discountAmt: stagingItem.discountAmt || 0,
      drs: stagingItem.drs || 0,
    };
    updateCartItems(prev => [...prev, newItem]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const handleUpdateItem = () => {
    if (!stagingItem.id) return;
    updateCartItems(prev => prev.map(item =>
      item.id === stagingItem.id ? { 
        ...item, 
        product: stagingItem.product, 
        name: stagingItem.name, 
        barcode: stagingItem.barcode, 
        qty: Number(stagingItem.qty) || 1, 
        price: Number(stagingItem.price) || 0, 
        stock: stagingItem.stock,
        originalPrice: stagingItem.originalPrice !== undefined ? stagingItem.originalPrice : (Number(stagingItem.price) || 0),
        discountPct: stagingItem.discountPct || 0,
        discountAmt: stagingItem.discountAmt || 0,
        drs: stagingItem.drs || 0,
      } : item
    ));
  };

  const handleRemoveItem = () => {
    if (!stagingItem.id) return;
    updateCartItems(prev => prev.filter(item => item.id !== stagingItem.id));
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const handleQuantityChange = (delta: number) => {
    setStagingItem(prev => ({ ...prev, qty: Math.max(1, (Number(prev.qty) || 0) + delta) }));
  };

  const handlePriceChange = (val: string) => {
    if (val === '') {
      setStagingItem(prev => ({ ...prev, price: '' }));
      return;
    }
    const parsedPrice = parseFloat(val);
    setStagingItem(prev => ({ ...prev, price: isNaN(parsedPrice) ? '' : parsedPrice }));
  };

  const handleCalculatorInput = (input: string) => {
    setCalculatorValue(prev => {
      if (input === 'C') return '0';
      if (input === 'Back') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (input === '=') {
        try {
          const expression = prev.replace(/x/g, '*');
          if (!/^[0-9+\-*/.() ]+$/.test(expression)) return 'Error';
          const result = Function(`"use strict"; return (${expression})`)();
          return Number.isFinite(result) ? String(parseFloat(result.toFixed(8))) : 'Error';
        } catch {
          return 'Error';
        }
      }

      if (prev === '0' || prev === 'Error') return input;
      return `${prev}${input}`;
    });
  };

  const [depositInput, setDepositInput] = useState<string>('');
  const [flatDiscount, setFlatDiscount] = useState<string>('');
  const [returnPopupOpened, setReturnPopupOpened] = useState(false);
  const [returnAmount, setReturnAmount] = useState(0);

  const subTotal = cartItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const flatDiscountVal = Math.min(Number(flatDiscount) || 0, subTotal);
  const depositVal = Number(depositInput) || 0;
  const totalDRS = cartItems.reduce((acc, item) => acc + (item.qty * (item.drs || 0)), 0);
  const total = Math.max(0, subTotal - flatDiscountVal + totalDRS);

  const handleCheckout = async (method: string = 'MIXED') => {
    if (cartItems.length === 0) return;

    if (method === 'CASH') {
      const retAmt = depositVal - total;
      setReturnAmount(retAmt);
      setReturnPopupOpened(true);
    }
    // Update customer visits & revenue in MongoDB if a customer is selected
    let loyaltyPointsEarned = 0;
    let loyaltyPointsTotal = 0;
    let loyaltyRewardThreshold = 0;
    let loyaltyRewardValue = 0;
    if (activeCart.customerId) {
      try {
        const categoryEntries = apiCategories;

        // Sum points per cart item based on its product's category
        let categoryPoints = 0;
        for (const item of cartItems) {
          // Find the product to get its category
          try {
            const { data: pData } = await api.get(`/products?search=${encodeURIComponent(item.name)}`);
            const prod = (pData.data || []).find((p: any) => p.name === item.name || p.barcode === item.barcode);
            if (prod) {
              const catEntry = categoryEntries.find(c =>
                typeof c === 'string' ? c === prod.category : c.name === prod.category
              );
              const ptsPerItem = (catEntry as any)?.loyaltyPoints || 0;
              categoryPoints += ptsPerItem * item.qty;
            }
          } catch { /* skip */ }
        }

        // Fallback to global setting if no category points defined
        let pointsToAdd = categoryPoints;
        if (pointsToAdd === 0) {
          try {
            const settingsRes = await api.get('/settings');
            const ptsPerEuro = settingsRes.data?.data?.loyaltyPointsPerEuro ?? 1;
            pointsToAdd = Math.floor(total * ptsPerEuro);
          } catch { pointsToAdd = Math.floor(total); }
        }

        const txRes = await api.post(`/customers/${activeCart.customerId}/transaction`, { amount: total, pointsOverride: pointsToAdd });
        const updatedCustomer = txRes.data?.data;
        if (updatedCustomer) {
          loyaltyPointsEarned = updatedCustomer.pointsEarned || 0;
          loyaltyPointsTotal = updatedCustomer.loyaltyPoints || 0;
        }
        // Get loyalty settings for receipt display
        try {
          const settingsRes = await api.get('/settings');
          loyaltyRewardThreshold = settingsRes.data?.data?.loyaltyRewardThreshold || 0;
          loyaltyRewardValue = settingsRes.data?.data?.loyaltyRewardValue || 0;
        } catch { /* ignore */ }
        const { data } = await api.get('/customers');
        setDbCustomers(data.data || []);
      } catch (err) {
        console.error("Failed to update customer stats in database", err);
      }
    }

    // Save order to the database
    try {
      const { data } = await api.post('/orders', {
        items: cartItems.map(item => ({
          product: item.product,
          name: item.name,
          quantity: item.qty,
          price: item.price,
          vatRate: 0,
          vatAmount: 0,
          totalPrice: item.qty * (item.originalPrice ?? item.price),
          discountPct: item.discountPct || 0,
          discountAmt: (item.discountAmt || 0) * item.qty,
          finalPrice: item.qty * item.price + (item.drs || 0) * item.qty,
          drs: item.drs || 0,
        })),
        subtotal: subTotal,
        totalVAT: 0,
        discount: flatDiscountVal,
        totalDRS,
        total,
        paymentMethod: method.toLowerCase(),
        ...(activeCart.customerId && {
          customerId: activeCart.customerId,
          customerName: activeCart.name
        }),
      });
      if (data?.data) setOrders(prev => [data.data, ...prev]);
    } catch (err) {
      console.error('Failed to save order to database', err);
      notifications.show({
        title: 'Order Save Failed',
        message: 'Could not save order to database. Please check your connection.',
        color: 'red',
      });
      return;
    }

    const newTransaction: Transaction = {
      transactionNo,
      items: [...cartItems],
      subTotal,
      deposit: depositVal,
      total,
      date: new Date().toLocaleString(),
      paymentMethod: method,
      discount: flatDiscountVal,
      totalDRS,
    };

    // Add customer data fields for printing
    (newTransaction as any).customerName = activeCart.customerId ? activeCart.name : 'Walk-in';
    (newTransaction as any).customerPhone = activeCart.customerPhone || '';
    // Loyalty points on receipt (only if customer linked)
    if (activeCart.customerId && loyaltyPointsEarned > 0) {
      (newTransaction as any).loyaltyPointsEarned = loyaltyPointsEarned;
      (newTransaction as any).loyaltyPointsTotal = loyaltyPointsTotal;
      (newTransaction as any).loyaltyRewardThreshold = loyaltyRewardThreshold;
      (newTransaction as any).loyaltyRewardValue = loyaltyRewardValue;
    }

    setLastTransaction(newTransaction);
    setTransactionNo(prev => prev + 1);

    // Auto-print receipt if Enable Printing is checked and payment is CASH
    if (enablePrinting && method === 'CASH') {
      setTimeout(() => handlePrint(), 100);
    }

    updateCartItems([]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
    setFlatDiscount('');

    // Reset selected customer for this cart tab
    setCarts(prev => prev.map(c => c.id === activeCartId ? { ...c, name: `CUSTOMER ${c.id.replace('customer', '')}`, customerId: undefined, customerPhone: undefined } : c));
  };

  const handleSplitPayment = async () => {
    const cashAmt = Number(splitCashAmount) || 0;
    const cardAmt = Number(splitCardAmount) || 0;
    const splitTotal = cashAmt + cardAmt;

    if (cartItems.length === 0) return;
    if (cashAmt < 0 || cardAmt < 0) {
      notifications.show({ title: 'Invalid Amount', message: 'Amounts cannot be negative.', color: 'red' });
      return;
    }
    if (splitTotal < total) {
      notifications.show({
        title: 'Insufficient Payment',
        message: `Total entered (€ ${splitTotal.toFixed(2)}) is less than the bill (€ ${total.toFixed(2)}).`,
        color: 'red'
      });
      return;
    }

    setSplitModalOpened(false);

    // Update customer stats if linked
    if (activeCart.customerId) {
      try {
        await api.post(`/customers/${activeCart.customerId}/transaction`, { amount: total });
        const { data } = await api.get('/customers');
        setDbCustomers(data.data || []);
      } catch (err) {
        console.error('Failed to update customer stats', err);
      }
    }

    // Save order to DB with split payment info
    try {
      const { data } = await api.post('/orders', {
        items: cartItems.map(item => ({
          product: item.product,
          name: item.name,
          quantity: item.qty,
          price: item.price,
          vatRate: 0,
          vatAmount: 0,
          totalPrice: item.qty * (item.originalPrice ?? item.price),
          discountPct: item.discountPct || 0,
          discountAmt: (item.discountAmt || 0) * item.qty,
          finalPrice: item.qty * item.price + (item.drs || 0) * item.qty,
          drs: item.drs || 0,
        })),
        subtotal: subTotal,
        totalVAT: 0,
        discount: flatDiscountVal,
        totalDRS,
        total,
        paymentMethod: 'split',
        splitCash: cashAmt,
        splitCard: cardAmt,
        ...(activeCart.customerId && {
          customerId: activeCart.customerId,
          customerName: activeCart.name
        }),
      });
      if (data?.data) setOrders(prev => [data.data, ...prev]);
    } catch (err) {
      console.error('Failed to save split order', err);
      notifications.show({ title: 'Order Save Failed', message: 'Could not save order to database.', color: 'red' });
      return;
    }

    const change = splitTotal - total;
    const newTransaction: Transaction = {
      transactionNo,
      items: [...cartItems],
      subTotal,
      deposit: splitTotal,
      total,
      date: new Date().toLocaleString(),
      paymentMethod: `SPLIT (Cash: €${cashAmt.toFixed(2)} / Card: €${cardAmt.toFixed(2)})`,
      discount: flatDiscountVal,
      totalDRS,
    };
    (newTransaction as any).customerName = activeCart.customerId ? activeCart.name : 'Walk-in';
    (newTransaction as any).customerPhone = activeCart.customerPhone || '';
    (newTransaction as any).splitCash = cashAmt;
    (newTransaction as any).splitCard = cardAmt;
    (newTransaction as any).change = change;

    setLastTransaction(newTransaction);
    setTransactionNo(prev => prev + 1);

    if (enablePrinting) {
      setTimeout(() => handlePrint(), 100);
    }

    // Show change if any
    if (change > 0) {
      setReturnAmount(change);
      setReturnPopupOpened(true);
    } else {
      notifications.show({
        title: 'Split Payment Complete',
        message: `Cash: €${cashAmt.toFixed(2)}  |  Card: €${cardAmt.toFixed(2)}`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
    }

    updateCartItems([]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
    setCarts(prev => prev.map(c => c.id === activeCartId ? { ...c, name: `CUSTOMER ${c.id.replace('customer', '')}`, customerId: undefined, customerPhone: undefined } : c));
    setSplitCashAmount('');
    setSplitCardAmount('');
    setFlatDiscount('');
  };

  const handleRePrint = () => {    if (lastTransaction) {
      handlePrint();
    } else {
      alert("No previous transaction to reprint.");
    }
  };

  const handleOptionAction = (actionName: string, path: string) => {
    setOptionsModalOpened(false);
    notifications.show({
      title: 'POS Command Redirect',
      message: `Redirecting to: ${actionName}`,
      color: 'teal',
      icon: <IconCheck size={16} />
    });
    navigate(path);
  };

  const openVoidModal = () => {
    setOptionsModalOpened(false);
    setVoidModalOpened(true);
  };

  const handleVoidTransaction = async () => {
    if (!selectedOrderId) {
      notifications.show({ title: 'Select Order', message: 'Please select an order to void.', color: 'orange' });
      return;
    }

    try {
      const selectedEmployeeLabel = employees.find((employee) => employee.value === selectedEmployee)?.label || '';
      const params = new URLSearchParams({
        reason: voidReason.trim(),
      });
      if (selectedEmployee) params.set('employeeId', selectedEmployee);
      if (selectedEmployeeLabel) params.set('employeeName', selectedEmployeeLabel);
      await api.delete(`/orders/${selectedOrderId}?${params.toString()}`);
      setOrders(prev => prev.filter(order => order._id !== selectedOrderId));
      setSelectedOrderId('');
      setVoidReason('');
      setVoidModalOpened(false);
      notifications.show({ title: 'Success', message: 'Order voided', color: 'green' });
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || err.response?.data?.data || 'Void failed',
        color: 'red'
      });
    }
  };

  const optionButtons = [
    { label: 'Z REPORT', action: () => handleOptionAction('Z REPORT', '/reports/z-report-print') },
    { label: 'TILL REPORT', action: () => handleOptionAction('TILL REPORT', '/reports/sales-summary') },
    { label: 'Post Amount', action: () => handleOptionAction('Post Amount', '/reports/posting'), isSpecial: true },
    { label: 'EXCH / REF', action: () => handleOptionAction('EXCH / REF', '/reports/exchange-refund') },
    { label: 'VOID TRANS', action: openVoidModal },
    { label: 'RE PRINT BILL', action: () => handleOptionAction('RE PRINT BILL', '/receipts') },
    { label: 'CATEGORY PRIORITY', action: () => handleOptionAction('CATEGORY PRIORITY', '/products/category') },
    { label: 'MANAGE CUSTOMER', action: () => handleOptionAction('MANAGE CUSTOMER', '/customers') },
    { label: 'CASH / CARD TRANS', action: () => handleOptionAction('CASH / CARD TRANS', '/reports/transaction-sales') },
    { label: 'ADD EXPENSES', action: () => handleOptionAction('ADD EXPENSES', '/expenses') },
    { label: 'ADD VOUCHER', action: () => handleOptionAction('ADD VOUCHER', '/products/category') },
    { label: 'CIGARETTE MACHINE REPORT', action: () => handleOptionAction('CIGARETTE MACHINE REPORT', '/reports/sales-analysis') },
    { label: 'VIEW EXPIRY REPORT', action: () => handleOptionAction('VIEW EXPIRY REPORT', '/reports/expiry-items') },
    { label: 'MANAGE ONLINE ORDERS', action: () => handleOptionAction('MANAGE ONLINE ORDERS', '/products/category') },
    { label: 'Download Invoice', action: () => handleOptionAction('Download Invoice', '/receipts') },
    { label: 'DELI REPORT', action: () => handleOptionAction('DELI REPORT', '/reports/category-sale') },
    { label: 'CASH LIFT', action: () => handleOptionAction('CASH LIFT', '/bank') },
    { label: 'BACK', action: () => setOptionsModalOpened(false) },
  ];

  const handleQuickSaveCustomer = async () => {
    if (!quickSaveName.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Name is required.',
        color: 'red'
      });
      return;
    }
    if (!quickSavePhone.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Phone number is required.',
        color: 'red'
      });
      return;
    }

    try {
      setQuickSaveLoading(true);
      const { data } = await api.post('/customers', {
        name: quickSaveName.trim(),
        contactNum1: quickSavePhone.trim(),
      });
      
      const newCust = data.data;
      if (newCust && newCust._id) {
        setDbCustomers(prev => [...prev, newCust]);
        
        setCarts(prev => prev.map(c => {
          if (c.id === activeCartId) {
            return {
              ...c,
              name: newCust.name,
              customerId: newCust._id,
              customerPhone: newCust.contactNum1
            };
          }
          return c;
        }));

        notifications.show({
          title: 'Success',
          message: 'Customer registered and linked to cart successfully.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        
        setQuickSaveModalOpened(false);
        setQuickSaveName('');
        setQuickSavePhone('');
      }
    } catch (err: any) {
      console.error(err);
      notifications.show({
        title: 'Error Saving Customer',
        message: err.response?.data?.message || err.message,
        color: 'red'
      });
    } finally {
      setQuickSaveLoading(false);
    }
  };

  const productCategoriesList = Array.from(new Set([
    "FISH AND SEAFOOD", "LAMB BEEF", "CHICKEN", "FRUITS", "VEG", "BAKERY AND DAIRY",
    ...apiCategories.map(c => c.name),
  ]));

  const handleQuickSaveProduct = async () => {
    if (!quickProductName.trim()) {
      notifications.show({ title: 'Validation Error', message: 'Product Name is required.', color: 'red' });
      return;
    }

    const targetBarcode = quickProductBarcode.trim() || `GEN-${Date.now()}`;
    const targetSku = quickProductSku.trim() || `SKU-${targetBarcode.slice(-6) || Date.now().toString().slice(-6)}`;
    const targetCategory = quickProductCategory || 'FISH AND SEAFOOD';

    try {
      setQuickProductLoading(true);
      const payload = {
        name: quickProductName.trim(),
        sku: targetSku,
        barcode: targetBarcode,
        category: targetCategory,
        price: Number(quickProductPrice) || 0,
        costPrice: Number(quickProductCostPrice) || 0,
        vatRate: Number(quickProductVatRate) || 0,
        vatType: quickProductVatType,
        stock: Number(quickProductStock) || 0,
      };

      const { data } = await api.post('/products', payload);
      const product = data.data;

      if (product && product._id) {
        const savedDiscounts = localStorage.getItem('productDiscounts');
        const productDiscounts = savedDiscounts ? JSON.parse(savedDiscounts) : {};
        const catalogDiscountPct = productDiscounts[product._id] || 0;
        const offerDiscount = getDiscountForProduct(product.name, product.category || '');
        const discountPct = Math.max(offerDiscount.pct, catalogDiscountPct);
        const discountedPrice = parseFloat((product.price * (1 - discountPct / 100)).toFixed(2));

        const drs = product.drs || 0;
        const discountAmt = parseFloat((product.price * (discountPct / 100)).toFixed(2));

        const newItem: CartItem = {
          id: Date.now().toString(),
          product: product._id,
          name: product.name,
          barcode: product.barcode,
          qty: 1,
          price: discountedPrice,
          stock: product.stock,
          originalPrice: product.price,
          discountPct: discountPct,
          discountAmt: discountAmt,
          drs: drs,
        };

        updateCartItems([...cartItems, newItem]);
        updateSelectedItemId(newItem.id);
        setStagingItem({ id: newItem.id, product: newItem.product, name: newItem.name, barcode: newItem.barcode, qty: 1, price: newItem.price, stock: newItem.stock, originalPrice: product.price, discountPct, discountAmt, drs });

        notifications.show({
          title: 'Success',
          message: 'Product registered and added to cart!',
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        setQuickProductModalOpened(false);
        setQuickProductName('');
        setQuickProductSku('');
        setQuickProductBarcode('');
        setQuickProductCategory('FISH AND SEAFOOD');
        setQuickProductPrice(0);
        setQuickProductCostPrice(0);
        setQuickProductVatRate(0);
        setQuickProductVatType('inclusive');
        setQuickProductStock(10);
        setBarcodeSearch('');
      }
    } catch (err: any) {
      console.error(err);
      notifications.show({
        title: 'Error Saving Product',
        message: err.response?.data?.message || err.message,
        color: 'red'
      });
    } finally {
      setQuickProductLoading(false);
    }
  };

  const handleAddCustomer = () => {
    const nextNum = carts.length + 1;
    const newId = `customer${nextNum}`;
    setCarts(prev => [...prev, { id: newId, name: `CUSTOMER ${nextNum}`, items: [], selectedItemId: '' }]);
    setActiveCartId(newId);
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const customColors = {
    bg: '#d2dadb',
    panelBg: '#e0e6e6',
    orangeBtn: '#d28c46',
    orangeBtnHover: '#c17a35',
    greenBtnTop: '#688939',
    greenBtnMid: '#86af49',
    headerBg: '#47635b',
    border: '#000000',
    tableHeaderRow: '#f0f0f0',
    selectedRow: '#ff9800',
    blueText: '#0055ff'
  };

  const btnStyle = {
    backgroundColor: customColors.orangeBtn,
    color: '#fff',
    border: '2px solid #fff',
    borderRadius: '2px'
  };

  return (
    <>
      <Box p="sm" bg={customColors.bg} h="100vh" style={{ border: `2px solid ${customColors.border}`, overflow: 'hidden' }}>
        <Grid>
          {/* LEFT COLUMN */}
          <Grid.Col span={3.5}>
            <Flex direction="column" h="calc(100vh - 104px)">
              <Tabs value={activeCartId} onChange={(val) => {
                if (val) {
                  setActiveCartId(val);
                  const cart = carts.find(c => c.id === val);
                  if (cart && cart.selectedItemId) {
                    const item = cart.items.find(i => i.id === cart.selectedItemId);
                    if (item) setStagingItem({ id: item.id, product: item.product, name: item.name, barcode: item.barcode, qty: item.qty, price: item.price, stock: item.stock, originalPrice: item.originalPrice, discountPct: item.discountPct, discountAmt: item.discountAmt, drs: item.drs });
                    else setStagingItem({ name: '', barcode: '', qty: '', price: '' });
                  } else {
                    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
                  }
                }
              }} variant="outline" bg="white" styles={{ tab: { padding: '4px 8px', fontSize: '12px', borderBottom: 'none' } }}>
                <Tabs.List style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
                  {carts.map(cart => (
                    <Tabs.Tab key={cart.id} value={cart.id} bg={activeCartId === cart.id ? "white" : "gray.2"}>
                      {cart.name}
                    </Tabs.Tab>
                  ))}
                  <Button variant="subtle" size="xs" px={10} mt={3} onClick={handleAddCustomer} style={{ color: 'black' }}>
                    <Text size="lg" fw="bold">+</Text>
                  </Button>
                </Tabs.List>
              </Tabs>

              <Paper withBorder mt={0} bg="white" style={{ flexGrow: 1, borderTop: 0, borderRadius: 0, border: `2px solid ${customColors.border}`, overflowY: 'auto' }}>
                <Table stickyHeader>
                  <Table.Thead bg={customColors.tableHeaderRow}>
                    <Table.Tr>
                      <Table.Th style={{ fontSize: '12px', padding: '4px 8px' }}>Product Name</Table.Th>
                      <Table.Th style={{ fontSize: '12px', padding: '4px 8px' }}>Qty/Wt</Table.Th>
                      <Table.Th style={{ fontSize: '12px', padding: '4px 8px' }}>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cartItems.map((item) => (
                      <Table.Tr
                        key={item.id}
                        bg={selectedItemId === item.id ? customColors.selectedRow : undefined}
                        onClick={() => {
                          updateSelectedItemId(item.id);
                          setStagingItem({ id: item.id, product: item.product, name: item.name, barcode: item.barcode, qty: item.qty, price: item.price, stock: item.stock, originalPrice: item.originalPrice, discountPct: item.discountPct, discountAmt: item.discountAmt, drs: item.drs });
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <Table.Td style={{ fontSize: '12px', padding: '4px 8px' }} fw={selectedItemId === item.id ? "bold" : "normal"}>{item.name}</Table.Td>
                        <Table.Td style={{ fontSize: '12px', padding: '4px 8px' }}>{item.qty} X 1</Table.Td>
                        <Table.Td style={{ fontSize: '12px', padding: '4px 8px' }}>{(item.qty * item.price).toFixed(2)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>

              <Paper withBorder mt="xs" p="xs" style={{ border: `2px solid ${customColors.border}`, borderRadius: 0, position: 'relative' }} bg={customColors.bg}>
                <Text size="10px" fw="bold" style={{ position: 'absolute', top: '-8px', left: '10px', backgroundColor: customColors.bg, padding: '0 5px' }}>Last Transaction Details</Text>
                <Grid mt={5}>
                  <Grid.Col span={6}>
                    <Flex justify="space-between"><Text size="11px">Trans No</Text><Text size="11px" fw="bold">{transactionNo}</Text></Flex>
                    <Flex justify="space-between"><Text size="11px">Trans Amt</Text><Text size="11px" fw="bold">{lastTransaction ? lastTransaction.total.toFixed(2) : '0.00'}</Text></Flex>
                    <Flex justify="space-between"><Text size="11px">Due Amt</Text><Text size="11px" fw="bold">0.00</Text></Flex>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Flex justify="space-between"><Text size="11px">Paid Amt</Text><Text size="11px" fw="bold">{lastTransaction ? lastTransaction.total.toFixed(2) : '0.00'}</Text></Flex>
                    <Flex justify="space-between"><Text size="11px">Return Amt</Text><Text size="11px" fw="bold">0.00</Text></Flex>
                    <Button size="xs" style={btnStyle} fullWidth mt={5} h={24} onClick={handleRePrint}>Re Print</Button>
                  </Grid.Col>
                </Grid>
              </Paper>
            </Flex>
          </Grid.Col>

          {/* RIGHT PANEL (Middle + Right Columns combined) */}
          <Grid.Col span={8.5}>
            <Flex direction="column" h="calc(100vh - 104px)">
              <Grid style={{ flexGrow: 1, alignContent: 'flex-start' }}>
                {/* MIDDLE COLUMN CONTENT */}
                <Grid.Col span={5.5}>
                  <Flex align="center" gap="xs" mb="xs">
                    <Text size="sm">Employee</Text>
                    <Select
                      data={employees}
                      value={selectedEmployee}
                      onChange={(val) => setSelectedEmployee(val)}
                      size="xs"
                      flex={1}
                      placeholder={employees.length === 0 ? 'No employees - add in Admin' : 'Select employee...'}
                      disabled={employees.length === 0}
                      styles={{ input: { borderRadius: 0 } }}
                    />
                    <SyncButton />
                    <Button style={btnStyle} size="xs" px="lg">LOCK</Button>
                  </Flex>

                  <Paper withBorder p={0} style={{ border: `2px solid ${customColors.headerBg}`, borderRadius: 0 }} bg={customColors.bg}>
                    <Flex justify="space-between" align="center" bg={customColors.headerBg} px="sm" py={3} gap="xs">
                      <Flex align="center" gap="xs" flex={1}>
                        <Text size="10px" c="white" style={{ whiteSpace: 'nowrap' }}>Customer:</Text>
                        <Autocomplete
                          size="xs"
                          placeholder="Search registered..."
                          value={activeCart.customerId ? `${activeCart.name} (${activeCart.customerPhone})` : (activeCart.name.startsWith('CUSTOMER ') ? '' : activeCart.name)}
                          data={dbCustomers.map(c => `${c.name} (${c.contactNum1})`)}
                          onChange={(val) => {
                            const matched = findCustomerMatch(val);
                            setCarts(prev =>
                              prev.map(c => {
                                if (c.id === activeCartId) {
                                  if (matched) {
                                    return {
                                      ...c,
                                      name: matched.name,
                                      customerId: matched._id,
                                      customerPhone: matched.contactNum1,
                                    };
                                  }
                                  return {
                                    ...c,
                                    name: val || `CUSTOMER ${c.id.replace('customer', '')}`,
                                    customerId: undefined,
                                    customerPhone: undefined,
                                  };
                                }
                                return c;
                              })
                            );
                          }}
                          onOptionSubmit={(val) => {
                            const matched = findCustomerMatch(val);
                            if (matched) {
                              setCarts(prev => prev.map(c => {
                                if (c.id === activeCartId) {
                                  return {
                                    ...c,
                                    name: matched.name,
                                    customerId: matched._id,
                                    customerPhone: matched.contactNum1
                                  };
                                }
                                return c;
                              }));
                            }
                          }}
                          onBlur={(e) => {
                            const typedVal = e.target.value.trim();
                            if (!typedVal) return;
                            const matched = findCustomerMatch(typedVal);
                            if (matched) {
                              setCarts(prev => prev.map(c => {
                                if (c.id === activeCartId) {
                                  return {
                                    ...c,
                                    name: matched.name,
                                    customerId: matched._id,
                                    customerPhone: matched.contactNum1
                                  };
                                }
                                return c;
                              }));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const typedVal = (e.target as HTMLInputElement).value.trim();
                              if (!typedVal) return;
                              const matched = findCustomerMatch(typedVal);
                              if (matched) {
                                setCarts(prev => prev.map(c => {
                                  if (c.id === activeCartId) {
                                    return {
                                      ...c,
                                      name: matched.name,
                                      customerId: matched._id,
                                      customerPhone: matched.contactNum1
                                    };
                                  }
                                  return c;
                                }));
                                notifications.show({
                                  title: 'Customer Selected',
                                  message: `Linked ${matched.name} to cart.`,
                                  color: 'green',
                                  autoClose: 2000
                                });
                              } else {
                                const isPhone = /^[+\d\s-]{4,}$/.test(typedVal);
                                if (isPhone) {
                                  setQuickSaveName('');
                                  setQuickSavePhone(typedVal);
                                } else {
                                  setQuickSaveName(typedVal);
                                  setQuickSavePhone('');
                                }
                                setQuickSaveModalOpened(true);
                              }
                            }
                          }}
                          styles={{
                            input: {
                              height: 20,
                              minHeight: 20,
                              fontSize: '11px',
                              padding: '0 4px',
                              borderRadius: 2,
                              border: 'none',
                              backgroundColor: '#ffffff',
                              color: 'black'
                            }
                          }}
                          flex={1}
                        />
                      </Flex>
                      <Button size="xs" style={{ ...btnStyle, border: '1px solid #fff' }} h={20} px={5} onClick={() => {
                        updateCartItems([]);
                        updateSelectedItemId('');
                        setStagingItem({ name: '', barcode: '', qty: '', price: '' });
                        setCarts(prev => prev.map(c => c.id === activeCartId ? { ...c, name: `CUSTOMER ${c.id.replace('customer', '')}`, customerId: undefined, customerPhone: undefined } : c));
                      }}>Clear</Button>
                    </Flex>

                    <Box p="xs">
                      <fieldset style={{ border: `1px solid ${customColors.border}`, margin: 0, padding: '5px', position: 'relative' }}>
                        <legend style={{ fontSize: '10px', marginLeft: '5px', padding: '0 5px' }}>Search</legend>
                        <Flex gap="xs" mb={5} align="center">
                          <Button onClick={handleBarcodeSubmit} style={btnStyle} size="xs" w={70} h={24}><Text size="11px">Barcode</Text></Button>
                          <TextInput
                            size="xs"
                            flex={1}
                            value={barcodeSearch}
                            onChange={(e) => setBarcodeSearch(e.target.value)}
                            onKeyDown={handleBarcodeKeyDown}
                            placeholder="Scan barcode..."
                            styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }}
                          />
                          <Button style={btnStyle} size="xs" w={60} h={24}><Text size="11px">ENTER</Text></Button>
                        </Flex>
                        <Flex gap="xs" align="center">
                          <Text size="11px" w={70}>Product</Text>
                          <Box flex={1} style={{ position: 'relative' }}>
                            <TextInput
                              size="xs"
                              value={productNameSearch}
                              onChange={(e) => handleProductNameChange(e.target.value)}
                              onBlur={() => setTimeout(() => { setProductNameResults([]); productNameResultsRef.current = []; setActiveProductIndex(-1); }, 150)}
                              onKeyDown={handleProductNameKeyDown}
                              placeholder="Type product name..."
                              styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }}
                            />
                            {productNameResults.length > 0 && (
                              <Paper
                                shadow="md"
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  zIndex: 9999,
                                  maxHeight: 200,
                                  overflowY: 'auto',
                                  border: '1px solid #ccc',
                                }}
                              >
                                {productNameResults.map((p, index) => (
                                  <Box
                                    key={p._id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      addProductToCart(p);
                                      setProductNameSearch('');
                                      setProductNameResults([]);
                                      productNameResultsRef.current = [];
                                      setActiveProductIndex(-1);
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      borderBottom: '1px solid #eee',
                                      backgroundColor: index === activeProductIndex ? '#e8f4fd' : '',
                                      fontWeight: index === activeProductIndex ? 'bold' : 'normal'
                                    }}
                                    onMouseEnter={() => setActiveProductIndex(index)}
                                  >
                                    {p.value}
                                  </Box>
                                ))}
                              </Paper>
                            )}
                          </Box>
                          <Button style={btnStyle} size="xs" w={60} h={24} onMouseDown={(e) => { e.preventDefault(); setProductNameSearch(''); setProductNameResults([]); productNameResultsRef.current = []; }}><Text size="11px">CLEAR</Text></Button>
                        </Flex>
                      </fieldset>

                      <fieldset style={{ border: `1px solid ${customColors.border}`, margin: '5px 0 0 0', padding: '5px', position: 'relative' }}>
                        <legend style={{ fontSize: '10px', marginLeft: '5px', padding: '0 5px' }}>Details</legend>
                        <Flex gap="xs" align="flex-start" mb={5}>
                          <Text size="12px" w={55} mt={5}>Product</Text>
                          <TextInput size="md" flex={1} value={stagingItem.name} readOnly styles={{ input: { borderRadius: 0, height: 40 } }} />
                        </Flex>
                        <Flex gap="xs" align="center" mb={5}>
                          <Text size="12px" w={55}>Barcode</Text>
                          <TextInput size="xs" flex={1} value={stagingItem.barcode} readOnly rightSection={<Text size="11px" td="underline" c="blue" style={{ cursor: 'pointer' }}>Edit</Text>} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                        </Flex>
                        <Flex gap="xs" align="center" mb={5}>
                          <Text size="12px" w={55}>Weight</Text>
                          <Box flex={1}></Box>
                          <Text size="12px">Quantity</Text>
                          <TextInput size="xs" w={60} value={stagingItem.qty} onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') setStagingItem(p => ({ ...p, qty: '' }));
                            else {
                              const pVal = parseInt(val);
                              if (!isNaN(pVal)) setStagingItem(p => ({ ...p, qty: pVal }));
                            }
                          }} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                        </Flex>
                        <Flex gap="xs" align="center" mb={10}>
                          <Select data={['1pc']} defaultValue="1pc" size="xs" w={80} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                          <Box flex={1} />
                          <Button style={btnStyle} size="xs" w={40} h={24} onClick={() => handleQuantityChange(1)}>+</Button>
                          <Button style={btnStyle} size="xs" w={40} h={24} onClick={() => handleQuantityChange(-1)}>-</Button>
                        </Flex>
                        <Flex gap="xs" align="center" mb={5}>
                          <Box flex={1}><Text size="12px" mb={2}>Unit Price</Text><TextInput size="xs" value={typeof stagingItem.price === 'number' ? stagingItem.price.toFixed(2) : stagingItem.price} onChange={(e) => handlePriceChange(e.target.value)} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24, backgroundColor: '#3388ff', color: 'white' } }} /></Box>
                          <Box flex={1}><Text size="12px" mb={2}>Total Price</Text><Text size="sm">{((Number(stagingItem.qty) || 0) * (Number(stagingItem.price) || 0)).toFixed(2)}</Text></Box>
                        </Flex>

                        <Flex gap={5} mt="sm">
                          <Button onClick={handleAddItem} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">ADD</Text></Button>
                          <Button onClick={handleUpdateItem} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">UPDATE</Text></Button>
                          <Button onClick={handleRemoveItem} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">REMOVE</Text></Button>
                          <Button onClick={() => { updateCartItems([]); updateSelectedItemId(''); setStagingItem({ name: '', barcode: '', qty: '', price: '' }); }} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="9px" fw="bold" ta="center" style={{ whiteSpace: 'normal' }}>REMOVE ALL</Text></Button>
                        </Flex>
                      </fieldset>
                    </Box>
                  </Paper>
                </Grid.Col>

                {/* RIGHT COLUMN CONTENT */}
                <Grid.Col span={6.5}>
                  <Flex justify="flex-end" align="center" gap="sm" mb="xs">
                    <Checkbox
                      label="Enable Printing"
                      size="xs"
                      checked={enablePrinting}
                      onChange={(e) => setEnablePrinting(e.currentTarget.checked)}
                    />
                  </Flex>
                  <Grid >
                    {[
                      ...quickProducts.map(item => ({
                        name: item.name,
                        color: item.color,
                        onClick: () => handleCategoryItem(item.name, item.barcode),
                      })),
                      { name: 'FISH AND SEAFOOD', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('FISH AND SEAFOOD'); setCategorySearch(''); setCategoryDbProducts([]); setCategoryModalOpened(true); fetchCategoryProducts('FISH AND SEAFOOD'); } },
                      { name: 'LAMB BEEF', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('LAMB BEEF'); setCategorySearch(''); setCategoryDbProducts([]); setCategoryModalOpened(true); fetchCategoryProducts('LAMB BEEF'); } },
                      { name: 'CHICKEN', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('CHICKEN'); setCategorySearch(''); setCategoryDbProducts([]); setCategoryModalOpened(true); fetchCategoryProducts('CHICKEN'); } },
                      { name: 'FRUITS', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('FRUITS'); setCategorySearch(''); setCategoryDbProducts([]); setCategoryModalOpened(true); fetchCategoryProducts('FRUITS'); } },
                      { name: 'VEG', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('VEG'); setCategorySearch(''); setCategoryDbProducts([]); setCategoryModalOpened(true); fetchCategoryProducts('VEG'); } },
                      { name: 'BAKERY AND DAIRY', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('BAKERY AND DAIRY'); setCategorySearch(''); setCategoryDbProducts([]); setCategoryModalOpened(true); fetchCategoryProducts('BAKERY AND DAIRY'); } }
                    ].map(cat => (
                      <Grid.Col span={4} key={cat.name}>
                        <Button onClick={cat.onClick} fullWidth style={{ backgroundColor: cat.color, border: '2px solid white', borderRadius: '2px', padding: '0 4px', height: '32px' }}>
                          <Text size="10px" fw="bold" ta="center" style={{ whiteSpace: 'normal', lineHeight: 1.1 }}>{cat.name}</Text>
                        </Button>
                      </Grid.Col>
                    ))}
                  </Grid>

                  {/* Inline Calculator */}
                  <Box mt="xs" p={6} style={{ border: `1px solid ${customColors.border}`, borderRadius: 4, backgroundColor: '#f0f0f0' }}>
                    <Box mb={4} p="4px 8px" style={{ background: '#222', borderRadius: 3, textAlign: 'right' }}>
                      <Text size="20px" fw={700} c="white" style={{ minHeight: 28, wordBreak: 'break-all', letterSpacing: 1 }}>
                        {calculatorValue}
                      </Text>
                    </Box>
                    <SimpleGrid cols={4} spacing={4}>
                      {['C', 'Back', '/', 'x', '7', '8', '9', '-', '4', '5', '6', '+', '1', '2', '3', '=', '0', '.', '(', ')'].map(key => (
                        <Button
                          key={key}
                          h={32}
                          p={0}
                          variant={key === '=' ? 'filled' : 'light'}
                          color={key === '=' ? 'green' : key === 'C' ? 'red' : 'orange'}
                          onClick={() => handleCalculatorInput(key)}
                          style={{ fontSize: '13px', fontWeight: 700, borderRadius: 3 }}
                        >
                          {key}
                        </Button>
                      ))}
                    </SimpleGrid>
                  </Box>

                </Grid.Col>
              </Grid>

              {/* BOTTOM PAYMENT SECTION */}
              <Flex gap={8} mt="xs">
                <Box flex={1}>
                  <Box style={{ border: `1px solid ${customColors.border}` }} bg="#dde3e5">
                    <Flex h={totalDRS > 0 ? 105 : 85}>
                      {/* CASH PAY BUTTON */}
                      <Box w="16%" style={{ borderRight: `1px solid ${customColors.border}`, cursor: 'pointer', padding: '2px' }} onClick={() => handleCheckout('CASH')}>
                        <Flex align="center" justify="center" h="100%">
                          <Text fw="bold" size="16px" ta="center" style={{ textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white', lineHeight: 1.2, color: 'black' }}>CASH<br />PAY</Text>
                        </Flex>
                      </Box>

                      {/* TOTALS GRID */}
                      <Box w="46%" style={{ borderRight: `1px solid ${customColors.border}`, display: 'flex', flexDirection: 'column' }}>
                        <Flex style={{ borderBottom: `1px solid ${customColors.border}`, flex: 1 }}>
                          <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                            <Text size="13px" c="black">Sub Total</Text>
                          </Flex>
                          <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px' }}>
                            <Text size="14px" c="black">{subTotal.toFixed(2)}</Text>
                          </Flex>
                        </Flex>
                        <Flex style={{ borderBottom: `1px solid ${customColors.border}`, flex: 1 }}>
                          <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                            <Text size="10px" c="red.7" fw={600} style={{ whiteSpace: 'nowrap' }}>Flat Discount</Text>
                          </Flex>
                          <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px', backgroundColor: '#fff3f3' }}>
                            <TextInput
                              value={flatDiscount}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '' || /^\d*\.?\d*$/.test(v)) setFlatDiscount(v);
                              }}
                              placeholder="0.00"
                              styles={{ input: { textAlign: 'right', border: 'none', background: 'transparent', height: 20, minHeight: 20, padding: 0, fontSize: '13px', color: 'red', fontWeight: 'bold' } }}
                            />
                          </Flex>
                        </Flex>
                        {totalDRS > 0 && (
                          <Flex style={{ borderBottom: `1px solid ${customColors.border}`, flex: 1 }}>
                            <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                              <Text size="13px" c="black">DRS</Text>
                            </Flex>
                            <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px' }}>
                              <Text size="14px" c="black">{totalDRS.toFixed(2)}</Text>
                            </Flex>
                          </Flex>
                        )}
                        <Flex style={{ borderBottom: `1px solid ${customColors.border}`, flex: 1 }}>
                          <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                            <Text size="13px" c="black">Deposit</Text>
                          </Flex>
                          <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px', backgroundColor: '#e2e2e2' }}>
                            <TextInput
                              value={depositInput}
                              onChange={(e) => setDepositInput(e.target.value)}
                              placeholder="0.00"
                              styles={{ input: { textAlign: 'right', border: 'none', background: 'transparent', height: 20, minHeight: 20, padding: 0, fontSize: '14px', color: 'black', fontWeight: 'bold' } }}
                            />
                          </Flex>
                        </Flex>
                        <Flex style={{ flex: 1 }}>
                          <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                            <Text size="15px" c="black">TOTAL</Text>
                          </Flex>
                          <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px' }}>
                            <Text size="16px" c="black" fw={700}>{total.toFixed(2)}</Text>
                          </Flex>
                        </Flex>
                      </Box>

                      {/* INPUTS — removed non-functional CASH/CARD display boxes */}

                      {/* SPLIT PAY BUTTON */}
                      <Box
                        w="20%"
                        style={{ borderRight: `1px solid ${customColors.border}`, cursor: 'pointer', padding: '2px', background: 'linear-gradient(135deg, #2e7d32 0%, #43a047 100%)' }}
                        onClick={() => {
                          if (cartItems.length === 0) {
                            notifications.show({ title: 'Empty Cart', message: 'Add items before paying.', color: 'yellow' });
                            return;
                          }
                          setSplitCashAmount('');
                          setSplitCardAmount('');
                          setSplitModalOpened(true);
                        }}
                      >
                        <Flex align="center" justify="center" h="100%" direction="column" gap={2}>
                          <Text fw="bold" size="11px" ta="center" style={{ lineHeight: 1.2, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>SPLIT<br />PAY</Text>
                          <Text size="9px" c="rgba(255,255,255,0.8)" ta="center">Cash+Card</Text>
                        </Flex>
                      </Box>

                      {/* CARD PAY BUTTON */}
                      <Box w="18%" style={{ position: 'relative', cursor: 'pointer', padding: '2px' }} onClick={() => handleCheckout('CARD')}>
                        <div style={{ position: 'absolute', top: '2px', left: '2px', right: '2px', bottom: '2px', backgroundImage: 'url(https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=300&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.9 }} />
                        <Flex align="center" justify="center" h="100%" style={{ position: 'relative', zIndex: 1 }}>
                          <Text fw="bold" size="14px" ta="center" style={{ textShadow: '1px 1px 0px black, -1px -1px 0px black, 1px -1px 0px black, -1px 1px 0px black', lineHeight: 1.2, color: 'white' }}>CARD<br />PAY</Text>
                        </Flex>
                      </Box>
                    </Flex>
                  </Box>

                  <Flex gap={4} mt="xs">
                    {[
                      { label: '2', bg: '#7a8954' },
                      { label: '5', bg: '#687a71' },
                      { label: '10', bg: '#cc7b7b' },
                      { label: '20', bg: '#7ba2b8' },
                      { label: '50', bg: '#dcb882' }
                    ].map((btn) => (
                      <Button
                        key={btn.label}
                        flex={1}
                        style={{ backgroundColor: btn.bg, border: '2px solid white', borderRadius: '2px', padding: '0 2px', height: '45px' }}
                        onClick={() => setDepositInput(prev => String((Number(prev) || 0) + Number(btn.label)))}
                      >
                        <Text size="18px" fw="bold" c="black">{btn.label}</Text>
                      </Button>
                    ))}
                  </Flex>

                  <Flex gap={4} mt="4px">
                    {['PAY DUES', 'SHOW ALL OFFERS', 'OPEN TILL', 'PAYBILL', 'OPTIONS'].map((opt) => (
                      <Button
                        onClick={
                          opt === 'PAYBILL'
                            ? () => {
                                if (cartItems.length === 0) {
                                  notifications.show({ title: 'Empty Cart', message: 'Add items to cart before paying.', color: 'yellow' });
                                  return;
                                }
                                setPayBillMethod('MIXED');
                                setPayBillModalOpened(true);
                              }
                            : opt === 'OPTIONS'
                              ? () => setOptionsModalOpened(true)
                              : opt === 'PAY DUES'
                                ? () => setPayDuesModalOpened(true)
                                : opt === 'SHOW ALL OFFERS'
                                  ? () => setShowOffersModalOpened(true)
                                  : opt === 'OPEN TILL'
                                    ? () => setOpenTillModalOpened(true)
                                    : undefined
                        }
                        key={opt}
                        flex={1}
                        style={{ backgroundColor: customColors.orangeBtn, border: '2px solid white', borderRadius: '2px', padding: '0 2px', height: '45px' }}
                      >
                        <Text size="11px" fw="bold" ta="center" style={{ whiteSpace: 'normal', lineHeight: 1 }}>{opt}</Text>
                      </Button>
                    ))}
                  </Flex>
                </Box>

                {/* EDIT BUTTONS BLOCK */}
                <Box w="15%">
                  <Flex direction="column" gap={4} h="100%">
                    <Button style={btnStyle} flex={1.5}><Text size="xl" fw="normal">+</Text></Button>
                    <Button style={btnStyle} flex={1.5} px={2}><Text size="12px" fw="bold" style={{ whiteSpace: 'normal', lineHeight: 1 }}>EDIT DETAILS</Text></Button>
                    <Button style={btnStyle} flex={1.5} px={2}><Text size="12px" fw="bold" style={{ whiteSpace: 'normal', lineHeight: 1 }}>EDIT PRICE</Text></Button>
                    <Button style={{ ...btnStyle, backgroundColor: '#c96263' }} flex={1} px={2}><Text size="12px" fw="bold" style={{ whiteSpace: 'normal', lineHeight: 1 }}>CLOSE<br />(Ctrl + X)</Text></Button>
                  </Flex>
                </Box>
              </Flex>
            </Flex>
          </Grid.Col>
        </Grid>
      </Box>

      {/* Printable Receipt */}
      <div style={{ display: 'none' }}>
        <div ref={componentRef}>
          {lastTransaction ? (
            <div style={{ width: '300px', padding: '8px', boxSizing: 'border-box', margin: '0 auto', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', backgroundColor: '#fff', fontSize: '12px', fontWeight: 500, lineHeight: 1.4, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ textAlign: 'center', marginBottom: '18px', borderBottom: '1px solid #000', paddingBottom: '12px' }}>
                <h1 style={{ margin: '0 0 4px', fontSize: '20px', fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 'bold', letterSpacing: '0', textTransform: 'uppercase' }}>Castlebar Halal Foods</h1>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', fontSize: '10px', color: '#333' }}>
                <div>
                  <p style={{ margin: '2px 0' }}><strong>CUSTOMER:</strong> {(lastTransaction as any).customerName || 'Walk-in'}</p>
                  {(lastTransaction as any).customerPhone && <p style={{ margin: '2px 0' }}><strong>PHONE:</strong> {(lastTransaction as any).customerPhone}</p>}
                  <p style={{ margin: '2px 0' }}><strong>DATE:</strong> {lastTransaction.date}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '2px 0' }}><strong>RECEIPT #:</strong> {lastTransaction.transactionNo}</p>
                  <p style={{ margin: '2px 0' }}><strong>STATUS:</strong> PAID</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px', fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', lineHeight: '2' }}>
                    <th style={{ width: '50%', textAlign: 'left', padding: '4px 0', fontWeight: 'bold' }}>ITEM</th>
                    <th style={{ width: '10%', textAlign: 'center', padding: '4px 0', fontWeight: 'bold' }}>QTY</th>
                    <th style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>PRICE</th>
                    <th style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 'bold' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {lastTransaction.items.map((item) => {
                    const originalPrice = item.originalPrice ?? item.price;
                    const discountPct = item.discountPct ?? 0;
                    const totalDiscountAmt = (item.discountAmt ?? 0) * item.qty;
                    const totalDRSAmt = (item.drs ?? 0) * item.qty;
                    const totalItemAmt = item.qty * item.price + totalDRSAmt;
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px dashed #eee' }}>
                        <td style={{ width: '50%', textAlign: 'left', padding: '6px 0', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 'bold', color: '#000' }}>{item.name}</div>
                          {totalDiscountAmt > 0 && (
                            <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>
                              Discount: {discountPct > 0 ? `-${discountPct}% ` : ''}(-€{totalDiscountAmt.toFixed(2)})
                            </div>
                          )}
                          {totalDRSAmt > 0 && (
                            <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', marginTop: '2px' }}>
                              DRS Deposit: +€{totalDRSAmt.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td style={{ width: '10%', textAlign: 'center', padding: '6px 0', verticalAlign: 'top' }}>{item.qty}</td>
                        <td style={{ width: '20%', textAlign: 'right', padding: '6px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>€{originalPrice.toFixed(2)}</td>
                        <td style={{ width: '20%', textAlign: 'right', padding: '6px 0', verticalAlign: 'top', fontWeight: 'bold', whiteSpace: 'nowrap' }}>€{totalItemAmt.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ width: '100%', fontSize: '11px', color: '#333' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>Subtotal:</span>
                  <span style={{ whiteSpace: 'nowrap' }}>€{lastTransaction.subTotal.toFixed(2)}</span>
                </div>
                {lastTransaction.discount && lastTransaction.discount > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#000' }}>
                    <span>Flat Discount:</span>
                    <span style={{ whiteSpace: 'nowrap' }}>-€{lastTransaction.discount.toFixed(2)}</span>
                  </div>
                ) : null}
                {lastTransaction.totalDRS && lastTransaction.totalDRS > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>Total DRS:</span>
                    <span style={{ whiteSpace: 'nowrap' }}>€{lastTransaction.totalDRS.toFixed(2)}</span>
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', borderTop: '1px solid #000', fontWeight: 'bold', fontSize: '15px', color: '#000' }}>
                  <span>TOTAL:</span>
                  <span style={{ whiteSpace: 'nowrap' }}>€{lastTransaction.total.toFixed(2)}</span>
                </div>
                {(lastTransaction as any).splitCash !== undefined && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px', borderTop: '1px dashed #ccc', marginTop: '4px', paddingTop: '4px' }}>
                      <span>Cash Paid:</span>
                      <span>{Number((lastTransaction as any).splitCash).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px' }}>
                      <span>Card Paid:</span>
                      <span>{Number((lastTransaction as any).splitCard).toFixed(2)}</span>
                    </div>
                    {Number((lastTransaction as any).change) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px', fontWeight: 'bold' }}>
                        <span>Change:</span>
                        <span>{Number((lastTransaction as any).change).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px' }}>
                  <span>Payment:</span>
                  <span>{lastTransaction.paymentMethod}</span>
                </div>
                {(lastTransaction as any).loyaltyPointsEarned !== undefined && (
                  <div style={{ marginTop: '12px', padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>⭐ LOYALTY POINTS</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                      Earned this visit: <strong>+{(lastTransaction as any).loyaltyPointsEarned} pts</strong>
                    </div>
                    <div style={{ fontSize: '11px' }}>
                      Total points: <strong>{(lastTransaction as any).loyaltyPointsTotal} pts</strong>
                    </div>
                    {(lastTransaction as any).loyaltyRewardThreshold && (
                      <div style={{ fontSize: '9px', marginTop: '4px', color: '#555' }}>
                        Reward at {(lastTransaction as any).loyaltyRewardThreshold} pts = €{(lastTransaction as any).loyaltyRewardValue} free shopping
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px', fontFamily: 'Courier, monospace' }}>No transaction data</div>
          )}
        </div>
      </div>

      <Modal
        opened={categoryModalOpened}
        onClose={() => setCategoryModalOpened(false)}
        size="100%"
        fullScreen
        withCloseButton={false}
        padding={0}
        styles={{ inner: { padding: 0 }, body: { backgroundColor: '#f4f6f8', height: '100vh', display: 'flex', flexDirection: 'column' } }}
      >
        {/* HEADER */}
        <Flex align="center" bg="white" p="md" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.05)', zIndex: 10 }}>
          <Text size="24px" fw={800} c="#2c3e50" style={{ letterSpacing: '1px' }}>{openedCategoryName}</Text>
          <Flex align="center" ml="auto" gap="xl">
            <Flex align="center" gap="sm">
              <Text size="sm" fw={600} c="dimmed">Search Product</Text>
              <TextInput
                size="md"
                placeholder="Type here..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                styles={{ input: { borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' } }}
              />
            </Flex>
            <Flex align="center" gap="sm" bg="#fff5f5" p="8px 12px" style={{ borderRadius: '8px', border: '1px solid #ffc9c9' }}>
              <Text c="red.7" size="xs" fw={600}>* Max 3 chars. Check to allow more.</Text>
              <Checkbox size="sm" color="red" />
            </Flex>
          </Flex>
        </Flex>

        {/* GRID AREA */}
        <Box flex={1} p="xl" style={{ overflowY: 'auto' }}>
          {categoryDbLoading ? (
            <Flex justify="center" align="center" h={200}>
              <Text size="lg" c="dimmed">Loading products...</Text>
            </Flex>
          ) : (() => {
            const filtered = categoryDbProducts.filter(p =>
              !categorySearch || p.name.toLowerCase().includes(categorySearch.toLowerCase())
            );
            return filtered.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '24px' }}>
                {filtered.map((product: any) => {
                  const imageUrl = resolveProductImageUrl(product.image);
                  return (
                    <Paper
                      key={product._id}
                      shadow="sm"
                      radius="lg"
                      withBorder
                      style={{ overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', display: 'flex', flexDirection: 'column', height: '190px' }}
                      onClick={() => {
                        addProductToCart(product);
                        setCategoryModalOpened(false);
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                    >
                      <Box bg="#e9ecef" style={{ height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={product.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <Text c="#adb5bd" size="sm" fw={500}>No Image</Text>
                        )}
                      </Box>
                      <Box bg="teal.6" p="sm" style={{ borderTop: '4px solid #12b886', minHeight: 62, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Text c="white" size="sm" fw={700} ta="center" lineClamp={2} style={{ lineHeight: 1.15 }}>{product.name}</Text>
                        <Text c="white" size="xs" ta="center" style={{ opacity: 0.85 }}>€ {product.price.toFixed(2)}</Text>
                      </Box>
                    </Paper>
                  );
                })}
              </div>
            ) : (
              <Flex direction="column" align="center" justify="center" h={300} gap="md">
                <Text size="xl" c="dimmed">No products found in {openedCategoryName}</Text>
                <Text size="sm" c="dimmed">Go to Product, General Products, {openedCategoryName} to add products.</Text>
              </Flex>
            );
          })()}
        </Box>

        {/* BOTTOM ACTION BAR */}
        <Flex p="md" bg="white" align="center" justify="space-between" style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.05)', zIndex: 10 }}>
          <Paper shadow="xs" w="60%" h={80} bg="#f8f9fa" withBorder radius="md" p="sm" style={{ display: 'flex', alignItems: 'center' }}>
            <Text c="dimmed" size="sm" style={{ fontStyle: 'italic' }}>Selected items will be staged for addition...</Text>
          </Paper>
          <Flex gap="md">
            <Button h={80} w={80} radius="md" variant="light" color="gray" size="xl">UP</Button>
            <Button h={80} w={80} radius="md" variant="light" color="gray" size="xl">DOWN</Button>
            <Button h={80} w={160} radius="md" color="orange.6" size="xl" style={{ boxShadow: '0 4px 14px rgba(255, 146, 43, 0.4)' }} onClick={() => setCategoryModalOpened(false)}>
              <Text size="xl" fw={800}>DONE</Text>
            </Button>
          </Flex>
        </Flex>
      </Modal>

      <Modal opened={returnPopupOpened} onClose={() => { setReturnPopupOpened(false); setDepositInput(''); }} title={<Text size="xl" fw="bold" c="dark">Change / Return Amount</Text>} centered>
        <Flex direction="column" align="center" justify="center" p="xl">
          <Text size="md" c="dimmed" mb="sm">Amount to return to customer:</Text>
          <Text size="48px" fw={900} c={returnAmount >= 0 ? 'green.7' : 'red.7'}>
            {returnAmount >= 0 ? `€ ${returnAmount.toFixed(2)}` : `-€ ${Math.abs(returnAmount).toFixed(2)}`}
          </Text>
          <Button mt="xl" size="lg" fullWidth color="blue" onClick={() => { setReturnPopupOpened(false); setDepositInput(''); }}>
            OK (Next Customer)
          </Button>
        </Flex>
      </Modal>

      {/* OPTIONS Command Panel Popup Modal */}
      <Modal
        opened={optionsModalOpened}
        onClose={() => setOptionsModalOpened(false)}
        size="lg"
        centered
        withCloseButton={false}
        padding={0}
        styles={{
          content: {
            backgroundColor: '#405c6b', // Authentic slate blue background from POS screenshot
            border: '4px solid #ffffff',
            borderRadius: '4px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          },
          body: {
            padding: '24px'
          }
        }}
      >
        <SimpleGrid cols={3} spacing="md">
          {optionButtons.map((btn) => (
            <Button
              key={btn.label}
              onClick={btn.action}
              style={{
                height: '65px',
                backgroundColor: btn.isSpecial ? '#8bc6fc' : customColors.orangeBtn,
                color: btn.isSpecial ? '#000000' : '#ffffff',
                border: '2px solid #ffffff',
                borderRadius: '2px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.2)',
                padding: '0 8px',
                transition: 'transform 0.1s ease, filter 0.1s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Text
                size="11px"
                fw="bold"
                ta="center"
                style={{
                  whiteSpace: 'normal',
                  lineHeight: 1.2,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}
              >
                {btn.label}
              </Text>
            </Button>
          ))}
        </SimpleGrid>
      </Modal>

      {/* VOID TRANS MODAL */}
      <Modal opened={voidModalOpened} onClose={() => setVoidModalOpened(false)} title="Void Transaction">
        <Select 
          label="Select Order" 
          data={orders.map(o => ({ value: o._id, label: `${o.invoiceId || 'Order #' + o._id.slice(-6)} - € ${o.total.toFixed(2)}` }))} 
          value={selectedOrderId}
          onChange={(val) => setSelectedOrderId(val || '')}
        />
        <TextInput label="Reason for void" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        <Button mt="md" fullWidth color="red" onClick={handleVoidTransaction}>Confirm Void</Button>
      </Modal>

      {/* QUICK SAVE CUSTOMER MODAL */}
      <Modal
        opened={quickSaveModalOpened}
        onClose={() => setQuickSaveModalOpened(false)}
        title={<Text size="lg" fw="bold" c="white">Quick Register Customer</Text>}
        centered
        styles={{
          content: {
            backgroundColor: '#405c6b',
            border: '4px solid #ffffff',
            borderRadius: '4px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: '#ffffff'
          },
          header: {
            backgroundColor: '#405c6b',
            color: '#ffffff'
          },
          body: {
            padding: '20px'
          },
          close: {
            color: '#ffffff'
          }
        }}
      >
        <Flex direction="column" gap="md">
          <TextInput
            label={<Text size="xs" fw="bold" c="white">Customer Name</Text>}
            placeholder="Enter customer name..."
            value={quickSaveName}
            onChange={(e) => setQuickSaveName(e.target.value)}
            required
            styles={{
              input: { borderRadius: '2px', height: '36px' }
            }}
          />
          <TextInput
            label={<Text size="xs" fw="bold" c="white">Phone Number (Required)</Text>}
            placeholder="Enter phone number..."
            value={quickSavePhone}
            onChange={(e) => setQuickSavePhone(e.target.value)}
            required
            styles={{
              input: { borderRadius: '2px', height: '36px' }
            }}
          />
          <Flex gap="sm" mt="md" justify="flex-end">
            <Button
              variant="outline"
              styles={{
                root: {
                  borderColor: '#ffffff',
                  color: '#ffffff',
                  borderRadius: '2px'
                }
              }}
              onClick={() => setQuickSaveModalOpened(false)}
            >
              Cancel
            </Button>
            <Button
              loading={quickSaveLoading}
              onClick={handleQuickSaveCustomer}
              style={{
                backgroundColor: customColors.orangeBtn,
                color: '#ffffff',
                border: '2px solid #ffffff',
                borderRadius: '2px'
              }}
            >
              Save & Link
            </Button>
          </Flex>
        </Flex>
      </Modal>

      {/* QUICK ADD PRODUCT MODAL */}
      <Modal
        opened={quickProductModalOpened}
        onClose={() => setQuickProductModalOpened(false)}
        title={
          <Flex align="center" gap="xs">
            <Text size="lg" fw={800} c="white" style={{ letterSpacing: '0.5px' }}>
              Quick Register Product
            </Text>
          </Flex>
        }
        centered
        size="lg"
        styles={{
          content: {
            backgroundColor: '#2e4a58',
            border: '3px solid #7ec8e3',
            borderRadius: '6px',
            boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
            color: '#ffffff'
          },
          header: {
            backgroundColor: '#243b47',
            color: '#ffffff',
            borderBottom: '2px solid #7ec8e3',
            paddingBottom: '12px'
          },
          body: {
            padding: '24px'
          },
          close: {
            color: '#ffffff'
          }
        }}
      >
        <Flex direction="column" gap="md">

          {/* -- REQUIRED SECTION -- */}
          <Box
            style={{
              background: 'rgba(126,200,227,0.12)',
              border: '2px solid #7ec8e3',
              borderRadius: '6px',
              padding: '16px'
            }}
          >
            <Text size="xs" fw={700} c="#7ec8e3" mb="xs" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
              Required
            </Text>
            <TextInput
              label={
                <Flex align="center" gap={4}>
                  <Text size="sm" fw={700} c="white">Product Name</Text>
                  <Text size="sm" c="#ff6b6b" fw={900}>*</Text>
                </Flex>
              }
              placeholder="e.g. Sufi Cooking Oil (5L)"
              value={quickProductName}
              onChange={(e) => setQuickProductName(e.target.value)}
              required
              size="md"
              styles={{
                input: {
                  borderRadius: '4px',
                  height: '44px',
                  fontSize: '15px',
                  fontWeight: 600,
                  border: quickProductName.trim() ? '2px solid #7ec8e3' : '2px solid #ff6b6b',
                  backgroundColor: '#1e3340',
                  color: '#ffffff',
                }
              }}
            />
            <Text size="xs" c="rgba(255,255,255,0.5)" mt={6}>
              Only Product Name is required to register. All other details can be filled later from the Products Catalog.
            </Text>
          </Box>

          {/* -- OPTIONAL SECTION -- */}
          <Divider
            label={
              <Text size="xs" fw={600} c="rgba(255,255,255,0.45)" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                Optional - Fill Later in Products Catalog
              </Text>
            }
            labelPosition="center"
            color="rgba(255,255,255,0.15)"
          />

          <Box style={{ opacity: 0.75 }}>
            <SimpleGrid cols={2} spacing="xs" mb="xs">
              <TextInput
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">Barcode (auto-filled)</Text>}
                value={quickProductBarcode}
                disabled
                styles={{
                  input: {
                    borderRadius: '3px',
                    height: '34px',
                    backgroundColor: '#1a2e3a',
                    color: 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)'
                  }
                }}
              />
              <TextInput
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">SKU</Text>}
                placeholder="Auto-generated if blank"
                value={quickProductSku}
                onChange={(e) => setQuickProductSku(e.target.value)}
                styles={{
                  input: {
                    borderRadius: '3px',
                    height: '34px',
                    backgroundColor: '#1a2e3a',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }
                }}
              />
            </SimpleGrid>

            <SimpleGrid cols={2} spacing="xs" mb="xs">
              <Select
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">Category</Text>}
                data={productCategoriesList}
                value={quickProductCategory}
                onChange={(val) => setQuickProductCategory(val || 'FISH AND SEAFOOD')}
                styles={{
                  input: {
                    borderRadius: '3px',
                    height: '34px',
                    backgroundColor: '#1a2e3a',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }
                }}
              />
              <NumberInput
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">Initial Stock</Text>}
                value={quickProductStock}
                onChange={(val) => setQuickProductStock(val)}
                min={0}
                styles={{
                  input: {
                    borderRadius: '3px',
                    height: '34px',
                    backgroundColor: '#1a2e3a',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }
                }}
              />
            </SimpleGrid>

            <SimpleGrid cols={3} spacing="xs">
              <NumberInput
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">Selling Price (€)</Text>}
                value={quickProductPrice}
                onChange={(val) => setQuickProductPrice(val)}
                min={0}
                styles={{
                  input: {
                    borderRadius: '3px',
                    height: '34px',
                    backgroundColor: '#1a2e3a',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }
                }}
              />
              <NumberInput
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">Cost Price (€)</Text>}
                value={quickProductCostPrice}
                onChange={(val) => setQuickProductCostPrice(val)}
                min={0}
                styles={{
                  input: {
                    borderRadius: '3px',
                    height: '34px',
                    backgroundColor: '#1a2e3a',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }
                }}
              />
              <NumberInput
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">VAT Rate (%)</Text>}
                value={quickProductVatRate}
                onChange={(val) => setQuickProductVatRate(val)}
                min={0}
                styles={{
                  input: {
                    borderRadius: '3px',
                    height: '34px',
                    backgroundColor: '#1a2e3a',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }
                }}
              />
            </SimpleGrid>
          </Box>

          {/* -- ACTION BUTTONS -- */}
          <Flex gap="sm" mt="sm" justify="flex-end">
            <Button
              variant="outline"
              size="sm"
              styles={{
                root: {
                  borderColor: 'rgba(255,255,255,0.35)',
                  color: 'rgba(255,255,255,0.7)',
                  borderRadius: '4px',
                  '&:hover': { borderColor: '#ffffff', color: '#ffffff' }
                }
              }}
              onClick={() => setQuickProductModalOpened(false)}
            >
              Cancel
            </Button>
            <Button
              loading={quickProductLoading}
              size="sm"
              disabled={!quickProductName.trim()}
              onClick={handleQuickSaveProduct}
              style={{
                backgroundColor: quickProductName.trim() ? customColors.orangeBtn : 'rgba(100,100,100,0.5)',
                color: '#ffffff',
                border: quickProductName.trim() ? '2px solid #ffffff' : '2px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                minWidth: '130px'
              }}
            >
              Register & Add
            </Button>
          </Flex>
        </Flex>
      </Modal>

      {/* SPLIT PAYMENT MODAL */}
      <Modal
        opened={splitModalOpened}
        onClose={() => setSplitModalOpened(false)}
        title={
          <Flex align="center" gap="xs">
            <Text fw={800} size="lg">Split Payment</Text>
            <Text size="sm" c="dimmed">- Cash + Card</Text>
          </Flex>
        }
        centered
        size="sm"
        styles={{
          content: { border: '3px solid #2e7d32', borderRadius: '6px' },
          header: { borderBottom: '2px solid #e9ecef' }
        }}
      >
        <Flex direction="column" gap="md" pt="xs">
          {/* Bill total */}
          <Box p="sm" style={{ backgroundColor: '#f1f8e9', border: '1px solid #a5d6a7', borderRadius: 6 }}>
            <Flex justify="space-between" align="center">
              <Text size="sm" c="dimmed">Bill Total</Text>
              <Text size="xl" fw={900} c="dark">€ {total.toFixed(2)}</Text>
            </Flex>
          </Box>

          {/* Cash input */}
          <NumberInput
            label="Cash Amount (€)"
            placeholder="0.00"
            min={0}
            decimalScale={2}
            value={splitCashAmount}
            onChange={(val) => {
              setSplitCashAmount(val);
              // Auto-fill remaining as card
              const cash = Number(val) || 0;
              const remaining = Math.max(0, total - cash);
              setSplitCardAmount(parseFloat(remaining.toFixed(2)));
            }}
            size="md"
            leftSection={<Text size="sm" fw={700} c="dark">€</Text>}
            styles={{
              input: { fontSize: '18px', fontWeight: 700, textAlign: 'right', borderColor: '#2e7d32', borderWidth: 2 }
            }}
          />

          {/* Card input */}
          <NumberInput
            label="Card Amount (€)"
            placeholder="0.00"
            min={0}
            decimalScale={2}
            value={splitCardAmount}
            onChange={(val) => {
              setSplitCardAmount(val);
              // Auto-fill remaining as cash
              const card = Number(val) || 0;
              const remaining = Math.max(0, total - card);
              setSplitCashAmount(parseFloat(remaining.toFixed(2)));
            }}
            size="md"
            leftSection={<Text size="sm" fw={700} c="dark">€</Text>}
            styles={{
              input: { fontSize: '18px', fontWeight: 700, textAlign: 'right', borderColor: '#1565c0', borderWidth: 2 }
            }}
          />

          {/* Running total */}
          {(() => {
            const cash = Number(splitCashAmount) || 0;
            const card = Number(splitCardAmount) || 0;
            const entered = cash + card;
            const diff = entered - total;
            const isShort = diff < -0.001;
            const isOver = diff > 0.001;
            return (
              <Box p="sm" style={{ backgroundColor: isShort ? '#fff3e0' : '#e8f5e9', border: `1px solid ${isShort ? '#ffb74d' : '#81c784'}`, borderRadius: 6 }}>
                <Flex justify="space-between" mb={4}>
                  <Text size="sm" c="dimmed">Total Entered</Text>
                  <Text size="sm" fw={700} c={isShort ? 'orange' : 'green'}>€ {entered.toFixed(2)}</Text>
                </Flex>
                {isShort && (
                  <Text size="xs" c="orange.7" fw={600}>Warning: Still short by € {Math.abs(diff).toFixed(2)}</Text>
                )}
                {isOver && (
                  <Text size="xs" c="green.7" fw={600}>Change to return: € {diff.toFixed(2)}</Text>
                )}
                {!isShort && !isOver && entered > 0 && (
                  <Text size="xs" c="green.7" fw={600}>Exact amount</Text>
                )}
              </Box>
            );
          })()}

          <Flex gap="sm" justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setSplitModalOpened(false)}>Cancel</Button>
            <Button
              size="md"
              style={{ backgroundColor: '#2e7d32', color: '#fff', minWidth: 140 }}
              disabled={(Number(splitCashAmount) || 0) + (Number(splitCardAmount) || 0) < total - 0.001}
              onClick={handleSplitPayment}
            >
              Confirm Split Pay
            </Button>
          </Flex>
        </Flex>
      </Modal>

      {/* PAY DUES Modal */}
      <Modal
        opened={payDuesModalOpened}
        onClose={() => setPayDuesModalOpened(false)}
        title={<Text fw={700} size="lg">Pay Customer Dues</Text>}
        centered
        size="md"
      >
        <Flex direction="column" gap="md" p="sm">
          <Text size="sm" c="dimmed">
            Use this to accept payment for a customer's outstanding credit balance or dues.
          </Text>
          <Autocomplete
            label="Select Customer"
            placeholder="Search by name or phone..."
            data={dbCustomers.map(c => `${c.name} (${c.contactNum1})`)}
            size="sm"
          />
          <NumberInput
            label="Amount to Pay (€)"
            placeholder="0.00"
            min={0}
            size="sm"
          />
          <Flex gap="sm" justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setPayDuesModalOpened(false)}>Cancel</Button>
            <Button
              style={{ backgroundColor: customColors.orangeBtn, color: '#fff' }}
              onClick={() => {
                setPayDuesModalOpened(false);
                notifications.show({ title: 'Dues Recorded', message: 'Customer dues payment recorded successfully.', color: 'green', icon: <IconCheck size={16} /> });
              }}
            >
              Confirm Payment
            </Button>
          </Flex>
        </Flex>
      </Modal>

      {/* SHOW ALL OFFERS Modal */}
      <Modal
        opened={showOffersModalOpened}
        onClose={() => setShowOffersModalOpened(false)}
        title={<Text fw={700} size="lg">Active Promotional Offers</Text>}
        centered
        size="lg"
      >
        {(() => {
          const offers = getActiveOffers();
          return offers.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Promo Code</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Discount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {offers.map((offer) => (
                  <Table.Tr key={offer.id}>
                    <Table.Td><Text fw={700} c="pink">{offer.code}</Text></Table.Td>
                    <Table.Td>{offer.type}</Table.Td>
                    <Table.Td fw={500}>{offer.target}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}><Text fw={700} c="green">{offer.value}% OFF</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" ta="center" py="xl">No active promotional offers at the moment.</Text>
          );
        })()}
      </Modal>

      {/* OPEN TILL Modal */}
      <Modal
        opened={openTillModalOpened}
        onClose={() => setOpenTillModalOpened(false)}
        title={<Text fw={700} size="lg">Open Till / Cash Drawer</Text>}
        centered
        size="sm"
      >
        <Flex direction="column" gap="md" p="sm">
          <Text size="sm" c="dimmed">Manage the cash drawer for this shift.</Text>
          <NumberInput
            label="Opening Cash Balance (€)"
            placeholder="Enter opening float..."
            min={0}
            size="sm"
          />
          <Flex gap="sm" justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setOpenTillModalOpened(false)}>Cancel</Button>
            <Button
              style={{ backgroundColor: customColors.orangeBtn, color: '#fff' }}
              onClick={() => {
                setOpenTillModalOpened(false);
                notifications.show({ title: 'Till Opened', message: 'Cash drawer opened and shift started.', color: 'teal', icon: <IconCheck size={16} /> });
              }}
            >
              Open Till
            </Button>
          </Flex>
        </Flex>
      </Modal>

      {/* PAYBILL Modal */}
      <Modal
        opened={payBillModalOpened}
        onClose={() => setPayBillModalOpened(false)}
        title={<Text fw={700} size="lg">Pay Bill</Text>}
        centered
        size="sm"
      >
        <Flex direction="column" gap="md" p="sm">
          <Flex justify="space-between" align="center" p="sm" style={{ backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
            <Text size="sm" c="dimmed">Items in Cart</Text>
            <Text fw={700}>{cartItems.length}</Text>
          </Flex>
          <Flex justify="space-between" align="center" p="sm" style={{ backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
            <Text size="sm" c="dimmed">Sub Total</Text>
            <Text fw={700}>€ {subTotal.toFixed(2)}</Text>
          </Flex>
          <Flex justify="space-between" align="center" p="sm" style={{ backgroundColor: '#e8f5e9', borderRadius: 8, border: '1px solid #a5d6a7' }}>
            <Text size="md" fw={700}>Total Amount</Text>
            <Text size="xl" fw={900} c="green">€ {total.toFixed(2)}</Text>
          </Flex>
          <Select
            label="Payment Method"
            data={[
              { value: 'MIXED', label: 'Mixed (Cash + Card)' },
              { value: 'CASH', label: 'Cash' },
              { value: 'CARD', label: 'Card' },
            ]}
            value={payBillMethod}
            onChange={(val) => setPayBillMethod(val || 'MIXED')}
            size="sm"
          />
          <Flex gap="sm" justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setPayBillModalOpened(false)}>Cancel</Button>
            <Button
              color="green"
              onClick={() => {
                setPayBillModalOpened(false);
                handleCheckout(payBillMethod);
              }}
            >
              Confirm & Process Payment
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
};

export default Dashboard;
