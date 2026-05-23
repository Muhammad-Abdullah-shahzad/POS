import { useEffect, useState } from 'react';
import { Badge, Center, Loader, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
}

const formatCurrency = (value: number) => `Rs. ${(Number(value) || 0).toFixed(2)}`;

const VoidTransactions = () => {
  const [orders, setOrders] = useState<VoidOrder[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchVoidOrders();
  }, []);

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Void Transactions</Title>
        <Text size="sm" c="dimmed">Audit history of all voided counter transactions.</Text>
      </div>

      <Paper withBorder p="md" radius="md">
        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice</Table.Th>
                <Table.Th>Original Date</Table.Th>
                <Table.Th>Voided At</Table.Th>
                <Table.Th>Items</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Voided By</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {orders.map((order) => (
                <Table.Tr key={order._id}>
                  <Table.Td>
                    <Text fw={700}>{order.invoiceId}</Text>
                    <Badge color="red" variant="light" size="sm">Voided</Badge>
                  </Table.Td>
                  <Table.Td>{new Date(order.createdAt).toLocaleString()}</Table.Td>
                  <Table.Td>{order.voidedAt ? new Date(order.voidedAt).toLocaleString() : '-'}</Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      {order.items.map((item, index) => (
                        <Text key={`${order._id}-${index}`} size="xs">
                          {item.name} x {item.quantity} @ {formatCurrency(item.price)}
                        </Text>
                      ))}
                    </Stack>
                  </Table.Td>
                  <Table.Td style={{ maxWidth: 280 }}>
                    <Text size="sm" style={{ whiteSpace: 'normal' }}>{order.voidReason || 'No reason provided'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {order.voidedBy?.name || order.voidedBy?.email || 'Unknown'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(order.total)}</Table.Td>
                </Table.Tr>
              ))}
              {orders.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="lg">No void transactions found.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
};

export default VoidTransactions;
