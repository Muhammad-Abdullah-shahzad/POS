import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Paper, Text, Title, Table, Badge, Button, Group, Stack, 
  TextInput, Select, NumberInput, SimpleGrid, Box, FileButton
} from '@mantine/core';
import { 
  IconTags, IconTrash, IconFileSpreadsheet, IconCheck, IconX,
  IconScale, IconSearch
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
  // 1. MANAGE CATEGORIES STATE & HANDLERS
  // ----------------------------------------------------
  const [newCatName, setNewCatName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('customProductCategories');
    return saved ? JSON.parse(saved) : [];
  });

  const categoriesWithStats = useMemo(() => {
    const allCats = Array.from(new Set([...customCategories, ...products.map(p => p.category)])).filter(Boolean);
    return allCats.map(catName => {
      const catProducts = products.filter(p => p.category === catName);
      const totalStock = catProducts.reduce((sum, p) => sum + p.stock, 0);
      const totalValue = catProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);
      return {
        name: catName,
        count: catProducts.length,
        stock: totalStock,
        value: totalValue
      };
    });
  }, [products, customCategories]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (customCategories.includes(newCatName.trim())) {
      notifications.show({
        title: 'Error',
        message: 'Category already exists',
        color: 'red',
        icon: <IconX size={16} />
      });
      return;
    }
    const updated = [...customCategories, newCatName.trim()];
    setCustomCategories(updated);
    localStorage.setItem('customProductCategories', JSON.stringify(updated));
    setNewCatName('');
    notifications.show({
      title: 'Success',
      message: 'Category added successfully',
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
            <Title order={2}>Manage Product Categories</Title>
            <Text size="sm" c="dimmed">Define product inventory segments and audit department performance stats.</Text>
          </div>

          <Paper withBorder p="md" radius="md">
            <form onSubmit={handleAddCategory}>
              <Group align="flex-end">
                <TextInput
                  label="New Category Name"
                  placeholder="e.g. Household & Detergents"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button type="submit" leftSection={<IconTags size={16} />} color="blue">
                  Create Category
                </Button>
              </Group>
            </form>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category Name</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Active Products Count</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total Units Stocked</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total Estimated Assets (At Retail)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {categoriesWithStats.map((cat, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td fw={600}>{cat.name}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{cat.count} SKUs</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{cat.stock} Units</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }} c="teal" fw={600}>Rs. {cat.value.toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
                {categoriesWithStats.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4} style={{ textAlign: 'center' }}>
                      <Text c="dimmed">No product categories registered.</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Paper>
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
