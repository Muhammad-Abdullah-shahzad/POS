import { 
  Grid, Paper, Text, Flex, TextInput, Table, Tabs, Select, Button, 
  Box, Checkbox, Modal 
} from '@mantine/core';
import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

interface CartItem {
  id: string;
  name: string;
  barcode: string;
  qty: number;
  price: number;
}

interface Transaction {
  transactionNo: number;
  items: CartItem[];
  subTotal: number;
  deposit: number;
  total: number;
  date: string;
  paymentMethod: string;
}

interface CustomerCart {
  id: string;
  name: string;
  items: CartItem[];
  selectedItemId: string;
}

const Dashboard = () => {
  const [carts, setCarts] = useState<CustomerCart[]>([
    { id: 'customer1', name: 'CUSTOMER 1', items: [], selectedItemId: '' },
    { id: 'customer2', name: 'CUSTOMER 2', items: [], selectedItemId: '' },
    { id: 'customer3', name: 'CUSTOMER 3', items: [], selectedItemId: '' }
  ]);
  const [activeCartId, setActiveCartId] = useState<string>('customer1');

  const [transactionNo, setTransactionNo] = useState<number>(1);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  const [stagingItem, setStagingItem] = useState<{ id?: string; name: string; barcode: string; qty: number | string; price: number | string }>({ name: '', barcode: '', qty: '', price: '' });

  const [fishModalOpened, setFishModalOpened] = useState(false);
  const [fishSearch, setFishSearch] = useState('');
  const fishItems = [
    "SEA BASS", "SEA BREAM", "PINK BREAM", "SARADINE", "KING FISH", "TUNA BONITO", "TUNA FILLETS",
    "SALMON", "SHARK FILLETS", "PRAWNS", "RED MULLETS", "SPANISH POMPANO", "GREY MULLETS", "RAHU FISH",
    "BOAL FISH", "MIRGAL", "HAKE FISH", "HILSHA FISH", "SALT FISH", "RED SNAPER FISH", "SMOKE TURKEY WINGS",
    "Salted dry Fish", "", "", "", "", "", ""
  ];

  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  const activeCart = carts.find(c => c.id === activeCartId)!;
  const cartItems = activeCart.items;
  const selectedItemId = activeCart.selectedItemId;

  const updateCartItems = (updater: React.SetStateAction<CartItem[]>) => {
    setCarts(prev => prev.map(c => {
      if (c.id === activeCartId) {
        const newItems = typeof updater === 'function' ? updater(c.items) : updater;
        return { ...c, items: newItems };
      }
      return c;
    }));
  };

  const updateSelectedItemId = (updater: React.SetStateAction<string>) => {
    setCarts(prev => prev.map(c => {
      if (c.id === activeCartId) {
        const newId = typeof updater === 'function' ? updater(c.selectedItemId) : updater;
        return { ...c, selectedItemId: newId };
      }
      return c;
    }));
  };

  const handleCategoryItem = (categoryName: string, defaultBarcode: string) => {
    updateSelectedItemId('');
    setStagingItem({
      name: categoryName,
      barcode: defaultBarcode,
      qty: 1,
      price: 1.00
    });
  };

  const handleAddItem = () => {
    if (!stagingItem.name) return;
    const newItem = {
      id: Date.now().toString(),
      name: stagingItem.name,
      barcode: stagingItem.barcode,
      qty: Number(stagingItem.qty) || 1,
      price: Number(stagingItem.price) || 0
    };
    updateCartItems(prev => [...prev, newItem]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const handleUpdateItem = () => {
    if (!stagingItem.id) return;
    updateCartItems(prev => prev.map(item => 
      item.id === stagingItem.id ? { ...item, name: stagingItem.name, barcode: stagingItem.barcode, qty: Number(stagingItem.qty) || 1, price: Number(stagingItem.price) || 0 } : item
    ));
  };

  const handleRemoveItem = () => {
    if (!stagingItem.id) return;
    updateCartItems(prev => prev.filter(item => item.id !== stagingItem.id));
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const handleQuantityChange = (delta: number) => {
    setStagingItem(prev => ({ ...prev, qty: Math.max(1, (Number(prev.qty) || 0) + delta) }));
  };

  const handlePriceChange = (val: string) => {
    if (val === '') {
      setStagingItem(prev => ({ ...prev, price: '' }));
      return;
    }
    const parsedPrice = parseFloat(val);
    setStagingItem(prev => ({ ...prev, price: isNaN(parsedPrice) ? '' : parsedPrice }));
  };

  const subTotal = cartItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const deposit = 0.00;
  const total = subTotal - deposit;

  const handleCheckout = (method: string = 'MIXED') => {
    if (cartItems.length === 0) return;
    const newTransaction: Transaction = {
      transactionNo,
      items: [...cartItems],
      subTotal,
      deposit,
      total,
      date: new Date().toLocaleString(),
      paymentMethod: method
    };
    setLastTransaction(newTransaction);
    setTransactionNo(prev => prev + 1);
    updateCartItems([]);
    updateSelectedItemId('');
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const handleRePrint = () => {
    if (lastTransaction) {
      handlePrint();
    } else {
      alert("No previous transaction to reprint.");
    }
  };

  const handleAddCustomer = () => {
    const nextNum = carts.length + 1;
    const newId = `customer${nextNum}`;
    setCarts(prev => [...prev, { id: newId, name: `CUSTOMER ${nextNum}`, items: [], selectedItemId: '' }]);
    setActiveCartId(newId);
    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
  };

  const customColors = {
    bg: '#d2dadb',
    panelBg: '#e0e6e6',
    orangeBtn: '#d28c46',
    orangeBtnHover: '#c17a35',
    greenBtnTop: '#688939',
    greenBtnMid: '#86af49',
    headerBg: '#47635b',
    border: '#000000',
    tableHeaderRow: '#f0f0f0',
    selectedRow: '#ff9800',
    blueText: '#0055ff'
  };

  const btnStyle = {
    backgroundColor: customColors.orangeBtn,
    color: '#fff',
    border: '2px solid #fff',
    borderRadius: '2px'
  };

  return (
    <>
      <Box p="xs" bg={customColors.bg} h="100vh" style={{ border: `2px solid ${customColors.border}`, overflow: 'hidden' }}>
        <Grid>
          {/* LEFT COLUMN */}
          <Grid.Col span={3.5}>
            <Flex direction="column" h="calc(100vh - 24px)">
              <Tabs value={activeCartId} onChange={(val) => {
                if (val) {
                  setActiveCartId(val);
                  const cart = carts.find(c => c.id === val);
                  if (cart && cart.selectedItemId) {
                    const item = cart.items.find(i => i.id === cart.selectedItemId);
                    if (item) setStagingItem({ id: item.id, name: item.name, barcode: item.barcode, qty: item.qty, price: item.price });
                    else setStagingItem({ name: '', barcode: '', qty: '', price: '' });
                  } else {
                    setStagingItem({ name: '', barcode: '', qty: '', price: '' });
                  }
                }
              }} variant="outline" bg="white" styles={{ tab: { padding: '4px 8px', fontSize: '12px', borderBottom: 'none' } }}>
                <Tabs.List style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
                  {carts.map(cart => (
                    <Tabs.Tab key={cart.id} value={cart.id} bg={activeCartId === cart.id ? "white" : "gray.2"}>
                      {cart.name}
                    </Tabs.Tab>
                  ))}
                  <Button variant="subtle" size="xs" px={10} mt={3} onClick={handleAddCustomer} style={{ color: 'black' }}>
                    <Text size="lg" fw="bold">+</Text>
                  </Button>
                </Tabs.List>
              </Tabs>
              
              <Paper withBorder mt={0} bg="white" style={{ flexGrow: 1, borderTop: 0, borderRadius: 0, border: `2px solid ${customColors.border}`, overflowY: 'auto' }}>
                <Table stickyHeader>
                  <Table.Thead bg={customColors.tableHeaderRow}>
                    <Table.Tr>
                      <Table.Th style={{fontSize:'12px', padding:'4px 8px'}}>Product Name</Table.Th>
                      <Table.Th style={{fontSize:'12px', padding:'4px 8px'}}>Qty/Wt</Table.Th>
                      <Table.Th style={{fontSize:'12px', padding:'4px 8px'}}>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cartItems.map((item) => (
                      <Table.Tr 
                        key={item.id} 
                        bg={selectedItemId === item.id ? customColors.selectedRow : undefined}
                        onClick={() => {
                          updateSelectedItemId(item.id);
                          setStagingItem({ id: item.id, name: item.name, barcode: item.barcode, qty: item.qty, price: item.price });
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <Table.Td style={{fontSize:'12px', padding:'4px 8px'}} fw={selectedItemId === item.id ? "bold" : "normal"}>{item.name}</Table.Td>
                        <Table.Td style={{fontSize:'12px', padding:'4px 8px'}}>{item.qty} X 1</Table.Td>
                        <Table.Td style={{fontSize:'12px', padding:'4px 8px'}}>{(item.qty * item.price).toFixed(2)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>

              <Paper withBorder mt="xs" p="xs" style={{ border: `2px solid ${customColors.border}`, borderRadius: 0, position: 'relative' }} bg={customColors.bg}>
                 <Text size="10px" fw="bold" style={{ position: 'absolute', top: '-8px', left: '10px', backgroundColor: customColors.bg, padding: '0 5px' }}>Last Transaction Details</Text>
                 <Grid mt={5}>
                   <Grid.Col span={6}>
                     <Flex justify="space-between"><Text size="11px">Trans No</Text><Text size="11px" fw="bold">{transactionNo}</Text></Flex>
                     <Flex justify="space-between"><Text size="11px">Trans Amt</Text><Text size="11px" fw="bold">{lastTransaction ? lastTransaction.total.toFixed(2) : '0.00'}</Text></Flex>
                     <Flex justify="space-between"><Text size="11px">Due Amt</Text><Text size="11px" fw="bold">0.00</Text></Flex>
                   </Grid.Col>
                   <Grid.Col span={6}>
                     <Flex justify="space-between"><Text size="11px">Paid Amt</Text><Text size="11px" fw="bold">{lastTransaction ? lastTransaction.total.toFixed(2) : '0.00'}</Text></Flex>
                     <Flex justify="space-between"><Text size="11px">Return Amt</Text><Text size="11px" fw="bold">0.00</Text></Flex>
                     <Button size="xs" style={btnStyle} fullWidth mt={5} h={24} onClick={handleRePrint}>Re Print</Button>
                   </Grid.Col>
                  </Grid>
               </Paper>
            </Flex>
          </Grid.Col>

          {/* RIGHT PANEL (Middle + Right Columns combined) */}
          <Grid.Col span={8.5}>
            <Flex direction="column" h="calc(100vh - 24px)">
               <Grid style={{ flexGrow: 1, alignContent: 'flex-start' }}>
                  {/* MIDDLE COLUMN CONTENT */}
                  <Grid.Col span={5.5}>
                    <Flex align="center" gap="xs" mb="xs">
                      <Text size="sm">Employee</Text>
                      <Select data={['admin']} defaultValue="admin" size="xs" flex={1} styles={{ input: { borderRadius: 0 } }} />
                      <Button style={btnStyle} size="xs" px="lg">LOCK</Button>
                    </Flex>
                    
                    <Paper withBorder p={0} style={{ border: `2px solid ${customColors.headerBg}`, borderRadius: 0 }} bg={customColors.bg}>
                       <Flex justify="space-between" align="center" bg={customColors.headerBg} px="sm" py={2}>
                          <Text size="11px" c="white">Customer  -   Number - </Text>
                          <Button size="xs" style={{...btnStyle, border: '1px solid #fff'}} h={20} px={5} onClick={() => { updateCartItems([]); updateSelectedItemId(''); setStagingItem({ name: '', barcode: '', qty: '', price: '' }); }}>Clear</Button>
                       </Flex>
                       
                       <Box p="xs">
                           <fieldset style={{ border: `1px solid ${customColors.border}`, margin: 0, padding: '5px', position: 'relative' }}>
                              <legend style={{ fontSize: '10px', marginLeft: '5px', padding: '0 5px' }}>Search</legend>
                              <Flex gap="xs" mb={5} align="center">
                                 <Button style={btnStyle} size="xs" w={70} h={24}><Text size="11px">Barcode</Text></Button>
                                 <TextInput size="xs" flex={1} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                                 <Button style={btnStyle} size="xs" w={60} h={24}><Text size="11px">ENTER</Text></Button>
                              </Flex>
                              <Flex gap="xs" align="center">
                                 <Text size="11px" w={70}>Product</Text>
                                 <TextInput size="xs" flex={1} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                                 <Button style={btnStyle} size="xs" w={60} h={24}><Text size="11px">BACK</Text></Button>
                              </Flex>
                           </fieldset>

                           <fieldset style={{ border: `1px solid ${customColors.border}`, margin: '5px 0 0 0', padding: '5px', position: 'relative' }}>
                              <legend style={{ fontSize: '10px', marginLeft: '5px', padding: '0 5px' }}>Details</legend>
                              <Flex gap="xs" align="flex-start" mb={5}>
                                 <Text size="12px" w={55} mt={5}>Product</Text>
                                 <TextInput size="md" flex={1} value={stagingItem.name} readOnly styles={{ input: { borderRadius: 0, height: 40 } }} />
                              </Flex>
                              <Flex gap="xs" align="center" mb={5}>
                                 <Text size="12px" w={55}>Barcode</Text>
                                 <TextInput size="xs" flex={1} value={stagingItem.barcode} readOnly rightSection={<Text size="11px" td="underline" c="blue" style={{cursor:'pointer'}}>Edit</Text>} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                              </Flex>
                              <Flex gap="xs" align="center" mb={5}>
                                 <Text size="12px" w={55}>Weight</Text>
                                 <Box flex={1}></Box>
                                 <Text size="12px">Quantity</Text>
                                 <TextInput size="xs" w={60} value={stagingItem.qty} onChange={(e) => {
                                   const val = e.target.value;
                                   if (val === '') setStagingItem(p => ({ ...p, qty: '' }));
                                   else {
                                     const pVal = parseInt(val);
                                     if (!isNaN(pVal)) setStagingItem(p => ({ ...p, qty: pVal }));
                                   }
                                 }} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                              </Flex>
                              <Flex gap="xs" align="center" mb={10}>
                                 <Select data={['1pc']} defaultValue="1pc" size="xs" w={80} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                                 <Box flex={1} />
                                 <Button style={btnStyle} size="xs" w={40} h={24} onClick={() => handleQuantityChange(1)}>+</Button>
                                 <Button style={btnStyle} size="xs" w={40} h={24} onClick={() => handleQuantityChange(-1)}>-</Button>
                              </Flex>
                              <Flex gap="xs" align="center" mb={5}>
                                 <Box flex={1}><Text size="12px" mb={2}>Unit Price</Text><TextInput size="xs" value={typeof stagingItem.price === 'number' ? stagingItem.price.toFixed(2) : stagingItem.price} onChange={(e) => handlePriceChange(e.target.value)} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24, backgroundColor: '#3388ff', color: 'white' } }} /></Box>
                                 <Box flex={1}><Text size="12px" mb={2}>Total Price</Text><Text size="sm">{((Number(stagingItem.qty) || 0) * (Number(stagingItem.price) || 0)).toFixed(2)}</Text></Box>
                              </Flex>

                              <Flex gap={5} mt="sm">
                                 <Button onClick={handleAddItem} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">ADD</Text></Button>
                                 <Button onClick={handleUpdateItem} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">UPDATE</Text></Button>
                                 <Button onClick={handleRemoveItem} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">REMOVE</Text></Button>
                                 <Button onClick={() => { updateCartItems([]); updateSelectedItemId(''); setStagingItem({ name: '', barcode: '', qty: '', price: '' }); }} style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="9px" fw="bold" ta="center" style={{whiteSpace:'normal'}}>REMOVE ALL</Text></Button>
                              </Flex>
                           </fieldset>
                       </Box>
                    </Paper>
                  </Grid.Col>

                  {/* RIGHT COLUMN CONTENT */}
                  <Grid.Col span={6.5}>
                     <Grid mb="sm">
                        {[
                          {name: 'OPEN ITEM', color: customColors.greenBtnTop, onClick: () => handleCategoryItem('OPEN ITEM', 'open1234')}, 
                          {name: 'HOUSE HOLD', color: customColors.greenBtnTop, onClick: () => handleCategoryItem('HOUSE HOLD', 'hh1234')}, 
                          {name: 'SWEETS', color: customColors.greenBtnTop, onClick: () => handleCategoryItem('SWEETS', 'sw1234')}, 
                          {name: 'MINERALS', color: customColors.greenBtnMid, onClick: () => handleCategoryItem('MINERALS', 'mn1234')}, 
                          {name: 'VEG ITEM', color: customColors.greenBtnMid, onClick: () => handleCategoryItem('VEG ITEM', 'vg1234')}, 
                          {name: 'FRESH MEAT', color: customColors.greenBtnMid, onClick: () => handleCategoryItem('FRESH MEAT', 'fm1234')}, 
                          {name: 'FISH AND SEAFOOD', color: customColors.orangeBtn, onClick: () => setFishModalOpened(true)}, 
                          {name: 'LAMB BEEF', color: customColors.orangeBtn}, 
                          {name: 'CHICKEN', color: customColors.orangeBtn}, 
                          {name: 'FRUITS', color: customColors.orangeBtn}, 
                          {name: 'VEG', color: customColors.orangeBtn}, 
                          {name: 'BAKERY AND DAIRY', color: customColors.orangeBtn}
                        ].map(cat => (
                           <Grid.Col span={4} key={cat.name}>
                              <Button onClick={cat.onClick} fullWidth style={{ backgroundColor: cat.color, border: '2px solid white', borderRadius: '2px', padding: '0 4px', height: '32px' }}>
                                 <Text size="10px" fw="bold" ta="center" style={{whiteSpace:'normal', lineHeight:1.1}}>{cat.name}</Text>
                              </Button>
                           </Grid.Col>
                        ))}
                     </Grid>

                     <Grid>
                        {[1,2,3,4,5,6,7,8,9,0,'00','X'].map(num => (
                           <Grid.Col span={4} key={num}>
                              <Button fullWidth style={{...btnStyle, height: '35px'}}><Text size="xl" fw="normal">{num}</Text></Button>
                           </Grid.Col>
                        ))}
                        <Grid.Col span={6}>
                           <Button fullWidth style={{...btnStyle, height: '28px'}}><Text size="11px">Clear All</Text></Button>
                        </Grid.Col>
                        <Grid.Col span={3}>
                           <Button fullWidth style={{...btnStyle, height: '28px'}}><Text size="11px">C</Text></Button>
                        </Grid.Col>
                        <Grid.Col span={3} p={0}>
                           <Box style={{ border: `1px solid ${customColors.border}`, height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: customColors.bg, marginLeft: '2px', marginTop: '2px' }}>
                              <Checkbox label={<Text size="9px" style={{lineHeight:1, whiteSpace: 'nowrap'}}>ENABLE<br/>PRINTING</Text>} size="xs" defaultChecked />
                           </Box>
                        </Grid.Col>
                     </Grid>
                  </Grid.Col>
               </Grid>

               {/* BOTTOM PAYMENT SECTION */}
               <Flex gap={8} mt="xs">
                  <Box flex={1}>
                     <Box style={{ border: `1px solid ${customColors.border}` }} bg="#dde3e5">
                       <Flex h={85}>
                         {/* CASH PAY BUTTON */}
                         <Box w="18%" style={{ borderRight: `1px solid ${customColors.border}`, cursor: 'pointer', padding: '2px' }} onClick={() => handleCheckout('CASH')}>
                           <Flex align="center" justify="center" h="100%">
                             <Text fw="bold" size="16px" ta="center" style={{ textShadow: '1px 1px 0px white, -1px -1px 0px white, 1px -1px 0px white, -1px 1px 0px white', lineHeight: 1.2, color: 'black' }}>CASH<br/>PAY</Text>
                           </Flex>
                         </Box>

                         {/* TOTALS GRID */}
                         <Box w="38%" style={{ borderRight: `1px solid ${customColors.border}`, display: 'flex', flexDirection: 'column' }}>
                            <Flex style={{ borderBottom: `1px solid ${customColors.border}`, flex: 1 }}>
                               <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                                  <Text size="13px" c="black">Sub Total</Text>
                               </Flex>
                               <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px' }}>
                                  <Text size="14px" c="black">{subTotal.toFixed(2)}</Text>
                               </Flex>
                            </Flex>
                            <Flex style={{ borderBottom: `1px solid ${customColors.border}`, flex: 1 }}>
                               <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                                  <Text size="13px" c="black">Deposit</Text>
                               </Flex>
                               <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px', backgroundColor: '#e2e2e2' }}>
                                  <Text size="14px" c="black">{deposit.toFixed(2)}</Text>
                               </Flex>
                            </Flex>
                            <Flex style={{ flex: 1 }}>
                               <Flex flex={5} align="center" style={{ borderRight: `1px solid ${customColors.border}`, padding: '0 6px' }}>
                                  <Text size="15px" c="black">TOTAL</Text>
                               </Flex>
                               <Flex flex={7} align="center" justify="flex-end" style={{ padding: '0 6px' }}>
                                  <Text size="16px" c="black">{total.toFixed(2)}</Text>
                               </Flex>
                            </Flex>
                         </Box>

                         {/* INPUTS */}
                         <Box w="26%" style={{ borderRight: `1px solid ${customColors.border}` }} p="6px 8px">
                           <Flex align="center" justify="space-between" h="50%" pb="3px">
                             <Text size="12px" c="black">CASH</Text>
                             <TextInput size="md" w={70} styles={{ input: { borderRadius: 0, textAlign: 'right', height: 34, minHeight: 34, fontSize: '18px', padding: '0 4px', border: `1px solid ${customColors.border}` } }} defaultValue="0.00" />
                           </Flex>
                           <Flex align="center" justify="space-between" h="50%" pt="3px">
                             <Text size="12px" c="black">CARD</Text>
                             <TextInput size="md" w={70} styles={{ input: { borderRadius: 0, textAlign: 'right', height: 34, minHeight: 34, fontSize: '18px', padding: '0 4px', border: `1px solid ${customColors.border}` } }} defaultValue="0.00" />
                           </Flex>
                         </Box>

                         {/* CARD PAY BUTTON */}
                         <Box w="18%" style={{ position: 'relative', cursor: 'pointer', padding: '2px' }} onClick={() => handleCheckout('CARD')}>
                           <div style={{ position: 'absolute', top: '2px', left: '2px', right: '2px', bottom: '2px', backgroundImage: 'url(https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=300&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.9 }} />
                           <Flex align="center" justify="center" h="100%" style={{ position: 'relative', zIndex: 1 }}>
                             <Text fw="bold" size="14px" ta="center" style={{ textShadow: '1px 1px 0px black, -1px -1px 0px black, 1px -1px 0px black, -1px 1px 0px black', lineHeight: 1.2, color: 'white' }}>CARD<br/>PAY</Text>
                           </Flex>
                         </Box>
                       </Flex>
                     </Box>

                     <Flex gap={4} mt="xs">
                        {[
                          { label: '2', bg: '#7a8954' },
                          { label: '5', bg: '#687a71' },
                          { label: '10', bg: '#cc7b7b' },
                          { label: '20', bg: '#7ba2b8' },
                          { label: '50', bg: '#dcb882' }
                        ].map((btn) => (
                           <Button key={btn.label} flex={1} style={{ backgroundColor: btn.bg, border: '2px solid white', borderRadius: '2px', padding: '0 2px', height: '45px' }}>
                              <Text size="18px" fw="bold" c="black">{btn.label}</Text>
                           </Button>
                        ))}
                     </Flex>

                     <Flex gap={4} mt="4px">
                        {['PAY DUES', 'SHOW ALL OFFERS', 'OPEN TILL', 'PAYBILL', 'OPTIONS'].map((opt) => (
                           <Button onClick={opt === 'PAYBILL' ? () => handleCheckout('MIXED') : undefined} key={opt} flex={1} style={{ backgroundColor: customColors.orangeBtn, border: '2px solid white', borderRadius: '2px', padding: '0 2px', height: '45px' }}>
                              <Text size="11px" fw="bold" ta="center" style={{whiteSpace:'normal', lineHeight:1}}>{opt}</Text>
                           </Button>
                        ))}
                     </Flex>
                  </Box>
                  
                  {/* EDIT BUTTONS BLOCK */}
                  <Box w="15%">
                     <Flex direction="column" gap={4} h="100%">
                        <Button style={btnStyle} flex={1.5}><Text size="xl" fw="normal">+</Text></Button>
                        <Button style={btnStyle} flex={1.5} px={2}><Text size="12px" fw="bold" style={{whiteSpace:'normal', lineHeight:1}}>EDIT DETAILS</Text></Button>
                        <Button style={btnStyle} flex={1.5} px={2}><Text size="12px" fw="bold" style={{whiteSpace:'normal', lineHeight:1}}>EDIT PRICE</Text></Button>
                        <Button style={{...btnStyle, backgroundColor: '#c96263'}} flex={1} px={2}><Text size="12px" fw="bold" style={{whiteSpace:'normal', lineHeight:1}}>CLOSE<br/>(Ctrl + X)</Text></Button>
                     </Flex>
                  </Box>
               </Flex>
            </Flex>
          </Grid.Col>
        </Grid>
      </Box>

      {/* Printable Receipt */}
      <div style={{ display: 'none' }}>
        <div ref={componentRef}>
          {lastTransaction ? (
            <div style={{ padding: '30px', fontFamily: 'Courier, monospace', color: '#000', backgroundColor: '#fff' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
                <h1 style={{ margin: '0', fontSize: '28px', textTransform: 'uppercase' }}>STORE POS</h1>
                <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold' }}>123 Business Road, Commerce City</p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
                <div>
                  <p><strong>CUSTOMER:</strong> Walk-in</p>
                  <p><strong>DATE:</strong> {lastTransaction.date}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p><strong>RECEIPT #:</strong> {lastTransaction.transactionNo}</p>
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
                  {lastTransaction.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px 5px' }}>{item.name}</td>
                      <td style={{ textAlign: 'center', padding: '10px 5px' }}>{item.qty}</td>
                      <td style={{ textAlign: 'right', padding: '10px 5px' }}>{item.price.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '10px 5px', fontWeight: 'bold' }}>{(item.qty * item.price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ width: '250px', marginLeft: 'auto', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                  <span>Subtotal:</span>
                  <span>{lastTransaction.subTotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #000', fontWeight: 'bold', fontSize: '18px' }}>
                  <span>TOTAL:</span>
                  <span>{lastTransaction.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '30px', fontFamily: 'Courier, monospace' }}>No transaction data</div>
          )}
        </div>
      </div>

      <Modal 
        opened={fishModalOpened} 
        onClose={() => setFishModalOpened(false)}
        size="100%"
        fullScreen
        withCloseButton={false}
        padding={0}
        styles={{ inner: { padding: 0 }, body: { backgroundColor: '#4a6b82', height: '100vh', display: 'flex', flexDirection: 'column' } }}
      >
        <Flex align="center" bg="#325a7a" p="xs" style={{ borderBottom: '1px solid white' }}>
          <Text c="white" size="xl" fw="bold" style={{ textDecoration: 'underline' }}>FISH AND SEAFOOD</Text>
          <Flex align="center" ml="auto" gap="sm">
            <Text c="white" size="sm">Search Product</Text>
            <TextInput size="sm" value={fishSearch} onChange={(e) => setFishSearch(e.target.value)} styles={{ input: { borderRadius: 0 } }} />
            <Box bg="red" p="4px 8px" style={{ border: '1px solid black' }}>
              <Text c="white" size="xs">* Only 3 characters are allowed for<br/>search. Tick checkbox to allow more.</Text>
            </Box>
            <Checkbox label={<Text c="white" size="sm">Allow more</Text>} color="gray" />
          </Flex>
        </Flex>
        
        <Box flex={1} p="xs">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid white', borderLeft: '1px solid white' }}>
            {fishItems.map((fish, index) => (
              <div key={index} style={{ borderRight: '1px solid white', borderBottom: '1px solid white', height: '18vh', display: 'flex', flexDirection: 'column' }}>
                <Box flex={1} bg={fish ? "black" : "#2d5d85"} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: fish ? 'pointer' : 'default' }} onClick={() => {
                  if(fish) handleCategoryItem(fish, 'fsh123');
                }}>
                   {fish && <Text c="white" size="xs" style={{ position: 'absolute', top: 5 }}>No Imag</Text>}
                </Box>
                {fish ? (
                  <Box bg="green" h="30px" display="flex" style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text c="white" size="11px" fw="bold" ta="center" style={{ whiteSpace: 'normal', lineHeight: 1 }}>{fish}</Text>
                  </Box>
                ) : (
                  <Box bg="#2d5d85" h="30px" />
                )}
              </div>
            ))}
          </div>
        </Box>

        <Flex p="sm" bg="#4a6b82" align="center" justify="space-between">
          <Box w="60%" h={100} bg="white" style={{ border: '1px solid black' }} />
          <Flex gap="sm">
            <Button h={80} w={100} bg="#333" style={{ border: '2px solid #555' }}><Text size="xl">⬆</Text></Button>
            <Button h={80} w={100} bg="#333" style={{ border: '2px solid #555' }}><Text size="xl">⬇</Text></Button>
            <Button h={80} w={120} bg={customColors.orangeBtn} style={{ border: '2px solid white' }} onClick={() => setFishModalOpened(false)}><Text size="lg" fw="bold">DONE</Text></Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
};

export default Dashboard;
