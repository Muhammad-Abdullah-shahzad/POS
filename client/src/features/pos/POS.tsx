import { useState, useRef, useEffect } from 'react';
import { TextInput, Button, Paper, Title, Grid, Table, Text, Group, Divider, ActionIcon, Badge, SimpleGrid } from '@mantine/core';
import { IconTrash, IconBarcode, IconPlus, IconMinus, IconCash, IconGift, IconCashRegister, IconReceipt } from '@tabler/icons-react';
import { usePosStore } from '../../store/posStore';
import api from '../../services/api';
import { useReactToPrint } from 'react-to-print';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

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

  const handlePrint = useReactToPrint({ contentRef: componentRef });

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

  // Handler for PAYBILL button
  const handlePayBill = () => {
    if (cart.length === 0) {
      notifications.show({
        title: 'Empty Cart',
        message: 'Please add items to cart before processing payment',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />
      });
      return;
    }
    
    modals.openConfirmModal({
      title: 'Alternative Payment Method',
      centered: true,
      children: (
        <Text size="sm">
          Process payment of <strong>€ {total.toFixed(2)}</strong> using alternative payment method?
          {totalDiscount > 0 && <><br /><Text size="xs" c="teal" component="span">Includes € {totalDiscount.toFixed(2)} discount</Text></>}
          <br /><br />
          <Text size="xs" c="dimmed">This can be used for card payments, mobile wallets, or credit transactions.</Text>
        </Text>
      ),
      labels: { confirm: 'Process Payment', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: handleCheckout,
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

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      const { data } = await api.post('/orders', {
        items: cart,
        subtotal,
        totalVAT,
        discount: totalDiscount,
        totalDRS,
        total,
        paymentMethod: 'cash',
      });

      const order = data?.data;
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
                            <Text size="xs" td="line-through" c="dimmed">€ {item.totalPrice.toFixed(2)}</Text>
                            <Text size="sm" fw={700} c="teal">€ {item.finalPrice.toFixed(2)}</Text>
                            <Badge size="xs" color="teal" variant="light">-{item.discountPct}%</Badge>
                          </div>
                        ) : (
                          <Text size="sm">€ {item.totalPrice.toFixed(2)}</Text>
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
                      <Table.Td>€ {item.vatAmount.toFixed(2)} ({item.vatRate}%)</Table.Td>
                      <Table.Td fw={700}>
                        € {(item.finalPrice * item.quantity / item.quantity).toFixed(2)}
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
              <Text>€ {subtotal.toFixed(2)}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text>Total VAT</Text>
              <Text>€ {totalVAT.toFixed(2)}</Text>
            </Group>
            {totalDiscount > 0 && (
              <Group justify="space-between" mb="xs">
                <Text c="teal" fw={600}>Discount</Text>
                <Text c="teal" fw={600}>- € {totalDiscount.toFixed(2)}</Text>
              </Group>
            )}
            {totalDRS > 0 && (
              <Group justify="space-between" mb="xs">
                <Text>Total DRS</Text>
                <Text>€ {totalDRS.toFixed(2)}</Text>
              </Group>
            )}

            <Divider my="sm" />

            <Group justify="space-between" mb="xl">
              <Title order={4}>Grand Total</Title>
              <Title order={4} c="blue">€ {total.toFixed(2)}</Title>
            </Group>

            <Button
              fullWidth size="xl" color="green"
              onClick={() => {
                modals.openConfirmModal({
                  title: 'Confirm Payment',
                  centered: true,
                  children: (
                    <Text size="sm">
                      Process payment of <strong>€ {total.toFixed(2)}</strong>?
                      {totalDiscount > 0 && <><br /><Text size="xs" c="teal" component="span">Includes € {totalDiscount.toFixed(2)} discount</Text></>}
                    </Text>
                  ),
                  labels: { confirm: 'Confirm Payment', cancel: 'No, Wait' },
                  confirmProps: { color: 'green' },
                  onConfirm: handleCheckout,
                });
              }}
              disabled={cart.length === 0}
            >
              Pay € {total.toFixed(2)}
            </Button>
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
                SHOW ALL OFFERS
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
                onClick={handlePayBill}
                size="sm"
              >
                PAYBILL
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
            <div><Text size="xs" c="dimmed">Trans Amt</Text><Text size="sm" fw={700}>€ {lastTransaction.transAmt.toFixed(2)}</Text></div>
            <div><Text size="xs" c="dimmed">Paid Amt</Text><Text size="sm" fw={700} c="green">€ {lastTransaction.paidAmt.toFixed(2)}</Text></div>
            <div><Text size="xs" c="dimmed">Return Amt</Text><Text size="sm" fw={700} c="blue">€ {lastTransaction.returnAmt.toFixed(2)}</Text></div>
            <div><Text size="xs" c="dimmed">Due Amt</Text><Text size="sm" fw={700} c={lastTransaction.dueAmt > 0 ? 'red' : 'dark'}>€ {lastTransaction.dueAmt.toFixed(2)}</Text></div>
            <div><Text size="xs" c="dimmed">Date</Text><Text size="sm" fw={500}>{lastTransaction.date}</Text></div>
          </Group>
        </Paper>
      )}

      {/* Printable Receipt */}
      <div className="print-only" style={{ display: 'none' }}>
        <div ref={componentRef}>
          <div id="printable-receipt" style={{ padding: '24px', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', backgroundColor: '#fff', fontSize: '15px', fontWeight: 900, lineHeight: 1.45, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <div style={{ textAlign: 'center', marginBottom: '22px', borderBottom: '5px solid #000', paddingBottom: '12px' }}>
              <h1 style={{ margin: '0', fontSize: '34px', fontFamily: 'Arial Black, Arial, Helvetica, sans-serif', fontWeight: 900, letterSpacing: '0', textTransform: 'uppercase' }}>Castlebar Halal Foods</h1>
              <p style={{ margin: '6px 0 2px', fontSize: '17px', fontWeight: 900 }}>123 Business Road, Commerce City</p>
              <p style={{ margin: '2px 0', fontSize: '15px', fontWeight: 900 }}>Phone: +1 234 567 8900</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '18px', fontSize: '14px', fontWeight: 900 }}>
              <div>
                <p style={{ margin: '3px 0' }}><strong>CUSTOMER:</strong> Walk-in Customer</p>
                <p style={{ margin: '3px 0' }}><strong>DATE:</strong> {new Date().toLocaleString()}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '3px 0' }}><strong>RECEIPT #:</strong> REC-{Date.now().toString().slice(-6)}</p>
                <p style={{ margin: '3px 0' }}><strong>STATUS:</strong> PAID</p>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '15px', fontWeight: 900 }}>
              <thead>
                <tr style={{ borderTop: '4px solid #000', borderBottom: '4px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '10px 5px', fontWeight: 900 }}>DESCRIPTION</th>
                  <th style={{ textAlign: 'center', padding: '10px 5px', fontWeight: 900 }}>QTY</th>
                  <th style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900 }}>UNIT</th>
                  <th style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900 }}>DISC</th>
                  <th style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900 }}>DRS</th>
                  <th style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={`print-${item.product}`} style={{ borderBottom: '2px solid #000' }}>
                    <td style={{ padding: '10px 5px', fontWeight: 900 }}>{item.name}</td>
                    <td style={{ textAlign: 'center', padding: '10px 5px', fontWeight: 900 }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900 }}>€ {item.price.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900, color: '#000' }}>
                      {item.discountAmt > 0 ? (item.discountPct > 0 ? `-${item.discountPct}% (€${item.discountAmt.toFixed(2)})` : `-€${item.discountAmt.toFixed(2)}`) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900 }}>
                      {item.drs > 0 ? `€ ${(item.drs * item.quantity).toFixed(2)}` : '-'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 900 }}>€ {item.finalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ width: '285px', marginLeft: 'auto', fontSize: '16px', fontWeight: 900 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                <span>Subtotal:</span><span>€ {subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                <span>Tax:</span><span>€ {totalVAT.toFixed(2)}</span>
              </div>
              {totalDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#000' }}>
                  <span>Discount:</span><span>- € {totalDiscount.toFixed(2)}</span>
                </div>
              )}
              {totalDRS > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                  <span>Total DRS:</span><span>€ {totalDRS.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 4px', borderTop: '4px solid #000', fontWeight: 900, fontSize: '24px' }}>
                <span>TOTAL:</span><span>€ {total.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ marginTop: '42px', textAlign: 'center', borderTop: '3px dashed #000', paddingTop: '16px' }}>
              <p style={{ margin: '0', fontSize: '16px', fontWeight: 900 }}>THANK YOU FOR SHOPPING!</p>
              <p style={{ margin: '5px 0', fontSize: '13px', fontWeight: 800, color: '#000' }}>Please visit us again soon.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default POS;
