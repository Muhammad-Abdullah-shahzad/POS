import { useEffect, useState } from 'react';
import { Table, Button, Group, Title, Modal, TextInput, NumberInput, Select, Paper, Autocomplete, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconCheck, IconX, IconPlus, IconTags, IconBarcode, IconTrash } from '@tabler/icons-react';

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
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [stockModalOpened, setStockModalOpened] = useState(false);
  const [searchStockOpened, setSearchStockOpened] = useState(false);
  const [categoryOpened, { open: openCategory, close: closeCategory }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addStockQuantity, setAddStockQuantity] = useState(0);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('customProductCategories');
    return saved ? JSON.parse(saved) : [];
  });

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
      vatRate: 20,
      vatType: 'exclusive',
      costPrice: 0,
      stock: 0,
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    if (loading) return;
    try {
      setLoading(true);
      await api.post('/products', values);
      notifications.show({
        title: 'Success',
        message: 'Product saved successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      close();
      form.reset();
      fetchProducts();
    } catch (error: any) {
      console.error('Submit Error:', error);
      const message = error.response?.data?.message || error.message;
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
            variant="outline" 
            leftSection={<IconTags size={16} />} 
            onClick={openCategory}
          >
            Manage Categories
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
              <Table.Th>Name</Table.Th>
              <Table.Th>SKU / Barcode</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Price</Table.Th>
              <Table.Th>VAT</Table.Th>
              <Table.Th>Stock</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {products.map((p) => (
              <Table.Tr key={p._id}>
                <Table.Td>{p.name}</Table.Td>
                <Table.Td>{p.sku} / {p.barcode}</Table.Td>
                <Table.Td>{p.category}</Table.Td>
                <Table.Td>Rs {p.price.toFixed(2)}</Table.Td>
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

      <Modal opened={opened} onClose={close} title="Add New Product" size="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Group grow mb="md">
            <TextInput label="Name" required {...form.getInputProps('name')} />
            <Autocomplete 
              label="Category" 
              data={uniqueCategories} 
              required 
              {...form.getInputProps('category')} 
            />
          </Group>
          <Group grow mb="md">
            <TextInput label="SKU" required {...form.getInputProps('sku')} />
            <TextInput label="Barcode" required {...form.getInputProps('barcode')} />
          </Group>
          <Group grow mb="md">
            <NumberInput label="Selling Price" required min={0} {...form.getInputProps('price')} />
            <NumberInput label="Cost Price (Your Cost)" required min={0} {...form.getInputProps('costPrice')} />
          </Group>
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
