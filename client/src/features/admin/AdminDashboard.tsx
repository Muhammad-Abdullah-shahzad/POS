import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Center, Group, Loader, SegmentedControl, Stack, Text } from '@mantine/core';
import api from '../../services/api';
import { fetchDashboardKpis } from '../../services/dashboardService';
import type { DashboardKpis, KpiPeriod } from '../../services/dashboardService';
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

/** The dashboard remembers whether it last showed today or this month. */
const PERIOD_KEY = 'pos.dashboard.period';

function savedPeriod(): KpiPeriod {
  try {
    return localStorage.getItem(PERIOD_KEY) === 'day' ? 'day' : 'month';
  } catch {
    return 'month';
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
  const [period, setPeriod] = useState<KpiPeriod>(savedPeriod);
  const [switching, setSwitching] = useState(false);
  /** Only the latest request may set the figures, so a slow reply for the other period is ignored. */
  const latestRequest = useRef(0);

  const loadKpis = useCallback(async (which: KpiPeriod) => {
    const request = ++latestRequest.current;
    try {
      setKpiError(false);
      const loaded = await fetchDashboardKpis(which);
      if (request === latestRequest.current) setKpis(loaded);
    } catch (error) {
      console.error('Dashboard KPIs failed to load', error);
      if (request === latestRequest.current) setKpiError(true);
    }
  }, []);

  const changePeriod = async (value: string) => {
    const next: KpiPeriod = value === 'day' ? 'day' : 'month';
    setPeriod(next);
    try {
      localStorage.setItem(PERIOD_KEY, next);
    } catch {
      /* Remembering the choice is a convenience only. */
    }
    setSwitching(true);
    await loadKpis(next);
    setSwitching(false);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [latestOrders, latestExpenses, allCustomers] = await Promise.all([
        fetchList<DashboardOrder>('/orders'),
        fetchList<DashboardExpense>('/expenses'),
        fetchList<DashboardCustomer>('/customers'),
        loadKpis(savedPeriod()),
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
      <Group justify="flex-end" gap="sm">
        {switching && <Loader size="xs" />}
        <SegmentedControl
          value={period}
          onChange={changePeriod}
          data={[
            { value: 'day', label: 'Daily' },
            { value: 'month', label: 'Monthly' },
          ]}
          aria-label="Show figures for today or this month"
        />
      </Group>

      {kpis && <DashboardKpiGrid kpis={kpis} onOpen={setActiveModal} />}

      {kpiError && (
        <div className={kpiClasses.error}>
          {period === 'day' ? "Today's" : "This month's"} figures could not be loaded.
          <Button variant="default" size="compact-sm" radius={0} onClick={() => loadKpis(period)}>
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
