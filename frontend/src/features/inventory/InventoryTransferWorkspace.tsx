import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRightLeft, RefreshCw, X } from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import PaginationFooter from '../../components/common/PaginationFooter';
import SharedStateView from '../../components/common/SharedStateView';
import { sessionStore } from '../auth/session';
import { ApiError } from '../../services/api/apiTypes';
import { canReadBinContext } from '../../services/inventory/inventoryReadApi';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import { MAX_TRANSFER_QUANTITY, MAX_TRANSFER_REASON, TransferRecord, TransferRequest } from '../../services/inventory/transferApi';
import { transferQueries } from '../../services/inventory/transferQueries';
import { getTransferOperation, TransferOperationState } from '../../services/inventory/transferMutation';
import { changeTransferDraft, draftTransferRequest, emptyTransferDraft, supportedSourceRows, TransferContext, TransferDraft, validateTransferDraft, warehouseForBin } from '../../services/inventory/transferWorkflow';

const input = 'w-full border border-slate-300 bg-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';
const panel = 'bg-white border border-slate-200 rounded-2xl shadow-2xs p-4 sm:p-5 space-y-4 min-w-0';
export function transferErrorKey(error?: ApiError) {
  if (error?.code === 'FE_TRANSFER_REVIEW_REQUIRED') return 'transfer.errors.review';
  if (error?.code === 'FE_TRANSFER_STORAGE') return 'transfer.errors.storage';
  if ([400, 401, 403, 409].includes(error?.status ?? 0)) return `transfer.errors.${error!.status}`;
  return error?.status === undefined ? 'transfer.errors.network' : 'transfer.errors.server';
}
// These are the same handlers used by UI events and deterministic interaction tests.
// Report translated keys only; raw operation errors can contain internal details.
export function createTransferEventHandlers(operation: Pick<ReturnType<typeof getTransferOperation>, 'submit' | 'reconcile' | 'acknowledge'>,
  onError: (key: string | undefined) => void, onAcknowledged: () => void) {
  const owner = sessionStore.get();
  const report = (error: unknown) => { if (owner === sessionStore.get()) onError(transferErrorKey(error as ApiError)); };
  const clear = () => { if (owner === sessionStore.get()) onError(undefined); };
  return {
    async submit(request: TransferRequest) {
      clear();
      try { await operation.submit(request); } catch (error) { report(error); }
    },
    async reconcile() {
      clear();
      try { await operation.reconcile(); } catch (error) { report(error); }
    },
    acknowledge(reviewed: boolean) {
      clear();
      try { if (operation.acknowledge(reviewed) && owner === sessionStore.get()) onAcknowledged(); }
      catch (error) { report(error); }
    },
  };
}
export function TransferReadState<T>({ query, children }: { query: UseQueryResult<T, Error>; children: ReactNode }) {
  const { t } = useTranslation();
  if (query.isPaused) return <p role="status">{t('transfer.offline')}</p>;
  if (query.isPending) return <p role="status">{t('transfer.loading')}</p>;
  if (query.isError) return <div role="alert"><SharedStateView type="error" title={t(transferErrorKey(query.error as unknown as ApiError))}
    onRetry={query.isFetching ? undefined : () => void query.refetch()} /></div>;
  return <>{query.isFetching && <p role="status" className="text-xs text-amber-700">{t('transfer.refreshing')}</p>}{children}</>;
}
function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onClose={onClose} aria-labelledby="transfer-dialog-title"
    className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] rounded-2xl border border-slate-200 p-0 shadow-2xl backdrop:bg-slate-900/40">
    <div className="p-5 space-y-4 overflow-y-auto max-h-[85dvh]">
      <header className="flex items-center justify-between gap-3"><h2 id="transfer-dialog-title" className="font-bold">{title}</h2>
        <button type="button" autoFocus aria-label={t('transfer.close')} onClick={() => ref.current?.close()} className="p-2 rounded-lg hover:bg-slate-100 focus:ring-2 focus:ring-blue-500"><X className="w-4 h-4" /></button></header>
      {children}
    </div>
  </dialog>;
}
export function TransferRecordFields({ row }: { row: TransferRecord }) {
  const { t, i18n } = useTranslation();
  const fields = { reference: row.id, product: `${row.sku} — ${row.productName}`, source: row.sourceBinCode,
    destination: row.destinationBinCode, quantity: row.quantityTransferred.toLocaleString(i18n.language), reason: row.reasonCode,
    timestamp: new Date(row.transferredAt).toLocaleString(i18n.language), actor: row.transferredBy || '—' };
  return <dl className="grid sm:grid-cols-2 gap-3 text-sm">{Object.entries(fields).map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-slate-500">{t(`transfer.${key}`)}</dt><dd className="break-words mt-1">{value}</dd></div>)}</dl>;
}
function TransferDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation(); const detail = useQuery(transferQueries.detail(id));
  return <Dialog title={t('transfer.detail')} onClose={onClose}><TransferReadState query={detail}>
    {detail.isSuccess && <TransferRecordFields row={detail.data} />}
  </TransferReadState><p className="text-xs text-slate-500">{t('transfer.actorNote')}</p></Dialog>;
}
function ReconciliationBin({ id, label }: { id: string; label: string }) {
  const { t } = useTranslation(); const query = useQuery(inventoryQueries.contents(id));
  return <div className="min-w-0 rounded-xl border border-slate-200 p-3 space-y-2"><h3 className="font-semibold text-sm">{label}</h3>
    <p className="text-xs font-mono break-all">{id}</p><TransferReadState query={query}>{query.isSuccess && <>
      <p className="text-xs">{query.data.binCode} · {t('transfer.physical')}</p>
      {query.data.items.length ? <div className="overflow-x-auto"><table className="enterprise-table text-xs w-full text-left"><thead><tr>{['product', 'lot', 'physical', 'status', 'expiry'].map(key => <th key={key} scope="col">{t(`transfer.${key}`)}</th>)}</tr></thead>
        <tbody>{query.data.items.map((row, index) => <tr key={index}><td>{row.sku} — {row.productName}</td><td>{row.lotNumber || t('transfer.noLot')}</td><td>{row.quantity}</td><td>{row.status}</td><td>{row.expirationDate}</td></tr>)}</tbody></table></div>
        : <p className="text-xs">{t('transfer.emptySource')}</p>}
    </>}</TransferReadState></div>;
}
export function TransferOutcome({ state, onRefresh, onNew }: {
  state: TransferOperationState; onRefresh: () => void; onNew: (reviewed: boolean) => void;
}) {
  const { t } = useTranslation(); const [reviewed, setReviewed] = useState(false);
  useEffect(() => { setReviewed(false); }, [state.reconciled, state.request]);
  if (state.phase === 'ready') return null;
  const uncertain = state.phase === 'uncertain';
  return <section role={uncertain || state.phase === 'rejected' ? 'alert' : 'status'} aria-live="polite"
    className={`${panel} ${uncertain ? 'border-amber-400 bg-amber-50' : state.phase === 'succeeded' ? 'border-emerald-300' : ''}`}>
    <h2 className="font-bold">{t(`transfer.outcome.${state.phase}`)}</h2>
    {state.reference && <p className="break-all font-mono text-sm">{t('transfer.reference')}: {state.reference}</p>}
    {state.error && <p className="text-sm">{t(transferErrorKey(state.error))}{[400, 409].includes(state.error.status ?? 0) && <> — {state.error.message}</>}</p>}
    {state.request && <dl className="grid sm:grid-cols-2 gap-2 text-xs break-all">
      <div><dt>{t('transfer.source')}</dt><dd>{state.request.sourceBinId}</dd></div>
      <div><dt>{t('transfer.destination')}</dt><dd>{state.request.destinationBinId}</dd></div>
      <div><dt>{t('transfer.product')}</dt><dd>{state.request.productId} / {state.request.lotNumber || t('transfer.noLot')}</dd></div>
      <div><dt>{t('transfer.quantity')}</dt><dd>{state.request.transferQuantity}</dd></div>
      <div><dt>{t('transfer.reason')}</dt><dd>{state.request.reason}</dd></div>
    </dl>}
    {uncertain && <p className="text-sm">{t('transfer.uncertainty')}</p>}
    {state.storageWarning && <p role="alert" className="text-sm text-amber-800">{t('transfer.storageWarning')}</p>}
    {state.refreshError !== undefined && <p role="alert" className="text-sm text-amber-800">{t('transfer.refreshFailed')}</p>}
    {state.refreshing && <p role="status">{t('transfer.refreshing')}</p>}
    {!['pending', 'restoring'].includes(state.phase) && state.error?.code !== 'FE_TRANSFER_STORAGE' && <div className="space-y-3">
      <ActionButton variant="secondary" disabled={state.refreshing} icon={<RefreshCw className="w-4 h-4" />} onClick={onRefresh}>{t('transfer.reconcile')}</ActionButton>
      {uncertain && <label className="flex gap-2 items-start text-sm"><input type="checkbox" className="mt-1" checked={reviewed} disabled={!state.reconciled || state.refreshing}
        onChange={event => setReviewed(event.target.checked)} /><span>{t('transfer.reviewed')}</span></label>}
      <ActionButton disabled={state.refreshing || uncertain && (!state.reconciled || !reviewed)} onClick={() => onNew(reviewed)}>{t('transfer.newTransfer')}</ActionButton>
    </div>}
  </section>;
}

