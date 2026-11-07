import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Plus, RefreshCw, ArrowLeft } from 'lucide-react';
import { sessionStore } from '../auth/session';
import { ApiError } from '../../services/api/apiTypes';
import { CountSheet, ConfirmCount, canManageCounts, countForm, countQuantity, countSubmission } from '../../services/cycleCount/assignedCycleCountApi';
import { countQueries, createCountOptions, confirmCountOptions } from '../../services/cycleCount/assignedCycleCountQueries';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import { createSubmissionGate } from '../../services/inventory/replenishmentMutation';
import { StatusBadge } from '../../components/common/StatusBadge';
import SharedStateView from '../../components/common/SharedStateView';

const base = '/dashboard/cycle-counting';
const button = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed';
const primary = `${button} !bg-blue-600 !border-blue-600 !text-white`;
const input = 'w-full min-w-0 border border-slate-200 bg-slate-50 rounded-xl p-2.5 text-sm';
export function CountStatus({ value }: { value: string }) {
  const { t } = useTranslation(); const known = ['Pending','Counting','Completed','Cancelled','Matched','Discrepancy'].includes(value);
  return <StatusBadge label={known ? t(`f6.status.${value}`) : value} variant={['Completed','Matched'].includes(value) ? 'green' : value === 'Discrepancy' ? 'red' : value === 'Pending' ? 'amber' : value === 'Counting' ? 'blue' : 'gray'} showDot />;
}
export function CountError({ error }: { error: unknown }) {
  const { t } = useTranslation(); const status = (error as ApiError)?.status;
  return <p role="alert" className="p-4 border border-rose-200 bg-rose-50 text-rose-800 rounded-xl text-xs">{t(`f6.errors.${status === 400 ? 'validation' : status === 403 ? 'forbidden' : status === 409 ? 'conflict' : status === 401 ? 'session' : 'uncertain'}`)}</p>;
}
function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return <header className="flex flex-wrap items-center justify-between gap-4"><div className="flex gap-3 items-center"><div className="p-2.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl"><ClipboardList className="w-5 h-5" /></div><h1 className="text-xl font-bold text-slate-900">{title}</h1></div><div className="flex gap-2 flex-wrap">{children}</div></header>;
}
export default function AssignedCycleCounts() {
  return <main className="min-w-0 w-full p-4 sm:p-6 space-y-5 bg-slate-50 min-h-screen"><Routes><Route index element={<AssignedTaskList />} /><Route path="create" element={<CreateAssignedCount />} /><Route path=":id" element={<AssignedCountDetail />} /></Routes></main>;
}
export function AssignedTaskList() {
  const { t } = useTranslation(); const session = useSyncExternalStore(sessionStore.subscribe,sessionStore.get,sessionStore.get);
  const tasks = useQuery(countQueries.pendingTasks()); const [reference,setReference] = useState(''); const navigate = useNavigate();
  const groups = [...new Set(tasks.data?.map(x => x.countSheetId))].map(id => ({ id, lines: tasks.data!.filter(x => x.countSheetId === id) }));
  return <><Heading title={t('f6.title')}><button className={button} disabled={tasks.isFetching} onClick={() => void tasks.refetch()}><RefreshCw className="w-4 h-4" />{t('f6.refresh')}</button>{canManageCounts(session?.role) && <Link className={primary} to={`${base}/create`}><Plus className="w-4 h-4" />{t('f6.create')}</Link>}</Heading>
    <p className="text-xs text-slate-500">{t('f6.ownScope')}</p>
    {canManageCounts(session?.role) && <form className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(reference.trim())) navigate(`${base}/${reference.trim()}`); }}><label className="flex-1 min-w-48 text-xs space-y-1"><span>{t('f6.knownId')}</span><input className={input} required pattern="[0-9a-fA-F-]{36}" value={reference} onChange={e => setReference(e.target.value)} /></label><button className={button}>{t('f6.open')}</button></form>}
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><h2 className="p-4 font-bold text-sm border-b border-slate-100">{t('f6.tasks')}</h2>{tasks.isError ? <CountError error={tasks.error} /> : tasks.isPending ? <SharedStateView type="loading" title={t('f6.loading')} /> : !groups.length ? <SharedStateView type="empty" title={t('f6.empty')} /> : <div className="overflow-x-auto"><table className="enterprise-table w-full text-left"><thead><tr>{['reference','zone','lines','actions'].map(k => <th key={k}>{t(`f6.${k}`)}</th>)}</tr></thead><tbody>{groups.map(g => <tr key={g.id}><td className="font-mono text-blue-700">{g.lines[0].sheetNumber || g.id}</td><td>{g.lines[0].targetZone}</td><td className="font-mono">{g.lines.length}</td><td><Link className={button} to={`${base}/${g.id}`}>{t('f6.open')}</Link></td></tr>)}</tbody></table></div>}</section></>;
}
export function AssignedCountDetail() {
  const { id = '' } = useParams(); const { t } = useTranslation(); const detail = useQuery(countQueries.detail(id)); const client = useQueryClient();
  useEffect(() => { if ((detail.error as ApiError)?.status === 403) void client.invalidateQueries({ queryKey: countQueries.pendingTasks().queryKey }); },[detail.error,client]);
  return <><Heading title={detail.data?.sheetNumber || t('f6.detail')}><Link className={button} to={base}><ArrowLeft className="w-4 h-4" />{t('f6.back')}</Link></Heading>{detail.isError ? <CountError error={detail.error} /> : detail.isPending ? <SharedStateView type="loading" title={t('f6.loading')} /> : detail.data && <CountWorkspace key={id} sheet={detail.data} stale={detail.isFetching} />}</>;
}
function sessionUserId(token?: string): string {
  if (!token) return '';
  try {
    const part = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    const payload = part ? JSON.parse(atob(part)) : null;
    const raw = payload?.nameid ?? payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? payload?.sub;
    return typeof raw === 'string' ? raw : '';
  } catch { return ''; }
}
export function CountWorkspace({ sheet, stale = false }: { sheet: CountSheet; stale?: boolean }) {
  const { t, i18n } = useTranslation(); const client = useQueryClient(); const mutation = useMutation(confirmCountOptions(client));
  const session = useSyncExternalStore(sessionStore.subscribe,sessionStore.get,sessionStore.get);
  const assignees = useQuery(countQueries.assignees()); const ownId = sessionUserId(session?.token);
  const renderActor = (userId: string | null, emptyText: string) => {
    if (!userId) return <span>{emptyText}</span>;
    const matched = assignees.data?.find(a => a.id.toLowerCase() === userId.toLowerCase());
    if (matched) return <><span className="font-sans font-semibold text-slate-800">{matched.fullName ? `${matched.fullName} · ${matched.username}` : matched.username}</span><span className="block text-[11px] text-slate-400 font-mono mt-0.5">{userId}</span></>;
    if (ownId && ownId.toLowerCase() === userId.toLowerCase() && session?.username) return <><span className="font-sans font-semibold text-slate-800">{session.fullName ? `${session.fullName} · ${session.username}` : session.username}</span><span className="block text-[11px] text-slate-400 font-mono mt-0.5">{userId}</span></>;
    return <span className="font-mono text-[11px] text-slate-600">{userId}</span>;
  };
  const [values,setValues] = useState<Record<string,string>>({}); const [notes,setNotes] = useState(sheet.notes); const [review,setReview] = useState<ConfirmCount | null>(null); const [blocked,setBlocked] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const gate = useRef(createSubmissionGate()); const summary = countForm(sheet,values);
  useEffect(() => { setValues({}); setReview(null); dialog.current?.close(); setNotes(sheet.notes); },[sheet]);
  const editable = ['Pending','Counting'].includes(sheet.status) && !blocked && !stale && !mutation.isPending;
  const confirm = () => void gate.current(async () => {
    if (!review || !editable) return;
    try { await mutation.mutateAsync(review); dialog.current?.close(); setReview(null); setValues({}); }
    catch { setBlocked(true); setValues({}); setReview(null); dialog.current?.close(); }
  });
  return <div className="space-y-5"><section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"><CountStatus value={sheet.status} /><dl className="grid sm:grid-cols-3 gap-4 text-xs">{([['reference',<span className="font-mono font-semibold text-slate-900">{sheet.sheetNumber || sheet.batchCode || '—'}</span>],['zone',<span className="font-medium text-slate-800">{sheet.zoneName || '—'}</span>],['bin',<span className="font-mono font-semibold text-blue-700">{sheet.binCode || '—'}</span>],['assignment',renderActor(sheet.assignedUserId,t('f6.unassigned'))],['created',<span className="font-mono">{new Date(sheet.createdAt).toLocaleString(i18n.language)}</span>],['createdBy',renderActor(sheet.createdBy,'—')]] as const).map(([label,node]) => <div key={label}><dt className="text-slate-500">{t(`f6.${label}`)}</dt><dd className="break-words mt-1">{node}</dd></div>)}</dl></section>
    {mutation.isError && <CountError error={mutation.error} />}{blocked && <Link className={button} to={base}>{t('f6.back')}</Link>}
    <p className="border border-blue-200 bg-blue-50 p-4 rounded-xl text-xs text-blue-800">{t(sheet.status === 'Completed' ? 'f6.completedHelp' : 'f6.localHelp')}</p>
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 border-b border-slate-100 flex flex-wrap justify-between gap-3"><h2 className="font-bold text-sm">{t('f6.items')}</h2>{['Pending','Counting'].includes(sheet.status) && <span className="text-xs text-slate-600">{t('f6.progress',{ entered: summary.entered,total: sheet.items.length })}</span>}</div><div className="overflow-x-auto"><table className="enterprise-table w-full text-left"><thead><tr>{['product','bin','lot','system','counted','variance','statusLabel'].map(k => <th key={k}>{t(`f6.${k}`)}</th>)}</tr></thead><tbody>{sheet.items.map(i => { const raw = values[i.id]; const valid = raw !== undefined && raw.trim() !== '' && countQuantity(Number(raw)); return <tr key={i.id}><td><strong className="font-mono text-blue-700">{i.sku}</strong><span className="block text-slate-500">{i.productName}</span></td><td className="font-mono">{i.binCode}</td><td>{i.lotNumber || '—'}</td><td className="text-right font-mono">{i.systemQuantity}</td><td>{['Pending','Counting'].includes(sheet.status) ? <input type="number" min="0" max="2147483647" step="1" aria-label={`${t('f6.counted')} ${i.sku} ${i.binCode} ${i.lotNumber}`} aria-invalid={raw !== undefined && raw !== '' && !valid} className={`${input} !w-28 text-right font-mono`} disabled={!editable} value={raw ?? ''} onChange={e => setValues(v => ({ ...v,[i.id]: e.target.value }))} /> : <span className="font-mono">{i.countedQuantity ?? '—'}</span>}</td><td className="font-mono text-right">{['Pending','Counting'].includes(sheet.status) ? valid ? Number(raw)-i.systemQuantity : '—' : i.variance ?? '—'}</td><td><CountStatus value={i.status} /></td></tr>; })}</tbody></table></div></section>
    <label className="block text-xs space-y-1"><span>{t('f6.notes')}</span><textarea className={input} value={notes} disabled={!editable} onChange={e => setNotes(e.target.value)} /></label>
    {['Pending','Counting'].includes(sheet.status) && <div className="sticky bottom-0 z-10 bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap justify-between items-center gap-3"><p className="text-xs">{t('f6.preview')}: <span className="font-mono">{summary.variance}</span></p><button className={primary} disabled={!editable || !summary.complete} onClick={() => { setReview(countSubmission(sheet,values,notes)); dialog.current?.showModal(); }}>{t('f6.review')}</button></div>}
    <dialog ref={dialog} aria-labelledby="count-review-title" onCancel={e => { if (mutation.isPending) e.preventDefault(); else setReview(null); }} className="m-auto p-0 w-[calc(100%-2rem)] max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl border-0 shadow-2xl backdrop:bg-slate-900/50"><header className="p-5 bg-slate-900 text-white"><h2 id="count-review-title" className="font-bold">{t('f6.review')}</h2><p className="font-mono text-xs mt-1">{sheet.sheetNumber}</p></header><div className="p-5 space-y-4"><p className="text-sm">{t('f6.finalWarning')}</p><p className="text-xs">{t('f6.progress',{ entered: summary.entered,total: sheet.items.length })} · {t('f6.preview')}: {summary.variance}</p><div className="flex flex-wrap justify-end gap-2"><button autoFocus className={button} disabled={mutation.isPending} onClick={() => { dialog.current?.close(); setReview(null); }}>{t('f6.close')}</button><button className={primary} disabled={mutation.isPending || !review || stale} onClick={confirm}>{t(mutation.isPending ? 'f6.processing' : 'f6.confirm')}</button></div></div></dialog>
  </div>;
}
export function CreateAssignedCount() {
  const { t } = useTranslation(); const session = useSyncExternalStore(sessionStore.subscribe,sessionStore.get,sessionStore.get); const allowed = canManageCounts(session?.role);
  const client = useQueryClient(); const navigate = useNavigate(); const mutation = useMutation(createCountOptions(client)); const gate = useRef(createSubmissionGate());
  const assignees = useQuery(countQueries.assignees()); const bins = useQuery({ ...inventoryQueries.bins(),enabled: allowed }); const zones = useQuery({ ...inventoryQueries.zones(),enabled: allowed });
  const [scope,setScope] = useState('bin'); const [location,setLocation] = useState(''); const [assigned,setAssigned] = useState(''); const [notes,setNotes] = useState(''); const [uncertain,setUncertain] = useState(false);
  if (!allowed) return <CountError error={{ status:403 }} />;
  const submit = () => void gate.current(async () => {
    if (uncertain || mutation.isPending || !location) return;
    try { const id = await mutation.mutateAsync({ binId: scope === 'bin' ? location : null,zoneId: scope === 'zone' ? location : null,assignedUserId: assigned || null,notes }); navigate(`${base}/${id}`,{ replace: true }); }
    catch (e) { const status = (e as ApiError).status; if (!status || status >= 500 || status === 401) setUncertain(true); }
  });
  return <><Heading title={t('f6.create')}><Link className={button} to={base}>{t('f6.back')}</Link></Heading><form className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 max-w-4xl" onSubmit={e => { e.preventDefault(); submit(); }}>
    {mutation.isError && <CountError error={mutation.error} />}{[assignees,bins,zones].some(q => q.isError) && <CountError error={{ status:400 }} />}
    <fieldset disabled={mutation.isPending || uncertain} className="space-y-4"><div className="grid sm:grid-cols-2 gap-4"><label className="text-xs space-y-1"><span>{t('f6.scope')}</span><select className={input} value={scope} onChange={e => { setScope(e.target.value); setLocation(''); }}><option value="bin">{t('f6.bin')}</option><option value="zone">{t('f6.zone')}</option></select></label><label className="text-xs space-y-1"><span>{t(`f6.${scope}`)}</span><select required className={input} value={location} onChange={e => setLocation(e.target.value)} disabled={scope === 'bin' ? !bins.data || bins.isError : !zones.data || zones.isError}><option value="">{t('f6.choose')}</option>{scope === 'bin' ? bins.data?.map(b => <option key={b.id} value={b.id}>{b.code}</option>) : zones.data?.map(z => <option key={z.id} value={z.id}>{z.code} · {z.name}</option>)}</select></label></div>
    <label className="block text-xs space-y-1"><span>{t('f6.assignment')}</span><select className={input} value={assigned} disabled={!assignees.data || assignees.isError} onChange={e => setAssigned(e.target.value)}><option value="">{t('f6.unassigned')}</option>{assignees.data?.map(a => <option key={a.id} value={a.id}>{a.fullName || a.username} · {a.username}</option>)}</select></label><p className="text-xs text-amber-800">{t('f6.assignmentHelp')}</p>
    <label className="block text-xs space-y-1"><span>{t('f6.notes')}</span><textarea className={input} value={notes} onChange={e => setNotes(e.target.value)} /></label><button className={primary} disabled={!location || assignees.isPending || assignees.isError}>{t(mutation.isPending ? 'f6.processing' : 'f6.create')}</button></fieldset>
  </form></>;
}
