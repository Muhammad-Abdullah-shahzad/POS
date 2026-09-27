import { useState, useRef, useEffect } from 'react';
import { TextInput, Button, Paper, Title, Grid, Table, Text, Group, Divider, ActionIcon, Badge, SimpleGrid, Select } from '@mantine/core';
import { IconTrash, IconBarcode, IconPlus, IconMinus, IconCash, IconGift, IconCashRegister, IconReceipt } from '@tabler/icons-react';
import { usePosStore } from '../../store/posStore';
import api from '../../services/api';
import { useReactToPrint } from 'react-to-print';
import { useSettingsStore } from '../../store/settingsStore';
import PrintableSaleDocument from '../printing/PrintableSaleDocument';
import { printPageStyle } from '../printing/printPageStyle';
import { printableSaleFromOrder } from '../printing/printableSaleFromOrder';
import type { StoredOrder } from '../printing/printableSaleFromOrder';
import { useShopDetails } from '../printing/useShopDetails';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { formatMoney } from '../../utils/money';

// Read active offers from localStorage
interface Offer {
  id: string;
  code: string;
  type: string;   // 'Category Discount' | 'Flat Percentage' | 'BOGO Free'
  target: string; // category name or product name
  value: number;  // discount %
  status: string; // 'Active' | 'Inactive'
}

const getActiveOffers = (): Offer[] => {
  try {
    const saved = localStorage.getItem('customProductOffers');
    if (!saved) return [];
    return JSON.parse(saved).filter((o: Offer) => o.status === 'Active');
  } catch {
    return [];
  }
};

// Find best applicable discount for a product
const getDiscountForProduct = (productName: string, category: string): { pct: number; label: string } => {
  const offers = getActiveOffers();
  let bestPct = 0;
  let bestLabel = '';

  // Normalize for comparison
  const normName = productName.trim().toLowerCase();
  const normCat = category.trim().toLowerCase();

  console.log('[POS Discount] Product:', normName, '| Category:', normCat);
  console.log('[POS Discount] Active offers:', offers);

  for (const offer of offers) {
    const target = (offer.target || '').trim().toLowerCase();
    const pct = Math.min(Number(offer.value) || 0, 100);
    if (pct <= 0) continue;

    const matchesCategory =
      (offer.type === 'Category Discount' || offer.type === 'Flat Percentage') &&
      normCat === target;
    const matchesProduct = normName === target;
    // Also match if target is contained in category or vice versa (partial match)
    const partialCatMatch =
      (offer.type === 'Category Discount' || offer.type === 'Flat Percentage') &&
      (normCat.includes(target) || target.includes(normCat));

    console.log(`[POS Discount] Offer "${offer.code}" target="${target}" matchesCat=${matchesCategory} matchesProd=${matchesProduct} partial=${partialCatMatch}`);

    if ((matchesCategory || matchesProduct || partialCatMatch) && pct > bestPct) {
      bestPct = pct;
      bestLabel = `${offer.code} (${pct}% off)`;
    }
  }

  console.log('[POS Discount] Best discount:', bestPct, bestLabel);
  return { pct: bestPct, label: bestLabel };
};