export default function InventoryTransferWorkspace() {
  const { t } = useTranslation();
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
  if (!canReadBinContext(session?.role)) return <div className="p-6" role="alert"><SharedStateView type="error" title={t('transfer.access')}
    subtitle={t('transfer.staffLimit')} /><Link className="text-blue-700 underline" to="/dashboard/inventory">{t('transfer.back')}</Link></div>;
  return <Workspace />;
}
function Workspace() {
  const { t, i18n } = useTranslation(); const client = useQueryClient();
  const operation = getTransferOperation(client);
  const state = useSyncExternalStore(operation.subscribe, operation.getState, operation.getState);
  const [draft, setDraft] = useState(emptyTransferDraft);
  const [eventError, setEventError] = useState<string>();
  const [review, setReview] = useState<{ request: TransferRequest; revision: string }>();
  const events = createTransferEventHandlers(operation, setEventError, () => { setDraft(emptyTransferDraft()); setReview(undefined); });
  const reviewButton = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1), [searchDraft, setSearchDraft] = useState(''), [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState(''), [selectedId, setSelectedId] = useState('');
  const [refreshing, setRefreshing] = useState(false), [refreshError, setRefreshError] = useState(false);
  const warehouses = useQuery(inventoryQueries.warehouses()), zones = useQuery(inventoryQueries.zones());
  const bins = useQuery(inventoryQueries.bins()), products = useQuery(inventoryQueries.products());
  const contents = useQuery({ ...inventoryQueries.contents(draft.sourceBinId), enabled: !!draft.sourceBinId });
  const history = useQuery(transferQueries.history({ pageNumber: page, pageSize: 10, productId: productFilter || undefined, searchKeyword: search || undefined }));
  const metadata = [warehouses, zones, bins, products];
  const context: TransferContext = { fresh: [...metadata, contents].every(query => query.isSuccess && !query.isFetching && !query.isStale),
    warehouses: warehouses.isSuccess ? warehouses.data : [], zones: zones.isSuccess ? zones.data : [], bins: bins.isSuccess ? bins.data : [],
    products: products.isSuccess ? products.data : [], contents: contents.isSuccess ? contents.data : undefined };
  const revision = [...metadata, contents].map(query => query.dataUpdatedAt).join(':');
  const visibleBins = context.bins.filter(bin => warehouseForBin(bin.id, context) === draft.warehouseId);
  const rows = contents.data?.binId === draft.sourceBinId ? supportedSourceRows(context) : [];
  const sourceProducts = context.products.filter(product => rows.some(row => row.productId === product.id));
  const lots = rows.filter(row => row.productId === draft.productId);
  const validation = validateTransferDraft(draft, context);
  const locked = state.phase !== 'ready';
  const change = <K extends keyof TransferDraft>(key: K, value: TransferDraft[K]) => { setDraft(previous => changeTransferDraft(previous, key, value)); setReview(undefined); };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setRefreshError(false);
    try {
      await Promise.all([...metadata, ...(draft.sourceBinId ? [contents] : []), history].map(query => query.refetch({ throwOnError: true })));
    } catch { setRefreshError(true); } finally { setRefreshing(false); }
  };
  const closeReview = () => { setReview(undefined); reviewButton.current?.focus(); };
  const reviewValid = review && validation === undefined && review.revision === revision && JSON.stringify(review.request) === JSON.stringify(draftTransferRequest(draft));
  return <section aria-label={t('transfer.title')} className="p-4 sm:p-6 space-y-5 min-w-0 bg-slate-50">
    <header className="flex flex-wrap justify-between items-start gap-3"><div><div className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-blue-600" /><h1 className="text-xl font-bold">{t('transfer.title')}</h1></div>
      <p className="text-sm text-slate-500 mt-1">{t('transfer.description')}</p><Link to="/dashboard/inventory" className="text-xs text-blue-700 underline">{t('transfer.back')}</Link></div>
      <ActionButton variant="secondary" disabled={refreshing} onClick={() => void refresh()} icon={<RefreshCw className="w-4 h-4" />}>{t('transfer.refresh')}</ActionButton></header>
    {refreshError && <p role="alert">{t('transfer.refreshFailed')}</p>}
    {eventError && <p role="alert">{t(eventError)}</p>}
    <TransferOutcome state={state} onRefresh={() => void events.reconcile()} onNew={events.acknowledge} />
    {state.request && state.phase !== 'pending' && <div className="grid lg:grid-cols-2 gap-4" aria-label={t('transfer.reconcile')}>
      <ReconciliationBin id={state.request.sourceBinId} label={t('transfer.source')} />
      <ReconciliationBin id={state.request.destinationBinId} label={t('transfer.destination')} />
    </div>}
    <section className={panel} aria-labelledby="transfer-create-title"><h2 id="transfer-create-title" className="font-bold">{t('transfer.create')}</h2>
      <p className="text-xs text-slate-600">{t('transfer.stockNote')}</p>
      {metadata.map((query, index) => <TransferReadState key={index} query={query as UseQueryResult<unknown, Error>}>{null}</TransferReadState>)}
      <form onSubmit={event => { event.preventDefault(); if (!locked && !validation) setReview({ request: draftTransferRequest(draft), revision }); }}>
        <fieldset disabled={locked} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
          <label className="text-xs font-medium space-y-1">{t('transfer.warehouse')}<select className={input} value={draft.warehouseId} disabled={!warehouses.isSuccess} onChange={event => change('warehouseId', event.target.value)}>
            <option value="">{t('transfer.choose')}</option>{context.warehouses.map(row => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</select></label>
          <label className="text-xs font-medium space-y-1">{t('transfer.source')}<select className={input} value={draft.sourceBinId} disabled={!draft.warehouseId || !bins.isSuccess || !zones.isSuccess} onChange={event => change('sourceBinId', event.target.value)}>
            <option value="">{t('transfer.choose')}</option>{visibleBins.map(row => <option key={row.id} value={row.id}>{row.code}</option>)}</select></label>
          <label className="text-xs font-medium space-y-1">{t('transfer.product')}<select className={input} value={draft.productId} disabled={!contents.isSuccess || !products.isSuccess || contents.isFetching} onChange={event => change('productId', event.target.value)}>
            <option value="">{t('transfer.choose')}</option>{sourceProducts.map(row => <option key={row.id} value={row.id}>{row.sku} — {row.name}</option>)}</select></label>
          <label className="text-xs font-medium space-y-1">{t('transfer.lot')}<select className={input} value={draft.lotNumber === null ? '' : JSON.stringify(draft.lotNumber)} disabled={!draft.productId || contents.isFetching} onChange={event => change('lotNumber', event.target.value ? JSON.parse(event.target.value) as string : null)}>
            <option value="">{t('transfer.choose')}</option>{lots.map(row => <option key={row.lotNumber} value={JSON.stringify(row.lotNumber)}>{row.lotNumber || t('transfer.noLot')} — {t('transfer.physical')}: {row.quantity}</option>)}</select></label>
          <label className="text-xs font-medium space-y-1">{t('transfer.destination')}<select className={input} value={draft.destinationBinId} disabled={draft.lotNumber === null} onChange={event => change('destinationBinId', event.target.value)}>
            <option value="">{t('transfer.choose')}</option>{visibleBins.filter(row => row.id !== draft.sourceBinId).map(row => <option key={row.id} value={row.id}>{row.code}</option>)}</select></label>
          <label className="text-xs font-medium space-y-1">{t('transfer.quantity')}<input className={input} inputMode="numeric" type="text" value={draft.quantity} maxLength={10} aria-describedby="transfer-quantity-help" onChange={event => change('quantity', event.target.value)} />
            <span id="transfer-quantity-help" className="block text-slate-500">{t('transfer.quantityHelp', { max: MAX_TRANSFER_QUANTITY })}</span></label>
          <label className="text-xs font-medium space-y-1 sm:col-span-2">{t('transfer.reason')}<textarea className={input} value={draft.reason} rows={2} maxLength={MAX_TRANSFER_REASON} onChange={event => change('reason', event.target.value)} /></label>
          <div className="self-end"><button ref={reviewButton} type="submit" disabled={!!validation || locked} className="rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40 focus:ring-2 focus:ring-blue-500">{t('transfer.review')}</button></div>
        </fieldset>
        {!locked && <p className="mt-3 text-xs text-slate-500" role="status">{validation ? t(`transfer.validation.${validation}`) : t('transfer.ready')}</p>}
      </form>
      {draft.sourceBinId && <TransferReadState query={contents}>{contents.isSuccess && <div className="overflow-x-auto"><h3 className="text-sm font-semibold mb-2">{t('transfer.contents')}</h3>
        {contents.data.items.length ? <table className="enterprise-table w-full text-sm text-left"><thead><tr>{['product', 'lot', 'physical', 'status', 'expiry'].map(key => <th key={key} scope="col">{t(`transfer.${key}`)}</th>)}</tr></thead>
          <tbody>{contents.data.items.map((row, index) => <tr key={index}><td>{row.sku} — {row.productName}</td><td>{row.lotNumber || t('transfer.noLot')}</td><td>{row.quantity.toLocaleString(i18n.language)}</td><td>{row.status}</td><td>{row.expirationDate}</td></tr>)}</tbody></table> : <p>{t('transfer.emptySource')}</p>}
        {rows.length === 0 && <p className="text-xs text-amber-800 mt-2">{t('transfer.unsupported')}</p>}
      </div>}</TransferReadState>}
    </section>
    <section className={panel} aria-labelledby="transfer-history-title"><h2 id="transfer-history-title" className="font-bold">{t('transfer.history')}</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setSearch(searchDraft.trim()); setPage(1); }}>
        <label className="text-xs font-medium">{t('transfer.search')}<input className={`${input} block mt-1`} value={searchDraft} maxLength={500} onChange={event => setSearchDraft(event.target.value)} /></label>
        <label className="text-xs font-medium">{t('transfer.product')}<select className={`${input} block mt-1 max-w-xs`} value={productFilter} disabled={!products.isSuccess} onChange={event => { setProductFilter(event.target.value); setPage(1); }}>
          <option value="">{t('transfer.allProducts')}</option>{context.products.map(row => <option key={row.id} value={row.id}>{row.sku} — {row.name}</option>)}</select></label>
        <ActionButton type="submit" variant="secondary">{t('transfer.apply')}</ActionButton>
        <ActionButton variant="ghost" onClick={() => { setSearchDraft(''); setSearch(''); setProductFilter(''); setPage(1); }}>{t('transfer.reset')}</ActionButton>
        <ActionButton variant="secondary" disabled={history.isFetching} onClick={() => void history.refetch()}>{t('transfer.refresh')}</ActionButton>
      </form>
      <p className="text-xs text-slate-500">{t('transfer.actorNote')}</p>
      <TransferReadState query={history}>{history.isSuccess && <>
        {history.data.items.length ? <div className="overflow-x-auto"><table className="enterprise-table w-full text-sm text-left"><thead><tr>{['reference', 'product', 'source', 'destination', 'quantity', 'reason', 'timestamp', 'actor'].map(key => <th key={key} scope="col">{t(`transfer.${key}`)}</th>)}</tr></thead>
          <tbody>{history.data.items.map(row => <tr key={row.id}><td><button className="font-mono text-xs text-blue-700 underline break-all focus:ring-2 focus:ring-blue-500" onClick={() => setSelectedId(row.id)} aria-label={`${t('transfer.detail')} ${row.id}`}>{row.id}</button></td><td>{row.sku}<br />{row.productName}</td>
            <td>{row.sourceBinCode}</td><td>{row.destinationBinCode}</td><td className="font-mono text-right">{row.quantityTransferred.toLocaleString(i18n.language)}</td><td>{row.reasonCode}</td><td className="whitespace-nowrap">{new Date(row.transferredAt).toLocaleString(i18n.language)}</td><td>{row.transferredBy || '—'}</td></tr>)}</tbody></table></div>
          : <SharedStateView type="empty" title={t('transfer.empty')} />}
        <PaginationFooter pageIndex={history.data.pageIndex} pageSize={10} totalCount={history.data.totalCount} totalPages={history.data.totalPages} disabled={history.isFetching} onPageChange={setPage} />
      </>}</TransferReadState>
    </section>
    {review && <Dialog title={t('transfer.review')} onClose={closeReview}>
      <dl className="grid sm:grid-cols-2 gap-3 text-sm">{Object.entries({ warehouse: context.warehouses.find(row => row.id === draft.warehouseId)?.name,
        source: context.bins.find(row => row.id === review.request.sourceBinId)?.code, destination: context.bins.find(row => row.id === review.request.destinationBinId)?.code,
        product: context.products.find(row => row.id === review.request.productId)?.sku, lot: review.request.lotNumber || t('transfer.noLot'), quantity: review.request.transferQuantity,
        reason: review.request.reason }).map(([key, value]) => <div key={key}><dt className="text-xs text-slate-500">{t(`transfer.${key}`)}</dt><dd className="break-words">{value}</dd></div>)}</dl>
      <p className="text-xs">{t('transfer.stockNote')}</p>{!reviewValid && <p role="alert">{t('transfer.validation.context')}</p>}
      <ActionButton disabled={!reviewValid || locked} onClick={() => {
        if (!reviewValid || locked) return;
        const request = review.request; closeReview(); void events.submit(request);
      }}>{t('transfer.confirm')}</ActionButton>
    </Dialog>}
    {selectedId && <TransferDetail id={selectedId} onClose={() => setSelectedId('')} />}
  </section>;
}
