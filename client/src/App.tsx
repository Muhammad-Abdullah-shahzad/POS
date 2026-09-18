import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import LicensePage from './features/license/LicensePage';
import { useLicenseWatcher } from './features/license/useLicenseWatcher';
import Dashboard from './features/dashboard/Dashboard';
import AdminDashboard from './features/admin/AdminDashboard';
import Products from './features/products/Products';
import Expenses from './features/expenses/Expenses';
import Receipts from './features/receipts/Receipts';
import Analysis from './features/analytics/Analysis';
import Suppliers from './features/suppliers/Suppliers';
import Employees from './features/employees/Employees';
import {
  SalaryManagement,
  Damages,
  ChangePassword,
  EmployeeAccess,
  DutyRoaster,
  AttendanceReport,
  OverTimeDetails
} from './features/employees/EmployeeSubFeatures';
import {
  SupplierPayments,
  ManageProductCodes
} from './features/products/StockSubFeatures';
import { ProductsSubFeatures } from './features/products/ProductsSubFeatures';
import ManageQuickProducts from './features/products/QuickProducts';
import { ReportsSubFeatures } from './features/reports/ReportsSubFeatures';
import GeneralProducts from './features/products/GeneralProducts';
import BankManagement from './features/bank/BankManagement';
import Customers from './features/customers/Customers';
import VoidTransactions from './features/voidTransactions/VoidTransactions';
import SettingsPage from './features/settings/SettingsPage';
import { useAuthStore } from './store/authStore';
import { isLicenseBlocking, useLicenseStore } from './store/licenseStore';
import { useCurrencyStore } from './store/currencyStore';

/**
 * Route guards.
 *
 * These only decide what to render. Every request is authorised again on the
 * server, so a tampered role in local storage changes nothing but the menu.
 * The licence guard is the same: it keeps a lapsed company on the renewal
 * screen, while the server (and, offline, the Electron main process) is what
 * actually refuses to work without a licence.
 */
const LicenseGuard = ({ children }: { children: React.ReactNode }) => {
  const status = useLicenseStore((state) => state.status);
  if (isLicenseBlocking(status)) return <Navigate to="/license" replace />;
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <LicenseGuard>{children}</LicenseGuard>;
};

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'manager') return <Navigate to="/" replace />;
  return <LicenseGuard>{children}</LicenseGuard>;
};

// Shared page set — used inside both / and /admin route parents
// Inside a nested Route, paths are RELATIVE — no leading slash, no prefix needed
const sharedRoutes = () => (
  <>
    <Route path="receipts" element={<Receipts />} />
    <Route path="products" element={<Products />} />
    <Route path="products/quick" element={<ManageQuickProducts />} />
    <Route path="products/codes" element={<ManageProductCodes />} />
    <Route path="products/general" element={<GeneralProducts />} />
    <Route path="products/general/:category" element={<GeneralProducts />} />
    <Route path="products/:subPath" element={<ProductsSubFeatures />} />
    <Route path="expenses" element={<Expenses />} />
    <Route path="analysis" element={<Analysis />} />
    <Route path="suppliers" element={<Suppliers />} />
    <Route path="suppliers/payments" element={<SupplierPayments />} />
    <Route path="reports/:reportType" element={<ReportsSubFeatures />} />
    <Route path="employees" element={<Employees />} />
    <Route path="employees/salary" element={<SalaryManagement />} />
    <Route path="employees/damages" element={<Damages />} />
    <Route path="employees/change-password" element={<ChangePassword />} />
    <Route path="employees/access" element={<EmployeeAccess />} />
    <Route path="employees/duty-roaster" element={<DutyRoaster />} />
    <Route path="employees/attendance-report" element={<AttendanceReport />} />
    <Route path="employees/overtime" element={<OverTimeDetails />} />
    <Route path="bank" element={<BankManagement />} />
    <Route path="customers" element={<Customers />} />
  </>
);

function App() {
  // Re-checks the licence while signed in; on the desktop this is what locks
  // the till at expiry with no internet connection.
  useLicenseWatcher();

  // Amounts are formatted from the currency store while rendering. Subscribing
  // here re-renders the open screen the moment an admin switches currency,
  // without remounting it, so nothing on screen (such as the cart) is lost.
  useCurrencyStore((state) => state.code);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* Reachable with an expired licence: it is where the renewal happens. */}
      <Route path="/license" element={<LicensePage />} />

      {/* ── CASHIER ROUTES ── */}
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="invoices" element={<Navigate to="/receipts" replace />} />
        {sharedRoutes()}
      </Route>

      {/* ── ADMIN ROUTES ── */}
      <Route path="/admin" element={<AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="void-transactions" element={<VoidTransactions />} />
        {sharedRoutes()}
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
