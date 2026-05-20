import { 
  Grid, Paper, Text, Flex, TextInput, Table, Tabs, Select, Button, 
  Box, Checkbox 
} from '@mantine/core';

const Dashboard = () => {

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
    <Box p="xs" bg={customColors.bg} h="100%" style={{ border: `2px solid ${customColors.border}` }}>
      <Grid>
        {/* LEFT COLUMN */}
        <Grid.Col span={3.5}>
            <Tabs defaultValue="customer1" variant="outline" bg="white" styles={{ tab: { padding: '4px 8px', fontSize: '12px', borderBottom: 'none' } }}>
              <Tabs.List>
                <Tabs.Tab value="customer1" bg="white">CUSTOMER 1</Tabs.Tab>
                <Tabs.Tab value="customer2" bg="gray.2">CUSTOMER 2</Tabs.Tab>
                <Tabs.Tab value="customer3" bg="gray.2">CUSTOMER 3</Tabs.Tab>
              </Tabs.List>
            </Tabs>
            
            <Paper withBorder mt={0} h={520} bg="white" style={{ borderTop: 0, borderRadius: 0, border: `2px solid ${customColors.border}` }}>
              <Table stickyHeader>
                <Table.Thead bg={customColors.tableHeaderRow}>
                  <Table.Tr>
                    <Table.Th style={{fontSize:'12px', padding:'4px 8px'}}>Product Name</Table.Th>
                    <Table.Th style={{fontSize:'12px', padding:'4px 8px'}}>Qty/Wt</Table.Th>
                    <Table.Th style={{fontSize:'12px', padding:'4px 8px'}}>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr bg={customColors.selectedRow}>
                    <Table.Td style={{fontSize:'12px', padding:'4px 8px'}}>book</Table.Td>
                    <Table.Td style={{fontSize:'12px', padding:'4px 8px'}}>1 X 1</Table.Td>
                    <Table.Td style={{fontSize:'12px', padding:'4px 8px'}}>1000.00</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Paper>

            <Paper withBorder mt="xs" p="xs" style={{ border: `2px solid ${customColors.border}`, borderRadius: 0, position: 'relative' }} bg={customColors.bg}>
               <Text size="10px" fw="bold" style={{ position: 'absolute', top: '-8px', left: '10px', backgroundColor: customColors.bg, padding: '0 5px' }}>Last Transaction Details</Text>
               <Grid mt={5}>
                 <Grid.Col span={6}>
                   <Flex justify="space-between"><Text size="11px">Trans No</Text><Text size="11px" fw="bold">1011251</Text></Flex>
                   <Flex justify="space-between"><Text size="11px">Trans Amt</Text><Text size="11px" fw="bold">1.00</Text></Flex>
                   <Flex justify="space-between"><Text size="11px">Due Amt</Text><Text size="11px" fw="bold">0.00</Text></Flex>
                 </Grid.Col>
                 <Grid.Col span={6}>
                   <Flex justify="space-between"><Text size="11px">Paid Amt</Text><Text size="11px" fw="bold">1.00</Text></Flex>
                   <Flex justify="space-between"><Text size="11px">Return Amt</Text><Text size="11px" fw="bold">0.00</Text></Flex>
                   <Button size="xs" style={btnStyle} fullWidth mt={5} h={24}>Re Print</Button>
                 </Grid.Col>
               </Grid>
            </Paper>
        </Grid.Col>

        {/* MIDDLE COLUMN */}
        <Grid.Col span={4}>
          <Flex align="center" gap="xs" mb="xs">
            <Text size="sm">Employee</Text>
            <Select data={['admin']} defaultValue="admin" size="xs" flex={1} styles={{ input: { borderRadius: 0 } }} />
            <Button style={btnStyle} size="xs" px="lg">LOCK</Button>
          </Flex>
          
          <Paper withBorder p={0} style={{ border: `2px solid ${customColors.headerBg}`, borderRadius: 0 }} bg={customColors.bg}>
             <Flex justify="space-between" align="center" bg={customColors.headerBg} px="sm" py={2}>
                <Text size="11px" c="white">Customer  -   Number - </Text>
                <Button size="xs" style={{...btnStyle, border: '1px solid #fff'}} h={20} px={5}>Clear</Button>
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
                       <TextInput size="md" flex={1} value="OPEN ITEM" readOnly styles={{ input: { borderRadius: 0, height: 40 } }} />
                    </Flex>
                    <Flex gap="xs" align="center" mb={5}>
                       <Text size="12px" w={55}>Barcode</Text>
                       <TextInput size="xs" flex={1} value="open1234" readOnly rightSection={<Text size="11px" td="underline" c="blue" style={{cursor:'pointer'}}>Edit</Text>} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                    </Flex>
                    <Flex gap="xs" align="center" mb={5}>
                       <Text size="12px" w={55}>Weight</Text>
                       <Box flex={1}></Box>
                       <Text size="12px">Quantity</Text>
                       <TextInput size="xs" w={60} defaultValue="1" styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                    </Flex>
                    <Flex gap="xs" align="center" mb={10}>
                       <Select data={['1pc']} defaultValue="1pc" size="xs" w={80} styles={{ input: { borderRadius: 0, height: 24, minHeight: 24 } }} />
                       <Box flex={1} />
                       <Button style={btnStyle} size="xs" w={40} h={24}>+</Button>
                       <Button style={btnStyle} size="xs" w={40} h={24}>-</Button>
                    </Flex>
                    <Flex gap="xs" align="center" mb={5}>
                       <Box flex={1}><Text size="12px" mb={2}>Unit Price</Text><TextInput size="xs" defaultValue="1.00" styles={{ input: { borderRadius: 0, height: 24, minHeight: 24, backgroundColor: '#3388ff', color: 'white' } }} /></Box>
                       <Box flex={1}><Text size="12px" mb={2}>Total Price</Text><Text size="sm">1.00</Text></Box>
                    </Flex>

                    <Flex gap={5} mt="sm">
                       <Button style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">ADD</Text></Button>
                       <Button style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">UPDATE</Text></Button>
                       <Button style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="10px" fw="bold">REMOVE</Text></Button>
                       <Button style={btnStyle} size="xs" flex={1} h={30} px={0}><Text size="9px" fw="bold" ta="center" style={{whiteSpace:'normal'}}>REMOVE ALL</Text></Button>
                    </Flex>
                 </fieldset>
             </Box>
          </Paper>
          
          <Paper mt="xs" p={0} style={{ border: `1px solid ${customColors.border}`, borderRadius: 0 }} bg={customColors.bg}>
             <Grid>
               <Grid.Col span={3} style={{ borderRight: `1px solid ${customColors.border}` }}>
                  <Box bg="gray.3" h="100%" p={5} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                     <Box w={40} h={30} bg="green.2" mb={5}></Box> {/* Placeholder for cash image */}
                     <Text size="11px" fw="bold" ta="center">CASH PAY</Text>
                  </Box>
               </Grid.Col>
               <Grid.Col span={5} p={0}>
                  <Flex style={{borderBottom: `1px solid ${customColors.border}`}}>
                    <Box w={70} style={{borderRight:`1px solid ${customColors.border}`}}><Text size="11px" p={4}>Sub Total</Text></Box>
                    <Box flex={1} ta="right" bg="white"><Text size="11px" p={4}>1000.00</Text></Box>
                  </Flex>
                  <Flex style={{borderBottom: `1px solid ${customColors.border}`}}>
                    <Box w={70} style={{borderRight:`1px solid ${customColors.border}`}}><Text size="11px" p={4}>Deposit</Text></Box>
                    <Box flex={1} ta="right" bg="white"><Text size="11px" p={4}>0.00</Text></Box>
                  </Flex>
                  <Flex>
                    <Box w={70} style={{borderRight:`1px solid ${customColors.border}`}}><Text size="12px" fw="bold" p={4}>TOTAL</Text></Box>
                    <Box flex={1} ta="right" bg="white"><Text size="12px" fw="bold" p={4}>1000.00</Text></Box>
                  </Flex>
               </Grid.Col>
               <Grid.Col span={4} p={0} style={{ borderLeft: `1px solid ${customColors.border}` }}>
                  <Flex align="center" style={{borderBottom: `1px solid ${customColors.border}`}} h={34}>
                    <Text size="10px" w={35} pl={2}>CASH</Text>
                    <TextInput size="xs" flex={1} defaultValue="0.00" styles={{ input: { border: 0, borderRadius: 0, textAlign: 'right', height: 34, minHeight: 34 } }} />
                  </Flex>
                  <Flex align="center" h={34}>
                    <Text size="10px" w={35} pl={2}>CARD</Text>
                    <TextInput size="xs" flex={1} defaultValue="0.00" styles={{ input: { border: 0, borderRadius: 0, textAlign: 'right', height: 34, minHeight: 34 } }} />
                  </Flex>
               </Grid.Col>
             </Grid>
          </Paper>
        </Grid.Col>

        {/* RIGHT COLUMN */}
        <Grid.Col span={4.5}>
           <Grid mb="sm">
              {[
                {name: 'OPEN ITEM', color: customColors.greenBtnTop}, 
                {name: 'HOUSE HOLD', color: customColors.greenBtnTop}, 
                {name: 'SWEETS', color: customColors.greenBtnTop}, 
                {name: 'MINERALS', color: customColors.greenBtnMid}, 
                {name: 'VEG ITEM', color: customColors.greenBtnMid}, 
                {name: 'FRESH MEAT', color: customColors.greenBtnMid}, 
                {name: 'FISH AND SEAFOOD', color: customColors.orangeBtn}, 
                {name: 'LAMB BEEF', color: customColors.orangeBtn}, 
                {name: 'CHICKEN', color: customColors.orangeBtn}, 
                {name: 'FRUITS', color: customColors.orangeBtn}, 
                {name: 'VEG', color: customColors.orangeBtn}, 
                {name: 'BAKERY AND DAIRY', color: customColors.orangeBtn}
              ].map(cat => (
                 <Grid.Col span={4} key={cat.name}>
                    <Button fullWidth style={{ backgroundColor: cat.color, border: '2px solid white', borderRadius: '2px', padding: '0 4px', height: '40px' }}>
                       <Text size="10px" fw="bold" ta="center" style={{whiteSpace:'normal', lineHeight:1.1}}>{cat.name}</Text>
                    </Button>
                 </Grid.Col>
              ))}
           </Grid>

           <Grid>
              <Grid.Col span={8}>
                 <Grid>
                    {[1,2,3,4,5,6,7,8,9,0,'00','X'].map(num => (
                       <Grid.Col span={4} key={num}>
                          <Button fullWidth style={{...btnStyle, height: '45px'}}><Text size="xl" fw="normal">{num}</Text></Button>
                       </Grid.Col>
                    ))}
                    <Grid.Col span={6}>
                       <Button fullWidth style={{...btnStyle, height: '35px'}}><Text size="11px">Clear All</Text></Button>
                    </Grid.Col>
                    <Grid.Col span={3}>
                       <Button fullWidth style={{...btnStyle, height: '35px'}}><Text size="11px">C</Text></Button>
                    </Grid.Col>
                    <Grid.Col span={3} p={0}>
                       <Box style={{ border: `1px solid ${customColors.border}`, height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: customColors.bg, marginLeft: '2px', marginTop: '2px' }}>
                          <Checkbox label={<Text size="9px" style={{lineHeight:1, whiteSpace: 'nowrap'}}>ENABLE<br/>PRINTING</Text>} size="xs" defaultChecked />
                       </Box>
                    </Grid.Col>
                 </Grid>
              </Grid.Col>
              <Grid.Col span={4}>
                 <Flex direction="column" gap={4} h="100%">
                    <Button style={btnStyle} flex={1}><Text size="xl" fw="normal">+</Text></Button>
                    <Button style={btnStyle} flex={1} px={2}><Text size="10px" fw="bold" style={{whiteSpace:'normal', lineHeight:1}}>EDIT DETAILS</Text></Button>
                    <Button style={btnStyle} flex={1} px={2}><Text size="10px" fw="bold" style={{whiteSpace:'normal', lineHeight:1}}>EDIT PRICE</Text></Button>
                 </Flex>
              </Grid.Col>
           </Grid>

           <Flex gap={4} mt="sm">
              {[2,5,10,20,50].map(val => (
                 <Button key={val} flex={1} style={{ backgroundColor: val <= 5 ? '#5d736b' : (val <= 10 ? '#db878a' : (val <= 20 ? '#82b9ce' : '#dfcca2')), color: '#000', border: '2px solid white', borderRadius: '2px', height: '35px' }}>
                    <Text fw="bold">{val}</Text>
                 </Button>
              ))}
           </Flex>

           <Flex gap={4} mt="xs">
              {['PAY DUES', 'SHOW ALL OFFERS', 'OPEN TILL', 'PAYBILL', 'OPTIONS', 'CLOSE (Ctrl + X)'].map((opt, i) => (
                 <Button key={opt} flex={i === 5 ? 1.2 : 1} style={{ backgroundColor: i === 5 ? '#c96263' : customColors.orangeBtn, border: '2px solid white', borderRadius: '2px', padding: '0 2px', height: '40px' }}>
                    <Text size="9px" fw="bold" ta="center" style={{whiteSpace:'normal', lineHeight:1}}>{opt}</Text>
                 </Button>
              ))}
           </Flex>
        </Grid.Col>
      </Grid>
    </Box>
  );
};

export default Dashboard;
