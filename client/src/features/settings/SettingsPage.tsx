import { useState, useEffect } from 'react';
import { Title, Paper, TextInput, NumberInput, Button, Stack, Group, Grid, Tabs, Text, Select, Switch } from '@mantine/core';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { CURRENCIES, useCurrencyStore } from '../../store/currencyStore';
import type { CurrencyCode } from '../../store/currencyStore';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconBuildingStore, IconReceipt, IconStar, IconUsersGroup } from '@tabler/icons-react';
import { currencySymbol, formatMoney, formatMoneyAs } from '../../utils/money';
import StaffLogins from './StaffLogins';
import CompanyLogoSetting from './CompanyLogoSetting';
import { useSettingsStore } from '../../store/settingsStore';

const SettingsPage = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const savedCurrency = useCurrencyStore((state) => state.code);
  const setCurrency = useCurrencyStore((state) => state.setCurrency);
  const { setSettings, fetchSettings } = useSettingsStore();

  const form = useForm({
    initialValues: {
      shopName: '',
      shopAddress: '',
      shopPhone: '',
      shopEmail: '',
      shopWebsite: '',
      receiptFooter: '',
      receiptSize: 'Thermal',
      showRemarksPrompt: true,
      currency: savedCurrency as CurrencyCode,
      loyaltyPointsPerEuro: 1,
      loyaltyRewardThreshold: 100,
      loyaltyRewardValue: 5,
    },
    validate: {
      shopName: (value) => (value.length < 2 ? 'Shop name must be at least 2 characters' : null),
      shopAddress: (value) => (value.length < 5 ? 'Address must be at least 5 characters' : null),
    },
  });

  const loadSettingsData = async () => {
    try {
      setFetching(true);
      const success = await fetchSettings();
      if (success) {
        const globalSettings = useSettingsStore.getState().settings;
        if (globalSettings) {
          form.setValues({
            shopName: globalSettings.shopName || '',
            shopAddress: globalSettings.shopAddress || '',
            shopPhone: globalSettings.shopPhone || '',
            shopEmail: globalSettings.shopEmail || '',
            shopWebsite: globalSettings.shopWebsite || '',
            receiptFooter: globalSettings.receiptFooter || '',
            receiptSize: globalSettings.receiptSize || 'Thermal',
            showRemarksPrompt: globalSettings.showRemarksPrompt ?? true,
            currency: (globalSettings.currency as CurrencyCode) || savedCurrency,
            loyaltyPointsPerEuro: globalSettings.loyaltyPointsPerEuro ?? 1,
            loyaltyRewardThreshold: globalSettings.loyaltyRewardThreshold ?? 100,
            loyaltyRewardValue: globalSettings.loyaltyRewardValue ?? 5,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Could not load configuration settings',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      const { data } = await api.put('/settings', values);
      if (data.success && data.data) {
        setCurrency(values.currency);
        setSettings(data.data); // Update global store immediately
        notifications.show({
          title: 'Settings Updated',
          message: 'System and shop parameters saved successfully',
          color: 'teal',
          icon: <IconCheck size={16} />,
        });
        // Fire custom event to let layout know settings have changed
        window.dispatchEvent(new Event('shop-settings-updated'));
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      const msg = error.response?.data?.message || 'Could not update configuration settings';
      notifications.show({
        title: 'Error Saving',
        message: msg,
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Paper withBorder p="xl" radius="md">
        <Title order={3} ta="center">Loading Settings...</Title>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Title order={2}>System Settings</Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Tabs defaultValue="shop" variant="outline">
          <Tabs.List>
            <Tabs.Tab value="shop" leftSection={<IconBuildingStore size={16} />}>Shop Details</Tabs.Tab>
            <Tabs.Tab value="receipt" leftSection={<IconReceipt size={16} />}>Receipt Options</Tabs.Tab>
            <Tabs.Tab value="loyalty" leftSection={<IconStar size={16} />}>Loyalty Points</Tabs.Tab>
            <Tabs.Tab value="staff" leftSection={<IconUsersGroup size={16} />}>Staff Logins</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="shop" pt="md">
            <Stack gap="md">
              <CompanyLogoSetting />
              <Paper withBorder p="lg" radius="md">
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Shop / Business Name"
                      placeholder="Enter business name"
                      required
                      {...form.getInputProps('shopName')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Contact Phone"
                      placeholder="e.g. +1 (555) 019-2834"
                      {...form.getInputProps('shopPhone')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Email Address"
                      placeholder="info@business.com"
                      {...form.getInputProps('shopEmail')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Website URL"
                      placeholder="www.business.com"
                      {...form.getInputProps('shopWebsite')}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TextInput
                      label="Address"
                      placeholder="Full business address"
                      required
                      {...form.getInputProps('shopAddress')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Select
                      label="Global Currency"
                      description={`Sets the system-wide currency. Receipts and screens will show ${formatMoneyAs(form.values.currency, 1234.5)}`}
                      data={Object.values(CURRENCIES).map(({ code, label }) => ({ value: code, label: `${label} (${code})` }))}
                      allowDeselect={false}
                      {...form.getInputProps('currency')}
                    />
                  </Grid.Col>
                </Grid>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="receipt" pt="md">
            <Paper withBorder p="lg" radius="md">
              <Stack gap="md">
                <Select
                  label="Receipt Size"
                  description="Choose whether to print receipts on standard narrow thermal paper or full A4 paper."
                  data={[
                    { value: 'Thermal', label: 'Standard Thermal (80mm)' },
                    { value: 'A4', label: 'A4 Document' }
                  ]}
                  allowDeselect={false}
                  {...form.getInputProps('receiptSize')}
                />
                <TextInput
                  label="Receipt Footer Note"
                  placeholder="e.g. THANK YOU FOR SHOPPING! Visit us again soon."
                  description="This text will be printed at the bottom of customer receipts."
                  {...form.getInputProps('receiptFooter')}
                />
                <Switch
                  label="Ask for remarks at checkout"
                  description="When on, the till asks for optional remarks before completing each sale and prints them on the invoice. When off, sales complete straight away."
                  {...form.getInputProps('showRemarksPrompt', { type: 'checkbox' })}
                />
              </Stack>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="loyalty" pt="md">
            <Paper withBorder p="lg" radius="md">
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Customers earn points automatically on every purchase. When they reach the threshold, they qualify for a free shopping reward.
                </Text>
                <Grid>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      label={`Points Earned per ${currencySymbol()}1 Spent`}
                      description={`e.g. 1 = 1 point per ${currencySymbol()}1 spent`}
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps('loyaltyPointsPerEuro')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      label="Points Needed for Reward"
                      description="e.g. 100 = reward at 100 points"
                      min={1}
                      {...form.getInputProps('loyaltyRewardThreshold')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <NumberInput
                      label={`Reward Value (${currencySymbol()})`}
                      description="Free shopping value when threshold reached"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps('loyaltyRewardValue')}
                    />
                  </Grid.Col>
                </Grid>
                <Paper bg="blue.0" p="md" radius="md" withBorder>
                  <Text size="sm" fw={600}>Example with current settings:</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Customer spends {formatMoney(form.values.loyaltyRewardThreshold / (form.values.loyaltyPointsPerEuro || 1))} total
                    → earns {form.values.loyaltyRewardThreshold} points
                    → qualifies for {formatMoney(form.values.loyaltyRewardValue)} free shopping reward.
                  </Text>
                </Paper>
              </Stack>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="staff" pt="md">
            <StaffLogins />
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="xl">
          <Button type="submit" loading={loading} size="md" color="blue">
            Save Settings
          </Button>
        </Group>
      </form>
    </Stack>
  );
};

export default SettingsPage;
