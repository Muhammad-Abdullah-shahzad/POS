import { useState, useEffect } from 'react';
import { Title, Paper, TextInput, NumberInput, Switch, Button, Stack, Group, Grid, Tabs, Box, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconBuildingStore, IconReceipt, IconReceiptTax, IconStar } from '@tabler/icons-react';

const SettingsPage = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const form = useForm({
    initialValues: {
      shopName: '',
      shopAddress: '',
      shopPhone: '',
      shopEmail: '',
      shopWebsite: '',
      receiptFooter: '',
      defaultVatRate: 20,
      isVatInclusiveDefault: true,
      loyaltyPointsPerEuro: 1,
      loyaltyRewardThreshold: 100,
      loyaltyRewardValue: 5,
    },
    validate: {
      shopName: (value) => (value.length < 2 ? 'Shop name must be at least 2 characters' : null),
      shopAddress: (value) => (value.length < 5 ? 'Address must be at least 5 characters' : null),
    },
  });

  const fetchSettings = async () => {
    try {
      setFetching(true);
      const { data } = await api.get('/settings');
      if (data.success && data.data) {
        form.setValues({
          shopName: data.data.shopName || '',
          shopAddress: data.data.shopAddress || '',
          shopPhone: data.data.shopPhone || '',
          shopEmail: data.data.shopEmail || '',
          shopWebsite: data.data.shopWebsite || '',
          receiptFooter: data.data.receiptFooter || '',
          defaultVatRate: data.data.defaultVatRate ?? 20,
          isVatInclusiveDefault: data.data.isVatInclusiveDefault ?? true,
          loyaltyPointsPerEuro: data.data.loyaltyPointsPerEuro ?? 1,
          loyaltyRewardThreshold: data.data.loyaltyRewardThreshold ?? 100,
          loyaltyRewardValue: data.data.loyaltyRewardValue ?? 5,
        });
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
    fetchSettings();
  }, []);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      const { data } = await api.put('/settings', values);
      if (data.success) {
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
            <Tabs.Tab value="tax" leftSection={<IconReceiptTax size={16} />}>Tax & VAT</Tabs.Tab>
            <Tabs.Tab value="loyalty" leftSection={<IconStar size={16} />}>Loyalty Points</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="shop" pt="md">
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
              </Grid>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="receipt" pt="md">
            <Paper withBorder p="lg" radius="md">
              <Stack gap="md">
                <TextInput
                  label="Receipt Footer Note"
                  placeholder="e.g. THANK YOU FOR SHOPPING! Visit us again soon."
                  description="This text will be printed at the bottom of customer receipts."
                  {...form.getInputProps('receiptFooter')}
                />
              </Stack>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="tax" pt="md">
            <Paper withBorder p="lg" radius="md">
              <Stack gap="md">
                <Grid align="flex-end">
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <NumberInput
                      label="Default VAT Rate (%)"
                      placeholder="e.g. 20"
                      min={0}
                      max={100}
                      required
                      {...form.getInputProps('defaultVatRate')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Box pb={8}>
                      <Switch
                        label="VAT Inclusive by Default"
                        description="If enabled, items will have tax inclusive pricing on search scan"
                        checked={form.values.isVatInclusiveDefault}
                        onChange={(event) => form.setFieldValue('isVatInclusiveDefault', event.currentTarget.checked)}
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
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
                      label="Points Earned per €1 Spent"
                      description="e.g. 1 = 1 point per euro"
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
                      label="Reward Value (€)"
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
                    Customer spends €{form.values.loyaltyRewardThreshold / (form.values.loyaltyPointsPerEuro || 1)} total
                    → earns {form.values.loyaltyRewardThreshold} points
                    → qualifies for €{form.values.loyaltyRewardValue} free shopping reward.
                  </Text>
                </Paper>
              </Stack>
            </Paper>
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
