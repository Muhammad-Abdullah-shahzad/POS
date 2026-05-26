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
import { BrowserRouter, HashRouter } from 'react-router-dom';
import '@mantine/notifications/styles.css';

// Electron loads the app via file:// — BrowserRouter breaks under that protocol
// because the full filesystem path becomes the route. HashRouter works everywhere.
const Router = window.electronAPI ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications position="top-right" />
      <ModalsProvider>
        <Router>
          <App />
        </Router>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
)
