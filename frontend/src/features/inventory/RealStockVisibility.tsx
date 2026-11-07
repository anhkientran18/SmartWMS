import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Package, AlertTriangle, RefreshCw, X, MapPin, History, Eye } from 'lucide-react';
import { sessionStore } from '../auth/session';
import { ApiError } from '../../services/api/apiTypes';
import { canReadBinContext } from '../../services/inventory/inventoryReadApi';
import { inventoryKey, inventoryQueries } from '../../services/inventory/inventoryQueries';

import KPICard from '../../components/common/KPICard';
import PaginationFooter from '../../components/common/PaginationFooter';
import SharedStateView from '../../components/common/SharedStateView';
import ActionButton from '../../components/common/ActionButton';
import { StatusBadge } from '../../components/common/StatusBadge';

// Hide previous successful data on a failed refetch; never render it as current stock.
export function InventoryReadState<T>({ query, children }: { query: UseQueryResult<T, Error>; children: ReactNode }) {
  const { t } = useTranslation();
  if (query.isPaused) return <div role="status"><SharedStateView type="offline" title={t('f0.states.offline')} subtitle={t('f2.offline')} /></div>;
  if (query.isPending) return <div role="status"><SharedStateView type="loading" title={t('f2.loading')} /></div>;
  if (query.isError) return <div role="alert"><SharedStateView type="error"
    title={t((query.error as unknown as ApiError).isForbidden ? 'f2.forbidden' : 'f2.error')}
    subtitle={t('f2.retryHint')} onRetry={query.isFetching ? undefined : () => void query.refetch()} /></div>;
  return <>{query.isFetching && <p role="status" className="text-xs text-amber-700 p-2">{t('f2.refreshing')}</p>}{children}</>;
}

