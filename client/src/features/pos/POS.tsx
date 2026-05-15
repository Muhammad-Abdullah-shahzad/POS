import { useState, useRef, useEffect } from 'react';
import { TextInput, Button, Paper, Title, Grid, Table, Text, Group, Divider, ActionIcon } from '@mantine/core';
import { IconTrash, IconBarcode, IconPlus, IconMinus } from '@tabler/icons-react';
import { usePosStore } from '../../store/posStore';
import api from '../../services/api';
import { useReactToPrint } from 'react-to-print';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';


const POS = () => {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const lastScanRef = useRef<{ barcode: string, time: number }>({ barcode: '', time: 0 });

  const { cart, subtotal, totalVAT, total, addToCart, removeFromCart, clearCart, updateQuantity } = usePosStore();

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return;

    // Counter measure for rapid duplicate scans (barcode scanner issue)
    const now = Date.now();
    if (trimmedBarcode === lastScanRef.current.barcode && (now - lastScanRef.current.time) < 500) {
      console.log('Duplicate scan detected and ignored');
      setBarcode('');
      return;
    }
    lastScanRef.current = { barcode: trimmedBarcode, time: now };

    try {
      setLoading(true);
      const { data } = await api.get(`/products/barcode/${trimmedBarcode}`);
      const product = data.data;

      if (product.stock <= 0) {
        notifications.show({
          title: 'Out of Stock',
          message: `${product.name} is currently unavailable.`,
          color: 'red',
          icon: <IconX size={16} />,
        });
        setBarcode('');
        return;
      }

      // Extract VAT based on type
      let vatAmount = 0;
      let basePrice = product.price;
      let totalPrice = 0;

      if (product.vatType === 'inclusive') {
        vatAmount = product.price - (product.price / (1 + product.vatRate / 100));
        basePrice = product.price - vatAmount;
        totalPrice = product.price; // The final price remains the same
      } else {
        vatAmount = product.price * (product.vatRate / 100);
        basePrice = product.price;
        totalPrice = product.price + vatAmount; // The final price adds VAT
      }

      const existingItem = cart.find(item => item.product === product._id);
      if (existingItem && existingItem.quantity >= product.stock) {
        notifications.show({
          title: 'Stock Limit Reached',
          message: `Only ${product.stock} units of ${product.name} are available.`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
        setBarcode('');
        return;
      }

      addToCart({
        product: product._id,
        name: product.name,
        quantity: 1,
        stock: product.stock,
        price: basePrice,
        vatRate: product.vatRate,
        vatAmount: vatAmount,
        totalPrice: totalPrice,
      });

      setBarcode('');
    } catch (error) {
      console.error('Product not found or error:', error);
      // Optional: Add toast notification here
    } finally {
      setLoading(false);
      // Small timeout to ensure the input is enabled before focusing
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      await api.post('/orders', {
        items: cart,
        subtotal,
        totalVAT,
        discount: 0,
        total,
        paymentMethod: 'cash'
      });
      // Trigger professional print using library
      handlePrint();

      notifications.show({
        title: 'Order Completed',
        message: 'Receipt generated successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      clearCart();
    } catch (error: any) {
      console.error('Checkout failed:', error);
      const message = error.response?.data?.message || 'Checkout failed. Please check stock levels.';
      notifications.show({
        title: 'Checkout Failed',
        message: message,
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  return (
    <>
      <Grid className="no-print">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper withBorder p="md" radius="md">
            <form onSubmit={handleScan}>
              <TextInput
                ref={inputRef}
                leftSection={<IconBarcode size={20} />}
                placeholder="Scan barcode or type SKU and press Enter"
                value={barcode}
                onChange={(e) => setBarcode(e.currentTarget.value)}
                disabled={loading}
                size="lg"
                mb="md"
              />
            </form>

            <Table.ScrollContainer minWidth={500}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Price</Table.Th>
                    <Table.Th>Qty</Table.Th>
                    <Table.Th>VAT</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {cart.map((item) => (
                    <Table.Tr key={item.product}>
                      <Table.Td>{item.name}</Table.Td>
                      <Table.Td>Rs {item.price.toFixed(2)}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon 
                            size="sm" 
                            variant="light" 
                            onClick={() => updateQuantity(item.product, -1)}
                            disabled={loading}
                          >
                            <IconMinus size={12} />
                          </ActionIcon>
                          <Text size="sm" fw={500} w={20} ta="center">{item.quantity}</Text>
                          <ActionIcon 
                            size="sm" 
                            variant="light" 
                            onClick={() => {
                              if (item.quantity >= item.stock) {
                                notifications.show({
                                  title: 'Stock Limit Reached',
                                  message: `Maximum available stock is ${item.stock}`,
                                  color: 'yellow',
                                  icon: <IconAlertCircle size={16} />,
                                });
                                return;
                              }
                              updateQuantity(item.product, 1);
                            }}
                            disabled={loading || item.quantity >= item.stock}
                          >
                            <IconPlus size={12} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                      <Table.Td>Rs {item.vatAmount.toFixed(2)} ({item.vatRate}%)</Table.Td>
                      <Table.Td>Rs {item.totalPrice.toFixed(2)}</Table.Td>
                      <Table.Td>
                        <ActionIcon color="red" variant="subtle" onClick={() => removeFromCart(item.product)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper withBorder p="md" radius="md" bg="gray.1">
            <Title order={3} mb="md">Order Summary</Title>

            <Group justify="space-between" mb="xs">
              <Text>Subtotal</Text>
              <Text>Rs {subtotal.toFixed(2)}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text>Total VAT</Text>
              <Text>Rs {totalVAT.toFixed(2)}</Text>
            </Group>
            <Group justify="space-between" mb="md">
              <Text>Discount</Text>
              <Text>Rs 0.00</Text>
            </Group>

            <Divider my="sm" />

            <Group justify="space-between" mb="xl">
              <Title order={4}>Grand Total</Title>
              <Title order={4} c="blue">Rs {total.toFixed(2)}</Title>
            </Group>

            <Button 
              fullWidth 
              size="xl" 
              color="green" 
              onClick={() => {
                modals.openConfirmModal({
                  title: 'Confirm Payment',
                  centered: true,
                  children: (
                    <Text size="sm">
                      Are you sure you want to process this payment of <strong>Rs {total.toFixed(2)}</strong>?
                    </Text>
                  ),
                  labels: { confirm: 'Confirm Payment', cancel: 'No, Wait' },
                  confirmProps: { color: 'green' },
                  onConfirm: handleCheckout,
                });
              }} 
              disabled={cart.length === 0}
            >
              Pay Rs {total.toFixed(2)}
            </Button>
            <Button 
              fullWidth 
              mt="md" 
              variant="light" 
              color="red" 
              onClick={() => { clearCart(); inputRef.current?.focus(); }} 
              disabled={cart.length === 0}
            >
              Clear Cart
            </Button>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Printable Receipt */}
      <div className="print-only" style={{ display: 'none' }}>
        <div ref={componentRef}>
          <div id="printable-receipt" style={{ padding: '30px', fontFamily: 'Courier, monospace', color: '#000', backgroundColor: '#fff' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h1 style={{ margin: '0', fontSize: '28px', textTransform: 'uppercase' }}>STORE POS</h1>
            <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>123 Business Road, Commerce City</p>
            <p style={{ margin: '2px 0', fontSize: '12px' }}>Phone: +1 234 567 8900</p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
            <div>
              <p><strong>CUSTOMER:</strong> Walk-in Customer</p>
              <p><strong>DATE:</strong> {new Date().toLocaleString()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>RECEIPT #:</strong> REC-{Date.now().toString().slice(-6)}</p>
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
              {cart.map((item) => (
                <tr key={`print-${item.product}`} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 5px' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', padding: '10px 5px' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '10px 5px' }}>Rs {item.price.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 'bold' }}>Rs {item.totalPrice.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ width: '250px', marginLeft: 'auto', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span>Subtotal:</span>
              <span>Rs {subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
              <span>Tax:</span>
              <span>Rs {totalVAT.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #000', fontWeight: 'bold', fontSize: '18px' }}>
              <span>TOTAL:</span>
              <span>Rs {total.toFixed(2)}</span>
            </div>
          </div>
          
          <div style={{ marginTop: '60px', textAlign: 'center', borderTop: '1px dashed #ccc', paddingTop: '20px' }}>
            <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>THANK YOU FOR SHOPPING!</p>
            <p style={{ margin: '5px 0', fontSize: '11px', color: '#666' }}>Please visit us again soon.</p>
          </div>
          </div>
        </div>
      </div>
    </>
  );
};


export default POS;