const POS = () => {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const lastScanRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });

  const {
    cart, subtotal, totalVAT, totalDiscount, totalDRS, total, lastTransaction,
    addToCart, removeFromCart, clearCart, updateQuantity, setLastTransaction,
  } = usePosStore();

  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data.data || [])).catch(() => {});
  }, []);

  // The sale as the server saved it, which is what gets printed.
  const [lastOrder, setLastOrder] = useState<StoredOrder | null>(null);
  const settings = useSettingsStore((state) => state.settings);
  const receiptSize: 'Thermal' | 'A4' = settings?.receiptSize === 'A4' ? 'A4' : 'Thermal';
  const shop = useShopDetails();

  // Receipts carry inline styles only; skipping the app's stylesheets opens the print window faster.
  const handlePrint = useReactToPrint({ contentRef: componentRef, pageStyle: printPageStyle(receiptSize), ignoreGlobalStyles: true });

  // Handler for PAY DUES button
  const handlePayDues = () => {
    modals.open({
      title: 'Pay Customer Dues',
      centered: true,
      children: (
        <Text size="sm">
          This feature allows customers to pay their outstanding credit/dues.
          <br /><br />
          <strong>Coming Soon:</strong> Customer dues ledger and payment tracking.
        </Text>
      ),
    });
  };

  // Handler for SHOW ALL OFFERS button
  const handleShowOffers = () => {
    const offers = getActiveOffers();
    modals.open({
      title: 'Active Promotional Offers',
      centered: true,
      size: 'lg',
      children: (
        <div>
          {offers.length > 0 ? (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Promo Code</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Target</Table.Th>
                  <Table.Th>Discount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {offers.map((offer) => (
                  <Table.Tr key={offer.id}>
                    <Table.Td><Badge color="pink">{offer.code}</Badge></Table.Td>
                    <Table.Td>{offer.type}</Table.Td>
                    <Table.Td>{offer.target}</Table.Td>
                    <Table.Td><Text fw={700} c="green">{offer.value}% OFF</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" ta="center">No active offers at the moment.</Text>
          )}
        </div>
      ),
    });
  };

  // Handler for OPEN TILL button
  const handleOpenTill = () => {
    modals.open({
      title: 'Cash Drawer Management',
      centered: true,
      children: (
        <Text size="sm">
          <strong>Open Till:</strong> Opens the cash drawer for cash management.
          <br /><br />
          This feature is typically used for:
          <ul>
            <li>Starting shift with opening balance</li>
            <li>Manual cash drawer opening</li>
            <li>Cash counting and reconciliation</li>
          </ul>
          <strong>Status:</strong> Feature coming soon.
        </Text>
      ),
    });
  };

  const processCheckout = (method: string) => {
    if (cart.length === 0) {
      notifications.show({
        title: 'Empty Cart',
        message: 'Please add items to cart before processing payment',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }

    if (method === 'credit') {
      let selectedCustomer: string | null = null;
      modals.open({
        title: 'Select Customer for Credit Sale',
        centered: true,
        children: (
          <div>
            <Select
              label="Customer"
              placeholder="Select a customer"
              data={customers.map(c => ({ value: c._id, label: `${c.name} (Bal: ${formatMoney(c.outstandingBalance || 0)})` }))}
              searchable
              onChange={(v) => { selectedCustomer = v; }}
            />
            <Button 
              fullWidth mt="md" color="dark"
              onClick={() => {
                if (!selectedCustomer) {
                  notifications.show({ title: 'Error', message: 'Customer is required for credit sales', color: 'red' });
                  return;
                }
                const c = customers.find(x => x._id === selectedCustomer);
                
                if (c && c.creditLimit > 0 && ((c.outstandingBalance || 0) + total) > c.creditLimit) {
                  notifications.show({ title: 'Credit Limit Exceeded', message: `Customer credit limit is ${formatMoney(c.creditLimit)}`, color: 'red' });
                  return;
                }

                modals.closeAll();
                handleCheckout('credit', c?._id, c?.name);
              }}
            >
              Confirm Credit Sale
            </Button>
          </div>
        )
      });
      return;
    }

    // Cash or Card
    modals.openConfirmModal({
      title: `Confirm ${method.toUpperCase()} Payment`,
      centered: true,
      children: (
        <Text size="sm">
          Process <strong>{method.toUpperCase()}</strong> payment of <strong>{formatMoney(total)}</strong>?
          {totalDiscount > 0 && <><br /><Text size="xs" c="teal" component="span">Includes {formatMoney(totalDiscount)} discount</Text></>}
        </Text>
      ),
      labels: { confirm: 'Confirm Payment', cancel: 'Cancel' },
      confirmProps: { color: method === 'cash' ? 'green' : 'blue' },
      onConfirm: () => handleCheckout(method),
    });
  };

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return;

    const now = Date.now();
    if (trimmedBarcode === lastScanRef.current.barcode && (now - lastScanRef.current.time) < 500) {
      setBarcode('');
      return;
    }
    lastScanRef.current = { barcode: trimmedBarcode, time: now };

    try {
      setLoading(true);
      const { data } = await api.get(`/products/barcode/${trimmedBarcode}`);
      const product = data.data;

      if (product.stock <= 0) {
        notifications.show({ title: 'Out of Stock', message: `${product.name} is currently unavailable.`, color: 'red', icon: <IconX size={16} /> });
        setBarcode('');
        return;
      }

      // --- VAT calculation ---
      let vatAmount = 0;
      let basePrice = product.price;
      let totalPrice = 0;

      if (product.vatType === 'inclusive') {
        vatAmount = product.price - (product.price / (1 + product.vatRate / 100));
        basePrice = product.price - vatAmount;
        totalPrice = product.price;
      } else {
        vatAmount = product.price * (product.vatRate / 100);
        basePrice = product.price;
        totalPrice = product.price + vatAmount;
      }

      // --- Discount lookup ---
      // Determine discount from offers or catalog-specific discounts
      const offerDiscount = getDiscountForProduct(
        product.name,
        product.category || ''
      );
      // Read latest catalog discount percentages directly from localStorage
      const savedDiscounts = localStorage.getItem('productDiscounts');
      const productDiscounts = savedDiscounts ? JSON.parse(savedDiscounts) : {};
      const catalogDiscountPct = productDiscounts[product._id] || 0;
      const discountPct = Math.max(offerDiscount.pct, catalogDiscountPct);
      const discountLabel = offerDiscount.label;
      const discountAmt = parseFloat((totalPrice * (discountPct / 100)).toFixed(2));
      const drs = product.drs || 0;
      const finalPrice = parseFloat((totalPrice - discountAmt + drs).toFixed(2));

      const existingItem = cart.find(item => item.product === product._id);
      if (existingItem && existingItem.quantity >= product.stock) {
        notifications.show({ title: 'Stock Limit Reached', message: `Only ${product.stock} units available.`, color: 'yellow', icon: <IconAlertCircle size={16} /> });
        setBarcode('');
        return;
      }

      if (discountPct > 0) {
        notifications.show({
          title: 'Discount Applied!',
          message: `${discountLabel} applied to ${product.name}`,
          color: 'teal',
          icon: <IconCheck size={16} />,
        });
      }

      addToCart({
        product: product._id,
        name: product.name,
        category: product.category || '',
        quantity: 1,
        stock: product.stock,
        price: basePrice,
        vatRate: product.vatRate,
        vatAmount,
        totalPrice,
        discountPct,
        discountAmt,
        finalPrice,
        discountLabel,
        drs,
      });

      setBarcode('');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Product not found or connection error';
      notifications.show({ title: 'Scan Error', message, color: 'red', icon: <IconX size={16} /> });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleCheckout = async (method: string, customerId?: string, customerName?: string) => {
    if (cart.length === 0) return;
    try {
      const { data } = await api.post('/orders', {
        items: cart,
        subtotal,
        totalVAT,
        discount: totalDiscount,
        totalDRS,
        total,
        paymentMethod: method,
        customerId,
        customerName,
      });

      const order = data?.data;
      setLastOrder(order ?? null);
      const transNo = order?.invoiceId || `REC-${Date.now().toString().slice(-7)}`;
      setLastTransaction({
        transNo,
        transAmt: total,
        paidAmt: total,
        returnAmt: 0,
        dueAmt: 0,
        date: new Date().toLocaleString(),
      });

      handlePrint();
      notifications.show({ title: 'Order Completed', message: `Receipt ${transNo} generated successfully`, color: 'green', icon: <IconCheck size={16} /> });
      clearCart();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Checkout failed. Please check stock levels.';
      notifications.show({ title: 'Checkout Failed', message, color: 'red', icon: <IconAlertCircle size={16} /> });
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
                      <Table.Td>
                        {item.discountPct > 0 ? (
                          <div>
                            <Text size="xs" td="line-through" c="dimmed">{formatMoney(item.totalPrice)}</Text>
                            <Text size="sm" fw={700} c="teal">{formatMoney(item.finalPrice)}</Text>
                            <Badge size="xs" color="teal" variant="light">-{item.discountPct}%</Badge>
                          </div>
                        ) : (
                          <Text size="sm">{formatMoney(item.totalPrice)}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon size="sm" variant="light" onClick={() => updateQuantity(item.product, -1)} disabled={loading}>
                            <IconMinus size={12} />
                          </ActionIcon>
                          <Text size="sm" fw={500} w={20} ta="center">{item.quantity}</Text>
                          <ActionIcon
                            size="sm" variant="light"
                            onClick={() => {
                              if (item.quantity >= item.stock) {
                                notifications.show({ title: 'Stock Limit Reached', message: `Maximum available stock is ${item.stock}`, color: 'yellow', icon: <IconAlertCircle size={16} /> });
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
                      <Table.Td>{formatMoney(item.vatAmount)} ({item.vatRate}%)</Table.Td>
                      <Table.Td fw={700}>
                        {formatMoney(item.finalPrice * item.quantity / item.quantity)}
                      </Table.Td>
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
              <Text>{formatMoney(subtotal)}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text>Total VAT</Text>
              <Text>{formatMoney(totalVAT)}</Text>
            </Group>
            {totalDiscount > 0 && (
              <Group justify="space-between" mb="xs">
                <Text c="teal" fw={600}>Discount</Text>
                <Text c="teal" fw={600}>- {formatMoney(totalDiscount)}</Text>
              </Group>
            )}
            {totalDRS > 0 && (
              <Group justify="space-between" mb="xs">
                <Text>Total DRS</Text>
                <Text>{formatMoney(totalDRS)}</Text>
              </Group>
            )}

            <Divider my="sm" />

            <Group justify="space-between" mb="xl">
              <Title order={4}>Grand Total</Title>
              <Title order={4} c="blue">{formatMoney(total)}</Title>
            </Group>

            <SimpleGrid cols={3} spacing="xs">
              <Button fullWidth size="md" color="green" onClick={() => processCheckout('cash')} disabled={cart.length === 0}>
                Cash
              </Button>
              <Button fullWidth size="md" color="blue" onClick={() => processCheckout('card')} disabled={cart.length === 0}>
                Card
              </Button>
              <Button fullWidth size="md" color="red" onClick={() => processCheckout('credit')} disabled={cart.length === 0}>
                Credit
              </Button>
            </SimpleGrid>
            <Button fullWidth mt="md" variant="light" color="red" onClick={() => { clearCart(); inputRef.current?.focus(); }} disabled={cart.length === 0}>
              Clear Cart
            </Button>

            <Divider my="md" label="Quick Actions" labelPosition="center" />

            <SimpleGrid cols={2} spacing="xs">
              <Button
                variant="light"
                color="blue"
                leftSection={<IconCash size={16} />}
                onClick={handlePayDues}
                size="sm"
              >
                PAY DUES
              </Button>
              <Button
                variant="light"
                color="pink"
                leftSection={<IconGift size={16} />}
                onClick={handleShowOffers}
                size="sm"
              >
                SHOW OFFERS
              </Button>
              <Button
                variant="light"
                color="orange"
                leftSection={<IconCashRegister size={16} />}
                onClick={handleOpenTill}
                size="sm"
              >
                OPEN TILL
              </Button>
              <Button
                variant="light"
                color="violet"
                leftSection={<IconReceipt size={16} />}
                onClick={() => processCheckout('card')}
                size="sm"
              >
                PAY CARD
              </Button>
            </SimpleGrid>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Last Transaction Details */}
      {lastTransaction && (
        <Paper withBorder p="sm" radius="md" mt="md" className="no-print" style={{ borderColor: '#495057' }}>
          <Text size="xs" fw={700} c="dimmed" mb="xs" tt="uppercase">Last Transaction Details</Text>
          <Group gap="xl">
            <div><Text size="xs" c="dimmed">Trans No</Text><Text size="sm" fw={700}>{lastTransaction.transNo}</Text></div>
            <div><Text size="xs" c="dimmed">Trans Amt</Text><Text size="sm" fw={700}>{formatMoney(lastTransaction.transAmt)}</Text></div>
            <div><Text size="xs" c="dimmed">Paid Amt</Text><Text size="sm" fw={700} c="green">{formatMoney(lastTransaction.paidAmt)}</Text></div>
            <div><Text size="xs" c="dimmed">Return Amt</Text><Text size="sm" fw={700} c="blue">{formatMoney(lastTransaction.returnAmt)}</Text></div>
            <div><Text size="xs" c="dimmed">Due Amt</Text><Text size="sm" fw={700} c={lastTransaction.dueAmt > 0 ? 'red' : 'dark'}>{formatMoney(lastTransaction.dueAmt)}</Text></div>
            <div><Text size="xs" c="dimmed">Date</Text><Text size="sm" fw={500}>{lastTransaction.date}</Text></div>
          </Group>
        </Paper>
      )}

      {/* Printed as the shop's chosen paper: an A4 invoice or a till receipt. */}
      <div className="print-only" style={{ display: 'none' }}>
        <div ref={componentRef}>
          <PrintableSaleDocument
            sale={lastOrder ? printableSaleFromOrder(lastOrder) : null}
            shop={shop}
            size={receiptSize}
          />
        </div>
      </div>
    </>
  );
};

export default POS;
