import { useEffect, useState, useRef } from 'react';
import { Table, Button, Group, Title, Modal, TextInput, NumberInput, Select, Paper, Stack, Text, Image, FileButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconCheck, IconX, IconPlus, IconBarcode, IconTrash, IconPhoto } from '@tabler/icons-react';

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
  const [addStockQuantity, setAddStockQuantity] = useState(0);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const resetImageRef = useRef<() => void>(null);
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('customProductCategories');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Handle both old string[] and new CategoryEntry[] formats
    return parsed.map((item: string | { name: string }) =>
      typeof item === 'string' ? item : item.name
    );
  });

  // Full category objects with VAT info
  const categoryEntries: { name: string; vatRate: number; vatType: string }[] = (() => {
    const saved = localStorage.getItem('customProductCategories');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return parsed.map((item: string | { name: string; vatRate: number; vatType: string }) =>
      typeof item === 'string'
        ? { name: item, vatRate: 0, vatType: 'exclusive' }
        : item
    );
  })();

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

      if (imageFile) {
        // With image: use FormData (multer handles it)
        const formData = new FormData();
        formData.append('name', values.name);
        if (values.sku.trim()) formData.append('sku', values.sku.trim());
        formData.append('barcode', values.barcode);
        formData.append('category', values.category);
        formData.append('price', String(values.price));
        formData.append('costPrice', String(values.costPrice));
        formData.append('vatRate', String(values.vatRate));
        formData.append('vatType', values.vatType);
        formData.append('stock', String(values.stock));
        formData.append('drs', String(values.drs || 0));
        formData.append('image', imageFile);
        await api.post('/products', formData);
      } else {
        // No image: plain JSON to the same endpoint
        const payload = {
          ...values,
          sku: values.sku.trim() || undefined,
          drs: values.drs || 0,
        };
        await api.post('/products', payload);
      }
      notifications.show({
        title: 'Success',
        message: 'Product saved successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      close();
      form.reset();
      setImageFile(null);
      setImagePreview(null);
      resetImageRef.current?.();
      fetchProducts();
    } catch (error: any) {
      console.error('Submit Error:', error);
      const message = error.response?.data?.message || error.message || 'Unknown error';
      notifications.show({
        title: 'Error Saving Product',
        message: message,
        color: 'red',
        icon: <IconX size={16} />,
      });
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

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      const updated = [...customCategories, newCategory.trim()];
      setCustomCategories(updated);
      localStorage.setItem('customProductCategories', JSON.stringify(updated));
      setNewCategory('');
      closeCategory();
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

      <Modal opened={opened} onClose={() => { close(); setImageFile(null); setImagePreview(null); resetImageRef.current?.(); }} title="Add New Product" size="lg">
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
          <Button fullWidth type="submit" loading={loading}>Save Product</Button>
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
