import { ReactNode, useRef, useState, useSyncExternalStore } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { sessionStore } from '../auth/session';
import { ApiError } from '../../services/api/apiTypes';
import { canExecuteInbound, canReceive, PutawayRequest, Receipt, receiveRequest, ReceiveRequest, statusKey } from '../../services/inbound/inboundApi';
import { inboundQueries, putawayMutationOptions, receiveMutationOptions } from '../../services/inbound/inboundQueries';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import { canReadBinContext } from '../../services/inventory/inventoryReadApi';
import { createSubmissionGate } from '../../services/inventory/replenishmentMutation';
import { Inbox, RefreshCw, Search, Eye, Clock, CheckCircle2, Package, MapPin, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import KPICard from '../../components/common/KPICard';
import PaginationFooter from '../../components/common/PaginationFooter';
import SharedStateView from '../../components/common/SharedStateView';
import InboundReceivingModal from './InboundReceivingModal';

const button = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const primary = `${button} !bg-blue-600 !border-blue-600 !text-white hover:!bg-blue-700`;
const input = 'border border-slate-200 bg-slate-50 rounded-xl p-2.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40';
export function InboundError({ error }: { error: unknown }) {
  const { t } = useTranslation(); const e = error as ApiError;
  return <div role="alert" className="p-3 rounded-lg bg-rose-50 text-rose-800"><p>{t(e?.status === 409 ? 'f4.conflict' : e?.status === 403 ? 'f4.forbidden' : e?.status === 400 ? 'f4.validation' : 'f4.uncertain')}</p></div>;
}
function Status({ value }: { value: string }) {
  const { t } = useTranslation(); const key = statusKey(value);
  return <StatusBadge label={key ? t(`f4.status.${key}`) : value} variant={key === 'completed' ? 'green' : key === 'processing' ? 'blue' : key === 'new' || key === 'pending' ? 'amber' : 'gray'} showDot size="sm" />;
}
export default function RealInbound({ flowNavigation, initialReceiptId = '' }: { flowNavigation?: ReactNode; initialReceiptId?: string } = {}) {
  const { t } = useTranslation(); const list = useQuery(inboundQueries.list());
  const writing = useIsMutating({ mutationKey: ['private', 'inbound'] }) > 0;
  const [selected, setSelected] = useState(initialReceiptId);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const records = list.isError ? [] : list.data ?? [];
  const filtered = records.filter(r => (!status || r.status === status) && `${r.receiptNumber} ${r.supplierName} ${r.referenceDocument}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)); const currentPage = Math.min(page, pages);
  return <main className="w-full flex flex-col p-4 sm:p-6 font-sans animate-fadeIn bg-slate-50 min-h-screen gap-5">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl"><Inbox className="h-5 w-5" strokeWidth={1.75} /></div><div><h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{t('f4.title')}</h1><p className="text-xs text-slate-500 font-medium mt-0.5">{t('f4.scope')}</p></div></div><button className={button} disabled={list.isFetching || writing} onClick={() => void list.refetch()}><RefreshCw className="w-4 h-4" />{t('f4.refresh')}</button></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <KPICard appearance="inventory" label={t('f4.totalReceipts')} value={list.isPending || list.isError ? '—' : records.length} icon={Inbox} variant="blue" />
      <KPICard appearance="inventory" label={t('f4.awaiting')} value={list.isPending || list.isError ? '—' : records.filter(r => ['New', 'Pending'].includes(r.status)).length} icon={Clock} variant="amber" />
      <KPICard appearance="inventory" label={t('f4.status.processing')} value={list.isPending || list.isError ? '—' : records.filter(r => r.status === 'Processing').length} icon={Package} variant="blue" />
      <KPICard appearance="inventory" label={t('f4.status.completed')} value={list.isPending || list.isError ? '—' : records.filter(r => r.status === 'Completed').length} icon={CheckCircle2} variant="green" />
    </div>
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
      {flowNavigation || <div className="inline-flex items-center gap-2 text-blue-600 text-xs font-semibold"><Inbox className="w-4 h-4" />{t('f4.inboundTab')}</div>}
      <div role="group" aria-label={t('f4.statusLabel')} className="flex flex-wrap gap-1.5">{['', ...new Set(records.map(r => r.status))].map(value => <button key={value} type="button" aria-pressed={status === value} disabled={writing || list.isPending || list.isError} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${status === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} onClick={() => { setStatus(value); setPage(1); }}>{value ? statusKey(value) ? t(`f4.status.${statusKey(value)}`) : value : t('f4.allStatuses')}<span className="rounded-full bg-current/10 px-1.5 font-mono">{list.isPending || list.isError ? '—' : value ? records.filter(r => r.status === value).length : records.length}</span></button>)}</div>
    </div>
    <div className="bg-slate-50/70 p-4"><label className="relative block"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" /><input aria-label={t('f4.search')} placeholder={t('f4.search')} className={`${input} !bg-white !pl-9`} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label></div>
    </div>
    {list.isError ? <div role="alert"><SharedStateView type="error" title={t((list.error as unknown as ApiError)?.isForbidden ? 'f4.forbidden' : 'ui.receiptsError')} subtitle={t('f2.retryHint')} onRetry={() => void list.refetch()} /></div> : list.isPending ? <div role="status"><SharedStateView type="loading" title={t('f4.loading')} /></div> : <div><div className="bg-white rounded-t-2xl border border-slate-200/80 overflow-x-auto shadow-sm"><table className="enterprise-table w-full text-left text-sm"><thead className="bg-slate-50/80 text-[11px] text-slate-500 uppercase tracking-wider"><tr>{['reference', 'supplier', 'expectedDate', 'statusLabel', 'actions'].map(k => <th className="px-4 py-3 font-semibold" key={k}>{t(`f4.${k}`)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
      {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(r => <tr key={r.id} className="hover:bg-blue-50/30 transition-colors"><td className="px-4 py-3"><span className="font-mono text-xs font-bold text-blue-700 break-all">{r.receiptNumber}</span>{r.referenceDocument && <small className="block text-slate-400 mt-1 break-all">{r.referenceDocument}</small>}</td><td className="px-4 py-3 font-medium text-slate-700 break-words">{r.supplierName || t('f4.unavailable')}</td><td className="px-4 py-3 text-slate-500 text-xs">{r.expectedDeliveryDate?.slice(0, 10) || t('f4.unavailable')}</td><td className="px-4 py-3"><Status value={r.status} /></td><td className="px-4 py-3"><button className={button} disabled={writing} onClick={() => setSelected(r.id)}><Eye className="w-4 h-4" />{t('f4.detail')}</button></td></tr>)}
    </tbody></table>{filtered.length === 0 && <SharedStateView type={search || status ? "search-empty" : "empty"} title={t('f4.empty')} subtitle={t('f2.emptyHint')} />}</div><PaginationFooter pageIndex={currentPage} pageSize={10} totalCount={filtered.length} totalPages={pages} disabled={list.isFetching || writing} onPageChange={setPage} /></div>}
    {selected && <ReceiptDetail key={selected} id={selected} close={() => setSelected('')} />}
  </main>;
}
function ReceiptDetail({ id, close }: { id: string; close: () => void }) {
  const { t } = useTranslation(); const detail = useQuery(inboundQueries.detail(id));
  const writing = useIsMutating({ mutationKey: ['private', 'inbound'] }) > 0;
  return <InboundReceivingModal mode="api" title={detail.data?.receiptNumber || t('f4.loading')} busy={writing} onClose={close}
    context={detail.isSuccess && <><Status value={detail.data.status} /><span>{detail.data.supplierName || t('f4.unavailable')}</span>{detail.data.referenceDocument && <span className="font-mono rounded border border-slate-700 bg-slate-800 px-2 py-0.5">{detail.data.referenceDocument}</span>}<span>{t('f4.expectedDate')}: {detail.data.expectedDeliveryDate?.slice(0, 10) || t('f4.unavailable')}</span></>}>
    {detail.isError ? <><InboundError error={detail.error} /><button className={button} onClick={() => void detail.refetch()}>{t('f4.refresh')}</button></> : detail.isPending ? <p>{t('f4.loading')}</p> : <ReceiptWorkspace receipt={detail.data} fetching={detail.isFetching} refresh={() => void detail.refetch()} />}
  </InboundReceivingModal>;
}
function ReceiptWorkspace({ receipt: r, fetching, refresh }: { receipt: Receipt; fetching: boolean; refresh: () => void }) {
  const { t } = useTranslation(); const client = useQueryClient();
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  const allowed = canExecuteInbound(session?.role); const contextAllowed = canReadBinContext(session?.role);
  const products = useQuery(inventoryQueries.products());
  const bins = useQuery({ ...inventoryQueries.bins(), enabled: contextAllowed });
  const zones = useQuery({ ...inventoryQueries.zones(), enabled: contextAllowed });
  const source = useQuery({ ...inventoryQueries.contents(r.binId ?? ''), enabled: contextAllowed && !!r.binId });
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [operation, setOperation] = useState<'receive' | 'putaway'>('receive');
  const [lineId, setLineId] = useState(''); const [quantity, setQuantity] = useState(0);
  const [suggestFor, setSuggestFor] = useState<{ sku: string; quantity: number } | null>(null);
  const suggestion = useQuery({ ...inboundQueries.suggestion(suggestFor?.sku ?? '', suggestFor?.quantity ?? 0), enabled: !!suggestFor });
  const [confirmation, setConfirmation] = useState<{ kind: 'receive'; body: ReceiveRequest } | { kind: 'putaway'; body: PutawayRequest } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null); const gate = useRef(createSubmissionGate());
  const receive = useMutation(receiveMutationOptions(client)); const putaway = useMutation(putawayMutationOptions(client));
  const busy = receive.isPending || putaway.isPending;
  const [result, setResult] = useState<'receive' | 'putaway' | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const line = r.items.find(i => i.id === lineId);
  const product = !products.isError ? products.data?.find(p => p.id === line?.productId) : undefined;
  const recommendation = suggestFor && !suggestion.isError && !suggestion.isFetching ? suggestion.data : undefined;
  const sourceBin = bins.data?.find(b => b.id === r.binId); const targetBin = bins.data?.find(b => b.id === recommendation?.binId);
  const warehouse = (zoneId?: string) => zones.data?.find(z => z.id === zoneId)?.warehouseId;
  const sameWarehouse = !!warehouse(sourceBin?.zoneId) && warehouse(sourceBin?.zoneId) === warehouse(targetBin?.zoneId);
  const rows = source.data?.items.filter(i => i.productId === line?.productId && i.lotNumber.trim() === line?.lotNumber.trim() && i.status === 'Available') ?? [];
  const physical = rows.length === 1 ? rows[0].quantity : 0;
  const validQuantity = !!line && Number.isInteger(quantity) && quantity > 0 && quantity <= line.quantityReceived;
  const validContext = contextAllowed && !source.isError && !source.isFetching && !bins.isError && !bins.isFetching && !zones.isError && !zones.isFetching && sameWarehouse && quantity <= physical;
  const canPutaway = allowed && validQuantity && !!recommendation && recommendation.binId !== r.binId && validContext && !fetching && !busy && product?.trackingMode !== 2;
  let request: ReceiveRequest | null = null;
  try { request = receiveRequest(r, deltas); } catch { /* Invalid/empty draft disables review. */ }
  const open = (value: NonNullable<typeof confirmation>) => { setResult(null); setFailure(null); setConfirmation(value); dialog.current?.showModal(); };
  const reviewReceive = async () => {
    if (!request || !allowed || busy || fetching) return;
    const owner = sessionStore.get();
    try {
      const latest = await client.fetchQuery(inboundQueries.detail(r.id));
      if (owner !== sessionStore.get()) return;
      open({ kind: 'receive', body: receiveRequest(latest, deltas) });
    } catch (error) { setFailure(error); }
  };
  const cancel = () => { if (!busy) { setConfirmation(null); dialog.current?.close(); } };
  const confirm = () => gate.current(async () => {
    if (!confirmation || !allowed || busy || fetching) return;
    if (confirmation.kind === 'putaway' && !canPutaway) return;
    const action = confirmation;
    try {
      if (action.kind === 'receive') await receive.mutateAsync(action.body);
      else await putaway.mutateAsync(action.body);
      setResult(action.kind);
    } catch (error) { setFailure(error); }
    finally { setDeltas({}); setQuantity(0); setSuggestFor(null); setConfirmation(null); dialog.current?.close(); }
  });
  const resetSuggestion = () => { setSuggestFor(null); setResult(null); setFailure(null); };
  const orderedTotal = r.items.reduce((total, item) => total + item.quantityExpected, 0);
  const receivedTotal = r.items.reduce((total, item) => total + item.quantityReceived, 0);
  const validDraft = r.items.every(item => Number.isInteger(deltas[item.id] ?? 0) && (deltas[item.id] ?? 0) >= 0 && (deltas[item.id] ?? 0) <= item.quantityExpected - item.quantityReceived);
  const draftTotal = r.items.reduce((total, item) => total + (deltas[item.id] ?? 0), 0);
  return <div className="space-y-4 receipt-workspace">
    <div role="tablist" aria-label={t('f4.actions')} className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">{(['receive', 'putaway'] as const).map((tab, index) => <button role="tab" aria-selected={operation === tab} key={tab} disabled={busy || !!confirmation} onClick={() => setOperation(tab)} className={`flex items-center gap-3 p-3 text-left text-xs font-semibold border rounded-xl transition-colors disabled:opacity-50 ${operation === tab ? tab === 'receive' ? 'border-blue-300 bg-blue-50 text-blue-800 ring-2 ring-blue-100' : 'border-indigo-300 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-600'}`}><span className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 font-mono ${operation === tab ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{index + 1}</span>{t(tab === 'receive' ? 'f4.inboundTab' : 'f4.putaway')}</button>)}</div>
    <div className="flex flex-wrap justify-between gap-3 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="flex items-center gap-2 text-xs text-slate-600"><MapPin aria-hidden="true" className="w-4 h-4 text-blue-500 shrink-0" />{t('f4.source')}: <span className="font-mono font-medium text-slate-900 break-all">{sourceBin?.code || r.binId || t('f4.unavailable')}</span></p><button className={button} disabled={busy || !!confirmation || fetching} onClick={() => { setDeltas({}); resetSuggestion(); refresh(); }}><RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />{t('f4.refresh')}</button></div>
    {fetching && <p role="status">{t('f4.loading')}</p>}
    {failure != null && <InboundError error={failure} />}{result && <p role="status" className="p-3 bg-green-50 text-green-800">{t(`f4.success.${result}`)}</p>}
    {products.isError && <p>{t('f4.metadataUnavailable')}</p>}
    <fieldset disabled={busy || !!confirmation || fetching} className="space-y-4">
      <section hidden={operation !== 'receive'} className="space-y-4">
      <p className="text-xs leading-relaxed text-blue-800 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-2"><Inbox aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />{t('f4.receiveMeaning')}</p>
      <div className="overflow-x-auto border border-slate-200 rounded-xl"><table className="enterprise-table w-full text-left [&_th:nth-child(n+3)]:text-right [&_td:nth-child(n+3)]:text-right [&_td:nth-child(n+3)]:font-mono"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{['product', 'lot', 'ordered', 'received', 'now', 'remainingAfter'].map(k => <th className="p-3" key={k}>{t(`f4.${k}`)}</th>)}</tr></thead><tbody>{r.items.map(item => {
        const p = !products.isError ? products.data?.find(p => p.id === item.productId) : undefined;
        return <tr key={item.id} className="border-t border-slate-100"><td className="p-2"><span className="block font-mono text-blue-700 font-semibold">{p?.sku || item.productId}</span><span className="block text-xs text-slate-700 mt-1">{item.productName}</span></td><td className="p-2"><span className="font-mono text-xs rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">{item.lotNumber || '—'}</span><small className="block text-slate-400 mt-1">{item.expirationDate?.slice(0, 10) || '—'}</small></td><td className="p-2">{item.quantityExpected}</td><td className="p-2">{item.quantityReceived}</td><td className="p-2"><input className={`${input} text-right font-mono min-w-20`} aria-label={`${t('f4.now')} ${p?.sku || item.productId}`} type="number" min="0" step="1" max={item.quantityExpected - item.quantityReceived} value={deltas[item.id] ?? 0} disabled={!allowed || !canReceive(r) || item.quantityReceived === item.quantityExpected || p?.trackingMode === 2} onChange={e => setDeltas({ ...deltas, [item.id]: Number(e.target.value) })} /></td><td className="p-3 font-mono font-semibold"><span className="text-blue-700">{Number.isInteger(deltas[item.id] ?? 0) && (deltas[item.id] ?? 0) >= 0 && (deltas[item.id] ?? 0) <= item.quantityExpected - item.quantityReceived ? item.quantityExpected - item.quantityReceived - (deltas[item.id] ?? 0) : t('f4.invalidDelta')}</span></td></tr>;
      })}</tbody></table></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">{[
        [t('f4.ordered'), orderedTotal], [t('f4.received'), receivedTotal], [t('f4.now'), validDraft ? `+${draftTotal}` : t('f4.invalidDelta')], [t('f4.remainingAfter'), validDraft ? orderedTotal - receivedTotal - draftTotal : t('f4.invalidDelta')],
      ].map(([label, value], index) => <div key={label} className={`rounded-xl border p-3 ${index === 2 ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}><p className="text-[11px] text-slate-500">{label}</p><p className={`font-mono text-base font-semibold mt-1 ${index === 2 ? 'text-blue-700' : 'text-slate-900'}`}>{value}</p></div>)}</div>
      <div className="receipt-action-bar"><p className="text-xs text-slate-500">{!canReceive(r) && t('f4.noReceive')}</p><button className={primary} disabled={!request || !allowed} onClick={() => void reviewReceive()}><CheckCircle2 aria-hidden="true" className="w-4 h-4" />{t('f4.reviewReceive')}</button></div>
      </section>
      <section hidden={operation !== 'putaway'} className="space-y-4"><p className="text-xs leading-relaxed text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-2"><Package aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />{t('f4.putawayMeaning')}</p>
        {!contextAllowed && <p className="text-amber-800">{t('f4.staffContext')}</p>}
        {contextAllowed && (source.isError || bins.isError || zones.isError) && <p role="alert">{t('f4.metadataUnavailable')}</p>}
        <div className="grid lg:grid-cols-2 gap-4 items-start"><div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Package aria-hidden="true" className="w-4 h-4 text-blue-600" />{t('f4.source')}</h3>
        <label className="block text-xs font-semibold text-slate-600 space-y-1.5"><span>{t('f4.product')}</span><select className={input} value={lineId} onChange={e => { setLineId(e.target.value); setQuantity(0); resetSuggestion(); }}><option value="">{t('f4.select')}</option>{r.items.filter(i => i.quantityReceived > 0).map(i => <option value={i.id} key={i.id}>{i.productName} · {i.lotNumber} · {t('f4.received')}: {i.quantityReceived}</option>)}</select></label>
        <label className="block text-xs font-semibold text-slate-600 space-y-1.5"><span>{t('f4.moveQuantity')}</span><input className={`${input} font-mono`} type="number" min="0" step="1" max={line?.quantityReceived ?? 0} value={quantity} onChange={e => { setQuantity(Number(e.target.value)); resetSuggestion(); }} /></label>
        {contextAllowed && line && !source.isError && source.data && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2"><p>{t('f4.physical')}: <strong className="font-mono text-slate-900">{physical}</strong></p><p>{t('f4.occupancy')}: <span className="font-mono">{source.data.currentOccupancy} / {source.data.maxCapacity}</span></p></div>}
        <button className={button} disabled={!allowed || !validQuantity || !product || product.trackingMode === 2 || !r.binId || suggestion.isFetching} onClick={() => { setSuggestFor({ sku: product!.sku, quantity }); void client.invalidateQueries({ queryKey: inboundQueries.suggestion(product!.sku, quantity).queryKey }); }}>{t('f4.suggest')}</button>
        {suggestFor && suggestion.isFetching && <p>{t('f4.loading')}</p>}{suggestFor && suggestion.isError && <InboundError error={suggestion.error} />}
        </div><div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3"><h3 className="font-semibold text-sm flex items-center gap-2 text-indigo-900"><MapPin aria-hidden="true" className="w-4 h-4" />{t('f4.destination')}</h3><p className="text-xs leading-relaxed text-slate-500">{t('f4.readOnly')}</p>
        {recommendation && <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"><p className="font-mono font-semibold text-indigo-700">{recommendation.binCode}</p><p className="text-xs text-slate-500">{recommendation.zoneName}</p><p className="text-xs border-y border-slate-100 py-3">{t('f4.space')}: <strong className="font-mono text-slate-900">{recommendation.availableSpaceBeforePutaway}</strong></p>
          {recommendation.binId === r.binId && <p>{t('f4.sameBin')}</p>}{contextAllowed && !sameWarehouse && <p>{t('f4.warehouseMismatch')}</p>}
          <button className={`${button} !bg-indigo-600 !border-indigo-600 !text-white hover:!bg-indigo-700 w-full`} disabled={!canPutaway} onClick={() => line && r.binId && open({ kind: 'putaway', body: { productId: line.productId, sourceBinId: r.binId, destinationBinId: recommendation.binId, transferQuantity: quantity, lotNumber: line.lotNumber, reason: `INBOUND_PUTAWAY_${r.id}` } })}><ArrowRight aria-hidden="true" className="w-4 h-4" />{t('f4.reviewPutaway')}</button>
        </div>}
        </div></div>
      </section>
    </fieldset>
    <Link className="text-blue-700 underline" to="/dashboard/inventory">{t('f4.inventoryLink')}</Link>
    <dialog ref={dialog} aria-labelledby="inbound-confirm-title" onCancel={e => { if (busy) e.preventDefault(); else setConfirmation(null); }} className="m-auto rounded-2xl border border-slate-200 p-4 sm:p-6 max-w-xl w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto shadow-2xl backdrop:bg-slate-900/50">
      <h3 id="inbound-confirm-title" className="font-bold text-lg">{t('f4.confirm')}</h3><p className="text-sm text-slate-500 mt-1 mb-4">{r.receiptNumber}</p>
      {confirmation?.kind === 'receive' ? <><p>{t('f4.confirmReceive')}</p>{confirmation.body.receivedItems.map(i => <p key={i.itemId}>{r.items.find(l => l.id === i.itemId)?.productName} · {products.data?.find(p => p.id === r.items.find(l => l.id === i.itemId)?.productId)?.sku || i.itemId}: +{i.quantityReceived}</p>)}</> : confirmation && <><p>{t('f4.confirmPutaway')}</p><p>{line?.productName} · {product?.sku} · {confirmation.body.lotNumber}</p><p>{sourceBin?.code || t('f4.unavailable')} → {recommendation?.binCode}: {confirmation.body.transferQuantity}</p></>}
      <div className="flex flex-wrap justify-end gap-3 mt-5 pt-4 border-t border-slate-100"><button className={button} disabled={busy} onClick={cancel}>{t('f4.cancel')}</button><button className={primary} disabled={busy || !allowed || fetching} onClick={() => void confirm()}>{t(busy ? 'f4.pending' : 'f4.confirm')}</button></div>
    </dialog>
  </div>;
}
