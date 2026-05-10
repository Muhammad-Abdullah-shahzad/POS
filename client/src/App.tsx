import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './features/auth/Login';
import Dashboard from './features/dashboard/Dashboard';
import POS from './features/pos/POS';
import Products from './features/products/Products';
import Expenses from './features/expenses/Expenses';
import Invoices from './features/invoices/Invoices';
import { useAuthStore } from './store/authStore';

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="products" element={<Products />} />
        <Route path="expenses" element={<Expenses />} />
      </Route>
    </Routes>
  );
}

export default App;
