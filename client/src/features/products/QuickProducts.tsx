import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, ColorSwatch, Group, Paper, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowDown, IconArrowUp, IconCheck, IconTrash } from '@tabler/icons-react';
import api from '../../services/api';

export interface QuickProductButton {
  id: string;
  name: string;
  barcode: string;
  color: string;
}

export const QUICK_PRODUCTS_STORAGE_KEY = 'counterQuickProducts';

export const QUICK_PRODUCT_COLORS = [
  { label: 'Dark Green', value: '#688939' },
  { label: 'Light Green', value: '#86af49' },
  { label: 'Orange', value: '#d28c46' },
];

export const DEFAULT_QUICK_PRODUCTS: QuickProductButton[] = [
  { id: 'open-item', name: 'OPEN ITEM', barcode: 'open1234', color: '#688939' },
  { id: 'house-hold', name: 'HOUSE HOLD', barcode: 'hh1234', color: '#688939' },
  { id: 'sweets', name: 'SWEETS', barcode: 'sw1234', color: '#688939' },
  { id: 'minerals', name: 'MINERALS', barcode: 'mn1234', color: '#86af49' },
  { id: 'veg-item', name: 'VEG ITEM', barcode: 'vg1234', color: '#86af49' },
  { id: 'fresh-meat', name: 'FRESH MEAT', barcode: 'fm1234', color: '#86af49' },
];

export const loadQuickProducts = (): QuickProductButton[] => {
  try {
    const saved = localStorage.getItem(QUICK_PRODUCTS_STORAGE_KEY);
    if (!saved) return DEFAULT_QUICK_PRODUCTS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_QUICK_PRODUCTS;
    return parsed.filter((item): item is QuickProductButton =>
      typeof item?.id === 'string' &&
      typeof item?.name === 'string' &&
      typeof item?.barcode === 'string' &&
      typeof item?.color === 'string'
    );
  } catch {
    return DEFAULT_QUICK_PRODUCTS;
  }
};

const saveQuickProducts = (items: QuickProductButton[]) => {
  localStorage.setItem(QUICK_PRODUCTS_STORAGE_KEY, JSON.stringify(items));
};

export const fetchQuickProducts = async (): Promise<QuickProductButton[]> => {
  try {
    const { data } = await api.get('/settings/quick-products');
    const items = Array.isArray(data.data) ? data.data : DEFAULT_QUICK_PRODUCTS;
    saveQuickProducts(items);
    return items;
  } catch {
    return loadQuickProducts();
  }
};

const persistQuickProducts = async (items: QuickProductButton[]) => {
  saveQuickProducts(items);
  await api.put('/settings/quick-products', { quickProducts: items });
  window.dispatchEvent(new Event('quick-products-updated'));
};

const ManageQuickProducts = () => {
  const [items, setItems] = useState<QuickProductButton[]>([]);
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [color, setColor] = useState(QUICK_PRODUCT_COLORS[1].value);

  useEffect(() => {
    fetchQuickProducts().then(setItems);
  }, []);

  const persist = async (nextItems: QuickProductButton[]) => {
    setItems(nextItems);
    try {
      await persistQuickProducts(nextItems);
    } catch (error: any) {
      notifications.show({
        title: 'Save Failed',
        message: error.response?.data?.message || 'Could not save quick products to the server.',
        color: 'red',
      });
    }
  };

  const handleAdd = () => {
    const cleanName = name.trim().toUpperCase();
    const cleanBarcode = barcode.trim() || `quick-${Date.now().toString().slice(-6)}`;
    if (!cleanName) {
      notifications.show({ title: 'Name required', message: 'Enter a quick product name.', color: 'red' });
      return;
    }

    void persist([
      ...items,
      {
        id: `quick-${Date.now()}`,
        name: cleanName,
        barcode: cleanBarcode,
        color,
      },
    ]);
    setName('');
    setBarcode('');
    notifications.show({ title: 'Saved', message: `${cleanName} added to Counter quick products.`, color: 'green', icon: <IconCheck size={16} /> });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const nextItems = [...items];
    [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
    void persist(nextItems);
  };

  const removeItem = (id: string) => {
    void persist(items.filter(item => item.id !== id));
  };

  const resetDefaults = () => {
    void persist(DEFAULT_QUICK_PRODUCTS);
    notifications.show({ title: 'Reset', message: 'Default quick products restored.', color: 'teal' });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Manage Quick Products</Title>
          <Text size="sm" c="dimmed">These buttons appear on the Counter quick product panel.</Text>
        </div>
        <Button variant="light" color="gray" onClick={resetDefaults}>Reset Defaults</Button>
      </Group>

      <Paper withBorder p="md" radius="sm">
        <Group align="flex-end">
          <TextInput
            label="Button Name"
            placeholder="e.g. BREAD"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <TextInput
            label="Code"
            placeholder="Auto if blank"
            value={barcode}
            onChange={(event) => setBarcode(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            label="Color"
            data={QUICK_PRODUCT_COLORS}
            value={color}
            onChange={(value) => setColor(value || QUICK_PRODUCT_COLORS[1].value)}
            w={160}
          />
          <Button onClick={handleAdd}>Add Quick Product</Button>
        </Group>
      </Paper>

      <Paper withBorder radius="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Color</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item, index) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={700}>{item.name}</Table.Td>
                <Table.Td c="dimmed">{item.barcode}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ColorSwatch color={item.color} size={18} />
                    <Badge variant="light">{QUICK_PRODUCT_COLORS.find(option => option.value === item.color)?.label || item.color}</Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end">
                    <ActionIcon variant="light" onClick={() => moveItem(index, -1)} disabled={index === 0}>
                      <IconArrowUp size={16} />
                    </ActionIcon>
                    <ActionIcon variant="light" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1}>
                      <IconArrowDown size={16} />
                    </ActionIcon>
                    <ActionIcon color="red" variant="light" onClick={() => removeItem(item.id)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
};

export default ManageQuickProducts;
