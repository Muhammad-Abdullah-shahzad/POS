import { TextInput, PasswordInput, Button, Text, SegmentedControl, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<'cashier' | 'admin'>('cashier');

  const form = useForm({
    initialValues: { email: '', password: '' },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      setError('');

      let user: { id: string; name: string; role: string };
      let token: string;

      const electronAPI = window.electronAPI;

      if (electronAPI) {
        const result = await electronAPI.auth.login(values.email, values.password);
        if (!result.success) { setError(result.message || 'Login failed'); return; }
        user  = result.data.user;
        token = result.data.token;
      } else {
        const { data } = await api.post('/auth/login', values);
        user  = data.data.user;
        token = data.data.token;
      }

      if (loginRole === 'admin' && user.role !== 'admin' && user.role !== 'manager') {
        setError('Access denied. Admin only.'); return;
      }
      if (loginRole === 'cashier' && (user.role === 'admin' || user.role === 'manager')) {
        setError('Please use the Admin login.'); return;
      }

      login(user, token);
      navigate(user.role === 'admin' || user.role === 'manager' ? '/admin' : '/');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = loginRole === 'admin';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#ffffff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 360 }}>

        {/* role toggle */}
        <Box mb="lg">
          <SegmentedControl
            fullWidth
            value={loginRole}
            onChange={(val) => { setLoginRole(val as 'cashier' | 'admin'); setError(''); }}
            data={[
              { label: 'Cashier', value: 'cashier' },
              { label: 'Admin', value: 'admin' },
            ]}
            color="blue"
            size="sm"
            radius="md"
          />
        </Box>

        {/* form */}
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Email"
            placeholder="you@store.com"
            required
            mb="sm"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            required
            mb="xs"
            {...form.getInputProps('password')}
          />

          {error && (
            <Text c="red" size="xs" mb="sm">{error}</Text>
          )}

          <Button
            fullWidth mt="md" type="submit"
            loading={loading} color="blue" size="md" radius="md"
          >
            {isAdmin ? 'Login as Admin' : 'Login as Cashier'}
          </Button>
        </form>

      </div>
    </div>
  );
};

export default Login;
