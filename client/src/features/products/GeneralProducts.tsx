import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Paper, Title, Text, Button, Group, Stack, TextInput, NumberInput,
  Select, Table, Badge, ActionIcon, Modal, SimpleGrid, Box, Grid,
  Loader, Center, Image
} from '@mantine/core';
import {
  IconPlus, IconEdit, IconTrash, IconSearch, IconArrowLeft, IconCheck, IconX,
  IconPhoto, IconUpload
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api from '../../services/api';

const GENERAL_CATEGORIES = [
  'FISH AND SEAFOOD',
  'LAMB BEEF',
  'CHICKEN',
  'FRUITS',
  'VEG',
  'BAKERY AND DAIRY',
];

const CATEGORY_COLORS: Record<string, string> = {
  'FISH AND SEAFOOD': 'blue',
  'LAMB BEEF':        'red',
  'CHICKEN':          'orange',
  'FRUITS':           'grape',
  'VEG':              'green',
  'BAKERY AND DAIRY': 'yellow',
};

const SERVER_URL = 'http://localhost:5001';

interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  vatRate: number;
  vatType: string;
  image?: string;
}

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  price: 0 as number | string,
  costPrice: 0 as number | string,
  stock: 0 as number | string,
  vatRate: 0 as number | string,
  vatType: 'inclusive',
};

