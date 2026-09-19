import { useState } from 'react';
import { Button, Group, PasswordInput, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconUser } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import httpClient from '../../services/httpClient';
import { rememberLicenseFromSignIn } from '../../services/licenseService';
import { useAuthStore } from '../../store/authStore';
import type { AuthTokens, AuthUser } from '../../store/authStore';
import AuthShell from './AuthShell';
import InfoDialog from './InfoDialog';
import { AUTH_BRAND, authClasses, authFieldClassNames } from './authFieldClasses';

type LoginMode = 'cashier' | 'admin';

const MODES: { value: LoginMode; label: string }[] = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'admin', label: 'Admin' },
];

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
  const [showResetHelp, setShowResetHelp] = useState(false);

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

      // The switch is a convenience, not a security control: the server decides
      // what each role may actually do.
      if (mode === 'admin' && !isManager) {
        setError('This account is not an admin. Switch to Cashier to sign in.');
        return;
      }
      if (mode === 'cashier' && isManager) {
        setError('This is an admin account. Switch to Admin to sign in.');
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
    <AuthShell>
      <div className={authClasses.modes} role="tablist" aria-label="Sign in as">
        {MODES.map(({ value, label }) => (
          <UnstyledButton
            key={value}
            role="tab"
            aria-selected={mode === value}
            data-active={mode === value || undefined}
            className={authClasses.mode}
            onClick={() => {
              setMode(value);
              setError('');
            }}
          >
            {label}
          </UnstyledButton>
        ))}
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap={14}>
          <TextInput
            placeholder="Email"
            aria-label="Email"
            size="md"
            radius={2}
            autoComplete="username"
            leftSection={<IconUser size={18} stroke={1.5} />}
            classNames={authFieldClassNames}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            placeholder="Password"
            aria-label="Password"
            size="md"
            radius={2}
            autoComplete="current-password"
            leftSection={<IconLock size={18} stroke={1.5} />}
            classNames={authFieldClassNames}
            {...form.getInputProps('password')}
          />

          {error && <Text className={authClasses.error}>{error}</Text>}

          <Button type="submit" fullWidth size="md" radius={2} color={AUTH_BRAND} loading={loading} className={authClasses.submit} mt={10}>
            Login
          </Button>
        </Stack>
      </form>

      <Group justify="flex-end" mt={12}>
        <UnstyledButton className={authClasses.link} onClick={() => setShowResetHelp(true)}>
          Forgot password?
        </UnstyledButton>
      </Group>

      {/* There is no self-service reset: passwords are reset by the shop admin. */}
      <InfoDialog opened={showResetHelp} onClose={() => setShowResetHelp(false)} title="Forgot your password?">
        <p>
          Ask your shop admin to set a new password for you. Admins who cannot sign in can contact Deviction
          Technologies.
        </p>
      </InfoDialog>

      <p className={authClasses.footer}>
        Want 7 Days Free Trial ?{' '}
        <Link to="/register" className={authClasses.link}>
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
};

export default Login;
