import { ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Barcode, Eye, Layers, Package, QrCode, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import PaginationFooter from '../../components/common/PaginationFooter';
import SharedStateView from '../../components/common/SharedStateView';
import { sessionStore } from '../auth/session';
import { ApiError } from '../../services/api/apiTypes';
import { canReadProducts, ProductDetail, ProductRead, BarcodeResolution } from '../../services/inventory/inventoryReadApi';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import { createBarcodeLookup } from '../../services/inventory/productLookup';
import SemanticProductSearchModal from './SemanticProductSearchModal';

const inputClass = 'w-full min-w-0 border border-slate-200 bg-white rounded-xl py-2.5 px-3 text-xs';
export function productErrorKey(error: ApiError | undefined, barcode = false) {
  if (!error?.status) return 'f8.errors.network';
  if (error.status === 400) return barcode ? 'f8.errors.barcode' : 'f8.errors.invalid';
  return `f8.errors.${[401, 403, 404].includes(error.status) ? error.status : 'server'}`;
}
function Failure({ error, barcode, retry }: { error?: ApiError; barcode?: boolean; retry?: () => void }) {
  const { t } = useTranslation();
  return <div role="alert"><SharedStateView type={error?.status === 403 ? '403' : error?.status === undefined ? 'offline' : 'error'} title={t(productErrorKey(error, barcode))} subtitle={t('f8.errors.hint')} onRetry={retry} /></div>;
}
function Field({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 text-xs text-slate-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${mono ? 'font-mono' : ''}`}>{children || '—'}</dd></div>;
}
export function ResolutionDetails({ result, onOpen }: { result: BarcodeResolution; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  return <div className="space-y-3" role="status">
    <p className="text-xs font-semibold text-blue-800">{t('f8.resolved')}</p>
    <dl className="grid gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
      <Field label={t('f8.sku')} mono>{result.sku}</Field><Field label={t('f8.name')}>{result.productName}</Field>
      {result.lotNumber && <Field label={t('f8.labelLot')} mono>{result.lotNumber}</Field>}
      {result.expirationDate && <Field label={t('f8.labelExpiry')} mono>{result.expirationDate.slice(0, 10)}</Field>}
    </dl>
    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">{t('f8.metadataOnly')}</p>
    <ActionButton variant="secondary" size="sm" icon={<Eye className="w-3.5 h-3.5" />} onClick={() => onOpen(result.productId)}>{t('f8.openDetail')}</ActionButton>
  </div>;
}
function BarcodeLookup({ onOpen, onClose }: { onOpen: (id: string) => void; onClose: () => void }) {
  const { t } = useTranslation(); const [raw, setRaw] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  // Effect ownership supports StrictMode setup/cleanup without reusing a disposed operation.
  const [operation, setOperation] = useState<ReturnType<typeof createBarcodeLookup>>();
  useEffect(() => { const next = createBarcodeLookup(); setOperation(next); return () => next.dispose(); }, []);
  return <dialog ref={dialog} onClose={onClose} aria-labelledby="product-lookup-title" className="m-auto p-0 w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] rounded-2xl border border-slate-200 shadow-2xl backdrop:bg-slate-900/40 overflow-hidden">
    <div className="flex flex-col max-h-[90dvh]"><header className="p-5 border-b border-slate-200 flex gap-3 items-start shrink-0 bg-white"><span className="p-2.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-600"><Barcode className="w-5 h-5" /></span><div className="min-w-0 flex-1"><h2 id="product-lookup-title" className="font-bold text-base">{t('f8.lookup')}</h2><p className="text-xs text-slate-500 mt-1">{t('f8.lookupHint')}</p></div><button type="button" aria-label={t('f8.close')} onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button></header>
      <div className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-4">{operation && <LookupForm operation={operation} raw={raw} setRaw={setRaw} onOpen={onOpen} />}</div>
    </div>
  </dialog>;
}
function LookupForm({ operation, raw, setRaw, onOpen }: { operation: ReturnType<typeof createBarcodeLookup>; raw: string; setRaw: (v: string) => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation(); const state = useSyncExternalStore(operation.subscribe, operation.getState, operation.getState);
  return <><form className="space-y-3" onSubmit={e => { e.preventDefault(); void operation.submit(raw); }}>
    <label className="block text-xs font-semibold text-slate-600" htmlFor="product-barcode">{t('f8.scanInput')}</label>
    <textarea id="product-barcode" className={`${inputClass} font-mono resize-y`} rows={3} maxLength={163} required disabled={state.pending} value={raw} onChange={e => { setRaw(e.target.value); operation.reset(); }} aria-describedby="product-barcode-formats" />
    <p id="product-barcode-formats" className="text-xs text-slate-500 leading-relaxed break-words">{t('f8.formats')}</p>
    <ActionButton type="submit" disabled={state.pending || !raw.trim()} icon={state.pending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}>{t(state.pending ? 'f8.resolving' : 'f8.resolve')}</ActionButton>
  </form>{state.error && <Failure error={state.error} barcode />}{state.result && <ResolutionDetails result={state.result} onOpen={onOpen} />}</>;
}
export function ProductFields({ product }: { product: ProductDetail }) {
  const { t, i18n } = useTranslation();
  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5">
    <Field label={t('f8.sku')} mono>{product.sku}</Field><Field label={t('f8.barcode')} mono>{product.barcode}</Field>
    <Field label={t('f8.name')}>{product.name}</Field><Field label={t('f8.unit')}>{product.unit}</Field>
    <Field label={t('f8.weight')} mono>{new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 8 }).format(product.weight)}</Field>
    <Field label={t('f8.tracking')}>{t(`f8.mode${product.trackingMode}`)}</Field>
    <div className="sm:col-span-2"><Field label={t('f8.description')}>{product.description}</Field></div>
  </dl>;
}
export function ProductLabelPreview({ product, children }: { product: ProductDetail; children: ReactNode }) {
  const { t } = useTranslation();
  return <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-4 sm:p-6"><div className="mx-auto max-w-sm rounded border-2 border-slate-900 bg-white p-4 shadow-md">
    <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-3 text-xs font-semibold"><span className="h-2 w-2 bg-blue-600 rounded-full" />SmartWMS <span className="ml-auto text-[10px] text-slate-500">{t('f8.productLabel')}</span></div>
    <dl className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3 grid grid-cols-2 gap-3"><div className="col-span-2"><Field label={t('f8.sku')} mono>{product.sku}</Field></div><div className="col-span-2"><Field label={t('f8.barcode')} mono>{product.barcode}</Field></div><div className="col-span-2"><Field label={t('f8.name')}><strong className="font-semibold">{product.name}</strong></Field></div><Field label={t('f8.unit')}>{product.unit}</Field></dl>
    <div className="min-h-48 flex items-center justify-center rounded-lg border border-slate-200 p-3">{children}</div>
  </div></div>;
}
function QrPanel({ product, initiallyRequested }: { product: ProductDetail; initiallyRequested: boolean }) {
  const { t } = useTranslation(); const [requested, setRequested] = useState(initiallyRequested);
  const qr = useQuery({ ...inventoryQueries.productQr(product.sku), enabled: requested });
  return <section className="border-t border-slate-200 pt-5 space-y-4" aria-labelledby="product-preview-title">
    <div className="flex flex-wrap justify-between items-center gap-3"><h3 id="product-preview-title" className="font-semibold text-sm flex items-center gap-2"><Eye className="w-4 h-4 text-blue-600" />{t('f8.qr')}</h3><ActionButton variant="secondary" size="sm" disabled={qr.isFetching} icon={<QrCode className="w-3.5 h-3.5" />} onClick={() => { if (requested) void qr.refetch(); else setRequested(true); }}>{t(requested ? 'f8.refreshQr' : 'f8.showQr')}</ActionButton></div>
    <ProductLabelPreview product={product}>{!requested ? <p className="text-xs text-slate-500 text-center max-w-56">{t('f8.qrHint')}</p> : qr.isFetching ? <p role="status" className="text-xs text-slate-500">{t('f8.loading')}</p> : qr.isError ? <Failure error={qr.error as unknown as ApiError} /> : qr.data && <img src={qr.data} alt={t('f8.qrAlt', { sku: product.sku })} className="w-44 h-44 max-w-full object-contain" />}</ProductLabelPreview>
  </section>;
}
function ProductDialog({ id, showQr, onClose }: { id: string; showQr: boolean; onClose: () => void }) {
  const { t } = useTranslation(); const dialog = useRef<HTMLDialogElement>(null);
  const detail = useQuery(inventoryQueries.product(id));
  // Removal closes the native dialog. A StrictMode cleanup close would queue
  // onClose after the second setup and dismiss the newly opened detail.
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onClose={onClose} aria-labelledby="product-detail-title" className="m-auto p-0 w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] rounded-2xl border-0 shadow-2xl backdrop:bg-slate-900/50 overflow-hidden">
    <div className="flex flex-col max-h-[90dvh]"><header className="bg-white px-5 py-4 flex gap-3 items-center shrink-0 border-b border-slate-200"><span className="rounded-xl border border-blue-100 bg-blue-50 p-2.5 text-blue-600"><Package className="w-5 h-5" /></span><h2 id="product-detail-title" className="text-base font-bold flex-1">{t('f8.detail')}</h2><button type="button" onClick={onClose} aria-label={t('f8.close')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button></header>
      <div className="p-5 sm:p-6 overflow-y-auto min-h-0 space-y-5">
        {detail.isPending ? <div role="status"><SharedStateView type="loading" title={t('f8.loading')} /></div> : detail.isError ? <Failure error={detail.error as unknown as ApiError} retry={() => void detail.refetch()} /> : <>
          <div className="flex justify-between gap-3 items-start"><div className="min-w-0"><p className="font-mono text-xs text-blue-700 break-all">{detail.data.sku}</p><h3 className="text-base font-bold text-slate-900 mt-1 break-words">{detail.data.name}</h3></div><ActionButton variant="secondary" size="sm" disabled={detail.isFetching} aria-label={t('f8.refreshDetail')} icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => void detail.refetch()} /></div>
          {detail.isFetching && <p role="status" className="text-xs text-amber-800">{t('f8.refreshing')}</p>}
          <ProductFields product={detail.data} /><p className="text-xs text-slate-500">{t('f8.trackingHint')}</p><QrPanel key={detail.data.sku} product={detail.data} initiallyRequested={showQr} />
        </>}
      </div>
    </div>
  </dialog>;
}
export default function ProductWorkspace() {
  const { t } = useTranslation(); const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
  if (!canReadProducts(session?.role)) return <div className="p-6"><SharedStateView type="403" title={t('f8.errors.403')} /></div>;
  return <Catalog key={session.token} />;
}
export function productPageMetrics(items: ProductRead[]) {
  const withBarcode = items.filter(product => product.barcode.trim()).length;
  return { withBarcode, missingBarcode: items.length - withBarcode,
    distinctUnits: new Set(items.map(product => product.unit.trim()).filter(Boolean)).size,
    coverage: items.length ? Math.round(withBarcode / items.length * 100) : null };
}
export function ProductMetrics({ total, items, busy }: { total?: number; items?: ProductRead[]; busy?: boolean }) {
  const { t, i18n } = useTranslation(); const metrics = items && productPageMetrics(items);
  const number = (value: number | undefined) => value === undefined ? '—' : new Intl.NumberFormat(i18n.language).format(value);
  const cards = [
    { label: t('f8.totalProducts'), value: number(total), note: t('f8.catalogWide'), icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-100' },
    { label: t('f8.barcodeCoverage'), value: number(metrics?.withBarcode), note: metrics?.coverage == null ? t('f8.currentPage') : t('f8.coverageNote', { percent: metrics.coverage }), icon: Barcode, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    { label: t('f8.distinctUnits'), value: number(metrics?.distinctUnits), note: t('f8.currentPage'), icon: Layers, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    { label: t('f8.missingBarcode'), value: number(metrics?.missingBarcode), note: t('f8.currentPage'), icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-100' },
  ];
  return <section aria-label={t('f8.metrics')} aria-busy={busy} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{cards.map((card, index) => <div key={card.label} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs min-h-32">
    <span className={'absolute right-5 top-5 border rounded-xl p-2.5 ' + card.color}><card.icon className="w-5 h-5" strokeWidth={1.75} /></span>
    <p className="text-xs text-slate-500 pr-14 leading-5">{card.label}</p><p className={'text-2xl font-bold tracking-tight mt-1 pr-12 ' + (index === 3 ? 'text-rose-600' : 'text-slate-900')}>{card.value}</p><p className="text-xs text-slate-500 mt-2 leading-5">{card.note}</p>
  </div>)}</section>;
}
export function ProductCatalogTable({ items, onOpen }: { items: ProductRead[]; onOpen: (id: string, qr?: boolean) => void }) {
  const { t, i18n } = useTranslation();
  return <div className="overflow-x-auto"><table className="enterprise-table w-full min-w-[880px] text-left"><colgroup><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '42%' }} /><col style={{ width: '8%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /></colgroup>
    <thead className="bg-slate-50"><tr>{['sku', 'barcode', 'identity', 'unit', 'weight', 'actions'].map(field => <th className={field === 'weight' || field === 'actions' ? 'text-right' : ''} key={field}>{t('f8.' + field)}</th>)}</tr></thead>
    <tbody>{items.map(product => <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50/80">
      <td><span className="inline-block max-w-full rounded border border-blue-100 bg-slate-50 px-2.5 py-1 font-mono text-blue-600 break-words [overflow-wrap:anywhere]">{product.sku}</span></td>
      <td className="font-mono"><span className="break-all">{product.barcode || '—'}</span></td>
      <td><strong className="block text-[13px] font-semibold text-slate-900 break-words">{product.name}</strong><span className="block mt-1 text-xs text-slate-500 break-words whitespace-pre-wrap">{product.description || '—'}</span></td>
      <td><span className="inline-block rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs break-words">{product.unit || '—'}</span></td>
      <td className="text-right font-mono tabular-nums">{new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 8 }).format(product.weight)}</td>
      <td><div className="flex justify-end gap-1"><ActionButton variant="ghost" size="sm" isIconOnly icon={<Eye className="w-4 h-4" />} tooltip={t('f8.detailFor', { sku: product.sku })} onClick={() => onOpen(product.id)} /><ActionButton variant="ghost" size="sm" isIconOnly icon={<QrCode className="w-4 h-4" />} tooltip={t('f8.qrFor', { sku: product.sku })} onClick={() => onOpen(product.id, true)} /></div></td>
    </tr>)}</tbody></table></div>;
}
function Catalog() {
  const { t } = useTranslation(); const [draft, setDraft] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ id: string; qr: boolean }>(); const [lookupOpen, setLookupOpen] = useState(false);
  const [semanticOpen, setSemanticOpen] = useState(false);
  const catalog = useQuery(inventoryQueries.productsPage(page, search));
  // The unfiltered total reuses the same fixed-20 page key. Initial observers
  // deduplicate; filtered result totals are never presented as global KPIs.
  const total = useQuery(inventoryQueries.productsPage(1, ''));
  const openProduct = (id: string, qr = false) => setSelected({ id, qr });
  const refresh = () => { void catalog.refetch(); if (page !== 1 || search) void total.refetch(); };
  return <div className="p-4 sm:p-6 space-y-6 min-w-0">
    <header><h1 className="text-xl font-bold text-slate-900">{t('f8.title')}</h1><p className="text-xs text-slate-500 mt-1.5">{t('f8.subtitle')}</p></header>
    <ProductMetrics total={total.isSuccess ? total.data.totalCount : undefined} items={catalog.isSuccess ? catalog.data.items : undefined} busy={catalog.isFetching || total.isFetching} />
    <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-wrap items-center gap-2.5" aria-label={t('f8.toolbar')} onSubmit={e => { e.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
      <label className="flex-1 basis-64 min-w-0 relative"><span className="sr-only">{t('f8.search')}</span><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" /><input className={inputClass + ' pl-9 bg-slate-50'} placeholder={t('f8.searchPlaceholder')} value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <ActionButton type="submit" variant="secondary">{t('f8.search')}</ActionButton>
      {(draft || search) && <ActionButton variant="ghost" onClick={() => { setDraft(''); setSearch(''); setPage(1); }}>{t('f8.reset')}</ActionButton>}
      <ActionButton variant="secondary" disabled={catalog.isFetching || total.isFetching} icon={<RefreshCw className="w-4 h-4" />} onClick={refresh}>{t('f8.refresh')}</ActionButton>
      <ActionButton variant="secondary" icon={<Barcode className="w-4 h-4" />} onClick={() => setLookupOpen(true)}>{t('f8.analyzeBarcode')}</ActionButton>
      <ActionButton variant="secondary" icon={<Sparkles className="w-4 h-4 text-blue-600" />} onClick={() => setSemanticOpen(true)}>{t('f8.semanticSearch.button')}</ActionButton>
    </form>
    <section className="bg-white border border-slate-200 rounded-2xl shadow-2xs min-w-0 overflow-hidden" aria-labelledby="product-catalog-title">
      <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2"><h2 id="product-catalog-title" className="flex gap-2 items-center text-sm font-semibold"><Package className="w-4 h-4 text-blue-600" />{t('f8.catalogList')}</h2>{catalog.isSuccess && <span className="text-xs text-slate-500 font-mono">{t('f8.resultCount', { count: catalog.data.totalCount })}</span>}</div>
      {catalog.isFetching && !catalog.isPending && <p role="status" className="px-5 py-2 text-xs text-amber-800">{t('f8.refreshing')}</p>}
      {catalog.isPending ? <div role="status"><SharedStateView type={catalog.isPaused ? 'offline' : 'loading'} title={t(catalog.isPaused ? 'f8.errors.network' : 'f8.loading')} /></div> : catalog.isError ? <Failure error={catalog.error as unknown as ApiError} retry={refresh} /> : <>
        {catalog.data.items.length ? <ProductCatalogTable items={catalog.data.items} onOpen={openProduct} /> : <SharedStateView type={search ? 'search-empty' : 'empty'} title={t(search ? 'f8.noMatches' : 'f8.empty')} subtitle={t('f8.emptyHint')} />}
        <PaginationFooter pageIndex={catalog.data.pageIndex} pageSize={catalog.data.pageSize} totalCount={catalog.data.totalCount} totalPages={catalog.data.totalPages} disabled={catalog.isFetching} onPageChange={setPage} />
      </>}
    </section>
    {lookupOpen && <BarcodeLookup onClose={() => setLookupOpen(false)} onOpen={id => { setLookupOpen(false); openProduct(id); }} />}
    {semanticOpen && <SemanticProductSearchModal onClose={() => setSemanticOpen(false)} onOpen={id => { setSemanticOpen(false); openProduct(id); }} />}
    {selected && <ProductDialog key={selected.id} id={selected.id} showQr={selected.qr} onClose={() => setSelected(undefined)} />}
  </div>;
}
