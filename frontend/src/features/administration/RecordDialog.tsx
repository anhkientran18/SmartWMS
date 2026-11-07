import { FormEvent, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { X, Save } from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import { AdminResource, adminDelete, adminWrite } from '../../services/administration/adminApi';
import { ApiError } from '../../services/api/apiTypes';

export interface EditorField { key: string; label: string; value?: string | number | boolean | null; type?: 'text' | 'email' | 'number' | 'password' | 'checkbox'; required?: boolean; maxLength?: number; minLength?: number; min?: number; options?: { value: string; label: string }[]; disabled?: boolean }
export const adminInput = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20';
export function AdminError({ error }: { error: unknown }) {
  const en = useTranslation().i18n.language.startsWith('en');
  const e = error as ApiError;
  const message = e?.status === 403 ? (en ? 'You do not have permission for this action.' : 'Bạn không có quyền thực hiện thao tác này.') : e?.status === 409 ? (en ? 'The record changed or has dependencies. Reload and review before retrying.' : 'Dữ liệu đã thay đổi hoặc có ràng buộc. Tải lại và kiểm tra trước khi thử lại.') : e?.status === 400 ? (en ? 'Check the required fields, duplicate codes and related records. The server rejected this operation.' : 'Kiểm tra trường bắt buộc, mã trùng và dữ liệu liên quan. Máy chủ đã từ chối thao tác.') : (en ? 'The result could not be confirmed. Refresh the list and inspect the record before submitting again.' : 'Chưa xác nhận được kết quả. Tải lại danh sách và kiểm tra dữ liệu trước khi gửi lại.');
  return <div role="alert" className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs leading-5"><p>{message}</p>{e?.code && <p className="font-mono mt-1">{e.code}</p>}{!en && e?.status === 400 && <p>{e.message}</p>}</div>;
}
export function RecordDialog({ resource, title, id, fields, onClose, remove = false, readOnly = false, extra, transform }: { resource: AdminResource; title: string; id?: string; fields: EditorField[]; onClose: () => void; remove?: boolean; readOnly?: boolean; extra?: Record<string, unknown>; transform?: (value: Record<string, unknown>) => Record<string, unknown> }) {
  const en = useTranslation().i18n.language.startsWith('en');
  const client = useQueryClient();
  const lock = useRef(false);
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map(f => [f.key, f.value ?? (f.type === 'checkbox' ? false : '')])));
  const mutation = useMutation({ retry: false, mutationKey: ['private', 'administration', resource], mutationFn: async () => {
    if (remove && id) return adminDelete(resource, id);
    const payload = Object.fromEntries(fields.filter(f => !f.disabled).map(f => [f.key, f.type === 'number' ? Number(values[f.key]) : f.type === 'password' ? values[f.key] : typeof values[f.key] === 'string' ? String(values[f.key]).trim() : values[f.key]]));
    return adminWrite(resource, transform ? transform({ ...payload, ...extra }) : { ...payload, ...extra }, id);
  }, onSuccess: async () => { await client.invalidateQueries({ queryKey: ['private'] }); onClose(); }, onSettled: () => { lock.current = false; } });
  const uncertain = mutation.isError && (!(mutation.error as ApiError)?.status || ((mutation.error as ApiError).status ?? 0) >= 500);
  function submit(e: FormEvent) { e.preventDefault(); if (lock.current || uncertain) return; lock.current = true; mutation.mutate(); }
  return <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onKeyDown={e => { if (e.key === 'Escape' && !mutation.isPending) onClose(); }}><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="record-dialog-title" className="w-full max-w-xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3"><h2 id="record-dialog-title" className="font-bold text-base">{title}</h2><button type="button" aria-label={en ? 'Close dialog' : 'Đóng hộp thoại'} disabled={mutation.isPending} onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button></div>
    <div className="p-6 space-y-4 overflow-y-auto">{remove ? <p className="text-sm text-slate-600">{en ? 'Delete this record? Related history or dependent records may prevent deletion. This does not move or dispose of inventory.' : 'Xóa bản ghi này? Lịch sử hoặc dữ liệu phụ thuộc có thể ngăn thao tác xóa. Thao tác không di chuyển hoặc hủy tồn kho.'}</p> : fields.map((f, index) => <label key={f.key} className="block text-xs font-semibold space-y-2"><span>{f.label}{f.required && ' *'}</span>{f.type === 'checkbox' ? <input type="checkbox" disabled={f.disabled || readOnly || mutation.isPending} checked={!!values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.checked }))} className="ml-3 accent-blue-600" /> : f.options ? <select autoFocus={index === 0} disabled={f.disabled || readOnly || mutation.isPending} required={f.required} className={adminInput} value={String(values[f.key])} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}><option value="">{en ? 'Select…' : 'Chọn…'}</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input autoFocus={index === 0} autoComplete={f.type === 'password' ? 'new-password' : 'off'} disabled={f.disabled || readOnly || mutation.isPending} type={f.type || 'text'} required={f.required} maxLength={f.maxLength} minLength={f.minLength} min={f.min} step={f.type === 'number' ? 'any' : undefined} className={adminInput} value={String(values[f.key])} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />}</label>)}{mutation.isError && <AdminError error={mutation.error} />}</div>
    <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2"><ActionButton variant="secondary" disabled={mutation.isPending} onClick={onClose}>{en ? 'Close' : 'Đóng'}</ActionButton>{!readOnly && <ActionButton type="submit" variant={remove ? 'destructive' : 'primary'} isLoading={mutation.isPending} disabled={uncertain} icon={!remove && <Save className="w-4 h-4" />}>{remove ? (en ? 'Delete' : 'Xóa') : (en ? 'Save changes' : 'Lưu thay đổi')}</ActionButton>}</footer>
  </form></div>;
}
