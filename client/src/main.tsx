import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@mantine/core/styles.css';
import { MantineProvider, createTheme } from '@mantine/core';

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: { size: 'md' },
      styles: {
        root: { fontWeight: 600, letterSpacing: '0.3px' },
      },
    },
    NavLink: {
      styles: {
        root: { 
          borderRadius: 'var(--mantine-radius-md)',
          fontWeight: 500,
        },
      },
    },
    Paper: {
      defaultProps: { withBorder: true, shadow: 'xs' },
    },
  },
});
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { BrowserRouter } from 'react-router-dom';
import '@mantine/notifications/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <ModalsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
)
