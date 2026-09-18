/**
 * Public sign up: one form creates the company and its first admin, then
 * signs them straight in. Cashier logins are added afterwards by the admin.
 *
 * In the desktop shell the request goes through Electron so the till is
 * claimed for the new company at the same time; in the browser it is a plain
 * API call.
 */
import { useState } from 'react';
import { Anchor, Button, PasswordInput, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { Link, useNavigate } from 'react-router-dom';
import httpClient from '../../services/httpClient';
import { rememberLicenseFromSignIn } from '../../services/licenseService';
import { useAuthStore } from '../../store/authStore';
import type { AuthTokens, AuthUser } from '../../store/authStore';

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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: 16,
      }}
    >
      <div style={{ width: 380 }}>
        <Title order={3} ta="center" mb={4}>
          Create your company account
        </Title>
        <Text size="sm" c="dimmed" ta="center" mb="lg">
          You will be the admin. Add cashiers from the admin panel afterwards.
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput label="Company / shop name" placeholder="Corner Shop" required mb="sm" {...form.getInputProps('companyName')} />
          <TextInput label="Your name" placeholder="Aoife Byrne" required mb="sm" autoComplete="name" {...form.getInputProps('name')} />
          <TextInput
            label="Email"
            placeholder="you@yourcompany.com"
            required
            mb="sm"
            autoComplete="username"
            {...form.getInputProps('email')}
          />
          <TextInput label="Phone" placeholder="Optional" mb="sm" autoComplete="tel" {...form.getInputProps('phone')} />
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            required
            mb="sm"
            autoComplete="new-password"
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirm password"
            required
            mb="xs"
            autoComplete="new-password"
            {...form.getInputProps('confirmPassword')}
          />

          {error && (
            <Text c="red" size="xs" mb="sm">
              {error}
            </Text>
          )}

          <Button fullWidth mt="md" type="submit" loading={loading} color="blue" size="md" radius="md">
            Create account
          </Button>
        </form>

        <Text size="sm" ta="center" mt="lg">
          Already have an account?{' '}
          <Anchor component={Link} to="/login" size="sm">
            Sign in
          </Anchor>
        </Text>
      </div>
    </div>
  );
};

export default Register;
