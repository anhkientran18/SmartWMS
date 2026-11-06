import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { sessionStore } from '../auth/session';
import { ApiError } from '../../services/api/apiTypes';
import { canReplenish } from '../../services/inventory/replenishmentApi';
import { createSubmissionGate, replenishmentMutationOptions } from '../../services/inventory/replenishmentMutation';
import { RefreshCw, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import RealStockVisibility from '../inventory/RealStockVisibility';

export function ReplenishmentFeedback({ count, error }: { count?: number; error?: ApiError | null }) {
  const { t } = useTranslation();
  if (error) {
    const key = error.status === 400 ? 'validation' : error.status === 403 ? 'forbidden' : error.status === 409 ? 'conflict' : 'failure';
    return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 p-4 flex items-start gap-3"><AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0" /><p>{t(`f3.${key}`)}</p></div>;
  }
  if (count === undefined) return null;
  return <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 p-4 flex items-start gap-3"><CheckCircle2 aria-hidden="true" className="w-5 h-5 shrink-0" /><div><p className="font-semibold">{t(count === 0 ? 'f3.zero' : 'f3.positive', { count })}</p><p className="text-xs mt-1">{t('f3.historyHint')}</p></div></div>;
}

export default function RealReplenishment() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
  const mutation = useMutation(replenishmentMutationOptions(client));
  const [confirming, setConfirming] = useState(false);
  const gate = useRef(createSubmissionGate());
  const dialog = useRef<HTMLDialogElement>(null);
  const allowed = canReplenish(session?.role);
  useEffect(() => { if (confirming) dialog.current?.showModal(); else dialog.current?.close(); }, [confirming]);
  const confirm = () => {
    if (!confirming || !canReplenish(sessionStore.get()?.role)) return;
    void gate.current(async () => {
      try { await mutation.mutateAsync(); } catch { /* Normalized error is rendered below. Never retry. */ }
      finally { setConfirming(false); }
    });
  };
  return <div className="p-4 sm:p-6 space-y-5 min-w-0 font-sans animate-fadeIn">
    <section className="space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3"><div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600"><RefreshCw className="w-5 h-5" /></div><div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{t('f3.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">{t('f3.description')}</p>
        </div></div>
        {allowed && <button className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl px-4 py-2.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed" disabled={mutation.isPending || confirming} onClick={() => { mutation.reset(); setConfirming(true); }} aria-describedby="replenishment-permission"><RefreshCw className={`w-3.5 h-3.5 ${mutation.isPending ? 'animate-spin' : ''}`} />{t(mutation.isPending ? 'f3.pending' : 'f3.run')}</button>}
      </header>
      <p id="replenishment-permission" className={`flex items-start gap-2 text-xs rounded-xl border p-3 ${allowed ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}><ShieldCheck aria-hidden="true" className="w-4 h-4 shrink-0" />{t(allowed ? 'f3.authorization' : 'f3.forbidden')}</p>
      <ReplenishmentFeedback count={mutation.isSuccess ? mutation.data : undefined} error={mutation.error as ApiError | null} />
      <Link className="inline-flex text-xs font-semibold text-blue-700 hover:underline" to="/dashboard/inventory">{t('f3.back')}</Link>
    </section>
    <dialog ref={dialog} aria-labelledby="replenishment-confirm-title" aria-describedby="replenishment-confirm-description" className="m-auto w-[min(32rem,90vw)] rounded-2xl border border-slate-200 p-4 sm:p-6 max-h-[85dvh] overflow-y-auto shadow-xl backdrop:bg-slate-900/40" onCancel={event => { event.preventDefault(); if (!mutation.isPending) setConfirming(false); }}>
      <h2 id="replenishment-confirm-title" className="text-xl font-semibold">{t('f3.confirmTitle')}</h2>
      <p id="replenishment-confirm-description" className="my-4 text-slate-600">{t('f3.confirmDescription')}</p>
      {mutation.isPending && <p role="status" className="my-4">{t('f3.pending')}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
        <button autoFocus className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={mutation.isPending} onClick={() => setConfirming(false)}>{t('f3.cancel')}</button>
        <button className="rounded-lg bg-blue-600 text-white px-4 py-2 disabled:opacity-50" disabled={mutation.isPending || !allowed} onClick={confirm}>{t('f3.confirm')}</button>
      </div>
    </dialog>
    <RealStockVisibility embedded />
  </div>;
}
