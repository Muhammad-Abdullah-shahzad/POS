import { useCallback, useEffect, useState } from 'react';
import { Button, Center, Loader, Stack, Text } from '@mantine/core';
import api from '../../services/api';
import { fetchDashboardKpis } from '../../services/dashboardService';
import type { DashboardKpis } from '../../services/dashboardService';
import DashboardKpiGrid from './DashboardKpiGrid';
import type { KpiKey } from './DashboardKpiGrid';
import KpiDetailModal from './details/KpiDetailModal';
import type { DashboardCustomer, DashboardExpense, DashboardOrder } from './details/types';
import kpiClasses from './KpiCard.module.css';

/** Rows for the "latest" lists in the detail views. A failed list shows as empty. */
async function fetchList<T>(path: string): Promise<T[]> {
  try {
    const { data } = await api.get(path);
    return Array.isArray(data?.data) ? (data.data as T[]) : [];
  } catch (error) {
    console.error(`Dashboard could not load ${path}`, error);
    return [];
  }
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [kpiError, setKpiError] = useState(false);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [expenses, setExpenses] = useState<DashboardExpense[]>([]);
  const [customers, setCustomers] = useState<DashboardCustomer[]>([]);
  const [activeModal, setActiveModal] = useState<KpiKey | null>(null);

  const loadKpis = useCallback(async () => {
    try {
      setKpiError(false);
      setKpis(await fetchDashboardKpis());
    } catch (error) {
      console.error('Dashboard KPIs failed to load', error);
      setKpiError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [latestOrders, latestExpenses, allCustomers] = await Promise.all([
        fetchList<DashboardOrder>('/orders'),
        fetchList<DashboardExpense>('/expenses'),
        fetchList<DashboardCustomer>('/customers'),
        loadKpis(),
      ]);
      if (cancelled) return;

      setOrders(latestOrders);
      setExpenses(latestExpenses);
      setCustomers(allCustomers);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [loadKpis]);

  if (loading) {
    return (
      <Center h={300}>
        <Stack align="center" gap="xs">
          <Loader size="lg" color="#2350c9" />
          <Text c="dimmed" size="sm">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      {kpis && <DashboardKpiGrid kpis={kpis} onOpen={setActiveModal} />}

      {kpiError && (
        <div className={kpiClasses.error}>
          This month's figures could not be loaded.
          <Button variant="default" size="compact-sm" radius={0} onClick={loadKpis}>
            Try again
          </Button>
        </div>
      )}

      {kpis && (
        <KpiDetailModal
          active={activeModal}
          onClose={() => setActiveModal(null)}
          kpis={kpis}
          orders={orders}
          expenses={expenses}
          customers={customers}
        />
      )}
    </Stack>
  );
};

export default AdminDashboard;