export const GeneralProducts = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();

  const activeCategory = category ? decodeURIComponent(category) : '';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Add / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async () => {
    if (!activeCategory) return;
    try {
      setLoading(true);
      const { data } = await api.get('/products');
      const all: Product[] = data.data || [];
      setProducts(all.filter(p => p.category.toUpperCase() === activeCategory.toUpperCase()));
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load products', color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [activeCategory]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      price: p.price,
      costPrice: p.costPrice,
      stock: p.stock,
      vatRate: p.vatRate,
      vatType: p.vatType,
    });
    setImageFile(null);
    setImagePreview(p.image ? `${SERVER_URL}/uploads/products/${p.image}` : null);
    setModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.barcode.trim()) {
      notifications.show({ title: 'Validation', message: 'Name, SKU and Barcode are required.', color: 'red' });
      return;
    }
    try {
      setSaving(true);

      if (imageFile) {
        // Use FormData for multipart upload
        const fd = new FormData();
        fd.append('name', form.name.trim());
        fd.append('sku', form.sku.trim());
        fd.append('barcode', form.barcode.trim());
        fd.append('category', activeCategory);
        fd.append('price', String(Number(form.price) || 0));
        fd.append('costPrice', String(Number(form.costPrice) || 0));
        fd.append('stock', String(Number(form.stock) || 0));
        fd.append('vatRate', String(Number(form.vatRate) || 0));
        fd.append('vatType', form.vatType);
        fd.append('image', imageFile);

        if (editingId) {
          await api.patch(`/products/${editingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        } else {
          await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
      } else {
        // Plain JSON — no image
        const payload = {
          name: form.name.trim(),
          sku: form.sku.trim(),
          barcode: form.barcode.trim(),
          category: activeCategory,
          price: Number(form.price) || 0,
          costPrice: Number(form.costPrice) || 0,
          stock: Number(form.stock) || 0,
          vatRate: Number(form.vatRate) || 0,
          vatType: form.vatType,
        };
        if (editingId) {
          await api.patch(`/products/${editingId}`, payload);
        } else {
          await api.post('/products', payload);
        }
      }

      notifications.show({
        title: editingId ? 'Updated' : 'Added',
        message: `${form.name.trim()} ${editingId ? 'updated' : 'added to ' + activeCategory} successfully.`,
        color: editingId ? 'teal' : 'green',
        icon: <IconCheck size={16} />,
      });

      setModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.response?.data?.message || 'Save failed', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await api.delete(`/products/${deleteId}`);
      notifications.show({ title: 'Deleted', message: 'Product removed.', color: 'red', icon: <IconTrash size={16} /> });
      setDeleteId(null);
      fetchProducts();
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.response?.data?.message || 'Delete failed', color: 'red' });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.toLowerCase().includes(search.toLowerCase())
  );

  // Category selector view
  if (!activeCategory) {
    return (
      <Stack gap="md">
        <div>
          <Title order={2}>Manage General Products</Title>
          <Text size="sm" c="dimmed">Select a category to manage its products.</Text>
        </div>
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
          {GENERAL_CATEGORIES.map(cat => (
            <Paper
              key={cat}
              withBorder
              p="xl"
              radius="md"
              style={{ cursor: 'pointer', textAlign: 'center', transition: 'transform 0.15s' }}
              onClick={() => navigate(`/products/general/${encodeURIComponent(cat)}`)}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Badge color={CATEGORY_COLORS[cat] || 'blue'} size="xl" variant="light" mb="sm">
                {cat}
              </Badge>
              <Text size="sm" c="dimmed">Manage products</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" onClick={() => navigate('/products/general')}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2}>
              <Badge color={CATEGORY_COLORS[activeCategory] || 'blue'} size="lg" variant="filled" mr="xs">
                {activeCategory}
              </Badge>
              Products
            </Title>
            <Text size="sm" c="dimmed">
              {products.length} product{products.length !== 1 ? 's' : ''} in this category
            </Text>
          </div>
        </Group>
        <Button leftSection={<IconPlus size={16} />} color="green" onClick={openAdd}>
          Add Product
        </Button>
      </Group>

      {/* Category quick-nav */}
      <Group gap="xs">
        {GENERAL_CATEGORIES.map(cat => (
          <Badge
            key={cat}
            color={cat === activeCategory ? (CATEGORY_COLORS[cat] || 'blue') : 'gray'}
            variant={cat === activeCategory ? 'filled' : 'light'}
            size="md"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/products/general/${encodeURIComponent(cat)}`)}
          >
            {cat}
          </Badge>
        ))}
      </Group>

      {/* Search + Table */}
      <Paper withBorder p="md" radius="md">
        <TextInput
          placeholder="Search by name, SKU or barcode..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          mb="md"
          style={{ maxWidth: 360 }}
        />

        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 56 }}>Image</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>SKU</Table.Th>
                <Table.Th>Barcode</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Stock</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map(p => (
                <Table.Tr key={p._id}>
                  <Table.Td>
                    {p.image ? (
                      <Image
                        src={`${SERVER_URL}/uploads/products/${p.image}`}
                        w={40} h={40} radius="sm" fit="cover"
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23e9ecef'/%3E%3C/svg%3E"
                      />
                    ) : (
                      <Box w={40} h={40} style={{ backgroundColor: '#e9ecef', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconPhoto size={18} color="#adb5bd" />
                      </Box>
                    )}
                  </Table.Td>
                  <Table.Td fw={600}>{p.name}</Table.Td>
                  <Table.Td c="dimmed">{p.sku}</Table.Td>
                  <Table.Td c="dimmed">{p.barcode}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>Rs. {p.price.toFixed(2)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Badge color={p.stock > 0 ? 'green' : 'red'} variant="light">{p.stock}</Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Group gap="xs" justify="center">
                      <ActionIcon variant="light" color="blue" onClick={() => openEdit(p)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" onClick={() => setDeleteId(p._id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {filtered.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="md">
                      {search ? 'No products match your search.' : `No products in ${activeCategory} yet. Click "Add Product" to get started.`}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Add / Edit Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text fw={700} size="lg">{editingId ? 'Edit Product' : `Add Product to ${activeCategory}`}</Text>}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Product Name"
            placeholder="e.g. Sea Bass Fillet"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="SKU"
                placeholder="e.g. FSH-001"
                required
                value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Barcode"
                placeholder="e.g. 1234567890"
                required
                value={form.barcode}
                onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
              />
            </Grid.Col>
          </Grid>
          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label="Selling Price (Rs.)"
                min={0}
                value={form.price}
                onChange={val => setForm(f => ({ ...f, price: val }))}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="Cost Price (Rs.)"
                min={0}
                value={form.costPrice}
                onChange={val => setForm(f => ({ ...f, costPrice: val }))}
              />
            </Grid.Col>
          </Grid>
          <Grid>
            <Grid.Col span={4}>
              <NumberInput
                label="Stock"
                min={0}
                value={form.stock}
                onChange={val => setForm(f => ({ ...f, stock: val }))}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <NumberInput
                label="VAT Rate (%)"
                min={0}
                max={100}
                value={form.vatRate}
                onChange={val => setForm(f => ({ ...f, vatRate: val }))}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="VAT Type"
                data={[
                  { value: 'inclusive', label: 'Inclusive' },
                  { value: 'exclusive', label: 'Exclusive' },
                ]}
                value={form.vatType}
                onChange={val => setForm(f => ({ ...f, vatType: val || 'inclusive' }))}
              />
            </Grid.Col>
          </Grid>

          {/* Image Upload — optional */}
          <Box>
            <Text size="sm" fw={500} mb={6}>Product Image <Text component="span" size="xs" c="dimmed">(optional)</Text></Text>
            <Group align="flex-start" gap="md">
              {/* Preview */}
              <Box
                w={90} h={90}
                style={{
                  border: '2px dashed #dee2e6',
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f8f9fa',
                  flexShrink: 0,
                }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <IconPhoto size={32} color="#adb5bd" />
                )}
              </Box>

              <Stack gap="xs" style={{ flex: 1 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageChange}
                />
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconUpload size={16} />}
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                >
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                </Button>
                {imagePreview && (
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<IconX size={14} />}
                    onClick={clearImage}
                    size="xs"
                  >
                    Remove Image
                  </Button>
                )}
                <Text size="xs" c="dimmed">JPG, PNG or WEBP. Max 5MB.</Text>
              </Stack>
            </Group>
          </Box>

          <Box p="xs" style={{ backgroundColor: '#f8f9fa', borderRadius: 8 }}>
            <Text size="xs" c="dimmed">Category: <strong>{activeCategory}</strong> (auto-assigned)</Text>
          </Box>

          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={() => setModalOpen(false)} leftSection={<IconX size={16} />}>
              Cancel
            </Button>
            <Button color="green" loading={saving} onClick={handleSave} leftSection={<IconCheck size={16} />}>
              {editingId ? 'Save Changes' : 'Add Product'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        opened={!!deleteId}
        onClose={() => setDeleteId(null)}
        title={<Text fw={700} c="red">Delete Product</Text>}
        size="sm"
        centered
      >
        <Text size="sm" mb="md">Are you sure you want to delete this product? This cannot be undone.</Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="red" loading={deleting} onClick={handleDelete} leftSection={<IconTrash size={16} />}>
            Delete
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
};

export default GeneralProducts;
