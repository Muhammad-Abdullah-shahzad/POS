/** The admin workspace, for admins and managers only. */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppLayout from './AppLayout';
import { ADMIN_NAV } from './navigation';

const AdminLayout = () => {
  const user = useAuthStore((state) => state.user);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'manager') return <Navigate to="/" replace />;

  return <AppLayout navItems={ADMIN_NAV} />;
};

export default AdminLayout;
