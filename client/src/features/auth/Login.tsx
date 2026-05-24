import { TextInput, PasswordInput, Button, Paper, Title, Container, Text, SegmentedControl, Box, ThemeIcon, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { IconBuildingStore, IconShieldLock } from '@tabler/icons-react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<'cashier' | 'admin'>('cashier');

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.post('/auth/login', values);
      const user = data.data.user;
      const token = data.data.token;

      // Enforce role match
      if (loginRole === 'admin' && user.role !== 'admin' && user.role !== 'manager') {
        setError('Access denied. This login is for Admin only.');
        return;
      }
      if (loginRole === 'cashier' && (user.role === 'admin' || user.role === 'manager')) {
        setError('Please use the Admin login for this account.');
        return;
      }

      login(user, token);

      if (user.role === 'admin' || user.role === 'manager') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = loginRole === 'admin';

  return (
    <Container size={440} my={80}>
      <Stack align="center" mb="lg" gap="xs">
        <ThemeIcon size={56} radius="xl" color={isAdmin ? 'violet' : 'blue'} variant="light">
          {isAdmin ? <IconShieldLock size={30} /> : <IconBuildingStore size={30} />}
        </ThemeIcon>
        <Title ta="center" order={2}>
          Store POS System
        </Title>
        <Text size="sm" c="dimmed">
          {isAdmin ? 'Admin Panel Login' : 'Cashier Counter Login'}
        </Text>
      </Stack>

      <Box mb="md">
        <SegmentedControl
          fullWidth
          value={loginRole}
          onChange={(val) => { setLoginRole(val as 'cashier' | 'admin'); setError(''); }}
          data={[
            { label: '🧾  Cashier', value: 'cashier' },
            { label: '🛡️  Admin', value: 'admin' },
          ]}
          color={isAdmin ? 'violet' : 'blue'}
          size="md"
          radius="md"
        />
      </Box>

      <Paper withBorder shadow="md" p={30} radius="md" style={{ borderColor: isAdmin ? 'var(--mantine-color-violet-4)' : undefined, borderWidth: isAdmin ? 2 : undefined }}>
        {error && <Text c="red" size="sm" mb="sm">{error}</Text>}
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput label="Email" placeholder="you@store.com" required {...form.getInputProps('email')} />
          <PasswordInput label="Password" placeholder="Your password" required mt="md" {...form.getInputProps('password')} />
          <Button
            fullWidth mt="xl" type="submit" loading={loading}
            color={isAdmin ? 'violet' : 'blue'}
          >
            {isAdmin ? 'Login as Admin' : 'Login as Cashier'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default Login;
