import { useState } from 'react';
import { Anchor, Box, Button, PasswordInput, SegmentedControl, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Link, useNavigate } from 'react-router-dom';
import httpClient from '../../services/httpClient';
import { rememberLicenseFromSignIn } from '../../services/licenseService';
import { useAuthStore } from '../../store/authStore';
import type { AuthTokens, AuthUser } from '../../store/authStore';

type LoginMode = 'cashier' | 'admin';

interface SignInResult {
  user: AuthUser;
  tokens: AuthTokens;
  /** Licence status that came back with the session; the route guard acts on it. */
  license: unknown;
}

/**
 * Sign in.
 *
 * In the desktop shell the request goes through Electron, which authenticates
 * against the server when it can reach it and falls back to the cached
 * credentials for this till when it cannot. In the browser it is a plain API
 * call. Either way the company comes from the account, never from the form.
 *
 * Sign in succeeds even when the company's licence has lapsed; the licence
 * guard then shows the renewal screen instead of the app.
 */
const Login = () => {
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);

  const [mode, setMode] = useState<LoginMode>('cashier');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email address'),
      password: (value) => (value.length > 0 ? null : 'Enter your password'),
    },
  });

  const signInThroughDesktop = async (email: string, password: string): Promise<SignInResult> => {
    const result = await window.electronAPI!.auth.login(email, password);
    if (!result.success) throw new Error(result.message ?? 'Sign in failed');

    return {
      user: result.data.user,
      tokens: { accessToken: result.data.accessToken, refreshToken: result.data.refreshToken },
      license: result.data.license,
    };
  };

  const signInThroughApi = async (email: string, password: string): Promise<SignInResult> => {
    const { data } = await httpClient.post('/auth/login', { email, password });

    return {
      user: data.data.user,
      tokens: { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
      license: data.data.license,
    };
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError('');

    try {
      const { user, tokens, license } = window.electronAPI
        ? await signInThroughDesktop(values.email, values.password)
        : await signInThroughApi(values.email, values.password);

      const isManager = user.role === 'admin' || user.role === 'manager';

      // The toggle is a convenience, not a security control: the server decides
      // what each role may actually do.
      if (mode === 'admin' && !isManager) {
        setError('This account is not an admin. Use the cashier login.');
        return;
      }
      if (mode === 'cashier' && isManager) {
        setError('This is an admin account. Use the admin login.');
        return;
      }

      signIn(user, tokens);
      rememberLicenseFromSignIn(license);
      navigate(isManager ? '/admin' : '/', { replace: true });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        'Sign in failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 360 }}>
        <Title order={3} ta="center" mb="lg">
          Sign in
        </Title>

        <Box mb="lg">
          <SegmentedControl
            fullWidth
            value={mode}
            onChange={(value) => {
              setMode(value as LoginMode);
              setError('');
            }}
            data={[
              { label: 'Cashier', value: 'cashier' },
              { label: 'Admin', value: 'admin' },
            ]}
            color="blue"
            size="sm"
            radius="md"
          />
        </Box>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Email"
            placeholder="you@yourcompany.com"
            required
            mb="sm"
            autoComplete="username"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            required
            mb="xs"
            autoComplete="current-password"
            {...form.getInputProps('password')}
          />

          {error && (
            <Text c="red" size="xs" mb="sm">
              {error}
            </Text>
          )}

          <Button fullWidth mt="md" type="submit" loading={loading} color="blue" size="md" radius="md">
            {mode === 'admin' ? 'Sign in as admin' : 'Sign in as cashier'}
          </Button>
        </form>

        <Text size="sm" ta="center" mt="lg">
          New company?{' '}
          <Anchor component={Link} to="/register" size="sm">
            Create an account
          </Anchor>
        </Text>
      </div>
    </div>
  );
};

export default Login;
