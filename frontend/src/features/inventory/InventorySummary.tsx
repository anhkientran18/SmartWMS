import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import KPICard from '../../components/common/KPICard';
import SharedStateView from '../../components/common/SharedStateView';
import ActionButton from '../../components/common/ActionButton';
import { Boxes, Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InventorySummary() {
  const { t, i18n } = useTranslation();
  const query = useQuery(inventoryQueries.summary());
  return <section className="p-4 sm:p-6 space-y-5 font-sans animate-fadeIn" aria-labelledby="inventory-summary-title">
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
      <div className="flex items-center gap-3"><div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl"><Boxes className="w-5 h-5" /></div><div>
        <h1 id="inventory-summary-title" className="text-lg sm:text-xl font-bold tracking-tight">{t('f1.summary.title')}</h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">{t('f1.summary.description')}</p>
      </div></div>
      <ActionButton variant="secondary" disabled={query.isFetching} icon={<RefreshCw className={`w-3.5 h-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />} onClick={() => query.refetch()}>{t('f1.summary.retry')}</ActionButton>
    </header>
    {query.isPending && <div role="status"><SharedStateView type="loading" title={t('f1.summary.loading')} /></div>}
    {query.isError && <div role="alert"><SharedStateView type="error" title={t('f2.error')} subtitle={t('f2.retryHint')} onRetry={() => void query.refetch()} /></div>}
    {query.isSuccess && <div className="grid sm:grid-cols-3 gap-3.5">
      {(['totalProducts', 'totalQuantity', 'lowStockItems'] as const).map((key, index) =>
        <KPICard appearance="inventory" key={key} label={t(`f1.summary.${key}`)} value={query.data[key].toLocaleString(i18n.language)} icon={[Package, Boxes, AlertTriangle][index]} variant={index === 2 ? 'amber' : 'blue'} />)}
    </div>}
    {query.isSuccess && query.data.totalProducts === 0 && <p className="mt-4">{t('f1.summary.empty')}</p>}
    <Link className="inline-flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-blue-700 text-xs font-semibold shadow-2xs hover:bg-blue-50" to="/dashboard/inventory"><Boxes aria-hidden="true" className="w-4 h-4" />{t('f2.openStock')}</Link>
  </section>;
}
