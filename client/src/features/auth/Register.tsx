/**
 * Public sign up: one form creates the company and its first admin, then signs
 * them straight in. Cashier logins are added afterwards by the admin.
 *
 * In the desktop shell the request goes through Electron so the till is claimed
 * for the new company at the same time; in the browser it is a plain API call.
 */
import { useState } from 'react';
import { Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconBuildingStore, IconLock, IconMail, IconPhone, IconUser } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import httpClient from '../../services/httpClient';
import { rememberLicenseFromSignIn } from '../../services/licenseService';
import { useAuthStore } from '../../store/authStore';
import type { AuthTokens, AuthUser } from '../../store/authStore';
import AuthShell from './AuthShell';
import { AUTH_BRAND, authClasses, authFieldClassNames } from './authFieldClasses';

interface RegisterForm {
  companyName: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface SignUpResult {
  user: AuthUser;
  tokens: AuthTokens;
  license: unknown;
}

const ICON = { size: 18, stroke: 1.5 } as const;

const Register = () => {
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterForm>({
    initialValues: { companyName: '', name: '', email: '', phone: '', password: '', confirmPassword: '' },
    validate: {
      companyName: (value) => (value.trim().length >= 2 ? null : 'Enter your company or shop name'),
      name: (value) => (value.trim().length >= 2 ? null : 'Enter your name'),
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email address'),
      password: (value) => (value.length >= 8 ? null : 'Use at least 8 characters'),
      confirmPassword: (value, values) => (value === values.password ? null : 'Passwords do not match'),
    },
  });

  const signUpThroughDesktop = async (values: RegisterForm): Promise<SignUpResult> => {
    const result = await window.electronAPI!.auth.register({
      companyName: values.companyName,
      name: values.name,
      email: values.email,
      password: values.password,
      phone: values.phone || undefined,
    });
    if (!result.success) throw new Error(result.message ?? 'Sign up failed');

    return {
      user: result.data.user,
      tokens: { accessToken: result.data.accessToken, refreshToken: result.data.refreshToken },
      license: result.data.license,
    };
  };

  const signUpThroughApi = async (values: RegisterForm): Promise<SignUpResult> => {
    const { data } = await httpClient.post('/auth/register', {
      companyName: values.companyName,
      name: values.name,
      email: values.email,
      password: values.password,
      phone: values.phone || undefined,
    });

    return {
      user: data.data.user,
      tokens: { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken },
      license: data.data.license,
    };
  };

  const handleSubmit = async (values: RegisterForm) => {
    setLoading(true);
    setError('');

    try {
      const { user, tokens, license } = window.electronAPI
        ? await signUpThroughDesktop(values)
        : await signUpThroughApi(values);

      signIn(user, tokens);
      rememberLicenseFromSignIn(license);
      navigate('/admin', { replace: true });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        'Sign up failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const field = { size: 'md', radius: 2, classNames: authFieldClassNames } as const;

  return (
    <AuthShell caption="Create your company account">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack gap={12}>
          <TextInput
            {...field}
            placeholder="Company or shop name"
            aria-label="Company or shop name"
            autoComplete="organization"
            leftSection={<IconBuildingStore {...ICON} />}
            {...form.getInputProps('companyName')}
          />
          <TextInput
            {...field}
            placeholder="Your name"
            aria-label="Your name"
            autoComplete="name"
            leftSection={<IconUser {...ICON} />}
            {...form.getInputProps('name')}
          />
          <TextInput
            {...field}
            placeholder="Email"
            aria-label="Email"
            autoComplete="username"
            leftSection={<IconMail {...ICON} />}
            {...form.getInputProps('email')}
          />
          <TextInput
            {...field}
            placeholder="Phone (optional)"
            aria-label="Phone, optional"
            autoComplete="tel"
            leftSection={<IconPhone {...ICON} />}
            {...form.getInputProps('phone')}
          />
          <PasswordInput
            {...field}
            placeholder="Password"
            aria-label="Password, at least 8 characters"
            autoComplete="new-password"
            leftSection={<IconLock {...ICON} />}
            {...form.getInputProps('password')}
          />
          <PasswordInput
            {...field}
            placeholder="Confirm password"
            aria-label="Confirm password"
            autoComplete="new-password"
            leftSection={<IconLock {...ICON} />}
            {...form.getInputProps('confirmPassword')}
          />

          {error && <Text className={authClasses.error}>{error}</Text>}

          <Button type="submit" fullWidth size="md" radius={2} color={AUTH_BRAND} loading={loading} className={authClasses.submit} mt={10}>
            Create account
          </Button>
        </Stack>
      </form>

      <p className={authClasses.footer}>
        Already have an account?{' '}
        <Link to="/login" className={authClasses.link}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
};

export default Register;
