import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { User, ShieldCheck, Globe, LogOut, Settings } from 'lucide-react';
import { expiresAt, sessionStore } from './session';
import ActionButton from '../../components/common/ActionButton';

export function LocalPreferences() {
  const { i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [changed, setChanged] = useState(false);
  return <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
    <h2 className="p-5 border-b border-slate-100 flex items-center gap-2 text-xs font-bold uppercase tracking-wide"><Globe className="w-4 h-4 text-blue-600" />{en ? 'Local interface preferences' : 'Tùy chọn giao diện cục bộ'}</h2>
    <div className="p-5 space-y-3"><label htmlFor="account-language" className="block text-xs font-semibold">{en ? 'Interface language' : 'Ngôn ngữ giao diện'}</label>
      <select id="account-language" value={en ? 'en-US' : 'vi-VN'} onChange={e => { void i18n.changeLanguage(e.target.value); setChanged(true); }} className="w-full max-w-md border border-slate-300 rounded-lg p-2.5 text-sm bg-white"><option value="vi-VN">Tiếng Việt</option><option value="en-US">English</option></select>
      <p className="text-xs leading-5 text-slate-500">{en ? 'Saved in this browser. This preference does not change server or other users’ settings.' : 'Được lưu trên trình duyệt này. Tùy chọn không thay đổi cấu hình máy chủ hoặc người dùng khác.'}</p>
      {changed && <p role="status" className="text-xs text-emerald-700">{en ? 'Interface language updated for this browser.' : 'Đã cập nhật ngôn ngữ giao diện cho trình duyệt này.'}</p>}
    </div></div>;
}

export default function AccountOverview({ onLogout, settings = false }: { onLogout: () => void; settings?: boolean }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const [confirm, setConfirm] = useState(false);
  if (!session) return null;
  return <section className="p-4 sm:p-6 space-y-5 text-slate-900">
    <header className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs"><div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">{settings ? <Settings /> : <User />}</div><div><h1 className="text-xl font-bold">{settings ? (en ? 'Interface preferences' : 'Tùy chọn giao diện') : (en ? 'Account overview' : 'Thông tin tài khoản')}</h1><p className="text-xs text-slate-500 mt-1">{en ? 'Your signed-in identity and browser-local preferences.' : 'Thông tin đăng nhập và tùy chọn giao diện trên trình duyệt.'}</p></div></header>
    {settings ? <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6"><div className="text-blue-600 text-xs font-semibold rounded-xl bg-blue-50 p-4 self-start flex items-center gap-2"><Settings className="w-4 h-4" />{en ? 'General preferences' : 'Tùy chọn chung'}</div><LocalPreferences /></div> : <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-5 items-start">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden"><h2 className="p-5 text-xs font-bold uppercase border-b border-slate-100">{en ? 'Account information' : 'Thông tin tài khoản'}</h2><div className="p-6 text-center"><div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">{(session.fullName || session.username).split(' ').map(s => s[0]).slice(0, 2).join('')}</div><h2 className="font-bold text-lg mt-3 break-words">{session.fullName || session.username}</h2><p className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 text-xs font-semibold">{t(`f1.roles.${session.role}`)}</p></div><dl className="p-5 border-t border-slate-100 space-y-4 text-xs">{[[en ? 'Username' : 'Tên đăng nhập', session.username], [en ? 'Role identifier' : 'Mã vai trò', session.role]].map(([label, value]) => <div key={label}><dt className="text-slate-500 mb-1">{label}</dt><dd className="font-semibold break-all">{value}</dd></div>)}</dl></div>
      <div className="space-y-5"><div className="bg-white border border-slate-200 rounded-2xl shadow-2xs"><h2 className="p-5 border-b border-slate-100 flex gap-2 text-xs font-bold uppercase"><ShieldCheck className="w-4 h-4 text-blue-600" />{en ? 'Current session' : 'Phiên đăng nhập hiện tại'}</h2><div className="p-5 space-y-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="text-slate-500">{en ? 'Session expiry' : 'Hết hạn phiên'}</span><span className="font-mono">{new Date(expiresAt(session.token)).toLocaleString(i18n.language)}</span></div><p className="text-slate-500 leading-5">{en ? 'Signing out clears this application’s local session and private cached data.' : 'Đăng xuất sẽ xóa phiên cục bộ và dữ liệu riêng được lưu tạm trong ứng dụng.'}</p></div></div><LocalPreferences /><div className="flex flex-wrap justify-between gap-3"><Link to="/dashboard/settings" className="text-xs text-blue-600 font-semibold inline-flex items-center gap-2"><Settings className="w-4 h-4" />{en ? 'Interface preferences' : 'Tùy chọn giao diện'}</Link><ActionButton variant="destructive" icon={<LogOut className="w-4 h-4" />} onClick={() => setConfirm(true)}>{t('header.logout')}</ActionButton></div></div>
    </div>}
    {confirm && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape') setConfirm(false); }}><div role="dialog" aria-modal="true" aria-labelledby="account-logout-title" className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"><h2 id="account-logout-title" className="font-bold">{en ? 'Confirm sign out' : 'Xác nhận đăng xuất'}</h2><p className="text-xs text-slate-500 leading-5 my-4">{en ? 'Sign out of SmartWMS in this browser?' : 'Đăng xuất khỏi SmartWMS trên trình duyệt này?'}</p><div className="flex justify-end gap-2"><ActionButton autoFocus variant="secondary" onClick={() => setConfirm(false)}>{en ? 'Cancel' : 'Hủy bỏ'}</ActionButton><ActionButton variant="destructive" onClick={onLogout}>{t('header.logout')}</ActionButton></div></div></div>}
  </section>;
}
