/** The cashier workspace. Admins and managers are sent to /admin. */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppLayout from './AppLayout';
import { CASHIER_NAV } from './navigation';

const MainLayout = () => {
  const user = useAuthStore((state) => state.user);

  if (user && (user.role === 'admin' || user.role === 'manager')) {
    return <Navigate to="/admin" replace />;
  }

  return <AppLayout navItems={CASHIER_NAV} />;
};

export default MainLayout;
