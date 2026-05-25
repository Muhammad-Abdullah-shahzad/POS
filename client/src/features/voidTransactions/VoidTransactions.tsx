import { useEffect, useState } from 'react';
import {
  Badge, Center, Loader, Paper, Stack, Table, Text, Title,
  Group, Box, Divider, ScrollArea
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconReceipt, IconUser, IconCalendar, IconAlertCircle } from '@tabler/icons-react';
import api from '../../services/api';

interface VoidOrder {
  _id: string;
  invoiceId: string;
  items: { name: string; quantity: number; price: number; totalPrice: number }[];
  total: number;
  paymentMethod: string;
  createdAt: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: { name?: string; email?: string; role?: string };
  voidedByEmployee?: { name?: string; emailId?: string; role?: string };
  voidedByEmployeeName?: string;
}

const formatCurrency = (value: number) => `€ ${(Number(value) || 0).toFixed(2)}`;
const formatDate = (d: string) => new Date(d).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
const formatVoidedBy = (order: VoidOrder) => {
  const employeeName =
    order.voidedByEmployee?.name ||
    order.voidedByEmployeeName ||
    order.voidedBy?.name ||
    order.voidedBy?.email ||
    'Unknown employee';
  const role = order.voidedByEmployee?.role || order.voidedBy?.role;
  return role && !employeeName.includes(`(${role})`) ? `${employeeName} (${role})` : employeeName;
};

const VoidTransactions = () => {
  const [orders, setOrders] = useState<VoidOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    const fetchVoidOrders = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/orders/voided');
        setOrders(data.data || []);
      } catch (err: any) {
        notifications.show({
          title: 'Error',
          message: err.response?.data?.message || 'Failed to load void transactions',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchVoidOrders();
  }, []);

  return (
    <Stack gap="md">
      <div>
        <Title order={isMobile ? 3 : 2}>Void Transactions</Title>
        <Text size="sm" c="dimmed">Audit history of all voided counter transactions.</Text>
      </div>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : orders.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Text ta="center" c="dimmed">No void transactions found.</Text>
        </Paper>
      ) : isMobile ? (
        /* -- MOBILE: card per row -- */
        <Stack gap="sm">
          {orders.map((order) => (
            <Paper key={order._id} withBorder p="md" radius="md" shadow="xs">
              {/* Header row */}
              <Group justify="space-between" mb="xs" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                  <IconReceipt size={16} color="var(--mantine-color-red-6)" style={{ flexShrink: 0 }} />
                  <Text fw={700} size="sm" style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.invoiceId}
                  </Text>
                </Group>
                <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
                  <Badge color="red" variant="light" size="sm">Voided</Badge>
                  <Text fw={800} size="sm" c="dark">{formatCurrency(order.total)}</Text>
                </Group>
              </Group>

              <Divider mb="xs" />

              {/* Dates */}
              <Group gap="xs" mb="xs" wrap="nowrap">
                <IconCalendar size={13} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                <Text size="xs" c="dimmed">
                  Created: <Text component="span" fw={500} c="dark">{formatDate(order.createdAt)}</Text>
                </Text>
              </Group>
              {order.voidedAt && (
                <Group gap="xs" mb="xs" wrap="nowrap">
                  <IconCalendar size={13} color="var(--mantine-color-red-5)" style={{ flexShrink: 0 }} />
                  <Text size="xs" c="dimmed">
                    Voided: <Text component="span" fw={500} c="red">{formatDate(order.voidedAt)}</Text>
                  </Text>
                </Group>
              )}

              {/* Voided by */}
              <Group gap="xs" mb="xs" wrap="nowrap">
                <IconUser size={13} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                <Text size="xs" c="dimmed">
                  Voided by: <Text component="span" fw={500} c="dark">
                    {formatVoidedBy(order)}
                  </Text>
                </Text>
              </Group>

              {/* Reason */}
              {order.voidReason && (
                <Group gap="xs" mb="xs" align="flex-start" wrap="nowrap">
                  <IconAlertCircle size={13} color="var(--mantine-color-orange-5)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Text size="xs" c="dimmed">
                    Reason: <Text component="span" fw={500} c="orange.7">{order.voidReason}</Text>
                  </Text>
                </Group>
              )}

              {/* Items */}
              <Box mt="xs" p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 6 }}>
                <Text size="xs" fw={600} c="dimmed" mb={4} tt="uppercase">Items</Text>
                <Stack gap={2}>
                  {order.items.map((item, idx) => (
                    <Group key={idx} justify="space-between" wrap="nowrap">
                      <Text size="xs" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name} x {item.quantity}
                      </Text>
                      <Text size="xs" fw={600} style={{ flexShrink: 0 }}>
                        {formatCurrency(item.price * item.quantity)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Box>
            </Paper>
          ))}
        </Stack>
      ) : (
        /* -- DESKTOP: full table -- */
        <Paper withBorder p="md" radius="md">
          <ScrollArea>
            <Table striped highlightOnHover verticalSpacing="sm" miw={800}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice</Table.Th>
                  <Table.Th>Original Date</Table.Th>
                  <Table.Th>Voided At</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th>Reason</Table.Th>
                  <Table.Th>Voided By Employee</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orders.map((order) => (
                  <Table.Tr key={order._id}>
                    <Table.Td>
                      <Text fw={700} size="sm">{order.invoiceId}</Text>
                      <Badge color="red" variant="light" size="sm">Voided</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDate(order.createdAt)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{order.voidedAt ? formatDate(order.voidedAt) : '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        {order.items.map((item, index) => (
                          <Text key={`${order._id}-${index}`} size="xs">
                            {item.name} x {item.quantity} @ {formatCurrency(item.price)}
                          </Text>
                        ))}
                      </Stack>
                    </Table.Td>
                    <Table.Td style={{ maxWidth: 220 }}>
                      <Text size="sm" style={{ whiteSpace: 'normal' }}>
                        {order.voidReason || 'No reason provided'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatVoidedBy(order)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={700}>{formatCurrency(order.total)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}
    </Stack>
  );
};

export default VoidTransactions;
