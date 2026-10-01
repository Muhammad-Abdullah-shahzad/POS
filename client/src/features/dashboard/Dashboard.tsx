import {
  Grid, Paper, Text, Flex, TextInput, Table, Tabs, Select, Button,
  Box, Checkbox, Modal, SimpleGrid, NumberInput, Divider, Autocomplete
} from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import api from '../../services/api';
import { fetchQuickProducts, loadQuickProducts, type QuickProductButton } from '../products/QuickProducts';
import SyncButton from '../sync/SyncButton';
import { currencySymbol, formatMoney } from '../../utils/money';
import { CURRENCIES, useCurrencyStore } from '../../store/currencyStore';
import type { CurrencyCode } from '../../store/currencyStore';
import { useSettingsStore } from '../../store/settingsStore';
import PrintableSaleDocument from '../printing/PrintableSaleDocument';
import { printPageStyle } from '../printing/printPageStyle';
import { printableSaleFromOrder } from '../printing/printableSaleFromOrder';
import type { StoredOrder } from '../printing/printableSaleFromOrder';
import { useShopDetails } from '../printing/useShopDetails';
import RemarksPrompt from './RemarksPrompt';
import { productImageUrl } from '../../utils/assetUrl';
import type { PrintableSale } from '../printing/printableSale';


/** Keeps a money field to digits and one decimal point, ignoring anything else typed. */
const amountInput = (next: string, previous: string): string => (/^\d*\.?\d*$/.test(next) ? next : previous);

/** Row height in the CASH PAY totals box, so its rows always line up cleanly. */
const PAYMENT_ROW_HEIGHT = 21;

/**
 * Height of the counter: the window less the app header (60), the page padding
 * (2 × 16) and the footer (37). Sizing it to 100vh instead pushed the bottom
 * buttons off screen, and out of reach entirely on short laptop screens.
 */
const COUNTER_HEIGHT = 'calc(100dvh - 129px)';
/** The counter's columns: its height less its own padding and border (2 × 14). */
const COUNTER_COLUMN_HEIGHT = 'calc(100dvh - 157px)';


interface CartItem {
  id: string;
  product?: string;
  name: string;
  /** Recorded when the line is added, so checkout never looks it up for loyalty points. */
  category?: string;
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

/** A sale that passed its checks and is waiting for the cashier's remarks. */
type PendingCheckout =
  | { method: 'CASH' | 'CARD' | 'CREDIT' }
  | { method: 'SPLIT'; cash: number; card: number };

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