const panel = 'stock-workspace bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-4 min-w-0';
const control = 'border border-slate-200 rounded-xl bg-white px-3 py-2 text-xs font-medium max-w-full disabled:opacity-40 disabled:cursor-not-allowed';
function LocationCode({ code }: { code: string }) {
  return code ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-blue-700"><MapPin aria-hidden="true" className="h-3 w-3" />{code}</span> : <>—</>;
}
function ReadTable({ labels, children }: { labels: string[]; children: ReactNode }) {
  const { t } = useTranslation();
  const numeric = [t('f2.physical'), t('f2.delta'), t('f2.occupancy'), t('f2.capacity'), t('f2.weight')];
  return <div className="overflow-x-auto"><table className="enterprise-table stock-table w-full text-left">
    <thead className="text-slate-500 bg-slate-50"><tr>{labels.map(label => <th key={label} className={`whitespace-nowrap ${numeric.includes(label) ? 'text-right' : ''}`}>{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100 [&_tr]:hover:bg-slate-50/80">{children}</tbody>
  </table></div>;
}

export default function RealStockVisibility({ embedded = false }: { embedded?: boolean }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
  const management = canReadBinContext(session?.role);
  const [pageIndex, setPageIndex] = useState(1);
  const [productId, setProductId] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [typeDraft, setTypeDraft] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [search, setSearch] = useState('');
  const [params] = useSearchParams();
  const [binId, setBinId] = useState(() => management ? params.get('binId') || '' : '');
  const [refreshing, setRefreshing] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (binId) drawer.current?.showModal(); }, [binId]);
  const summary = useQuery(inventoryQueries.summary());
  const alerts = useQuery(inventoryQueries.alerts());
  const history = useQuery(inventoryQueries.history({ pageIndex, pageSize: 10, productId: productId || undefined, transactionType: transactionType || undefined }));
  const products = useQuery(inventoryQueries.products());
  const warehouses = useQuery({ ...inventoryQueries.warehouses(), enabled: management });
  const zones = useQuery({ ...inventoryQueries.zones(), enabled: management });
  const bins = useQuery({ ...inventoryQueries.bins(), enabled: management });
  const detail = useQuery({ ...inventoryQueries.bin(binId), enabled: management && !!binId });
  const contents = useQuery({ ...inventoryQueries.contents(binId), enabled: management && !!binId });
  const number = (value: number) => value.toLocaleString(i18n.language);
  const missing = t('f2.unset');
  const refresh = async () => {
    setRefreshing(true);
    try { await client.refetchQueries({ queryKey: inventoryKey, type: 'active' }); }
    finally { setRefreshing(false); }
  };
  const visibleZones = zones.isSuccess ? zones.data.filter(z => !warehouseId || z.warehouseId === warehouseId) : [];
  const visibleBins = bins.isSuccess ? bins.data.filter(b => (!zoneId || b.zoneId === zoneId) &&
    (!warehouseId || (zones.isSuccess && zones.data.some(z => z.id === b.zoneId && z.warehouseId === warehouseId))) &&
    b.code.toLowerCase().includes(search.toLowerCase().trim())) : [];
  const selectedBin = bins.isSuccess ? bins.data.find(b => b.id === binId) : undefined;
  const selectedZone = zones.isSuccess ? zones.data.find(z => z.id === selectedBin?.zoneId) : undefined;
  const selectedWarehouse = warehouses.isSuccess ? warehouses.data.find(w => w.id === selectedZone?.warehouseId) : undefined;

  return <section className={`${embedded ? '' : 'p-4 sm:p-6'} space-y-5 min-w-0 font-sans animate-fadeIn bg-slate-50 pb-8`} aria-label={t('f2.title')}>
    {!embedded && <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
      <div className="flex items-center gap-3"><div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl"><Boxes className="w-5 h-5" strokeWidth={1.75} /></div>
        <div><h1 id="stock-title" className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{t('f2.title')}</h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">{t('f2.description')}</p></div></div>
      <ActionButton variant="secondary" disabled={refreshing} onClick={refresh} icon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}>{t('f2.refresh')}</ActionButton>
    </header>}

    <InventoryReadState query={summary}>
      {summary.isSuccess && <><div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <KPICard appearance="inventory" label={t('f2.totalProducts')} value={number(summary.data.totalProducts)} icon={Package} variant="blue" />
        <KPICard appearance="inventory" label={t('f2.totalQuantity')} value={number(summary.data.totalQuantity)} icon={Boxes} variant="blue" />
        <KPICard appearance="inventory" label={t('f2.lowStockItems')} value={number(summary.data.lowStockItems)} icon={AlertTriangle} variant="amber" />
      </div>{summary.data.totalProducts === 0 && <SharedStateView type="empty" title={t('f2.summaryEmpty')} subtitle={t('f2.description')} />}</>}
    </InventoryReadState>

    <section className={panel} aria-labelledby="alerts-title">
      <div className="stock-section-heading"><AlertTriangle aria-hidden="true" className="stock-section-icon text-amber-600 bg-amber-50 border-amber-200" /><div><h2 id="alerts-title" className="font-bold text-sm text-slate-900">{t('f2.alerts')}</h2><p className="text-xs text-slate-500 mt-1">{t('f2.alertDescription')}</p></div></div>
      <InventoryReadState query={alerts}>{alerts.isSuccess && (alerts.data.length ?
        <ReadTable labels={['SKU', t('f2.product'), t('f2.physical')]}>{alerts.data.map(row =>
          <tr key={row.productId}><td><span className="font-mono text-blue-700 font-medium">{row.sku || missing}</span></td><td className="font-medium">{row.productName || missing}</td><td className="text-right font-mono tabular-nums"><span className="text-amber-700 font-semibold">{number(row.currentStock)}</span></td></tr>)}</ReadTable> : <SharedStateView type="empty" title={t('f2.alertEmpty')} subtitle={t('f2.emptyHint')} />)}
      </InventoryReadState>
    </section>

    <section className={panel} aria-labelledby="history-title">
      <div className="stock-section-heading"><History aria-hidden="true" className="stock-section-icon text-blue-600 bg-blue-50 border-blue-200" /><div><h2 id="history-title" className="font-bold text-sm text-slate-900">{t('f2.history')}</h2><p className="text-xs text-slate-500 mt-1">{t('f2.historyDescription')}</p></div></div>
      <div className="stock-filter-band flex flex-wrap gap-3 items-end">
        <label className="text-xs font-medium text-slate-600 max-w-full">{t('f2.product')}<select className={`${control} block mt-1`} value={productId}
          disabled={!products.isSuccess} onChange={e => { setProductId(e.target.value); setPageIndex(1); }}>
          <option value="">{t('f2.allProducts')}</option>{products.isSuccess && products.data.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
        </select></label>
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); setTransactionType(typeDraft.trim()); setPageIndex(1); }}>
          <label className="text-xs font-medium text-slate-600 max-w-full">{t('f2.transactionType')}<input className={`${control} block mt-1 sm:w-64`} value={typeDraft} placeholder={t('f2.typePlaceholder')} onChange={e => setTypeDraft(e.target.value)} /></label>
          <button className={control} type="submit">{t('f2.apply')}</button>
        </form>
        <button className={control} onClick={() => { setProductId(''); setTypeDraft(''); setTransactionType(''); setPageIndex(1); }}>{t('f2.reset')}</button>
      </div>
      {products.isError && <InventoryReadState query={products}>{null}</InventoryReadState>}
      {products.isPending && <p role="status">{t('f2.metadataLoading')}</p>}
      <InventoryReadState query={history}>{history.isSuccess && <>
        {history.data.items.length ? <ReadTable labels={[t('f2.date'), t('f2.product'), t('f2.transactionType'), t('f2.delta'), t('f2.source'), t('f2.destination'), t('f2.reason'), t('f2.operator')]}>
          {history.data.items.map(row => <tr key={row.id}>
            <td className="whitespace-nowrap">{new Date(row.createdAt).toLocaleString(i18n.language)}</td><td><span className="block font-mono text-blue-700 text-[11px]">{products.isSuccess && products.data.find(product => product.id === row.productId)?.sku}</span><span className="block font-medium mt-0.5">{row.productName || row.productId}</span></td><td>{t(`ui.transactions.${row.transactionType}`, { defaultValue: row.transactionType || missing })}</td>
            <td className="text-right font-mono tabular-nums">{number(row.quantityChanged)}</td><td><LocationCode code={row.sourceBinCode} /></td><td><LocationCode code={row.destinationBinCode} /></td><td>{row.reasonCode || '—'}</td><td>{row.createdBy || '—'}</td>
          </tr>)}
        </ReadTable> : <SharedStateView type="empty" title={t('f2.historyEmpty')} subtitle={t('f2.emptyHint')} />}
        <PaginationFooter pageIndex={history.data.pageIndex} pageSize={10} totalCount={history.data.totalCount}
          totalPages={history.data.totalPages} disabled={history.isFetching} onPageChange={setPageIndex} />
      </>}</InventoryReadState>
    </section>

    <section className={panel} aria-labelledby="bins-title">
      <div className="stock-section-heading"><MapPin aria-hidden="true" className="stock-section-icon text-blue-600 bg-blue-50 border-blue-200" /><div><h2 id="bins-title" className="font-bold text-sm text-slate-900">{t('f2.binContext')}</h2><p className="text-xs text-slate-500 mt-1">{t('f2.binDescription')}</p></div></div>
      {!management ? <p>{t('f2.managementOnly')}</p> : <>
        <div className="stock-filter-band flex flex-wrap gap-3">
          <label className="text-xs font-medium text-slate-600 max-w-full">{t('f2.warehouse')}<select className={`${control} block mt-1`} disabled={!warehouses.isSuccess || !zones.isSuccess} value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setZoneId(''); }}>
            <option value="">{t('f2.allWarehouses')}</option>{warehouses.isSuccess && warehouses.data.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select></label>
          <label className="text-xs font-medium text-slate-600 max-w-full">{t('f2.zone')}<select className={`${control} block mt-1`} disabled={!zones.isSuccess} value={zoneId} onChange={e => setZoneId(e.target.value)}>
            <option value="">{t('f2.allZones')}</option>{visibleZones.map(z => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
          </select></label>
          <label className="text-xs font-medium text-slate-600 max-w-full">{t('f2.binSearch')}<input className={`${control} block mt-1`} value={search} onChange={e => setSearch(e.target.value)} /></label>
        </div>
        {[warehouses, zones].map((query, index) => <div key={index}><InventoryReadState query={query}>{null}</InventoryReadState></div>)}
        <InventoryReadState query={bins}>{bins.isSuccess && (visibleBins.length ?
          <ReadTable labels={[t('f2.bin'), t('f2.purpose'), t('f2.occupancy'), t('f2.capacity'), t('f2.details')]}>
            {visibleBins.map(bin => <tr key={bin.id}><td><LocationCode code={bin.code || bin.id} /></td><td>{t(bin.purpose === 0 ? 'f2.storage' : 'f2.staging')}</td><td className="text-right font-mono tabular-nums">{number(bin.currentOccupancy)}</td><td className="text-right font-mono tabular-nums">{number(bin.maxCapacity)}</td>
              <td><button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-200 hover:text-blue-700" onClick={() => setBinId(bin.id)}><Eye aria-hidden="true" className="w-3.5 h-3.5" />{t('f2.view')} <span className="sr-only">{bin.code}</span></button></td></tr>)}
          </ReadTable> : <SharedStateView type="empty" title={t('f2.binEmpty')} subtitle={t('f2.emptyHint')} />)}
        </InventoryReadState>
      </>}
    </section>

    {management && binId && <dialog ref={drawer} aria-labelledby="bin-detail-title" onCancel={e => { e.preventDefault(); setBinId(''); }}
      className="m-0 ml-auto w-full max-w-4xl h-dvh max-h-dvh border-0 p-0 bg-white shadow-2xl backdrop:bg-slate-900/50">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center gap-4 px-5 py-4 bg-slate-900 text-white shrink-0"><h2 id="bin-detail-title" className="text-base font-bold">{t('f2.binDetails')}</h2><button autoFocus className="p-2 rounded-lg hover:bg-slate-800" aria-label={t('f2.close')} onClick={() => setBinId('')}><X className="w-5 h-5" /></button></div>
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
        <p className="text-xs text-slate-500">{selectedWarehouse ? `${selectedWarehouse.code} — ${selectedWarehouse.name}` : t('f2.contextUnavailable')} / {selectedZone ? `${selectedZone.code} — ${selectedZone.name}` : t('f2.contextUnavailable')}</p>
        <InventoryReadState query={detail}>{detail.isSuccess && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"><LocationCode code={detail.data.code || detail.data.id} /><div className="grid grid-cols-2 gap-4 text-xs"><div><p className="text-slate-500">{t('f2.occupancy')}</p><p className="font-mono font-semibold text-lg mt-1">{number(detail.data.currentOccupancy)}</p></div><div><p className="text-slate-500">{t('f2.capacity')}</p><p className="font-mono font-semibold text-lg mt-1">{number(detail.data.maxCapacity)}</p></div></div></div>}</InventoryReadState>
        <p className="text-xs text-slate-500">{t('f2.contentsDescription')}</p>
        <InventoryReadState query={contents}>{contents.isSuccess && <>
          <div className="rounded-xl border border-slate-200 p-4 space-y-2"><p className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{t('f2.occupancy')}: <strong className="font-mono text-slate-900">{number(contents.data.currentOccupancy)} / {number(contents.data.maxCapacity)}</strong></span><span className="font-mono text-slate-900">{number(contents.data.utilizationPercentage)}%</span></p>{contents.data.maxCapacity > 0 && <progress aria-label={t('f2.occupancy')} className={`stock-capacity-bar ${contents.data.utilizationPercentage >= 100 ? 'text-rose-500' : contents.data.utilizationPercentage >= 80 ? 'text-amber-500' : 'text-emerald-500'}`} max={100} value={Math.min(100, contents.data.utilizationPercentage)} />}</div>
          {contents.data.items.length ? <ReadTable labels={['SKU', t('f2.product'), t('f2.physical'), t('f2.status'), t('f2.lot'), t('f2.expiration'), t('f2.barcode'), t('f2.weight')]}>
            {contents.data.items.map((row, index) => {
              // Index is only a rendering key: the contract has no inventory-row ID.
              const product = products.isSuccess ? products.data.find(p => p.id === row.productId) : undefined;
              const knownStatus = ['Available', 'Reserved', 'QCHold', 'Damaged', 'Expired'].includes(row.status);
              return <tr key={index}><td className="font-mono">{row.sku || row.productId}</td><td>{row.productName || missing}</td><td className="text-right font-mono tabular-nums">{number(row.quantity)} {product?.unit}</td>
                <td><StatusBadge showDot variant={row.status === 'Available' ? 'green' : row.status === 'Reserved' ? 'blue' : row.status === 'QCHold' ? 'amber' : row.status === 'Damaged' ? 'red' : 'gray'} label={knownStatus ? t(`f2.statuses.${row.status}`) : row.status || missing} /></td><td>{row.lotNumber || '—'}</td>
                <td>{row.expirationDate === 'Không có hạn dùng' || !row.expirationDate ? t('f2.noExpiry') : row.expirationDate}</td>
                <td>{product ? product.barcode || missing : t('f2.metadataUnavailable')}</td><td className="text-right font-mono tabular-nums">{product ? product.weight === 0 ? missing : number(product.weight) : t('f2.metadataUnavailable')}</td></tr>;
            })}
          </ReadTable> : <SharedStateView type="empty" title={t('f2.contentsEmpty')} subtitle={t('f2.emptyHint')} />}
        </>}</InventoryReadState>
        {products.isError && <InventoryReadState query={products}>{null}</InventoryReadState>}
        </div>
      </div>
    </dialog>}
  </section>;
}
