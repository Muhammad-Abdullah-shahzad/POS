import { useEffect, useState, useRef } from 'react';
import { Table, Button, Group, Title, Modal, TextInput, NumberInput, Select, Paper, Stack, Text, Image, FileButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconCheck, IconX, IconPlus, IconBarcode, IconTrash, IconPhoto, IconEdit, IconPrinter } from '@tabler/icons-react';
import JsBarcode from 'jsbarcode';

interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  vatRate: number;
  vatType: string;
  costPrice: number;
  stock: number;
  drs?: number;
  image?: string;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [stockModalOpened, setStockModalOpened] = useState(false);
  const [searchStockOpened, setSearchStockOpened] = useState(false);
  const [categoryOpened, { close: closeCategory }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addStockQuantity, setAddStockQuantity] = useState(0);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const resetImageRef = useRef<() => void>(null);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [categoryEntries, setCategoryEntries] = useState<{ name: string; vatRate: number; vatType: string }[]>([]);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      const cats = data.data || [];
      setCategoryEntries(cats.map((c: any) => ({ name: c.name, vatRate: c.vatRate ?? 0, vatType: c.vatType ?? 'exclusive' })));
      setCustomCategories(cats.map((c: any) => c.name));
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const form = useForm({
    initialValues: {
      name: '',
      sku: '',
      barcode: '',
      category: '',
      price: 0,
      vatRate: 0,
      vatType: 'exclusive',
      costPrice: 0,
      stock: 0,
      drs: 0,
    },
    validate: {
      name: (v) => v.trim() ? null : 'Name is required',
      barcode: (v) => v.trim() ? null : 'Barcode is required',
      category: (v) => v.trim() ? null : 'Category is required',
      price: (v) => v > 0 ? null : 'Price must be greater than 0',
      costPrice: (v) => v >= 0 ? null : 'Cost price is required',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    if (loading) return;
    try {
      setLoading(true);
      const isEdit = !!editingProduct;
      const endpoint = isEdit ? `/products/${editingProduct!._id}` : '/products';
      const method = isEdit ? 'patch' : 'post';

      const basePayload = { ...values, sku: values.sku.trim() || undefined, drs: values.drs || 0 };

      if (imageFile && !window.electronAPI) {
        // Web: send as multipart FormData (server handles file upload)
        const formData = new FormData();
        Object.entries(basePayload).forEach(([k, v]) => { if (v !== undefined) formData.append(k, String(v)); });
        formData.append('image', imageFile);
        await api[method](endpoint, formData);
      } else if (imageFile && window.electronAPI) {
        // Electron: IPC can't carry FormData — convert image to base64 and send as JSON
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
        await api[method](endpoint, { ...basePayload, image: imageBase64 });
      } else {
        await api[method](endpoint, basePayload);
      }

      notifications.show({
        title: 'Success',
        message: isEdit ? 'Product updated successfully' : 'Product saved successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      close();
      form.reset();
      setImageFile(null);
      setImagePreview(null);
      setEditingProduct(null);
      resetImageRef.current?.();
      fetchProducts();
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Unknown error';
      notifications.show({ title: 'Error', message, color: 'red', icon: <IconX size={16} /> });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedProduct || addStockQuantity <= 0) return;
    try {
      setLoading(true);
      await api.patch(`/products/${selectedProduct._id}/stock`, { quantity: addStockQuantity });
      notifications.show({
        title: 'Success',
        message: `Added ${addStockQuantity} units to ${selectedProduct.name}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      setStockModalOpened(false);
      setAddStockQuantity(0);
      fetchProducts();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update stock',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchBarcode.trim()) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/products/barcode/${searchBarcode.trim()}`);
      setSelectedProduct(data.data);
      setSearchStockOpened(false);
      setStockModalOpened(true);
      setSearchBarcode('');
    } catch (error: any) {
      notifications.show({
        title: 'Not Found',
        message: 'No product found with this barcode',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await api.post('/categories', { name: newCategory.trim(), vatRate: 0, vatType: 'exclusive' });
      await fetchCategories();
      setNewCategory('');
      closeCategory();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err?.message || 'Failed to save category', color: 'red', icon: <IconX size={16} /> });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      await api.delete(`/products/${id}`);
      notifications.show({
        title: 'Success',
        message: 'Product deleted successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      fetchProducts();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to delete product',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (product: Product) =>
    modals.openConfirmModal({
      title: 'Delete product',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{product.name}</strong>? This action is irreversible and may affect sales records.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => handleDelete(product._id),
    });

  const uniqueCategories = Array.from(new Set([...customCategories, ...products.map(p => p.category)])).filter(Boolean);

  const printProductReceipt = (product: Product) => {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    try {
      JsBarcode(svg, product.barcode || product.sku || product.name, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 12,
        margin: 8,
      });
    } catch {
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '60');
    }
    const barcodeHtml = svg.outerHTML;

    const win = window.open('', '_blank', 'width=320,height=480');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Product Label</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; display: flex; justify-content: center; align-items: flex-start; padding: 16px; background: #fff; }
    .receipt { width: 240px; border: 1px dashed #999; padding: 14px 12px; text-align: center; }
    .store-name { font-size: 14px; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
    .divider { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    .product-name { font-size: 13px; font-weight: bold; margin-bottom: 6px; word-break: break-word; }
    .barcode-wrap { margin: 8px auto; display: flex; justify-content: center; }
    .barcode-wrap svg { max-width: 100%; }
    .row { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
    .label { color: #555; }
    .value { font-weight: bold; }
    .price-big { font-size: 20px; font-weight: bold; margin: 6px 0 2px; }
    @media print {
      body { padding: 0; }
      .receipt { border: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="store-name">PRODUCT LABEL</div>
    <hr class="divider"/>
    <div class="product-name">${product.name}</div>
    <div class="barcode-wrap">${barcodeHtml}</div>
    <hr class="divider"/>
    <div class="price-big">€ ${product.price.toFixed(2)}</div>
    <div class="row"><span class="label">Cost Price:</span><span class="value">€ ${product.costPrice.toFixed(2)}</span></div>
    <div class="row"><span class="label">Discount (DRS):</span><span class="value">€ ${(product.drs || 0).toFixed(2)}</span></div>
    <div class="row"><span class="label">VAT:</span><span class="value">${product.vatRate}% (${product.vatType})</span></div>
    <div class="row"><span class="label">Category:</span><span class="value">${product.category}</span></div>
    <hr class="divider"/>
    <div style="font-size:10px;color:#888;margin-top:4px;">SKU: ${product.sku || '-'}</div>
  </div>
  <script>window.onload = function(){ window.print(); window.close(); }<\/script>
</body>
</html>`);
    win.document.close();
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setImageFile(null);
    // Show existing image as preview
    const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
    setImagePreview(
      product.image
        ? product.image.startsWith('http')
          ? product.image
          : `${apiBase}${product.image}`
        : null
    );
    form.setValues({
      name: product.name,
      sku: product.sku || '',
      barcode: product.barcode,
      category: product.category,
      price: product.price,
      vatRate: product.vatRate,
      vatType: product.vatType,
      costPrice: product.costPrice,
      stock: product.stock,
      drs: product.drs || 0,
    });
    open();
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>Products</Title>
        <Group>
          <Button 
            variant="outline" 
            leftSection={<IconBarcode size={18} />} 
            onClick={() => setSearchStockOpened(true)}
          >
            Search & Add Stock
          </Button>
          <Button 
            leftSection={<IconPlus size={16} />} 
            onClick={open}
          >
            Add New Product
          </Button>
        </Group>
      </Group>

      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Image</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>SKU / Barcode</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Price</Table.Th>
              <Table.Th>DRS</Table.Th>
              <Table.Th>VAT</Table.Th>
              <Table.Th>Stock</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {products.map((p) => (
              <Table.Tr key={p._id}>
                <Table.Td>
                  {p.image ? (
                    <Image
                      src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}${p.image}`}
                      h={40} w={40} radius="sm" fit="cover"
                      fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23eee'/%3E%3C/svg%3E"
                    />
                  ) : (
                    <div style={{ width: 40, height: 40, background: '#f1f3f5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconPhoto size={18} color="#adb5bd" />
                    </div>
                  )}
                </Table.Td>
                <Table.Td>{p.name}</Table.Td>
                <Table.Td>{p.sku || '-'} / {p.barcode}</Table.Td>
                <Table.Td>{p.category}</Table.Td>
                <Table.Td>€ {p.price.toFixed(2)}</Table.Td>
                <Table.Td>€ {(p.drs || 0).toFixed(2)}</Table.Td>
                <Table.Td>{p.vatRate}% ({p.vatType})</Table.Td>
                <Table.Td fw={700} c={p.stock < 10 ? 'red' : 'inherit'}>{p.stock}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Group gap="xs" justify="flex-end">
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="teal"
                      leftSection={<IconPrinter size={13} />}
                      onClick={() => printProductReceipt(p)}
                    >
                      Print
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="light"
                      color="blue"
                      leftSection={<IconEdit size={13} />}
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="compact-xs" 
                      variant="light" 
                      onClick={() => {
                        setSelectedProduct(p);
                        setStockModalOpened(true);
                      }}
                    >
                      Add Stock
                    </Button>
                    <Button 
                      size="compact-xs" 
                      variant="light" 
                      color="red"
                      onClick={() => openDeleteModal(p)}
                    >
                      <IconTrash size={14} />
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={() => { close(); setImageFile(null); setImagePreview(null); setEditingProduct(null); resetImageRef.current?.(); form.reset(); }} title={editingProduct ? `Edit: ${editingProduct.name}` : 'Add New Product'} size="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          {/* Image Upload */}
          <Group mb="md" align="flex-end">
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={500} mb={4}>Product Image (optional)</Text>
              <FileButton
                resetRef={resetImageRef}
                onChange={(file) => {
                  setImageFile(file);
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setImagePreview(url);
                  } else {
                    setImagePreview(null);
                  }
                }}
                accept="image/png,image/jpeg,image/webp"
              >
                {(props) => (
                  <Button variant="outline" leftSection={<IconPhoto size={16} />} {...props}>
                    {imageFile ? imageFile.name : 'Choose Image'}
                  </Button>
                )}
              </FileButton>
            </div>
            {imagePreview && (
              <Image src={imagePreview} h={80} w={80} radius="md" fit="cover" />
            )}
          </Group>

          <Group grow mb="md">
            <TextInput label="Name" required {...form.getInputProps('name')} />
            <Select
              label="Category"
              placeholder="Select or type category"
              data={uniqueCategories}
              required
              searchable
              value={form.values.category}
              error={form.errors.category}
              onChange={(val) => {
                const selected = val || '';
                form.setFieldValue('category', selected);
                // Auto-fill VAT from category definition
                const match = categoryEntries.find(
                  c => c.name.toLowerCase() === selected.toLowerCase()
                );
                if (match) {
                  form.setFieldValue('vatRate', match.vatRate);
                  form.setFieldValue('vatType', match.vatType);
                }
              }}
            />
          </Group>
          <Group grow mb="md">
            <TextInput label="SKU (optional)" {...form.getInputProps('sku')} />
            <TextInput label="Barcode" required {...form.getInputProps('barcode')} />
          </Group>
          <Group grow mb="md">
            <NumberInput label="Selling Price" required min={0} {...form.getInputProps('price')} />
            <NumberInput label="Cost Price (Your Cost)" required min={0} {...form.getInputProps('costPrice')} />
          </Group>
          <NumberInput label="DRS (optional)" min={0} mb="md" {...form.getInputProps('drs')} />
          <Group grow mb="md">
            <NumberInput label="VAT Rate (%)" required min={0} {...form.getInputProps('vatRate')} />
            <Select
              label="VAT Type"
              data={['inclusive', 'exclusive']}
              required
              {...form.getInputProps('vatType')}
            />
          </Group>
          <NumberInput label="Initial Stock" required min={0} mb="xl" {...form.getInputProps('stock')} />
          <Button fullWidth type="submit" loading={loading}>{editingProduct ? 'Update Product' : 'Save Product'}</Button>
        </form>
      </Modal>

      <Modal opened={categoryOpened} onClose={closeCategory} title="Add Product Category" size="sm">
        <TextInput 
          label="Category Name" 
          placeholder="e.g. Electronics" 
          value={newCategory} 
          onChange={(e) => setNewCategory(e.currentTarget.value)}
          mb="md"
        />
        <Button fullWidth onClick={handleAddCategory}>Save Category</Button>
      </Modal>

      <Modal 
        opened={stockModalOpened} 
        onClose={() => setStockModalOpened(false)} 
        title={`Add Stock: ${selectedProduct?.name}`}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">Current Stock: <strong>{selectedProduct?.stock}</strong></Text>
          <NumberInput 
            label="Quantity to Add" 
            placeholder="Enter amount" 
            min={1}
            value={addStockQuantity}
            onChange={(val) => setAddStockQuantity(Number(val))}
          />
          <Button fullWidth onClick={handleUpdateStock} loading={loading}>Update Inventory</Button>
        </Stack>
      </Modal>

      <Modal 
        opened={searchStockOpened} 
        onClose={() => setSearchStockOpened(false)} 
        title="Search Product for Inventory"
        size="sm"
      >
        <form onSubmit={handleSearchStock}>
          <Stack gap="md">
            <TextInput 
              label="Scan Barcode or SKU" 
              placeholder="Enter code..." 
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.currentTarget.value)}
              autoFocus
            />
            <Button fullWidth type="submit" loading={loading}>Find Product</Button>
          </Stack>
        </form>
      </Modal>
    </Paper>
  );
};

export default Products;