  // Daily transaction counter — number of transactions made today. Resets to 0 each new day.
  const todayKey = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  const [dailyTxnCount, setDailyTxnCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('dailyTxnCount');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.date === todayKey()) return parsed.count || 0;
      }
    } catch { /* ignore */ }
    return 0;
  });

  // Increment the daily counter, auto-resetting if the day has rolled over since the last sale.
  const incrementDailyTxn = () => {
    const today = todayKey();
    let current = 0;
    try {
      const raw = localStorage.getItem('dailyTxnCount');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.date === today) current = parsed.count || 0;
      }
    } catch { /* ignore */ }
    const next = current + 1;
    localStorage.setItem('dailyTxnCount', JSON.stringify({ date: today, count: next }));
    setDailyTxnCount(next);
  };

  const [stagingItem, setStagingItem] = useState<StagingItem>({ name: '', barcode: '', qty: '', price: '' });

  const [apiCategories, setApiCategories] = useState<{ name: string; vatRate: number; vatType: string; loyaltyPoints?: number }[]>([]);
  const [categoryModalOpened, setCategoryModalOpened] = useState(false);
  const [optionsModalOpened, setOptionsModalOpened] = useState(false);
  const [deviceSettingsModalOpened, setDeviceSettingsModalOpened] = useState(false);
  
  const savedCurrency = useCurrencyStore((state) => state.code);
  const setCurrency = useCurrencyStore((state) => state.setCurrency);
  const { settings: storeSettings, fetchSettings } = useSettingsStore();

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
  const [payDuesCustomerId, setPayDuesCustomerId] = useState<string | null>(null);
  const [payDuesAmount, setPayDuesAmount] = useState<number | string>('');
  const [payDuesMethod, setPayDuesMethod] = useState<string>('cash');
  const [payDuesNotes, setPayDuesNotes] = useState<string>('');
  const [payDuesLoading, setPayDuesLoading] = useState(false);
  const [showOffersModalOpened, setShowOffersModalOpened] = useState(false);
  const [openTillModalOpened, setOpenTillModalOpened] = useState(false);
  const [payBillModalOpened, setPayBillModalOpened] = useState(false);
  const [payBillMethod, setPayBillMethod] = useState<string>('MIXED');
  // Edit Detail (cart line item) state
  const [editDetailModalOpened, setEditDetailModalOpened] = useState(false);
  const [editDetailForm, setEditDetailForm] = useState<{
    name: string;
    barcode: string;
    qty: number | string;
    originalPrice: number | string;
    discountPct: number | string;
    drs: number | string;
  }>({ name: '', barcode: '', qty: 1, originalPrice: 0, discountPct: 0, drs: 0 });
  const [editDetailLoading, setEditDetailLoading] = useState(false);
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
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const fetchDbData = async () => {
    try {
      const [custRes, orderRes, empRes, catRes, topProductsRes] = await Promise.all([
        api.get('/customers'),
        api.get('/orders'),
        api.get('/employees'),
        api.get('/categories'),
        api.get('/analytics/top-products?limit=9').catch(() => ({ data: { data: [] } }))
      ]);
      await fetchSettings(); // Fetch system settings into global store
      setDbCustomers(custRes.data.data || []);
      setOrders(orderRes.data.data || []);
      setTopProducts(topProductsRes.data?.data || []);
      setApiCategories((catRes.data.data || []).map((c: any) => ({
        name: c.name, vatRate: c.vatRate ?? 0, vatType: c.vatType ?? 'exclusive', loyaltyPoints: c.loyaltyPoints ?? 0,
      })));
      const empList = (empRes.data.data || []).map((e: any) => ({
        value: e._id,
        label: `${e.name}${e.role ? ` (${e.role})` : ''}`,
      }));
      setEmployees(empList);
      if (empList.length > 0) setSelectedEmployee(prev => prev || empList[0].value);
      return true;
    } catch (err) {
      console.error("Failed to fetch initial POS data", err);
      return false;
    }
  };

  useEffect(() => {
    fetchDbData();
  }, []);

  const handleSyncSettings = async () => {
    setOptionsModalOpened(false);
    notifications.show({ title: 'Syncing', message: 'Pulling latest settings and data from server...', color: 'blue' });
    const success = await fetchDbData();
    if (success) {
      notifications.show({ title: 'Sync Complete', message: 'System settings and data have been updated.', color: 'teal' });
    } else {
      notifications.show({ title: 'Sync Failed', message: 'Could not reach server.', color: 'red' });
    }
  };

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
          category: product.category || '',
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
            message: `${discountPct}% discount applied to ${product.name}. Price: ${formatMoney(discountedPrice)}`,
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
    // Check if this product is already in the cart
    const existingIndex = cartItems.findIndex(item => item.product === product._id);
    if (existingIndex !== -1) {
      // Increment quantity of the existing entry
      const updatedItems = [...cartItems];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        qty: updatedItems[existingIndex].qty + 1,
      };
      updateCartItems(updatedItems);
      updateSelectedItemId(updatedItems[existingIndex].id);
      setStagingItem({
        id: updatedItems[existingIndex].id,
        product: updatedItems[existingIndex].product,
        name: updatedItems[existingIndex].name,
        barcode: updatedItems[existingIndex].barcode,
        qty: updatedItems[existingIndex].qty,
        price: updatedItems[existingIndex].price,
        stock: updatedItems[existingIndex].stock,
        originalPrice: updatedItems[existingIndex].originalPrice,
        discountPct: updatedItems[existingIndex].discountPct,
        discountAmt: updatedItems[existingIndex].discountAmt,
        drs: updatedItems[existingIndex].drs,
      });
      return;
    }

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
      category: product.category || '',
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
        message: `${discountPct}% discount applied to ${product.name}. Price: ${formatMoney(discountedPrice)}`,
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
  /** What the printer gets: built once at checkout, read by both paper sizes. */
  const [lastPrintable, setLastPrintable] = useState<PrintableSale | null>(null);
  const receiptSize: 'Thermal' | 'A4' = storeSettings?.receiptSize === 'A4' ? 'A4' : 'Thermal';
  // Shops that never write remarks can switch the prompt off in Settings.
  const askForRemarks = storeSettings?.showRemarksPrompt !== false;
  const shop = useShopDetails();

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    pageStyle: printPageStyle(receiptSize),
    // Receipts carry inline styles only, so skip copying the app's stylesheets
    // into the print window; it opens noticeably faster without them.
    ignoreGlobalStyles: true,
  });

  // A print request is answered after React has rendered the receipt it is for.
  // Guessing with a timer could print the previous sale on a slow till.
  const [printRequest, setPrintRequest] = useState(0);
  const answeredPrintRequest = useRef(0);
  const requestPrint = () => setPrintRequest((count) => count + 1);

  useEffect(() => {
    if (printRequest === answeredPrintRequest.current) return;
    answeredPrintRequest.current = printRequest;
    handlePrint();
  }, [printRequest, handlePrint]);

  // Barcode label printing (product name on top, barcode below)
  const barcodePrintRef = useRef<HTMLDivElement>(null);
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const [barcodeItem, setBarcodeItem] = useState<{ name: string; barcode: string } | null>(null);
  const handlePrintBarcode = useReactToPrint({ contentRef: barcodePrintRef });

  // Render the barcode SVG whenever a new item is queued for printing, then print.
  useEffect(() => {
    if (!barcodeItem || !barcodeSvgRef.current) return;
    try {
      JsBarcode(barcodeSvgRef.current, barcodeItem.barcode, {
        format: 'CODE128',
        width: 2,
        height: 70,
        displayValue: true,
        fontSize: 16,
        margin: 10,
        textMargin: 4,
      });
    } catch (err) {
      console.error('Failed to render barcode', err);
      notifications.show({ title: 'Invalid Barcode', message: 'Could not generate a barcode for this value.', color: 'red' });
      return;
    }
    const t = setTimeout(() => handlePrintBarcode(), 120);
    return () => clearTimeout(t);
  }, [barcodeItem]);

  const printSelectedBarcode = () => {
    if (!selectedItemId) {
      notifications.show({ title: 'No Product Selected', message: 'Select a product in the cart first.', color: 'yellow' });
      return;
    }
    const item = cartItems.find(i => i.id === selectedItemId);
    if (!item) {
      notifications.show({ title: 'No Product Selected', message: 'Select a product in the cart first.', color: 'yellow' });
      return;
    }
    if (!item.barcode || !item.barcode.trim()) {
      notifications.show({ title: 'No Barcode', message: 'This product has no barcode to print.', color: 'yellow' });
      return;
    }
    // New object reference each time so re-printing the same product re-triggers the effect.
    setBarcodeItem({ name: item.name, barcode: item.barcode.trim() });
  };

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
    const newQty = Math.max(1, (Number(stagingItem.qty) || 0) + delta);
    setStagingItem(prev => ({ ...prev, qty: newQty }));
    if (selectedItemId) {
      updateCartItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, qty: newQty } : item));
    }
  };

  // Set the quantity of the currently staged/selected product directly (quantity number pad)
  const handleSetQuantity = (n: number) => {
    if (!stagingItem.name) return;
    setStagingItem(prev => ({ ...prev, qty: n }));
    if (selectedItemId) {
      updateCartItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, qty: n } : item));
    }
  };

  /**
   * A unit price typed at the till is the rate for this sale only: it becomes
   * the line's price on the invoice (replacing any automatic discount, since
   * the cashier has set the price outright). The product's own price in the
   * catalogue is not touched. Like the quantity buttons, it applies to the
   * selected cart line straight away.
   */
  const handlePriceChange = (val: string) => {
    if (val === '') {
      setStagingItem(prev => ({ ...prev, price: '' }));
      return;
    }
    const parsedPrice = parseFloat(val);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setStagingItem(prev => ({ ...prev, price: '' }));
      return;
    }
    const asTyped = { price: parsedPrice, originalPrice: parsedPrice, discountPct: 0, discountAmt: 0 };
    // The box keeps what was typed (so "12" can become "1200"); the cart line gets the number.
    setStagingItem(prev => ({ ...prev, ...asTyped, price: val }));
    if (selectedItemId) {
      updateCartItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, ...asTyped } : item));
    }
  };

  // Open the Edit Detail modal pre-filled with the currently selected cart line item
  const openEditDetailModal = () => {
    if (!selectedItemId) {
      notifications.show({ title: 'No Product Selected', message: 'Select a product in the cart first.', color: 'yellow' });
      return;
    }
    const item = cartItems.find(i => i.id === selectedItemId);
    if (!item) {
      notifications.show({ title: 'No Product Selected', message: 'Select a product in the cart first.', color: 'yellow' });
      return;
    }
    setEditDetailForm({
      name: item.name,
      barcode: item.barcode,
      qty: item.qty,
      originalPrice: item.originalPrice ?? item.price,
      discountPct: item.discountPct ?? 0,
      drs: item.drs ?? 0,
    });
    setEditDetailModalOpened(true);
  };

  // Persist the edited details back into the selected cart line item AND the product catalog (DB)
  const handleSaveEditDetail = async () => {
    if (!selectedItemId) return;
    const name = String(editDetailForm.name).trim();
    if (!name) {
      notifications.show({ title: 'Name Required', message: 'Product name cannot be empty.', color: 'red' });
      return;
    }
    const item = cartItems.find(i => i.id === selectedItemId);
    const barcode = String(editDetailForm.barcode).trim();
    const qty = Math.max(1, Number(editDetailForm.qty) || 1);
    const originalPrice = Math.max(0, Number(editDetailForm.originalPrice) || 0);
    const discountPct = Math.min(100, Math.max(0, Number(editDetailForm.discountPct) || 0));
    const drs = Math.max(0, Number(editDetailForm.drs) || 0);
    const discountAmt = parseFloat((originalPrice * (discountPct / 100)).toFixed(2));
    const price = parseFloat((originalPrice * (1 - discountPct / 100)).toFixed(2));

    setEditDetailLoading(true);
    try {
      // 1) Persist catalog fields to the DB (name, barcode, unit price, DRS deposit).
      //    qty is a per-sale value and is NOT a product attribute, so it is not sent.
      const productId = item?.product;
      if (productId) {
        await api.patch(`/products/${productId}`, {
          name,
          barcode,
          price: originalPrice,
          drs,
        });
      }

      // 2) Persist the per-product discount to localStorage so it survives refresh / re-scan,
      //    matching how the catalog discount is read back in (productDiscounts map by product id).
      if (productId) {
        const saved = localStorage.getItem('productDiscounts');
        const productDiscounts = saved ? JSON.parse(saved) : {};
        if (discountPct > 0) productDiscounts[productId] = discountPct;
        else delete productDiscounts[productId];
        localStorage.setItem('productDiscounts', JSON.stringify(productDiscounts));
      }

      // 3) Update the in-memory cart line so the UI reflects the change immediately.
      updateCartItems(prev => prev.map(it => it.id === selectedItemId ? {
        ...it,
        name,
        barcode,
        qty,
        originalPrice,
        discountPct,
        discountAmt,
        price,
        drs,
      } : it));

      // Keep the staging row in sync so the bottom panel reflects the edit
      setStagingItem(prev => prev.id === selectedItemId ? {
        ...prev,
        name,
        barcode,
        qty,
        originalPrice,
        discountPct,
        discountAmt,
        price,
        drs,
      } : prev);

      setEditDetailModalOpened(false);
      notifications.show({
        title: 'Details Updated',
        message: productId ? `${name} saved to catalog.` : `${name} updated for this sale.`,
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
    } catch (err: any) {
      console.error('Failed to save product details', err);
      notifications.show({
        title: 'Error Saving Details',
        message: err.response?.data?.message || err.message || 'Could not update the product.',
        color: 'red',
      });
    } finally {
      setEditDetailLoading(false);
    }
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

  // Money handed over at the till. Cash gives change on a cash sale; on a
  // credit sale both are deposits, and the rest goes on the customer account.
  const [cashDepositInput, setCashDepositInput] = useState<string>('');
  const [cardDepositInput, setCardDepositInput] = useState<string>('');
  const [flatDiscount, setFlatDiscount] = useState<string>('');
  const [returnPopupOpened, setReturnPopupOpened] = useState(false);
  // A checked sale waiting for the cashier's remarks, and how to complete it once they press OK.
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [returnAmount, setReturnAmount] = useState(0);

  const subTotal = cartItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const flatDiscountVal = Math.min(Number(flatDiscount) || 0, subTotal);
  const cashDeposit = Number(cashDepositInput) || 0;
  const cardDeposit = Number(cardDepositInput) || 0;
  const totalDRS = cartItems.reduce((acc, item) => acc + (item.qty * (item.drs || 0)), 0);
  // Sub Total, Flat Discount, Cash Deposit, Card Deposit, TOTAL, plus DRS when there is one.
  // The payment box's height is driven by this count, so a row added or removed here
  // never has to be matched by hand against a fixed pixel height elsewhere.
  const paymentRowCount = 5 + (totalDRS > 0 ? 1 : 0);
  const total = Math.max(0, subTotal - flatDiscountVal + totalDRS);

  /**
   * Everything that follows a saved sale, whatever it was paid with: keep it
   * for reprinting, move the receipt counter on, and print when printing is on.
   */
  const completeSale = (sale: PrintableSale | null, transaction: Transaction) => {
    if (sale) setLastPrintable(sale);
    setCashDepositInput('');
    setCardDepositInput('');
    setLastTransaction(transaction);
    setTransactionNo(prev => prev + 1);
    incrementDailyTxn();
    if (enablePrinting && sale) requestPrint();
  };

  /**
   * Loyalty points a sale earns: each category's points per item, or the shop's
   * rate per unit of currency when no category sets any. Cart lines carry their
   * category, so this normally needs no network at all; lines that do not (added
   * by hand, or before categories were recorded) are looked up in one parallel batch.
   */
  const loyaltyPointsForSale = async (items: CartItem[], saleTotal: number): Promise<number> => {
    const unknown = items.filter(item => item.category === undefined);
    const lookedUp = await Promise.all(
      unknown.map(async (item): Promise<[string, string]> => {
        try {
          const { data } = await api.get(`/products?search=${encodeURIComponent(item.name)}`);
          const match = (data.data || []).find((p: { _id?: string; name?: string; barcode?: string }) =>
            p._id === item.product || p.name === item.name || p.barcode === item.barcode
          );
          return [item.id, match?.category ?? ''];
        } catch {
          return [item.id, ''];
        }
      })
    );
    const categoryOf = new Map(lookedUp);
    const pointsPerItem = (category: string) => apiCategories.find(c => c.name === category)?.loyaltyPoints ?? 0;

    const categoryPoints = items.reduce(
      (sum, item) => sum + pointsPerItem(item.category ?? categoryOf.get(item.id) ?? '') * item.qty,
      0
    );
    return categoryPoints > 0 ? categoryPoints : saleTotal * (storeSettings?.loyaltyPointsPerEuro ?? 1);
  };

  /**
   * Record the customer's visit and points, then refresh the customer list
   * (balances change with credit sales). Runs after the receipt, so the till
   * never waits for it.
   */
  const recordCustomerVisit = (customerId: string, amount: number, points: number) => {
    void (async () => {
      try {
        await api.post(`/customers/${customerId}/transaction`, { amount, pointsOverride: points });
      } catch (error) {
        console.error('Failed to record the customer visit', error);
        notifications.show({
          title: 'Customer points not recorded',
          message: "The sale is saved, but this visit and its points were not added to the customer.",
          color: 'yellow',
        });
      }
      try {
        const { data } = await api.get('/customers');
        setDbCustomers(data.data || []);
      } catch {
        // The list refreshes on the next load; the sale itself is safe.
      }
    })();
  };

  /** The part of a credit sale that goes on the customer's account. */
  const creditPortion = Math.max(0, total - cashDeposit - cardDeposit);

  /**
   * A credit sale needs a customer, deposits that do not exceed the total,
   * something left to put on account, and room under the credit limit.
   */
  const creditSaleIsValid = (): boolean => {
    const refuse = (title: string, message: string) => {
      notifications.show({ title, message, color: 'red' });
      return false;
    };

    if (!activeCart.customerId) return refuse('Customer Required', 'Select a customer to put this sale on their account.');
    if (cashDeposit < 0 || cardDeposit < 0) return refuse('Invalid Deposit', 'Deposits cannot be negative.');
    if (cashDeposit + cardDeposit > total) {
      return refuse('Deposit Too High', `The deposits add up to more than the total of ${formatMoney(total)}.`);
    }
    if (creditPortion <= 0) {
      return refuse('Nothing on Account', 'The deposits cover the whole total. Use Cash, Card or Split Pay instead.');
    }

    const customer = dbCustomers.find(c => c._id === activeCart.customerId);
    const balance = Number(customer?.outstandingBalance) || 0;
    if (customer && customer.creditLimit > 0 && balance + creditPortion > customer.creditLimit) {
      return refuse('Credit Limit Exceeded', `Customer credit limit is ${formatMoney(customer.creditLimit)}.`);
    }
    return true;
  };

  /** Tells the cashier the sale went through: change for cash, a note otherwise. */
  const confirmSale = (method: string, cashDifference: number) => {
    if (method === 'CASH') {
      setReturnAmount(cashDifference);
      setReturnPopupOpened(true);
      return;
    }

    const onAccount = method === 'CREDIT';
    const deposits = [cashDeposit > 0 && `${formatMoney(cashDeposit)} cash`, cardDeposit > 0 && `${formatMoney(cardDeposit)} card`].filter(Boolean);
    notifications.show({
      title: onAccount ? 'Sale on account' : 'Card payment complete',
      message: onAccount
        ? `${formatMoney(creditPortion)} added to ${activeCart.name}'s balance${deposits.length ? ` (paid ${deposits.join(' + ')})` : ''}.`
        : `${formatMoney(total)} taken by card.`,
      color: 'teal',
      icon: <IconCheck size={16} />,
    });
  };

  const handleCheckout = async (method: string = 'MIXED', remarks = '') => {
    if (cartItems.length === 0) return;

    if (method === 'CREDIT' && !creditSaleIsValid()) return;

    // Worked out before saving, so the receipt can show them without waiting.
    const customerId = activeCart.customerId;
    const loyaltyPointsEarned = customerId ? Math.floor(await loyaltyPointsForSale(cartItems, total)) : 0;
    const loyaltyCustomer = customerId ? dbCustomers.find(c => c._id === customerId) : undefined;
    const loyaltyPointsTotal = (Number(loyaltyCustomer?.loyaltyPoints) || 0) + loyaltyPointsEarned;
    const loyaltyRewardThreshold = storeSettings?.loyaltyRewardThreshold || 0;
    const loyaltyRewardValue = storeSettings?.loyaltyRewardValue || 0;

    // Save order to the database
    let savedOrder: StoredOrder | null = null;
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
        ...(remarks && { remarks }),
        // What was handed over now; the server puts the rest on the account.
        ...(method === 'CREDIT' && { paidCash: cashDeposit, paidCard: cardDeposit }),
        ...(activeCart.customerId && {
          customerId: activeCart.customerId,
          customerName: activeCart.name
        }),
      });
      savedOrder = data?.data ?? null;
      if (data?.data) setOrders(prev => [data.data, ...prev]);
    } catch (err: any) {
      console.error('Failed to save order to database', err);
      notifications.show({
        title: 'Order Save Failed',
        message: err.response?.data?.message || err.message || 'Could not save order to database. Please check your connection.',
        color: 'red',
      });
      return;
    }

    const newTransaction: Transaction = {
      transactionNo,
      items: [...cartItems],
      subTotal,
      deposit: cashDeposit,
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

    // Negative when less cash was handed over than the total; the popup shows it in red.
    const cashDifference = method === 'CASH' ? cashDeposit - total : 0;
    const change = Math.max(0, cashDifference);
    completeSale(
      savedOrder &&
        printableSaleFromOrder(savedOrder, {
          change,
          loyalty:
            activeCart.customerId && loyaltyPointsEarned > 0
              ? { earned: loyaltyPointsEarned, total: loyaltyPointsTotal, rewardThreshold: loyaltyRewardThreshold, rewardValue: loyaltyRewardValue }
              : undefined,
        }),
      newTransaction
    );
    confirmSale(method, cashDifference);

    if (customerId) recordCustomerVisit(customerId, total, loyaltyPointsEarned);

    updateCartItems([]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
    setFlatDiscount('');

    // Reset selected customer for this cart tab
    setCarts(prev => prev.map(c => c.id === activeCartId ? { ...c, name: `CUSTOMER ${c.id.replace('customer', '')}`, customerId: undefined, customerPhone: undefined } : c));
  };

  const handleSplitPayment = () => {
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
        message: `Total entered (${formatMoney(splitTotal)}) is less than the bill (${formatMoney(total)}).`,
        color: 'red'
      });
      return;
    }

    setSplitModalOpened(false);
    proceedToCheckout({ method: 'SPLIT', cash: cashAmt, card: cardAmt });
  };

  /** Completes a split payment once the cashier has added any remarks. */
  const completeSplitPayment = async (cashAmt: number, cardAmt: number, remarks: string) => {
    const splitTotal = cashAmt + cardAmt;

    // Same points rule as every other payment; recorded after the receipt.
    const customerId = activeCart.customerId;
    const loyaltyPointsEarned = customerId ? Math.floor(await loyaltyPointsForSale(cartItems, total)) : 0;

    // Save order to DB with split payment info
    let savedOrder: StoredOrder | null = null;
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
        ...(remarks && { remarks }),
        ...(activeCart.customerId && {
          customerId: activeCart.customerId,
          customerName: activeCart.name
        }),
      });
      savedOrder = data?.data ?? null;
      if (data?.data) setOrders(prev => [data.data, ...prev]);
    } catch (err: any) {
      console.error('Failed to save split order', err);
      notifications.show({ title: 'Order Save Failed', message: err.response?.data?.message || err.message || 'Could not save order to database.', color: 'red' });
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
      paymentMethod: `SPLIT (Cash: ${formatMoney(cashAmt)} / Card: ${formatMoney(cardAmt)})`,
      discount: flatDiscountVal,
      totalDRS,
    };
    (newTransaction as any).customerName = activeCart.customerId ? activeCart.name : 'Walk-in';
    (newTransaction as any).customerPhone = activeCart.customerPhone || '';
    (newTransaction as any).splitCash = cashAmt;
    (newTransaction as any).splitCard = cardAmt;
    (newTransaction as any).change = change;

    completeSale(savedOrder && printableSaleFromOrder(savedOrder, { change }), newTransaction);
    if (customerId) recordCustomerVisit(customerId, total, loyaltyPointsEarned);

    // Show change if any
    if (change > 0) {
      setReturnAmount(change);
      setReturnPopupOpened(true);
    } else {
      notifications.show({
        title: 'Split Payment Complete',
        message: `Cash: ${formatMoney(cashAmt)}  |  Card: ${formatMoney(cardAmt)}`,
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

  const handleConfirmPayDues = async () => {
    if (!payDuesCustomerId) {
      notifications.show({ title: 'Select Customer', message: 'Please select a customer first.', color: 'red' });
      return;
    }
    const amt = Number(payDuesAmount) || 0;
    if (amt <= 0) {
      notifications.show({ title: 'Invalid Amount', message: 'Please enter a valid amount to pay.', color: 'red' });
      return;
    }
    const targetCust = dbCustomers.find(c => c._id === payDuesCustomerId);
    if (!targetCust) return;

    try {
      setPayDuesLoading(true);
      await api.post(`/customers/${payDuesCustomerId}/payments`, {
        amountPaid: amt,
        paymentMethod: payDuesMethod,
        customerName: targetCust.name,
        notes: payDuesNotes,
      });

      // Update customer balance locally in dbCustomers
      setDbCustomers(prev => prev.map(c =>
        c._id === payDuesCustomerId
          ? { ...c, outstandingBalance: Math.max(0, (c.outstandingBalance || 0) - amt) }
          : c
      ));

      const remaining = Math.max(0, (targetCust.outstandingBalance || 0) - amt);
      notifications.show({
        title: 'Payment Received',
        message: `Successfully received ${formatMoney(amt)} from ${targetCust.name}. Remaining dues: ${formatMoney(remaining)}.`,
        color: 'green',
        icon: <IconCheck size={16} />
      });
      setPayDuesModalOpened(false);
    } catch (e: any) {
      notifications.show({ title: 'Payment Failed', message: e.message || 'Failed to record payment', color: 'red' });
    } finally {
      setPayDuesLoading(false);
    }
  };

  /** Complete a sale that has already been checked. */
  const completeCheckout = (checkout: PendingCheckout, remarks: string) => {
    if (checkout.method === 'SPLIT') void completeSplitPayment(checkout.cash, checkout.card, remarks);
    else void handleCheckout(checkout.method, remarks);
  };

  /** Ask for remarks if the shop wants them; otherwise complete the sale straight away. */
  const proceedToCheckout = (checkout: PendingCheckout) => {
    if (askForRemarks) setPendingCheckout(checkout);
    else completeCheckout(checkout, '');
  };

  /**
   * A payment button: check the sale first, so the cashier is never asked for
   * remarks on a sale that cannot go through.
   */
  const startCheckout = (method: 'CASH' | 'CARD' | 'CREDIT') => {
    if (cartItems.length === 0) return;
    if (method === 'CREDIT' && !creditSaleIsValid()) return;
    proceedToCheckout({ method });
  };

  /** OK in the remarks prompt: complete the sale that was waiting, with its remarks. */
  const finishCheckout = (remarks: string) => {
    const pending = pendingCheckout;
    setPendingCheckout(null);
    if (pending) completeCheckout(pending, remarks);
  };

  const handleRePrint = () => {
    if (lastPrintable) {
      requestPrint();
    } else {
      notifications.show({ title: 'Nothing to reprint', message: 'No sale has been completed on this till yet.', color: 'yellow' });
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
    { label: 'DEVICE SETTINGS', action: () => { setOptionsModalOpened(false); setDeviceSettingsModalOpened(true); }, isSpecial: true },
    { label: 'SYNC DATA', action: handleSyncSettings, isSpecial: true },
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
          category: product.category || '',
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
      <Box p="sm" bg={customColors.bg} h={COUNTER_HEIGHT} style={{ border: `2px solid ${customColors.border}`, overflow: 'hidden' }}>
        <Grid>
          {/* LEFT COLUMN */}
          <Grid.Col span={3.5}>
            <Flex direction="column" h={COUNTER_COLUMN_HEIGHT}>
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
            <Flex direction="column" h={COUNTER_COLUMN_HEIGHT}>
              {/* Scrolls on short screens, so the payment buttons below stay in view. */}
              <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
              <Grid style={{ alignContent: 'flex-start' }}>
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
                              if (!isNaN(pVal)) {
                                setStagingItem(p => ({ ...p, qty: pVal }));
                                if (selectedItemId) {
                                  updateCartItems(prev => prev.map(item => item.id === selectedItemId ? { ...item, qty: pVal } : item));
                                }
                              }
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

                  {/* QUANTITY NUMBER PAD — sets the quantity of the selected/staged product */}
                  <Paper withBorder mt="xs" p="xs" style={{ border: `2px solid ${customColors.border}`, borderRadius: 0 }} bg={customColors.bg}>
                    <Text size="12px" fw="bold" mb={6} ta="center">Quantity</Text>
                    <SimpleGrid cols={3} spacing={6}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <Button
                          key={n}
                          style={btnStyle}
                          h={36}
                          p={0}
                          disabled={!stagingItem.name}
                          onClick={() => handleSetQuantity(n)}
                        >
                          <Text size="16px" fw="bold">{n}</Text>
                        </Button>
                      ))}
                    </SimpleGrid>
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

                  {/* TOP DEMANDED PRODUCTS */}
                  <Box mt="xs" p={6} style={{ border: `1px solid ${customColors.border}`, borderRadius: 4, backgroundColor: '#e9ecef' }}>
                    <Text size="11px" fw="bold" mb={4} ta="center" c="dimmed">TOP DEMANDED</Text>
                    {topProducts.length > 0 ? (
                      <Grid>
                        {topProducts.map(p => (
                          <Grid.Col span={4} key={p.productId}>
                            <Button 
                              onClick={() => {
                                if (p.product) addProductToCart(p.product);
                              }} 
                              fullWidth 
                              style={{ backgroundColor: '#17a2b8', border: '2px solid white', borderRadius: '2px', padding: '0 4px', height: '32px' }}
                            >
                              <Text size="10px" fw="bold" ta="center" style={{ whiteSpace: 'normal', lineHeight: 1.1, color: 'white' }}>{p.name}</Text>
                            </Button>
                          </Grid.Col>
                        ))}
                      </Grid>
                    ) : (
                      <Text size="10px" c="dimmed" ta="center" py={4}>No trending products yet.</Text>
                    )}
                  </Box>

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
              </Box>

              {/* BOTTOM PAYMENT SECTION */}
              <Flex gap={8} mt="xs" style={{ flexShrink: 0 }}>
                <Box flex={1}>
                  <Box style={{ border: `1px solid ${customColors.border}` }} bg="#dde3e5">
                    <Flex h={PAYMENT_ROW_HEIGHT * paymentRowCount}>
                      {/* CASH PAY BUTTON */}
                      <Box w="14%" style={{ borderRight: `1px solid ${customColors.border}`, cursor: 'pointer', padding: '2px' }} onClick={() => startCheckout('CASH')}>
                        <Flex align="center" justify="center" h="100%">
                          <Text fw="bold" size="14px" ta="center" style={{ textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white', lineHeight: 1.2, color: 'black' }}>CASH<br />PAY</Text>
                        </Flex>
                      </Box>

                      {/* TOTALS GRID */}
                      <Box w="44%" style={{ borderRight: `1px solid ${customColors.border}`, display: 'flex', flexDirection: 'column' }}>
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
                            <Text size="13px" c="black" style={{ whiteSpace: 'nowrap' }}>Cash Deposit</Text>
                          </Flex>
                          <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px', backgroundColor: '#e2e2e2' }}>
                            <TextInput
                              aria-label="Cash deposit"
                              value={cashDepositInput}
                              onChange={(e) => setCashDepositInput(amountInput(e.target.value, cashDepositInput))}
                              placeholder="0.00"
                              styles={{ input: { textAlign: 'right', border: 'none', background: 'transparent', height: 20, minHeight: 20, padding: 0, fontSize: '14px', color: 'black', fontWeight: 'bold' } }}
                            />
                          </Flex>
                        </Flex>
                        <Flex style={{ borderBottom: `1px solid ${customColors.border}`, flex: 1 }}>
                          <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                            <Text size="13px" c="black" style={{ whiteSpace: 'nowrap' }}>Card Deposit</Text>
                          </Flex>
                          <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px', backgroundColor: '#e2e2e2' }}>
                            <TextInput
                              aria-label="Card deposit"
                              value={cardDepositInput}
                              onChange={(e) => setCardDepositInput(amountInput(e.target.value, cardDepositInput))}
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
                        w="14%"
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
                      <Box w="14%" style={{ borderRight: `1px solid ${customColors.border}`, position: 'relative', cursor: 'pointer', padding: '2px' }} onClick={() => startCheckout('CARD')}>
                        <div style={{ position: 'absolute', top: '2px', left: '2px', right: '2px', bottom: '2px', backgroundImage: 'url(https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=300&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.9 }} />
                        <Flex align="center" justify="center" h="100%" style={{ position: 'relative', zIndex: 1 }}>
                          <Text fw="bold" size="14px" ta="center" style={{ textShadow: '1px 1px 0px black, -1px -1px 0px black, 1px -1px 0px black, -1px 1px 0px black', lineHeight: 1.2, color: 'white' }}>CARD<br />PAY</Text>
                        </Flex>
                      </Box>

                      {/* CREDIT PAY BUTTON */}
                      <Box w="14%" style={{ position: 'relative', cursor: 'pointer', padding: '2px', background: 'linear-gradient(135deg, #d32f2f 0%, #f44336 100%)' }} onClick={() => startCheckout('CREDIT')}>
                        <Flex align="center" justify="center" h="100%" direction="column" gap={2}>
                          <Text fw="bold" size="14px" ta="center" style={{ lineHeight: 1.2, color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>CREDIT<br />PAY</Text>
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
                      { label: '50', bg: '#dcb882' },
                      { label: '500', bg: '#b298c4' },
                      { label: '1000', bg: '#e5a593' }
                    ].map((btn) => (
                      <Button
                        key={btn.label}
                        flex={1}
                        style={{ backgroundColor: btn.bg, border: '2px solid white', borderRadius: '2px', padding: '0 2px', height: '45px' }}
                        onClick={() => setCashDepositInput(prev => String((Number(prev) || 0) + Number(btn.label)))}
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
                                ? () => {
                                  setPayDuesCustomerId(activeCart.customerId || null);
                                  setPayDuesAmount('');
                                  setPayDuesNotes('');
                                  setPayDuesMethod('cash');
                                  setPayDuesModalOpened(true);
                                }
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
                    <Button style={btnStyle} flex={1.5} px={2} onClick={openEditDetailModal}><Text size="12px" fw="bold" style={{ whiteSpace: 'normal', lineHeight: 1 }}>EDIT DETAILS</Text></Button>
                    <Button style={btnStyle} flex={1.5} px={2}><Text size="12px" fw="bold" style={{ whiteSpace: 'normal', lineHeight: 1 }}>EDIT PRICE</Text></Button>
                    <Button style={{ ...btnStyle, backgroundColor: '#4a8c6f' }} flex={1.5} px={2} onClick={printSelectedBarcode}><Text size="12px" fw="bold" style={{ whiteSpace: 'normal', lineHeight: 1 }}>PRINT BARCODE</Text></Button>
                    <Button style={{ ...btnStyle, backgroundColor: '#c96263' }} flex={1} px={2}><Text size="12px" fw="bold" style={{ whiteSpace: 'normal', lineHeight: 1 }}>CLOSE<br />(Ctrl + X)</Text></Button>
                  </Flex>
                </Box>
              </Flex>
            </Flex>
          </Grid.Col>
        </Grid>
      </Box>

      {/* Printable Barcode Label */}
      <div style={{ display: 'none' }}>
        <div ref={barcodePrintRef}>
          {barcodeItem && (
            <div style={{ textAlign: 'center', padding: '12px 16px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', backgroundColor: '#fff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px', lineHeight: 1.2 }}>{barcodeItem.name}</div>
              <svg ref={barcodeSvgRef} />
            </div>
          )}
        </div>
      </div>

      {/* Printable receipt: an A4 invoice or an 80mm till receipt, as Settings asks. */}
      <div style={{ display: 'none' }}>
        <div ref={componentRef}>
          <PrintableSaleDocument sale={lastPrintable} shop={shop} size={receiptSize} />
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
                  const imageUrl = productImageUrl(product.image);
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
                        <Text c="white" size="xs" ta="center" style={{ opacity: 0.85 }}>{formatMoney(product.price)}</Text>
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

      <RemarksPrompt opened={pendingCheckout !== null} onConfirm={finishCheckout} onCancel={() => setPendingCheckout(null)} />

      <Modal opened={returnPopupOpened} onClose={() => { setReturnPopupOpened(false); setCashDepositInput(''); }} title={<Text size="xl" fw="bold" c="dark">Change / Return Amount</Text>} centered>
        <Flex direction="column" align="center" justify="center" p="xl">
          <Text size="md" c="dimmed" mb="sm">Amount to return to customer:</Text>
          <Text size="48px" fw={900} c={returnAmount >= 0 ? 'green.7' : 'red.7'}>
            {formatMoney(returnAmount)}
          </Text>
          <Box mt="lg" px="xl" py="sm" style={{ backgroundColor: '#f1f3f5', borderRadius: '8px', textAlign: 'center', minWidth: '220px' }}>
            <Text size="11px" c="dimmed" fw={600} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Transactions</Text>
            <Text size="32px" fw={900} c="dark">{dailyTxnCount}</Text>
          </Box>
          <Button mt="xl" size="lg" fullWidth color="blue" onClick={() => { setReturnPopupOpened(false); setCashDepositInput(''); }}>
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

      {/* DEVICE SETTINGS MODAL */}
      <Modal opened={deviceSettingsModalOpened} onClose={() => setDeviceSettingsModalOpened(false)} title="Local Device Settings">
        <Select
          label="Currency"
          description="Used on this device only."
          data={Object.values(CURRENCIES).map(({ code, label }) => ({ value: code, label: `${label} (${code})` }))}
          value={savedCurrency}
          onChange={(val) => { if (val) setCurrency(val as CurrencyCode); }}
          allowDeselect={false}
        />
        <Button mt="xl" fullWidth onClick={() => setDeviceSettingsModalOpened(false)}>Close</Button>
      </Modal>

      {/* VOID TRANS MODAL */}
      <Modal opened={voidModalOpened} onClose={() => setVoidModalOpened(false)} title="Void Transaction">
        <Select
          label="Select Order"
          data={orders.map(o => ({ value: o._id, label: `${o.invoiceId || 'Order #' + o._id.slice(-6)} - ${formatMoney(o.total)}` }))}
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
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">Selling Price ({currencySymbol()})</Text>}
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
                label={<Text size="xs" fw={600} c="rgba(255,255,255,0.6)">Cost Price ({currencySymbol()})</Text>}
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

      {/* EDIT PRODUCT DETAILS MODAL */}
      <Modal
        opened={editDetailModalOpened}
        onClose={() => setEditDetailModalOpened(false)}
        title={
          <Flex align="center" gap="xs">
            <Text size="lg" fw={800} c="white" style={{ letterSpacing: '0.5px' }}>
              Edit Product Details
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
          body: { padding: '24px' },
          close: { color: '#ffffff' }
        }}
      >
        <Flex direction="column" gap="md">
          <TextInput
            label={
              <Flex align="center" gap={4}>
                <Text size="sm" fw={700} c="white">Product Name</Text>
                <Text size="sm" c="#ff6b6b" fw={900}>*</Text>
              </Flex>
            }
            placeholder="Product name"
            value={String(editDetailForm.name)}
            onChange={(e) => setEditDetailForm(prev => ({ ...prev, name: e.target.value }))}
            required
            size="md"
            styles={{
              input: {
                borderRadius: '4px',
                height: '44px',
                fontSize: '15px',
                fontWeight: 600,
                border: String(editDetailForm.name).trim() ? '2px solid #7ec8e3' : '2px solid #ff6b6b',
                backgroundColor: '#1e3340',
                color: '#ffffff',
              }
            }}
          />

          <SimpleGrid cols={2} spacing="sm">
            <TextInput
              label={<Text size="xs" fw={600} c="rgba(255,255,255,0.7)">Barcode</Text>}
              placeholder="Barcode"
              value={String(editDetailForm.barcode)}
              onChange={(e) => setEditDetailForm(prev => ({ ...prev, barcode: e.target.value }))}
              styles={{
                input: {
                  borderRadius: '3px', height: '38px',
                  backgroundColor: '#1a2e3a', color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)'
                }
              }}
            />
            <NumberInput
              label={<Text size="xs" fw={600} c="rgba(255,255,255,0.7)">Quantity</Text>}
              value={editDetailForm.qty}
              onChange={(val) => setEditDetailForm(prev => ({ ...prev, qty: val }))}
              min={1}
              styles={{
                input: {
                  borderRadius: '3px', height: '38px',
                  backgroundColor: '#1a2e3a', color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)'
                }
              }}
            />
          </SimpleGrid>

          <SimpleGrid cols={3} spacing="sm">
            <NumberInput
              label={<Text size="xs" fw={600} c="rgba(255,255,255,0.7)">Unit Price ({currencySymbol()})</Text>}
              value={editDetailForm.originalPrice}
              onChange={(val) => setEditDetailForm(prev => ({ ...prev, originalPrice: val }))}
              min={0}
              decimalScale={2}
              styles={{
                input: {
                  borderRadius: '3px', height: '38px',
                  backgroundColor: '#1a2e3a', color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)'
                }
              }}
            />
            <NumberInput
              label={<Text size="xs" fw={600} c="rgba(255,255,255,0.7)">Discount (%)</Text>}
              value={editDetailForm.discountPct}
              onChange={(val) => setEditDetailForm(prev => ({ ...prev, discountPct: val }))}
              min={0}
              max={100}
              styles={{
                input: {
                  borderRadius: '3px', height: '38px',
                  backgroundColor: '#1a2e3a', color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)'
                }
              }}
            />
            <NumberInput
              label={<Text size="xs" fw={600} c="rgba(255,255,255,0.7)">DRS Deposit ({currencySymbol()})</Text>}
              value={editDetailForm.drs}
              onChange={(val) => setEditDetailForm(prev => ({ ...prev, drs: val }))}
              min={0}
              decimalScale={2}
              styles={{
                input: {
                  borderRadius: '3px', height: '38px',
                  backgroundColor: '#1a2e3a', color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.2)'
                }
              }}
            />
          </SimpleGrid>

          {/* LIVE PRICE PREVIEW */}
          {(() => {
            const qty = Math.max(1, Number(editDetailForm.qty) || 1);
            const op = Math.max(0, Number(editDetailForm.originalPrice) || 0);
            const pct = Math.min(100, Math.max(0, Number(editDetailForm.discountPct) || 0));
            const drs = Math.max(0, Number(editDetailForm.drs) || 0);
            const unit = op * (1 - pct / 100);
            const lineTotal = unit * qty + drs * qty;
            return (
              <Box style={{ background: 'rgba(126,200,227,0.12)', border: '1px solid rgba(126,200,227,0.4)', borderRadius: '6px', padding: '12px' }}>
                <Flex justify="space-between" mb={4}>
                  <Text size="xs" c="rgba(255,255,255,0.7)">Discounted Unit Price</Text>
                  <Text size="xs" fw={700} c="white">{formatMoney(unit)}</Text>
                </Flex>
                <Flex justify="space-between">
                  <Text size="sm" fw={700} c="#7ec8e3">Line Total ({qty} × )</Text>
                  <Text size="sm" fw={800} c="#7ec8e3">{formatMoney(lineTotal)}</Text>
                </Flex>
              </Box>
            );
          })()}

          <Flex gap="sm" mt="sm" justify="flex-end">
            <Button
              variant="outline"
              size="sm"
              styles={{ root: { borderColor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.7)', borderRadius: '4px' } }}
              onClick={() => setEditDetailModalOpened(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={editDetailLoading}
              disabled={!String(editDetailForm.name).trim()}
              onClick={handleSaveEditDetail}
              style={{
                backgroundColor: String(editDetailForm.name).trim() ? customColors.orangeBtn : 'rgba(100,100,100,0.5)',
                color: '#ffffff',
                border: '2px solid #ffffff',
                borderRadius: '4px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                minWidth: '130px'
              }}
            >
              Save Changes
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
              <Text size="xl" fw={900} c="dark">{formatMoney(total)}</Text>
            </Flex>
          </Box>

          {/* Cash input */}
          <NumberInput
            label={`Cash Amount (${currencySymbol()})`}
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
            leftSection={<Text size="sm" fw={700} c="dark">{currencySymbol()}</Text>}
            styles={{
              input: { fontSize: '18px', fontWeight: 700, textAlign: 'right', borderColor: '#2e7d32', borderWidth: 2 }
            }}
          />

          {/* Card input */}
          <NumberInput
            label={`Card Amount (${currencySymbol()})`}
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
            leftSection={<Text size="sm" fw={700} c="dark">{currencySymbol()}</Text>}
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
                  <Text size="sm" fw={700} c={isShort ? 'orange' : 'green'}>{formatMoney(entered)}</Text>
                </Flex>
                {isShort && (
                  <Text size="xs" c="orange.7" fw={600}>Warning: Still short by {formatMoney(Math.abs(diff))}</Text>
                )}
                {isOver && (
                  <Text size="xs" c="green.7" fw={600}>Change to return: {formatMoney(diff)}</Text>
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
        <Flex direction="column" gap="sm">
          <Text size="xs" c="dimmed">
            Accept partial or full payments towards a customer's outstanding balance. Each payment reduces their total debt and is logged in the customer ledger.
          </Text>

          <Select
            label="Select Customer"
            placeholder="Search customer by name..."
            searchable
            clearable
            value={payDuesCustomerId}
            onChange={(val) => {
              setPayDuesCustomerId(val);
              setPayDuesAmount('');
            }}
            data={dbCustomers.map(c => ({
              value: c._id,
              label: `${c.name} (${c.contactNum1 || 'No Phone'}) — Due: ${formatMoney(c.outstandingBalance || 0)}`
            }))}
          />

          {(() => {
            const selCust = dbCustomers.find(c => c._id === payDuesCustomerId);
            const balance = selCust ? (selCust.outstandingBalance || 0) : 0;
            const amt = Number(payDuesAmount) || 0;
            const remaining = Math.max(0, balance - amt);

            if (!selCust) return null;

            return (
              <Flex direction="column" gap="xs">
                <Paper withBorder p="xs" radius="sm" bg={balance > 0 ? 'red.0' : 'green.0'}>
                  <Flex justify="space-between" align="center">
                    <Text size="sm" c="dimmed">Current Outstanding Balance:</Text>
                    <Text size="md" fw={700} c={balance > 0 ? 'red' : 'green'}>{formatMoney(balance)}</Text>
                  </Flex>
                </Paper>

                <NumberInput
                  label={`Amount to Pay (${currencySymbol()})`}
                  placeholder="e.g. 400"
                  min={0}
                  max={balance}
                  decimalScale={2}
                  value={payDuesAmount}
                  onChange={(val) => setPayDuesAmount(val ?? '')}
                  size="md"
                  leftSection={<Text size="sm" fw={700}>{currencySymbol()}</Text>}
                />

                <Flex gap="xs">
                  <Button
                    size="xs"
                    variant="outline"
                    color="dark"
                    onClick={() => setPayDuesAmount(balance)}
                    disabled={balance <= 0}
                  >
                    Pay Full ({formatMoney(balance)})
                  </Button>
                  {balance > 500 && (
                    <>
                      <Button size="xs" variant="subtle" color="gray" onClick={() => setPayDuesAmount(100)}>+100</Button>
                      <Button size="xs" variant="subtle" color="gray" onClick={() => setPayDuesAmount(200)}>+200</Button>
                      <Button size="xs" variant="subtle" color="gray" onClick={() => setPayDuesAmount(500)}>+500</Button>
                    </>
                  )}
                </Flex>

                {amt > 0 && (
                  <Paper withBorder p="xs" radius="sm" bg={remaining === 0 ? 'green.0' : 'blue.0'}>
                    <Flex justify="space-between" align="center">
                      <Text size="xs" c="dimmed">Remaining Balance After Payment:</Text>
                      <Text size="sm" fw={700} c={remaining === 0 ? 'green' : 'blue'}>
                        {formatMoney(remaining)} {remaining === 0 ? '(Fully Cleared!)' : ''}
                      </Text>
                    </Flex>
                  </Paper>
                )}

                <Text size="xs" fw={600} c="dimmed" mt={4}>PAYMENT METHOD</Text>
                <Flex gap="xs">
                  <Button
                    flex={1}
                    variant={payDuesMethod === 'cash' ? 'filled' : 'outline'}
                    color="dark"
                    onClick={() => setPayDuesMethod('cash')}
                  >
                    Cash
                  </Button>
                  <Button
                    flex={1}
                    variant={payDuesMethod === 'card' ? 'filled' : 'outline'}
                    color="dark"
                    onClick={() => setPayDuesMethod('card')}
                  >
                    Card
                  </Button>
                </Flex>

                <TextInput
                  label="Notes / Reference (Optional)"
                  placeholder="e.g. Installment 1, partial payment, etc."
                  value={payDuesNotes}
                  onChange={(e) => setPayDuesNotes(e.currentTarget.value)}
                  size="sm"
                />
              </Flex>
            );
          })()}

          <Flex gap="sm" justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setPayDuesModalOpened(false)}>Cancel</Button>
            <Button
              style={{ backgroundColor: customColors.orangeBtn, color: '#fff' }}
              onClick={handleConfirmPayDues}
              loading={payDuesLoading}
              disabled={!payDuesCustomerId || (Number(payDuesAmount) || 0) <= 0}
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
            label={`Opening Cash Balance (${currencySymbol()})`}
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
            <Text fw={700}>{formatMoney(subTotal)}</Text>
          </Flex>
          <Flex justify="space-between" align="center" p="sm" style={{ backgroundColor: '#e8f5e9', borderRadius: 8, border: '1px solid #a5d6a7' }}>
            <Text size="md" fw={700}>Total Amount</Text>
            <Text size="xl" fw={900} c="green">{formatMoney(total)}</Text>
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
