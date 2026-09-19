/**
 * The detail view for whichever KPI card was opened. Only the open view is
 * rendered, so the dashboard does not build eight sets of charts up front.
 */
import { useState } from 'react';
import type { KpiKey } from '../DashboardKpiGrid';
import DetailModal from './DetailModal';
import type { DetailContext } from './types';
import { DETAIL_VIEWS } from './registry';

interface KpiDetailModalProps extends DetailContext {
  active: KpiKey | null;
  onClose: () => void;
}

export default function KpiDetailModal({ active, onClose, ...context }: KpiDetailModalProps) {
  // Keep the last view on screen while the modal animates closed.
  const [shown, setShown] = useState<KpiKey | null>(active);
  if (active !== null && active !== shown) setShown(active);

  const view = shown ? DETAIL_VIEWS[shown] : null;

  return (
    <DetailModal opened={active !== null} onClose={onClose} title={view?.title ?? ''} subtitle={view?.subtitle(context.kpis)}>
      {view && <view.Content {...context} />}
    </DetailModal>
  );
}
