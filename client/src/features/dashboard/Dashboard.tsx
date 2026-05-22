import {
  Grid, Paper, Text, Flex, TextInput, Table, Tabs, Select, Button,
  Box, Checkbox, Modal, Autocomplete, SimpleGrid
} from '@mantine/core';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../services/api';

interface CartItem {
  id: string;
  name: string;
  barcode: string;
  qty: number;
  price: number;
}

interface Transaction {
  transactionNo: number;
  items: CartItem[];
  subTotal: number;
  deposit: number;
  total: number;
  date: string;
  paymentMethod: string;
}

interface CustomerCart {
  id: string;
  name: string;
  items: CartItem[];
  selectedItemId: string;
  customerId?: string;
  customerPhone?: string;
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
  const [carts, setCarts] = useState<CustomerCart[]>([
    { id: 'customer1', name: 'CUSTOMER 1', items: [], selectedItemId: '' },
    { id: 'customer2', name: 'CUSTOMER 2', items: [], selectedItemId: '' },
    { id: 'customer3', name: 'CUSTOMER 3', items: [], selectedItemId: '' }
  ]);
  const [activeCartId, setActiveCartId] = useState<string>('customer1');

  const [transactionNo, setTransactionNo] = useState<number>(1);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  const [stagingItem, setStagingItem] = useState<{ id?: string; name: string; barcode: string; qty: number | string; price: number | string }>({ name: '', barcode: '', qty: '', price: '' });

  const [categoryModalOpened, setCategoryModalOpened] = useState(false);
  const [optionsModalOpened, setOptionsModalOpened] = useState(false);
  const [voidModalOpened, setVoidModalOpened] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [voidReason, setVoidReason] = useState<string>('');
  const [openedCategoryName, setOpenedCategoryName] = useState('');
const [categorySearch, setCategorySearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [dbCustomers, setDbCustomers] = useState<any[]>([]);
  const [quickSaveModalOpened, setQuickSaveModalOpened] = useState(false);
  const [quickSaveName, setQuickSaveName] = useState('');
  const [quickSavePhone, setQuickSavePhone] = useState('');
  const [quickSaveLoading, setQuickSaveLoading] = useState(false);

  useEffect(() => {
    const fetchDbData = async () => {
      try {
        const [custRes, orderRes] = await Promise.all([
          api.get('/customers'),
          api.get('/orders')
        ]);
        setDbCustomers(custRes.data.data || []);
        setOrders(orderRes.data.data || []);
      } catch (err) {
        console.error("Failed to fetch initial POS data", err);
      }
    };
    fetchDbData();
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
            })),
            subTotal: lastOrder.subtotal,
            deposit: 0,
            total: lastOrder.total,
            date: new Date(lastOrder.createdAt).toLocaleString(),
            paymentMethod: lastOrder.paymentMethod || 'MIXED',
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

        const newItem: CartItem = {
          id: Date.now().toString(),
          name: product.name,
          barcode: product.barcode,
          qty: 1,
          price: discountedPrice
        };
        updateCartItems([...cartItems, newItem]);
        updateSelectedItemId(newItem.id);
        setStagingItem({ id: newItem.id, name: newItem.name, barcode: newItem.barcode, qty: 1, price: newItem.price });
        setBarcodeSearch('');

