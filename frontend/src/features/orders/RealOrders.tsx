import { Link, useSearchParams } from 'react-router-dom';
import { sessionStore } from '../auth/session';
import { useTranslation } from 'react-i18next';
import { useIsMutating } from '@tanstack/react-query';
import { Inbox, Truck } from 'lucide-react';
import RealInbound from '../inbound/RealInbound';
import RealOutbound from '../outbound/RealOutbound';

export default function RealOrders() {
  const { t, i18n } = useTranslation(); const [params, setParams] = useSearchParams(); const outbound = params.get('flow') === 'outbound'; const writing = useIsMutating() > 0;
  const flowNavigation = <nav aria-label={t('f5.orderFlows')} className="min-w-0"><div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">{[false, true].map(value => { const Icon = value ? Truck : Inbox; return <button key={String(value)} disabled={writing} aria-pressed={outbound === value} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 ${outbound === value ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500'}`} onClick={() => setParams(value ? { flow: 'outbound' } : {})}><Icon className="w-4 h-4" />{t(value ? 'f5.outboundTab' : 'f4.inboundTab')}</button>; })}</div></nav>;
  return outbound ? <RealOutbound flowNavigation={flowNavigation} /> : <RealInbound initialReceiptId={params.get('receiptId') || ''} flowNavigation={<div className="flex flex-wrap items-center gap-3">{flowNavigation}{sessionStore.get()?.role !== 'Staff' && <Link className="bg-blue-600 text-white rounded-xl px-3 py-2 text-xs font-semibold" to="/dashboard/orders/inbound/create">{i18n.language.startsWith('en') ? 'Create receipt' : 'Tạo phiếu nhập kho'}</Link>}</div>} />;
}
