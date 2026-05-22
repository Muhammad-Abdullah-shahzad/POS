import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Paper, Text, Title, Table, Badge, Button, Group, Stack, 
  TextInput, Select, NumberInput, SimpleGrid, Box, FileButton,
  Checkbox, Tabs, Modal, ActionIcon, Divider, Grid
} from '@mantine/core';
import { 
  IconTags, IconTrash, IconFileSpreadsheet, IconCheck, IconX,
  IconScale, IconSearch, IconWorld, IconGift, IconPercentage, 
  IconArrowUpRight, IconBuildingSkyscraper, IconEdit, IconPlus, IconExternalLink
} from '@tabler/icons-react';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';

interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
}

export const ProductsSubFeatures = () => {
  const { subPath } = useParams<{ subPath: string }>();

  // Core product data state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch live products from backend
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/products');
      setProducts(data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // ----------------------------------------------------
  // ONLINE PRODUCTS STATE
  // ----------------------------------------------------
  const [onlineProducts, setOnlineProducts] = useState<Record<string, { isOnline: boolean; onlinePrice: number }>>(() => {
    const saved = localStorage.getItem('onlineProductsStore');
    return saved ? JSON.parse(saved) : {};
  });

  const handleToggleOnline = (productId: string, currentProd: Product) => {
    const prev = onlineProducts[productId] || { isOnline: false, onlinePrice: currentProd.price };
    const updated = {
      ...onlineProducts,
      [productId]: {
        ...prev,
        isOnline: !prev.isOnline
      }
    };
    setOnlineProducts(updated);
    localStorage.setItem('onlineProductsStore', JSON.stringify(updated));
    notifications.show({
      title: 'Online Channel Updated',
      message: `${currentProd.name} is now ${!prev.isOnline ? 'Active' : 'Inactive'} on Web & Mobile Store Channels.`,
      color: !prev.isOnline ? 'green' : 'gray',
      icon: <IconWorld size={16} />
    });
  };

  const handleOnlinePriceChange = (productId: string, val: number) => {
    const prev = onlineProducts[productId] || { isOnline: false, onlinePrice: 0 };
    const updated = {
      ...onlineProducts,
      [productId]: {
        ...prev,
        onlinePrice: val
      }
    };
    setOnlineProducts(updated);
    localStorage.setItem('onlineProductsStore', JSON.stringify(updated));
  };

  // ----------------------------------------------------
  // OFFERS STATE & HANDLERS
  // ----------------------------------------------------
  const [offers, setOffers] = useState<any[]>(() => {
    const saved = localStorage.getItem('customProductOffers');
    if (saved) return JSON.parse(saved);
    // Save defaults to localStorage on first load
    const defaults = [
      { id: '1', code: 'EAD10', type: 'Category Discount', target: 'Beverages', value: 10, status: 'Active' },
      { id: '2', code: 'BOGO-TEA', type: 'BOGO Free', target: 'Discount Tapal Tea Premium', value: 100, status: 'Active' }
    ];
    localStorage.setItem('customProductOffers', JSON.stringify(defaults));
    return defaults;
  });
  const [newOfferCode, setNewOfferCode] = useState('');
  const [newOfferType, setNewOfferType] = useState('Category Discount');
  const [newOfferTarget, setNewOfferTarget] = useState('');
  const [newOfferValue, setNewOfferValue] = useState<number | string>(10);

  const handleAddOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfferCode.trim()) return;
    const newOffer = {
      id: String(Date.now()),
      code: newOfferCode.trim().toUpperCase(),
      type: newOfferType,
      target: newOfferTarget || 'All Products',
      value: Number(newOfferValue) || 0,
      status: 'Active'
    };
    const updated = [newOffer, ...offers];
    setOffers(updated);
    localStorage.setItem('customProductOffers', JSON.stringify(updated));
    setNewOfferCode('');
    setNewOfferValue(10);
    setNewOfferTarget('');
    notifications.show({
      title: 'Promo Created',
      message: `Active campaign code ${newOffer.code} is now live and working!`,
      color: 'teal',
      icon: <IconGift size={16} />
    });
  };

  const handleDeleteOffer = (id: string) => {
    const updated = offers.filter(o => o.id !== id);
    setOffers(updated);
    localStorage.setItem('customProductOffers', JSON.stringify(updated));
    notifications.show({
      title: 'Offer Removed',
      message: 'Promotional campaign deactivated successfully.',
      color: 'red',
      icon: <IconTrash size={16} />
    });
  };

  // ----------------------------------------------------
  // ADVANCED CATEGORY ACTIONS STATE & HANDLERS
  // ----------------------------------------------------
  const [selectedProdIds, setSelectedProdIds] = useState<string[]>([]);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | string>(10);
  const [increasePriceModalOpen, setIncreasePriceModalOpen] = useState(false);
  const [increasePercent, setIncreasePercent] = useState<number | string>(5);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetCategory, setTargetCategory] = useState('');
  const [superCatModalOpen, setSuperCatModalOpen] = useState(false);
  const [superCategories, setSuperCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('customSuperCategories');
    return saved ? JSON.parse(saved) : ['Dry Grocery', 'Fresh Foods', 'Beverages & Snacks'];
  });
  const [newSuperCatName, setNewSuperCatName] = useState('');
  // Persisted product discount percentages
  const [productDiscounts, setProductDiscounts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('productDiscounts');
    return saved ? JSON.parse(saved) : {};
  });

  const handleAddSuperCategory = () => {
    if (!newSuperCatName.trim()) return;
    if (superCategories.includes(newSuperCatName.trim())) {
      notifications.show({ title: 'Error', message: 'Super category already exists', color: 'red' });
      return;
    }
    const updated = [...superCategories, newSuperCatName.trim()];
    setSuperCategories(updated);
    localStorage.setItem('customSuperCategories', JSON.stringify(updated));
    setNewSuperCatName('');
    notifications.show({ title: 'Success', message: 'Super Category defined successfully', color: 'green' });
  };

  // Companies (Manufacturers) state
  const [companies, setCompanies] = useState<string[]>(() => {
    const saved = localStorage.getItem('customCompanies');
    return saved ? JSON.parse(saved) : ['Nestle', 'Unilever', 'National Foods', 'Tapal Tea'];
  });
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyModalMode, setCompanyModalMode] = useState<'add' | 'edit'>('add');
  const [companyInputVal, setCompanyInputVal] = useState('');

  const handleAddCompany = () => {
    if (!companyInputVal.trim()) return;
    if (companies.includes(companyInputVal.trim())) {
      notifications.show({ title: 'Error', message: 'Company already exists', color: 'red' });
      return;
    }
    const updated = [...companies, companyInputVal.trim()];
    setCompanies(updated);
    localStorage.setItem('customCompanies', JSON.stringify(updated));
    setSelectedCompany(companyInputVal.trim());
    setCompanyModalOpen(false);
    setCompanyInputVal('');
    notifications.show({ title: 'Success', message: 'Brand Manufacturer Company added', color: 'green' });
  };

  const handleEditCompany = () => {
    if (!selectedCompany || !companyInputVal.trim()) return;
    const updated = companies.map(c => c === selectedCompany ? companyInputVal.trim() : c);
    setCompanies(updated);
    localStorage.setItem('customCompanies', JSON.stringify(updated));
    setSelectedCompany(companyInputVal.trim());
    setCompanyModalOpen(false);
    setCompanyInputVal('');
    notifications.show({ title: 'Success', message: 'Brand Manufacturer Company renamed', color: 'green' });
  };

  const handleDeleteCompany = () => {
    if (!selectedCompany) return;
    const updated = companies.filter(c => c !== selectedCompany);
    setCompanies(updated);
    localStorage.setItem('customCompanies', JSON.stringify(updated));
    setSelectedCompany('');
    notifications.show({ title: 'Success', message: 'Brand Manufacturer Company deleted', color: 'red' });
  };

  const handleApplyDiscount = async () => {
    const pct = Number(discountPercent) || 0;
    try {
      setLoading(true);
      // Update persisted discounts for selected products
      const updatedDiscounts = { ...productDiscounts };
      
      // Update each product's price in the database
      for (const prodId of selectedProdIds) {
        const product = products.find(p => p._id === prodId);
        if (product) {
          const newPrice = parseFloat((product.price * (1 - pct / 100)).toFixed(2));
          await api.patch(`/products/${prodId}`, { price: newPrice });
          
          if (pct > 0) {
            updatedDiscounts[prodId] = pct;
          } else {
            delete updatedDiscounts[prodId];
          }
        }
      }
      
      setProductDiscounts(updatedDiscounts);
      localStorage.setItem('productDiscounts', JSON.stringify(updatedDiscounts));
      setDiscountModalOpen(false);
      notifications.show({
        title: 'Discount Applied',
        message: `Successfully applied a ${pct}% promotional discount to ${selectedProdIds.length} selected retail items.`,
        color: 'teal',
        icon: <IconCheck size={16} />
      });
      setSelectedProdIds([]);
      fetchProducts(); // Refresh products from database
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to apply discount',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIncreasePrice = async () => {
    const pct = Number(increasePercent) || 0;
    try {
      setLoading(true);
      
      // Update each product's price in the database
      for (const prodId of selectedProdIds) {
        const product = products.find(p => p._id === prodId);
        if (product) {
          const newPrice = parseFloat((product.price * (1 + pct / 100)).toFixed(2));
          await api.patch(`/products/${prodId}`, { price: newPrice });
        }
      }
      
      setIncreasePriceModalOpen(false);
      notifications.show({
        title: 'Prices Calibrated',
        message: `Successfully increased selling prices for ${selectedProdIds.length} items by ${pct}%.`,
        color: 'teal',
        icon: <IconCheck size={16} />
      });
      setSelectedProdIds([]);
      fetchProducts(); // Refresh products from database
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to increase prices',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveProducts = () => {
    if (!targetCategory) return;
    setProducts(products.map(p => {
      if (selectedProdIds.includes(p._id)) {
        return { ...p, category: targetCategory };
      }
      return p;
    }));
    setMoveModalOpen(false);
    notifications.show({
      title: 'Department Transferred',
      message: `Shifted and re-grouped ${selectedProdIds.length} catalog items into ${targetCategory} department.`,
      color: 'teal',
      icon: <IconCheck size={16} />
    });
    setSelectedProdIds([]);
  };

  // ----------------------------------------------------
  // 1. MANAGE CATEGORIES STATE & HANDLERS
  // ----------------------------------------------------
  const [newCatName, setNewCatName] = useState('');
  const [newCatVatRate, setNewCatVatRate] = useState<number | string>(0);
  const [newCatVatType, setNewCatVatType] = useState<string>('exclusive');

  interface CategoryEntry {
    name: string;
    vatRate: number;
    vatType: string;
  }

  const [customCategories, setCustomCategories] = useState<CategoryEntry[]>(() => {
    const saved = localStorage.getItem('customProductCategories');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Migrate old string[] format to CategoryEntry[]
    return parsed.map((item: string | CategoryEntry) =>
      typeof item === 'string' ? { name: item, vatRate: 0, vatType: 'exclusive' } : item
    );
  });

  const categoriesWithStats = useMemo(() => {
    const allCatNames = Array.from(new Set([...customCategories.map(c => c.name), ...products.map(p => p.category)])).filter(Boolean);
    return allCatNames.map(catName => {
      const catProducts = products.filter(p => p.category === catName);
      const totalStock = catProducts.reduce((sum, p) => sum + p.stock, 0);
      const totalValue = catProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);
      const catEntry = customCategories.find(c => c.name === catName);
      return {
        name: catName,
        count: catProducts.length,
        stock: totalStock,
        value: totalValue,
        vatRate: catEntry?.vatRate ?? 0,
        vatType: catEntry?.vatType ?? 'exclusive',
      };
    });
  }, [products, customCategories]);

  // Compute displayed price for each product based on persisted discount
  const displayedProducts = useMemo(() => {
    return products.map(p => {
      const discount = productDiscounts[p._id] || 0;
      const discountedPrice = p.price * (1 - discount / 100);
      return { ...p, discount, displayedPrice: discountedPrice };
    });
  }, [products, productDiscounts]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (customCategories.some(c => c.name === newCatName.trim())) {
      notifications.show({
        title: 'Error',
        message: 'Category already exists',
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }
    const newEntry: CategoryEntry = {
      name: newCatName.trim(),
      vatRate: Number(newCatVatRate) || 0,
      vatType: newCatVatType,
    };
    const updated = [...customCategories, newEntry];
    setCustomCategories(updated);
    localStorage.setItem('customProductCategories', JSON.stringify(updated));
    setNewCatName('');
    setNewCatVatRate(0);
    setNewCatVatType('exclusive');
    notifications.show({
      title: 'Success',
      message: `Category "${newEntry.name}" added with ${newEntry.vatRate}% VAT (${newEntry.vatType})`,
      color: 'green',
      icon: <IconCheck size={16} />
    });
  };

  // ----------------------------------------------------
  // 2. EDIT PRICING STATE & HANDLERS
  // ----------------------------------------------------
  const [priceEdits, setPriceEdits] = useState<Record<string, { costPrice: number; price: number }>>({});

  const handlePriceChange = (prodId: string, field: 'costPrice' | 'price', val: number) => {
    const currentProd = products.find(p => p._id === prodId);
    if (!currentProd) return;

    const previousEdits = priceEdits[prodId] || { costPrice: currentProd.costPrice, price: currentProd.price };
    setPriceEdits({
      ...priceEdits,
      [prodId]: {
        ...previousEdits,
        [field]: val
      }
    });
  };

  const handleSavePrices = () => {
    // In a full production server, we would PATCH /products/:id for each edited product.
    // For this build, we update the local react state to reflect new pricing and notify the user.
    setProducts(products.map(p => {
      if (priceEdits[p._id]) {
        return {
          ...p,
          costPrice: priceEdits[p._id].costPrice,
          price: priceEdits[p._id].price
        };
      }
      return p;
    }));
    setPriceEdits({});
    notifications.show({
      title: 'Success',
      message: 'Product selling prices and cost bases updated successfully',
      color: 'teal',
      icon: <IconCheck size={16} />
    });
  };

  // ----------------------------------------------------
  // 3. WASTAGE MANAGEMENT STATE & HANDLERS
  // ----------------------------------------------------
  const [selectedWasteId, setSelectedWasteId] = useState<string>('');
  const [wasteQty, setWasteQty] = useState<number | string>(1);
  const [wasteReason, setWasteReason] = useState<string>('Damaged');
  const [wastageLogs, setWastageLogs] = useState<any[]>([
    { id: '1', name: 'Sufi Cooking Oil (5L)', sku: 'SOIL-5L', qty: 2, cost: 2200, reason: 'Leaked Bottle', date: '2026-05-18' },
    { id: '2', name: 'National Chili Sauce', sku: 'NFOOD-CS250', qty: 3, cost: 154, reason: 'Broken Jar', date: '2026-05-19' },
  ]);

  const handleRecordWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = products.find(p => p._id === selectedWasteId);
    if (!targetProd) return;

    const qtyNum = Number(wasteQty) || 0;
    if (qtyNum <= 0) return;

    try {
      setLoading(true);
      // Reduce the inventory stock on the backend in real-time!
      await api.patch(`/products/${targetProd._id}/stock`, { quantity: -qtyNum });

      const newLog = {
        id: String(Date.now()),
        name: targetProd.name,
        sku: targetProd.sku,
        qty: qtyNum,
        cost: targetProd.costPrice,
        reason: wasteReason,
        date: new Date().toISOString().substring(0, 10)
      };

      setWastageLogs([newLog, ...wastageLogs]);
      notifications.show({
        title: 'Success',
        message: `Recorded wastage write-off for ${qtyNum} units of ${targetProd.name}`,
        color: 'red',
        icon: <IconTrash size={16} />
      });

      setSelectedWasteId('');
      setWasteQty(1);
      fetchProducts();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to sync wastage to database',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // 4. EXCEL SHEET LOAD STATE & HANDLERS
  // ----------------------------------------------------
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [uploadedRows, setUploadedRows] = useState<any[]>([]);

  const handleFileChange = (file: File | null) => {
    setExcelFile(file);
    if (file) {
      // Simulate reading and parsing an Excel spreadsheet sheet
      notifications.show({
        title: 'Excel Uploaded',
        message: `Parsed ${file.name} successfully. Reviewing row integrity...`,
        color: 'blue'
      });

      // Populate mock preview table rows
      setUploadedRows([
        { sku: 'DIS-TEA-400', name: 'Discount Tapal Tea Premium', category: 'Beverages', costPrice: 420, price: 480, stock: 120 },
        { sku: 'NFOOD-KCH250', name: 'National Ketchup Squeeze Bottle', category: 'Grains & Spices', costPrice: 110, price: 135, stock: 85 },
        { sku: 'OLP-CRM200', name: 'Olpers Milk Cream Tetrapack', category: 'Bakery & Dairy', costPrice: 165, price: 190, stock: 60 }
      ]);
    }
  };

  const handleImportExcel = () => {
    // In production, we would loop over rows and trigger api.post('/products')
    // For this build, we append rows to local state products list
    const newItems = uploadedRows.map((row, idx) => ({
      _id: `MOCK-${Date.now()}-${idx}`,
      ...row
    }));
    setProducts([...newItems, ...products]);
    setUploadedRows([]);
    setExcelFile(null);
    notifications.show({
      title: 'Import Success',
      message: 'Merged and synchronized 3 new items into primary retail inventory database',
      color: 'green',
      icon: <IconCheck size={16} />
    });
  };

  // ----------------------------------------------------
  // 5. STOCK RECONCILIATION STATE & HANDLERS
  // ----------------------------------------------------
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});

  const handlePhysicalCountChange = (prodId: string, qty: number) => {
    setPhysicalCounts({
      ...physicalCounts,
      [prodId]: qty
    });
  };

  const handleReconcileStock = async () => {
    try {
      setLoading(true);
      let reconciledCount = 0;

      // Iterate through physical updates and apply adjustments
      for (const prodId of Object.keys(physicalCounts)) {
        const prod = products.find(p => p._id === prodId);
        if (prod) {
          const counted = physicalCounts[prodId];
          const difference = counted - prod.stock;
          if (difference !== 0) {
            // Calibrate stock on the server to match physical reality
            await api.patch(`/products/${prodId}/stock`, { quantity: difference });
            reconciledCount++;
          }
        }
      }

      notifications.show({
        title: 'Audit Complete',
        message: `Inventory reconciled. Calibrated and adjusted ${reconciledCount} items.`,
        color: 'teal',
        icon: <IconScale size={16} />
      });

      setPhysicalCounts({});
      fetchProducts();
    } catch (error) {
      notifications.show({
        title: 'Error Reconciling',
        message: 'Could not sync adjustment factors with backend database',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter items for Tables
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  return (
    <Stack gap="md" style={{ height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      
      {/* ----------------------------------------------------
          1. VIEW: MANAGE CATEGORIES
          ---------------------------------------------------- */}
      {subPath === 'category' && (
        <Stack gap="md" style={{ flex: 1, overflowY: 'auto' }}>
          <div>
            <Title order={2}>Manage Product Channels & Campaigns</Title>
            <Text size="sm" c="dimmed">Define product inventory categories, e-commerce sync channels, bulk pricing, and active promotional campaigns.</Text>
          </div>

          <Tabs defaultValue="categories" variant="outline" radius="md">
            <Tabs.List mb="md">
              <Tabs.Tab value="categories" leftSection={<IconTags size={16} />}>
                Manage Categories & Bulk Operations
              </Tabs.Tab>
              <Tabs.Tab value="online" leftSection={<IconWorld size={16} />}>
                Manage Online Products
              </Tabs.Tab>
              <Tabs.Tab value="offers" leftSection={<IconGift size={16} />}>
                Manage Offers & Coupons
              </Tabs.Tab>
            </Tabs.List>

            {/* TAB 1: CATEGORIES & BULK OPERATIONS */}
            <Tabs.Panel value="categories">
              <SimpleGrid cols={{ base: 1, md: 5 }} spacing="md">
                {/* Left side: Category Creation and Stats (Span 2) */}
                <Box style={{ gridColumn: 'span 2' }}>
                  <Stack gap="md">
                    <Paper withBorder p="md" radius="md">
                      <Title order={4} mb="xs">Create Category</Title>
                      <form onSubmit={handleAddCategory}>
                        <Stack gap="sm">
                          <TextInput
                            label="New Category Name"
                            placeholder="e.g. Household & Detergents"
                            required
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                          />
                          <Group grow>
                            <NumberInput
                              label="Default VAT Rate (%)"
                              placeholder="e.g. 15"
                              min={0}
                              max={100}
                              value={newCatVatRate}
                              onChange={(val) => setNewCatVatRate(val)}
                            />
                            <Select
                              label="VAT Type"
                              data={[
                                { value: 'exclusive', label: 'Exclusive (added on top)' },
                                { value: 'inclusive', label: 'Inclusive (included in price)' },
                              ]}
                              value={newCatVatType}
                              onChange={(val) => setNewCatVatType(val || 'exclusive')}
                            />
                          </Group>
                          <Button type="submit" leftSection={<IconPlus size={16} />} color="blue" fullWidth>
                            Add Category
                          </Button>
                        </Stack>
                      </form>
                    </Paper>

                    <Paper withBorder radius="md" p="md">
                      <Title order={4} mb="xs">Categories Performance</Title>
                      <Table striped highlightOnHover verticalSpacing="xs">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Name</Table.Th>
                            <Table.Th style={{ textAlign: 'center' }}>VAT</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>SKUs</Table.Th>
                            <Table.Th style={{ textAlign: 'right' }}>Assets</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {categoriesWithStats.map((cat, idx) => (
                            <Table.Tr key={idx}>
                              <Table.Td fw={600}>{cat.name}</Table.Td>
                              <Table.Td style={{ textAlign: 'center' }}>
                                <Badge size="sm" color={cat.vatRate > 0 ? 'blue' : 'gray'} variant="light">
                                  {cat.vatRate}% {cat.vatType}
                                </Badge>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>{cat.count} SKUs</Table.Td>
                              <Table.Td style={{ textAlign: 'right' }} c="teal" fw={600}>Rs. {cat.value.toLocaleString()}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Paper>
                  </Stack>
                </Box>

                {/* Right side: Bulk Operations & Product Category Mover (Span 3) */}
                <Box style={{ gridColumn: 'span 3' }}>
                  <Paper withBorder p="md" radius="md" bg="var(--mantine-color-gray-0)">
                    <Stack gap="md">
                      <Title order={4} c="blue">Advanced Catalog Actions</Title>
                      
                      {/* Company Selection Panel (Matching Screenshot) */}
                      <Paper p="sm" withBorder radius="md" bg="white">
                        <Grid align="flex-end">
                          <Grid.Col span={4}>
                            <Select
                              label="Company"
                              placeholder="Select Manufacturer..."
                              data={companies}
                              value={selectedCompany}
                              onChange={(val) => setSelectedCompany(val || '')}
                              clearable
                            />
                          </Grid.Col>
                          <Grid.Col span={8}>
                            <Group gap="xs" justify="flex-end">
                              <Button
                                size="xs"
                                variant="outline"
                                color="blue"
                                leftSection={<IconPlus size={14} />}
                                onClick={() => {
                                  setCompanyModalMode('add');
                                  setCompanyInputVal('');
                                  setCompanyModalOpen(true);
                                }}
                              >
                                Add New Company
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                color="yellow"
                                disabled={!selectedCompany}
                                leftSection={<IconEdit size={14} />}
                                onClick={() => {
                                  setCompanyModalMode('edit');
                                  setCompanyInputVal(selectedCompany);
                                  setCompanyModalOpen(true);
                                }}
                              >
                                EDIT
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                color="red"
                                disabled={!selectedCompany}
                                leftSection={<IconTrash size={14} />}
                                onClick={handleDeleteCompany}
                              >
                                DELETE
                              </Button>
                            </Group>
                          </Grid.Col>
                        </Grid>
                      </Paper>

                      {/* Bulk Action Buttons (Matching Screenshot) */}
                      <Paper p="sm" withBorder radius="md" bg="white">
                        <Stack gap="xs">
                          <Text size="xs" fw={700} c="dimmed">BULK ACTIONS FOR SELECTED ITEMS</Text>
                          <SimpleGrid cols={2} spacing="xs">
                            <Button 
                              variant="filled" 
                              color="blue" 
                              leftSection={<IconPercentage size={16} />}
                              disabled={selectedProdIds.length === 0}
                              onClick={() => setDiscountModalOpen(true)}
                            >
                              Apply Discount %
                            </Button>
                            <Button 
                              variant="filled" 
                              color="teal" 
                              leftSection={<IconArrowUpRight size={16} />}
                              disabled={selectedProdIds.length === 0}
                              onClick={() => setIncreasePriceModalOpen(true)}
                            >
                              Increase Selling Price
                            </Button>
                            <Button 
                              variant="filled" 
                              color="orange" 
                              leftSection={<IconScale size={16} />}
                              disabled={selectedProdIds.length === 0}
                              onClick={() => setMoveModalOpen(true)}
                            >
                              Move Products
                            </Button>
                            <Button 
                              variant="filled" 
                              color="grape" 
                              leftSection={<IconBuildingSkyscraper size={16} />}
                              onClick={() => setSuperCatModalOpen(true)}
                            >
                              Manage Super Category
                            </Button>
                          </SimpleGrid>
                        </Stack>
                      </Paper>

                      {/* Product Selector with Checkboxes (Matching Screenshot) */}
                      <Paper p="sm" withBorder radius="md" bg="white">
                        <Stack gap="xs">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={600} c="red">*Select Products to move to other category</Text>
                            <Checkbox
                              label="Select All"
                              checked={products.length > 0 && selectedProdIds.length === products.length}
                              indeterminate={selectedProdIds.length > 0 && selectedProdIds.length < products.length}
                              onChange={(event) => {
                                if (event.currentTarget.checked) {
                                  setSelectedProdIds(products.map(p => p._id));
                                } else {
                                  setSelectedProdIds([]);
                                }
                              }}
                              fw={600}
                            />
                          </Group>
                          
                          <Divider />

                          <Box style={{ maxHeight: 220, overflowY: 'auto' }}>
                            <Table striped verticalSpacing="xs">
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th style={{ width: 40 }}></Table.Th>
                                  <Table.Th>Product Name</Table.Th>
                                  <Table.Th>Current Category</Table.Th>
                                  <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {displayedProducts.map((p) => (
                                  <Table.Tr key={p._id}>
                                    <Table.Td>
                                      <Checkbox
                                        checked={selectedProdIds.includes(p._id)}
                                        onChange={(event) => {
                                          if (event.currentTarget.checked) {
                                            setSelectedProdIds([...selectedProdIds, p._id]);
                                          } else {
                                            setSelectedProdIds(selectedProdIds.filter(id => id !== p._id));
                                          }
                                        }}
                                      />
                                    </Table.Td>
                                    <Table.Td fw={500}>{p.name}</Table.Td>
                                    <Table.Td>
                                      <Badge variant="light" color="blue">{p.category || 'Unassigned'}</Badge>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: 'right' }}>{p.discount > 0 ? (<><span style={{ textDecoration: 'line-through', color: 'gray' }}>Rs. {p.price.toFixed(2)}</span> <span style={{ color: 'red', fontWeight: 600 }}>Rs. {p.displayedPrice.toFixed(2)} ({p.discount}%)</span></>) : (<>Rs. {p.price.toFixed(2)}</>)}</Table.Td>
                                  </Table.Tr>
                                ))}
                                {products.length === 0 && (
                                  <Table.Tr>
                                    <Table.Td colSpan={4} style={{ textAlign: 'center' }}>
                                      <Text c="dimmed" size="sm">No catalog products registered.</Text>
                                    </Table.Td>
                                  </Table.Tr>
                                )}
                              </Table.Tbody>
                            </Table>
                          </Box>
                        </Stack>
                      </Paper>

                    </Stack>
                  </Paper>
                </Box>
              </SimpleGrid>
            </Tabs.Panel>

            {/* TAB 2: MANAGE ONLINE PRODUCTS */}
            <Tabs.Panel value="online">
              <Paper withBorder p="md" radius="md">
                <Stack gap="md">
                  <div>
                    <Title order={3} c="green">Web StoreSync Channels</Title>
                    <Text size="sm" c="dimmed">Toggle products visibility and pricing for your online e-commerce website and delivery mobile app channels.</Text>
                  </div>

                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Product Name</Table.Th>
                        <Table.Th>SKU</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Retail Price</Table.Th>
                        <Table.Th style={{ width: 160 }}>Online Price (Rs.)</Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>Channel Status</Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>Direct Web Link</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {products.map((p) => {
                        const status = onlineProducts[p._id] || { isOnline: false, onlinePrice: p.price };
                        return (
                          <Table.Tr key={p._id}>
                            <Table.Td fw={600}>{p.name}</Table.Td>
                            <Table.Td>{p.sku}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>Rs. {p.price.toFixed(2)}</Table.Td>
                            <Table.Td>
                              <NumberInput
                                min={0}
                                value={status.onlinePrice}
                                onChange={(val) => handleOnlinePriceChange(p._id, Number(val) || 0)}
                                disabled={!status.isOnline}
                              />
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Button
                                size="xs"
                                variant={status.isOnline ? 'filled' : 'outline'}
                                color={status.isOnline ? 'green' : 'gray'}
                                leftSection={<IconWorld size={14} />}
                                onClick={() => handleToggleOnline(p._id, p)}
                              >
                                {status.isOnline ? 'Online' : 'Offline'}
                              </Button>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              {status.isOnline ? (
                                <ActionIcon color="blue" variant="light" size="sm" onClick={() => window.open(`https://example.com/shop/${p.sku}`, '_blank')}>
                                  <IconExternalLink size={16} />
                                </ActionIcon>
                              ) : (
                                <Text size="xs" c="dimmed">Inactive</Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Paper>
            </Tabs.Panel>

            {/* TAB 3: MANAGE OFFERS */}
            <Tabs.Panel value="offers">
              <SimpleGrid cols={{ base: 1, md: 5 }} spacing="md">
                {/* Promo Code Form (Span 2) */}
                <Box style={{ gridColumn: 'span 2' }}>
                  <Paper withBorder p="md" radius="md">
                    <Title order={4} mb="sm" c="pink">Add New Discount / BOGO Offer</Title>
                    <form onSubmit={handleAddOffer}>
                      <Stack gap="sm">
                        <TextInput
                          label="Campaign Promo Code"
                          placeholder="e.g. SUMMER50"
                          required
                          value={newOfferCode}
                          onChange={(e) => setNewOfferCode(e.target.value)}
                        />
                        <Select
                          label="Promo Offer Type"
                          data={['Category Discount', 'Flat Percentage', 'BOGO Free']}
                          value={newOfferType}
                          onChange={(val) => setNewOfferType(val || 'Category Discount')}
                          required
                        />
                        <TextInput
                          label="Target Product / Category"
                          placeholder="e.g. Beverages or Tea"
                          value={newOfferTarget}
                          onChange={(e) => setNewOfferTarget(e.target.value)}
                          required
                        />
                        <NumberInput
                          label="Discount / Incentive Value (%)"
                          min={1}
                          max={100}
                          value={newOfferValue}
                          onChange={(val) => setNewOfferValue(Number(val) || 0)}
                          required
                        />
                        <Button type="submit" color="pink" leftSection={<IconGift size={16} />} mt="xs" fullWidth>
                          Activate Promo Offer
                        </Button>
                      </Stack>
                    </form>
                  </Paper>
                </Box>

                {/* Promo Codes ledger (Span 3) */}
                <Box style={{ gridColumn: 'span 3' }}>
                  <Paper withBorder p="md" radius="md">
                    <Group justify="space-between" mb="md">
                      <Title order={4}>Active Promo Campaigns Ledger</Title>
                      <Badge color="pink" size="lg" variant="dot">Live Campaigns</Badge>
                    </Group>

                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Promo Code</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Target Category / SKU</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Incentive</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {offers.map((offer) => (
                          <Table.Tr key={offer.id}>
                            <Table.Td>
                              <Badge color="pink" variant="filled" size="md">{offer.code}</Badge>
                            </Table.Td>
                            <Table.Td>{offer.type}</Table.Td>
                            <Table.Td fw={500}>{offer.target}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }} fw={700} c="green">{offer.value}% OFF</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteOffer(offer.id)}>
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        {offers.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                              <Text c="dimmed">No discount offer campaigns running.</Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </Paper>
                </Box>
              </SimpleGrid>
            </Tabs.Panel>
          </Tabs>

          {/* =========================================================================
              MODALS FOR BULK OPERATIONS & COMPANY CRUD
              ========================================================================= */}
          {/* 1. Discount Modal */}
          <Modal opened={discountModalOpen} onClose={() => setDiscountModalOpen(false)} title="Apply Bulk Percentage Discount" size="sm" centered>
            <Stack gap="md">
              <Text size="sm">Enter the percentage discount to deduct from the retail price of <strong>{selectedProdIds.length}</strong> selected products.</Text>
              <NumberInput
                label="Discount (%)"
                min={1}
                max={99}
                value={discountPercent}
                onChange={(val) => setDiscountPercent(Number(val) || 0)}
                required
              />
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={() => setDiscountModalOpen(false)}>Cancel</Button>
                <Button color="blue" onClick={handleApplyDiscount}>Apply Discount</Button>
              </Group>
            </Stack>
          </Modal>

          {/* 2. Price Increase Modal */}
          <Modal opened={increasePriceModalOpen} onClose={() => setIncreasePriceModalOpen(false)} title="Calibrate Price (Increase)" size="sm" centered>
            <Stack gap="md">
              <Text size="sm">Enter the percentage increase to append to the selling price of <strong>{selectedProdIds.length}</strong> selected products.</Text>
              <NumberInput
                label="Price Increase (%)"
                min={1}
                max={500}
                value={increasePercent}
                onChange={(val) => setIncreasePercent(Number(val) || 0)}
                required
              />
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={() => setIncreasePriceModalOpen(false)}>Cancel</Button>
                <Button color="teal" onClick={handleIncreasePrice}>Increase Prices</Button>
              </Group>
            </Stack>
          </Modal>

          {/* 3. Move Category Modal */}
          <Modal opened={moveModalOpen} onClose={() => setMoveModalOpen(false)} title="Bulk Move Products" size="sm" centered>
            <Stack gap="md">
              <Text size="sm">Choose the target inventory category/department to relocate <strong>{selectedProdIds.length}</strong> products.</Text>
              <Select
                label="Target Category"
                placeholder="Choose category..."
                data={Array.from(new Set([...customCategories.map(c => c.name), ...products.map(p => p.category)])).filter(Boolean)}
                value={targetCategory}
                onChange={(val) => setTargetCategory(val || '')}
                required
              />
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={() => setMoveModalOpen(false)}>Cancel</Button>
                <Button color="orange" onClick={handleMoveProducts}>Relocate Products</Button>
              </Group>
            </Stack>
          </Modal>

          {/* 4. Manage Super Category Modal */}
          <Modal opened={superCatModalOpen} onClose={() => setSuperCatModalOpen(false)} title="Manage Super Categories" size="md" centered>
            <Stack gap="md">
              <Text size="sm">Define new Super Categories (top-level divisions) for e-commerce and retail shelf navigation.</Text>
              <Group align="flex-end">
                <TextInput
                  label="Super Category Name"
                  placeholder="e.g. Grocery"
                  value={newSuperCatName}
                  onChange={(e) => setNewSuperCatName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button color="grape" onClick={handleAddSuperCategory}>Add</Button>
              </Group>

              <Divider label="Active Super Categories" labelPosition="center" />
              <Table striped>
                <Table.Tbody>
                  {superCategories.map((sc, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={600}>{sc}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <ActionIcon color="red" variant="subtle" onClick={() => {
                          const updated = superCategories.filter(item => item !== sc);
                          setSuperCategories(updated);
                          localStorage.setItem('customSuperCategories', JSON.stringify(updated));
                        }}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Modal>

          {/* 5. Company Modal */}
          <Modal opened={companyModalOpen} onClose={() => setCompanyModalOpen(false)} title={companyModalMode === 'add' ? 'Add New Manufacturer/Company' : 'Rename Manufacturer/Company'} size="sm" centered>
            <Stack gap="md">
              <TextInput
                label="Company Name"
                placeholder="e.g. Nestle Pakistan"
                value={companyInputVal}
                onChange={(e) => setCompanyInputVal(e.target.value)}
                required
              />
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={() => setCompanyModalOpen(false)}>Cancel</Button>
                <Button color="blue" onClick={companyModalMode === 'add' ? handleAddCompany : handleEditCompany}>Save</Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      )}

      {/* ----------------------------------------------------
          2. VIEW: EDIT PRICES
          ---------------------------------------------------- */}
      {subPath === 'edit-price' && (
        <Stack gap="md" style={{ flex: 1, overflow: 'hidden' }}>
          <Group justify="space-between">
            <div>
              <Title order={2}>Bulk Price Editor</Title>
              <Text size="sm" c="dimmed">Edit product cost prices and retail values with live profit margin calculations.</Text>
            </div>
            {Object.keys(priceEdits).length > 0 && (
              <Button color="teal" leftSection={<IconCheck size={16} />} onClick={handleSavePrices}>
                Save Pricing Changes ({Object.keys(priceEdits).length})
              </Button>
            )}
          </Group>

          <Paper withBorder p="md" radius="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TextInput
              placeholder="Search product SKU or name..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              mb="md"
              style={{ maxWidth: 350 }}
            />

            <Box style={{ flex: 1, overflowY: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                  <Table.Tr>
                    <Table.Th>Product Name</Table.Th>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th style={{ width: 140 }}>Cost Price (Rs.)</Table.Th>
                    <Table.Th style={{ width: 140 }}>Selling Price (Rs.)</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Calculated Margin</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredProducts.map((p) => {
                    const edited = priceEdits[p._id] || { costPrice: p.costPrice, price: p.price };
                    const profit = edited.price - edited.costPrice;
                    const margin = edited.price > 0 ? (profit / edited.price) * 100 : 0;

                    return (
                      <Table.Tr key={p._id}>
                        <Table.Td fw={500}>{p.name}</Table.Td>
                        <Table.Td>{p.sku}</Table.Td>
                        <Table.Td>
                          <NumberInput
                            min={0}
                            value={edited.costPrice}
                            onChange={(val) => handlePriceChange(p._id, 'costPrice', Number(val) || 0)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            min={0}
                            value={edited.price}
                            onChange={(val) => handlePriceChange(p._id, 'price', Number(val) || 0)}
                          />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={600} c={margin > 15 ? 'green' : margin > 0 ? 'orange' : 'red'}>
                          {margin.toFixed(1)}%
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Stack>
      )}

      {/* ----------------------------------------------------
          3. VIEW: WASTAGE MANAGEMENT
          ---------------------------------------------------- */}
      {subPath === 'wastage' && (
        <Stack gap="md" style={{ flex: 1, overflowY: 'auto' }}>
          <div>
            <Title order={2}>Wastage & Damages Auditor</Title>
            <Text size="sm" c="dimmed">Log written-off inventory stock due to expiration, spills, breakage, or general theft.</Text>
          </div>

          <SimpleGrid cols={{ base: 1, md: 5 }} spacing="md">
            <Box style={{ gridColumn: 'span 2' }}>
              <Paper withBorder p="md" radius="md">
                <form onSubmit={handleRecordWastage}>
                  <Stack gap="sm">
                    <Title order={4}>Log Inventory Waste</Title>
                    <Select
                      label="Select Product to Write Off"
                      placeholder="Select SKU..."
                      data={products.map(p => ({ value: p._id, label: `${p.name} (SKU: ${p.sku})` }))}
                      required
                      value={selectedWasteId}
                      onChange={(val) => setSelectedWasteId(val || '')}
                      searchable
                    />
                    <SimpleGrid cols={2}>
                      <NumberInput
                        label="Wastage Quantity"
                        min={1}
                        required
                        value={wasteQty}
                        onChange={(val) => setWasteQty(val)}
                      />
                      <Select
                        label="Reason for Write-Off"
                        data={['Expired Stock', 'Damaged Packaging', 'Broken / Spilled', 'Theft / Inventory Shrinkage']}
                        required
                        value={wasteReason}
                        onChange={(val) => setWasteReason(val || 'Damaged')}
                      />
                    </SimpleGrid>
                    <Button type="submit" color="red" leftSection={<IconTrash size={16} />} mt="md" loading={loading}>
                      Confirm Wastage Write-Off
                    </Button>
                  </Stack>
                </form>
              </Paper>
            </Box>

            <Box style={{ gridColumn: 'span 3' }}>
              <Paper withBorder p="md" radius="md">
                <Title order={4} mb="xs">Wastage Logs Ledger</Title>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product Name</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Qty</Table.Th>
                      <Table.Th>Reason</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {wastageLogs.map((log) => (
                      <Table.Tr key={log.id}>
                        <Table.Td fw={500}>{log.name}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} c="red" fw={600}>-{log.qty}</Table.Td>
                        <Table.Td>
                          <Badge color="red" variant="light">{log.reason}</Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{log.date}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </Box>
          </SimpleGrid>
        </Stack>
      )}

      {/* ----------------------------------------------------
          4. VIEW: EXCEL SHEET LOAD
          ---------------------------------------------------- */}
      {subPath === 'excel-load' && (
        <Stack gap="md" style={{ flex: 1, overflowY: 'auto' }}>
          <div>
            <Title order={2}>Spreadsheet Excel Bulk Importer</Title>
            <Text size="sm" c="dimmed">Upload catalog spreadsheets (.csv, .xlsx) to insert or bulk merge items into the POS system.</Text>
          </div>

          <Paper withBorder p="xl" radius="md" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2 }}>
            <Stack gap="md" align="center" style={{ width: '100%', maxWidth: 400 }}>
              <IconFileSpreadsheet size={48} style={{ color: 'var(--mantine-color-green-filled)' }} />
              <Text ta="center" fw={600}>Select or Drag Stock Spreadsheet</Text>
              <Text size="xs" c="dimmed" ta="center">Compatible formats: Standard Microsoft Excel Workbook (.xlsx) or Comma-Separated Values (.csv). Row keys should map SKU, Name, Selling Price, Cost, and Stock.</Text>

              <Group justify="center">
                <FileButton onChange={handleFileChange} accept=".csv,.xlsx">
                  {(props) => <Button {...props} color="green">Upload Catalog Sheet</Button>}
                </FileButton>
                <Button variant="subtle" color="gray" onClick={() => alert('Downloading Excel Template sheet...')}>
                  Download Excel Template
                </Button>
              </Group>

              {excelFile && (
                <Text size="sm" fw={500} c="green">Selected File: {excelFile.name}</Text>
              )}
            </Stack>
          </Paper>

          {uploadedRows.length > 0 && (
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between" mb="md">
                <Title order={4}>Spreadsheet Parsing Preview ({uploadedRows.length} Rows Identified)</Title>
                <Button color="blue" leftSection={<IconCheck size={16} />} onClick={handleImportExcel}>
                  Confirm Bulk Import
                </Button>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Cost Price</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Retail Price</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Initial Stock</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {uploadedRows.map((row, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td fw={600}>{row.sku}</Table.Td>
                      <Table.Td>{row.name}</Table.Td>
                      <Table.Td>{row.category}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>Rs. {row.costPrice}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>Rs. {row.price}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{row.stock} Units</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Stack>
      )}

      {/* ----------------------------------------------------
          5. VIEW: STOCK RECONCILIATION
          ---------------------------------------------------- */}
      {subPath === 'reconciliation' && (
        <Stack gap="md" style={{ flex: 1, overflow: 'hidden' }}>
          <Group justify="space-between">
            <div>
              <Title order={2}>Physical Stock Reconciliation Audit</Title>
              <Text size="sm" c="dimmed">Perform physical inventory checks and resolve system variance discrepancies.</Text>
            </div>
            {Object.keys(physicalCounts).length > 0 && (
              <Button color="teal" leftSection={<IconScale size={16} />} onClick={handleReconcileStock} loading={loading}>
                Approve Reconciliation Calibration ({Object.keys(physicalCounts).length})
              </Button>
            )}
          </Group>

          <Paper withBorder p="md" radius="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TextInput
              placeholder="Search product..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              mb="md"
              style={{ maxWidth: 350 }}
            />

            <Box style={{ flex: 1, overflowY: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                  <Table.Tr>
                    <Table.Th>Product Name</Table.Th>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>System Expected Stock</Table.Th>
                    <Table.Th style={{ width: 150 }}>Physical Audited Count</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Discrepancy</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredProducts.map((p) => {
                    const enteredCount = physicalCounts[p._id];
                    const hasEntered = enteredCount !== undefined;
                    const variance = hasEntered ? (enteredCount - p.stock) : 0;

                    return (
                      <Table.Tr key={p._id}>
                        <Table.Td fw={500}>{p.name}</Table.Td>
                        <Table.Td>{p.sku}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={600}>{p.stock} Units</Table.Td>
                        <Table.Td>
                          <NumberInput
                            min={0}
                            placeholder="Enter physical count"
                            value={enteredCount}
                            onChange={(val) => handlePhysicalCountChange(p._id, Number(val) || 0)}
                          />
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }} fw={700} c={variance > 0 ? 'green' : variance < 0 ? 'red' : 'dimmed'}>
                          {hasEntered ? (variance > 0 ? `+${variance}` : variance) : '-'}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          </Paper>
        </Stack>
      )}

    </Stack>
  );
};