        if (discountPct > 0) {
          notifications.show({
            title: 'Discount Applied!',
            message: `${discountPct}% discount applied to ${product.name}. Price: Rs ${discountedPrice.toFixed(2)}`,
            color: 'teal',
            icon: <IconCheck size={16} />,
          });
        }
      } else {
        notifications.show({ title: 'Not Found', message: `No product found with barcode ${barcodeSearch}`, color: 'red' });
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

  const categoryItemsMap: Record<string, string[]> = {
    "FISH AND SEAFOOD": [
      "SEA BASS", "SEA BREAM", "PINK BREAM", "SARADINE", "KING FISH", "TUNA BONITO", "TUNA FILLETS",
      "SALMON", "SHARK FILLETS", "PRAWNS", "RED MULLETS", "SPANISH POMPANO", "GREY MULLETS", "RAHU FISH",
      "BOAL FISH", "MIRGAL", "HAKE FISH", "HILSHA FISH", "SALT FISH", "RED SNAPER FISH", "SMOKE TURKEY WINGS",
      "Salted dry Fish"
    ],
    "LAMB BEEF": ["LAMB CHOPS", "BEEF STEAK", "MINCED BEEF", "LAMB SHANK", "BEEF RIBS", "ROAST BEEF", "BEEF BRISKET", "LAMB LEG"],
    "CHICKEN": ["WHOLE CHICKEN", "CHICKEN BREAST", "CHICKEN WINGS", "CHICKEN THIGHS", "DRUMSTICKS", "CHICKEN MINCE", "CHICKEN LIVER"],
    "FRUITS": ["APPLE", "BANANA", "ORANGE", "MANGO", "GRAPES", "PINEAPPLE", "WATERMELON", "STRAWBERRY", "PEACH", "PEAR"],
    "VEG": ["POTATO", "ONION", "TOMATO", "CARROT", "BROCCOLI", "SPINACH", "CABBAGE", "BELL PEPPER", "GARLIC", "GINGER"],
    "BAKERY AND DAIRY": ["MILK", "BREAD", "EGGS", "BUTTER", "CHEESE", "YOGURT", "CROISSANT", "BAGUETTE", "CAKE", "MUFFIN"]
  };

  const currentCategoryItems = categoryItemsMap[openedCategoryName] || [];

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
      name: stagingItem.name,
      barcode: stagingItem.barcode,
      qty: Number(stagingItem.qty) || 1,
      price: Number(stagingItem.price) || 0
    };
    updateCartItems(prev => [...prev, newItem]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const handleUpdateItem = () => {
    if (!stagingItem.id) return;
    updateCartItems(prev => prev.map(item =>
      item.id === stagingItem.id ? { ...item, name: stagingItem.name, barcode: stagingItem.barcode, qty: Number(stagingItem.qty) || 1, price: Number(stagingItem.price) || 0 } : item
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

  const [depositInput, setDepositInput] = useState<string>('');
  const [returnPopupOpened, setReturnPopupOpened] = useState(false);
  const [returnAmount, setReturnAmount] = useState(0);

  const subTotal = cartItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const depositVal = Number(depositInput) || 0;
  const total = subTotal;

  const handleCheckout = async (method: string = 'MIXED') => {
    if (cartItems.length === 0) return;

    if (method === 'CASH') {
      const retAmt = depositVal - total;
      setReturnAmount(retAmt);
      setReturnPopupOpened(true);
    }

    // Update customer visits & revenue in MongoDB if a customer is selected
    if (activeCart.customerId) {
      try {
        await api.post(`/customers/${activeCart.customerId}/transaction`, { amount: total });
        // Refresh dbCustomers list
        const { data } = await api.get('/customers');
        setDbCustomers(data.data || []);
      } catch (err) {
        console.error("Failed to update customer stats in database", err);
      }
    }

    // Save order to the database
    try {
      await api.post('/orders', {
        items: cartItems.map(item => ({
          name: item.name,
          quantity: item.qty,
          price: item.price,
          vatRate: 0,
          vatAmount: 0,
          totalPrice: item.qty * item.price,
        })),
        subtotal: subTotal,
        totalVAT: 0,
        discount: 0,
        total,
        paymentMethod: method.toLowerCase(),
      });
    } catch (err) {
      console.error('Failed to save order to database', err);
      notifications.show({
        title: 'Order Save Failed',
        message: 'Could not save order to database. Please check your connection.',
        color: 'red',
      });
    }

    const newTransaction: Transaction = {
      transactionNo,
      items: [...cartItems],
      subTotal,
      deposit: depositVal,
      total,
      date: new Date().toLocaleString(),
      paymentMethod: method
    };

    // Add customer data fields for printing
    (newTransaction as any).customerName = activeCart.customerId ? activeCart.name : 'Walk-in';
    (newTransaction as any).customerPhone = activeCart.customerPhone || '';

    setLastTransaction(newTransaction);
    setTransactionNo(prev => prev + 1);
    updateCartItems([]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });

    // Reset selected customer for this cart tab
    setCarts(prev => prev.map(c => c.id === activeCartId ? { ...c, name: `CUSTOMER ${c.id.replace('customer', '')}`, customerId: undefined, customerPhone: undefined } : c));
  };

  const handleRePrint = () => {
    if (lastTransaction) {
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

  const optionButtons = [
    { label: 'Z REPORT', action: () => handleOptionAction('Z REPORT', '/reports/z-report-print') },
    { label: 'TILL REPORT', action: () => handleOptionAction('TILL REPORT', '/reports/sales-summary') },
    { label: 'Post Amount', action: () => handleOptionAction('Post Amount', '/reports/posting'), isSpecial: true },
    { label: 'EXCH / REF', action: () => handleOptionAction('EXCH / REF', '/reports/exchange-refund') },
    { label: 'VOID TRANS', action: () => setVoidModalOpened(true) },
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
                    if (item) setStagingItem({ id: item.id, name: item.name, barcode: item.barcode, qty: item.qty, price: item.price });
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
                          setStagingItem({ id: item.id, name: item.name, barcode: item.barcode, qty: item.qty, price: item.price });
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
                    <Select data={['admin']} defaultValue="admin" size="xs" flex={1} styles={{ input: { borderRadius: 0 } }} />
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
                            // Check if it matches a customer in the db
                            const matched = dbCustomers.find(c => `${c.name} (${c.contactNum1})` === val);
                            setCarts(prev => prev.map(c => {
                              if (c.id === activeCartId) {
                                if (matched) {
                                  return {
                                    ...c,
                                    name: matched.name,
                                    customerId: matched._id,
                                    customerPhone: matched.contactNum1
                                  };
                                } else {
                                  return {
                                    ...c,
                                    name: val || `CUSTOMER ${c.id.replace('customer', '')}`,
                                    customerId: undefined,
                                    customerPhone: undefined
                                  };
                                }
                              }
                              return c;
                            }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const typedVal = (e.target as HTMLInputElement).value.trim();
                              if (!typedVal) return;
                              const matched = dbCustomers.find(c => `${c.name} (${c.contactNum1})` === typedVal || c.name.toLowerCase() === typedVal.toLowerCase());
                              if (!matched) {
                                setQuickSaveName(typedVal);
                                setQuickSavePhone('');
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
                          <TextInput size="xs" flex={1} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                          <Button style={btnStyle} size="xs" w={60} h={24}><Text size="11px">BACK</Text></Button>
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
                  <Grid >
                    {[
                      { name: 'OPEN ITEM', color: customColors.greenBtnTop, onClick: () => handleCategoryItem('OPEN ITEM', 'open1234') },
                      { name: 'HOUSE HOLD', color: customColors.greenBtnTop, onClick: () => handleCategoryItem('HOUSE HOLD', 'hh1234') },
                      { name: 'SWEETS', color: customColors.greenBtnTop, onClick: () => handleCategoryItem('SWEETS', 'sw1234') },
                      { name: 'MINERALS', color: customColors.greenBtnMid, onClick: () => handleCategoryItem('MINERALS', 'mn1234') },
                      { name: 'VEG ITEM', color: customColors.greenBtnMid, onClick: () => handleCategoryItem('VEG ITEM', 'vg1234') },
                      { name: 'FRESH MEAT', color: customColors.greenBtnMid, onClick: () => handleCategoryItem('FRESH MEAT', 'fm1234') },
                      { name: 'FISH AND SEAFOOD', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('FISH AND SEAFOOD'); setCategoryModalOpened(true); } },
                      { name: 'LAMB BEEF', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('LAMB BEEF'); setCategoryModalOpened(true); } },
                      { name: 'CHICKEN', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('CHICKEN'); setCategoryModalOpened(true); } },
                      { name: 'FRUITS', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('FRUITS'); setCategoryModalOpened(true); } },
                      { name: 'VEG', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('VEG'); setCategoryModalOpened(true); } },
                      { name: 'BAKERY AND DAIRY', color: customColors.orangeBtn, onClick: () => { setOpenedCategoryName('BAKERY AND DAIRY'); setCategoryModalOpened(true); } }
                    ].map(cat => (
                      <Grid.Col span={4} key={cat.name}>
                        <Button onClick={cat.onClick} fullWidth style={{ backgroundColor: cat.color, border: '2px solid white', borderRadius: '2px', padding: '0 4px', height: '32px' }}>
                          <Text size="10px" fw="bold" ta="center" style={{ whiteSpace: 'normal', lineHeight: 1.1 }}>{cat.name}</Text>
                        </Button>
                      </Grid.Col>
                    ))}
                  </Grid>

                  <Grid>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '00', 'X'].map(num => (
                      <Grid.Col span={4} key={num}>
                        <Button fullWidth style={{ ...btnStyle, height: '35px' }}><Text size="xl" fw="normal">{num}</Text></Button>
                      </Grid.Col>
                    ))}
                    <Grid.Col span={6}>
                      <Button fullWidth style={{ ...btnStyle, height: '28px' }}><Text size="11px">Clear All</Text></Button>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Button fullWidth style={{ ...btnStyle, height: '28px' }}><Text size="11px">C</Text></Button>
                    </Grid.Col>
                    <Grid.Col span={3} p={0}>
                      <Box style={{ border: `1px solid ${customColors.border}`, height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: customColors.bg, marginLeft: '2px', marginTop: '2px' }}>
                        <Checkbox label={<Text size="9px" style={{ lineHeight: 1, whiteSpace: 'nowrap' }}>ENABLE<br />PRINTING</Text>} size="xs" defaultChecked />
                      </Box>
                    </Grid.Col>
                  </Grid>
                </Grid.Col>
              </Grid>

              {/* BOTTOM PAYMENT SECTION */}
              <Flex gap={8} mt="xs">
                <Box flex={1}>
                  <Box style={{ border: `1px solid ${customColors.border}` }} bg="#dde3e5">
                    <Flex h={85}>
                      {/* CASH PAY BUTTON */}
                      <Box w="18%" style={{ borderRight: `1px solid ${customColors.border}`, cursor: 'pointer', padding: '2px' }} onClick={() => handleCheckout('CASH')}>
                        <Flex align="center" justify="center" h="100%">
                          <Text fw="bold" size="16px" ta="center" style={{ textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white', lineHeight: 1.2, color: 'black' }}>CASH<br />PAY</Text>
                        </Flex>
                      </Box>

                      {/* TOTALS GRID */}
                      <Box w="38%" style={{ borderRight: `1px solid ${customColors.border}`, display: 'flex', flexDirection: 'column' }}>
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
                            <Text size="16px" c="black">{total.toFixed(2)}</Text>
                          </Flex>
                        </Flex>
                      </Box>

                      {/* INPUTS */}
                      <Box w="26%" style={{ borderRight: `1px solid ${customColors.border}` }} p="6px 8px">
                        <Flex align="center" justify="space-between" h="50%" pb="3px">
                          <Text size="12px" c="black">CASH</Text>
                          <TextInput size="md" w={70} styles={{ input: { borderRadius: 0, textAlign: 'right', height: 34, minHeight: 34, fontSize: '18px', padding: '0 4px', border: `1px solid ${customColors.border}` } }} defaultValue="0.00" />
                        </Flex>
                        <Flex align="center" justify="space-between" h="50%" pt="3px">
                          <Text size="12px" c="black">CARD</Text>
                          <TextInput size="md" w={70} styles={{ input: { borderRadius: 0, textAlign: 'right', height: 34, minHeight: 34, fontSize: '18px', padding: '0 4px', border: `1px solid ${customColors.border}` } }} defaultValue="0.00" />
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
                      <Button key={btn.label} flex={1} style={{ backgroundColor: btn.bg, border: '2px solid white', borderRadius: '2px', padding: '0 2px', height: '45px' }}>
                        <Text size="18px" fw="bold" c="black">{btn.label}</Text>
                      </Button>
                    ))}
                  </Flex>

                  <Flex gap={4} mt="4px">
                    {['PAY DUES', 'SHOW ALL OFFERS', 'OPEN TILL', 'PAYBILL', 'OPTIONS'].map((opt) => (
                      <Button
                        onClick={
                          opt === 'PAYBILL'
                            ? () => handleCheckout('MIXED')
                            : opt === 'OPTIONS'
                              ? () => setOptionsModalOpened(true)
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
            <div style={{ padding: '30px', fontFamily: 'Courier, monospace', color: '#000', backgroundColor: '#fff' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                <h1 style={{ margin: '0', fontSize: '28px', textTransform: 'uppercase' }}>STORE POS</h1>
                <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>123 Business Road, Commerce City</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
                <div>
                  <p><strong>CUSTOMER:</strong> {(lastTransaction as any).customerName || 'Walk-in'}</p>
                  {(lastTransaction as any).customerPhone && <p><strong>PHONE:</strong> {(lastTransaction as any).customerPhone}</p>}
                  <p><strong>DATE:</strong> {lastTransaction.date}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p><strong>RECEIPT #:</strong> {lastTransaction.transactionNo}</p>
                  <p><strong>STATUS:</strong> PAID</p>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000' }}>
                    <th style={{ textAlign: 'left', padding: '10px 5px' }}>DESCRIPTION</th>
                    <th style={{ textAlign: 'center', padding: '10px 5px' }}>QTY</th>
                    <th style={{ textAlign: 'right', padding: '10px 5px' }}>UNIT</th>
                    <th style={{ textAlign: 'right', padding: '10px 5px' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {lastTransaction.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px 5px' }}>{item.name}</td>
                      <td style={{ textAlign: 'center', padding: '10px 5px' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right', padding: '10px 5px' }}>{item.price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 'bold' }}>{(item.qty * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ width: '250px', marginLeft: 'auto', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                  <span>Subtotal:</span>
                  <span>{lastTransaction.subTotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #000', fontWeight: 'bold', fontSize: '18px' }}>
                  <span>TOTAL:</span>
                  <span>{lastTransaction.total.toFixed(2)}</span>
                </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '24px' }}>
            {currentCategoryItems.filter(item => item !== "").map((item, index) => (
              <Paper
                key={index}
                shadow="sm"
                radius="lg"
                withBorder
                style={{ overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', display: 'flex', flexDirection: 'column', height: '180px' }}
                onClick={() => {
                  handleCategoryItem(item, 'cat123');
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
              >
                <Box flex={1} bg="#e9ecef" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text c="#adb5bd" size="sm" fw={500}>No Image</Text>
                </Box>
                <Box bg="teal.6" p="sm" style={{ borderTop: '4px solid #12b886' }}>
                  <Text c="white" size="sm" fw={700} ta="center" style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>{item}</Text>
                </Box>
              </Paper>
            ))}
          </div>
        </Box>

        {/* BOTTOM ACTION BAR */}
        <Flex p="md" bg="white" align="center" justify="space-between" style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.05)', zIndex: 10 }}>
          <Paper shadow="xs" w="60%" h={80} bg="#f8f9fa" withBorder radius="md" p="sm" style={{ display: 'flex', alignItems: 'center' }}>
            <Text c="dimmed" size="sm" style={{ fontStyle: 'italic' }}>Selected items will be staged for addition...</Text>
          </Paper>
          <Flex gap="md">
            <Button h={80} w={80} radius="md" variant="light" color="gray" size="xl">⬆</Button>
            <Button h={80} w={80} radius="md" variant="light" color="gray" size="xl">⬇</Button>
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
            {returnAmount >= 0 ? `$${returnAmount.toFixed(2)}` : `-$${Math.abs(returnAmount).toFixed(2)}`}
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
          data={orders.map(o => ({ value: o._id, label: `Order #${o._id.slice(-6)} - $${o.total.toFixed(2)}` }))} 
          onChange={(val) => setSelectedOrderId(val || '')}
        />
        <TextInput label="Reason for void" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        <Button mt="md" fullWidth color="red" onClick={async () => {
           try {
             await api.delete(`/orders/${selectedOrderId}?reason=${voidReason}`);
             notifications.show({ title: 'Success', message: 'Order voided', color: 'green' });
             setVoidModalOpened(false);
           } catch(e) { notifications.show({ title: 'Error', message: 'Void failed', color: 'red' }); }
        }}>Confirm Void</Button>
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
    </>
  );
};

export default Dashboard;
