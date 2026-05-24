import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Login from './features/auth/Login';
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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'manager') return <Navigate to="/" replace />;
  return <>{children}</>;
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
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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
