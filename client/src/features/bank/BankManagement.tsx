import { useEffect, useState } from 'react';
import { Tabs, Table, Button, Group, Modal, TextInput, Select, Paper, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { IconBuildingBank, IconCreditCard, IconListDetails, IconPlus } from '@tabler/icons-react';

export default function BankManagement() {
  const [activeTab, setActiveTab] = useState<string | null>('accounts');
  
  const [bankNames, setBankNames] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  
  const [bankNameOpened, { open: openBankName, close: closeBankName }] = useDisclosure(false);
  const [accountOpened, { open: openAccount, close: closeAccount }] = useDisclosure(false);
  const [cardOpened, { open: openCard, close: closeCard }] = useDisclosure(false);
  
  const [loading, setLoading] = useState(false);

  const fetchBankNames = async () => {
    try { const { data } = await api.get('/banks/names'); setBankNames(data.data); } catch (e) {}
  };
  const fetchAccounts = async () => {
    try { const { data } = await api.get('/banks/accounts'); setAccounts(data.data); } catch (e) {}
  };
  const fetchCards = async () => {
    try { const { data } = await api.get('/banks/cards'); setCards(data.data); } catch (e) {}
  };

  useEffect(() => {
    fetchBankNames();
    fetchAccounts();
    fetchCards();
  }, []);

  const nameForm = useForm({ initialValues: { name: '' } });
  const accountForm = useForm({ initialValues: { bankName: '', type: '', accountName: '', iban: '', bic: '' } });
  const cardForm = useForm({ initialValues: { bankName: '', accountName: '', type: '', cardNumber: '', cardName: '', expiryDate: '' } });

  const handleNameSubmit = async (values: typeof nameForm.values) => {
    setLoading(true);
    try {
      await api.post('/banks/names', values);
      notifications.show({ title: 'Success', message: 'Bank name added', color: 'green' });
      closeBankName(); nameForm.reset(); fetchBankNames();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.response?.data?.message || 'Error', color: 'red' });
    } finally { setLoading(false); }
  };

  const handleAccountSubmit = async (values: typeof accountForm.values) => {
    setLoading(true);
    try {
      await api.post('/banks/accounts', values);
      notifications.show({ title: 'Success', message: 'Account added', color: 'green' });
      closeAccount(); accountForm.reset(); fetchAccounts();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.response?.data?.message || 'Error', color: 'red' });
    } finally { setLoading(false); }
  };

  const handleCardSubmit = async (values: typeof cardForm.values) => {
    setLoading(true);
    try {
      await api.post('/banks/cards', values);
      notifications.show({ title: 'Success', message: 'Card added', color: 'green' });
      closeCard(); cardForm.reset(); fetchCards();
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.response?.data?.message || 'Error', color: 'red' });
    } finally { setLoading(false); }
  };

  const bankNameOptions = bankNames.map(b => b.name);

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="accounts" leftSection={<IconListDetails size={16} />}>Accounts</Tabs.Tab>
            <Tabs.Tab value="cards" leftSection={<IconCreditCard size={16} />}>Cards</Tabs.Tab>
            <Tabs.Tab value="names" leftSection={<IconBuildingBank size={16} />}>Bank Names</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="accounts" pt="md">
            <Group justify="flex-end" mb="md">
              <Button leftSection={<IconPlus size={16} />} onClick={openAccount}>Add Account</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Bank Name</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Account Name</Table.Th>
                  <Table.Th>IBAN</Table.Th>
                  <Table.Th>BIC</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accounts.map((a) => (
                  <Table.Tr key={a._id}>
                    <Table.Td>{a.bankName}</Table.Td>
                    <Table.Td>{a.type}</Table.Td>
                    <Table.Td>{a.accountName}</Table.Td>
                    <Table.Td>{a.iban}</Table.Td>
                    <Table.Td>{a.bic}</Table.Td>
                  </Table.Tr>
                ))}
                {accounts.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5} ta="center" py="xl">No accounts found</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          <Tabs.Panel value="cards" pt="md">
            <Group justify="flex-end" mb="md">
              <Button leftSection={<IconPlus size={16} />} onClick={openCard}>Add Card</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Bank Name</Table.Th>
                  <Table.Th>Account Name</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Card Number</Table.Th>
                  <Table.Th>Card Name</Table.Th>
                  <Table.Th>Expiry Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cards.map((c) => (
                  <Table.Tr key={c._id}>
                    <Table.Td>{c.bankName}</Table.Td>
                    <Table.Td>{c.accountName}</Table.Td>
                    <Table.Td>{c.type}</Table.Td>
                    <Table.Td>{c.cardNumber}</Table.Td>
                    <Table.Td>{c.cardName}</Table.Td>
                    <Table.Td>{c.expiryDate}</Table.Td>
                  </Table.Tr>
                ))}
                {cards.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6} ta="center" py="xl">No cards found</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          <Tabs.Panel value="names" pt="md">
            <Group justify="flex-end" mb="md">
              <Button leftSection={<IconPlus size={16} />} onClick={openBankName}>Add Bank Name</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Bank Name</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {bankNames.map((b) => (
                  <Table.Tr key={b._id}>
                    <Table.Td>{b.name}</Table.Td>
                  </Table.Tr>
                ))}
                {bankNames.length === 0 && (
                  <Table.Tr>
                    <Table.Td ta="center" py="xl">No bank names found</Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      {/* Modals */}
      <Modal opened={bankNameOpened} onClose={closeBankName} title="Add Bank Name" size="sm">
        <form onSubmit={nameForm.onSubmit(handleNameSubmit)}>
          <TextInput label="Name" required {...nameForm.getInputProps('name')} mb="md" />
          <Button fullWidth type="submit" loading={loading}>Save</Button>
        </form>
      </Modal>

      <Modal opened={accountOpened} onClose={closeAccount} title="Add Account" size="md">
        <form onSubmit={accountForm.onSubmit(handleAccountSubmit)}>
          <Stack gap="sm">
            <Select label="Bank Name" data={bankNameOptions} required {...accountForm.getInputProps('bankName')} />
            <TextInput label="Type" required {...accountForm.getInputProps('type')} />
            <TextInput label="Account Name" required {...accountForm.getInputProps('accountName')} />
            <TextInput label="IBAN" required {...accountForm.getInputProps('iban')} />
            <TextInput label="BIC" required {...accountForm.getInputProps('bic')} />
            <Button fullWidth type="submit" loading={loading} mt="md">Save</Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={cardOpened} onClose={closeCard} title="Add Card Details" size="md">
        <form onSubmit={cardForm.onSubmit(handleCardSubmit)}>
          <Stack gap="sm">
            <Select label="Bank Name" data={bankNameOptions} required {...cardForm.getInputProps('bankName')} />
            <TextInput label="Account Name" required {...cardForm.getInputProps('accountName')} />
            <TextInput label="Type" required {...cardForm.getInputProps('type')} />
            <TextInput label="Card Number" required {...cardForm.getInputProps('cardNumber')} />
            <TextInput label="Card Name" required {...cardForm.getInputProps('cardName')} />
            <TextInput label="Expiry Date" placeholder="MM/YY" required {...cardForm.getInputProps('expiryDate')} />
            <Button fullWidth type="submit" loading={loading} mt="md">Save</Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
