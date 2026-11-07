import { useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Truck, Plus, Pencil, Trash2, Eye, RefreshCw } from 'lucide-react';
import { sessionStore } from '../auth/session';
import { adminRead, SupplierRecord } from '../../services/administration/adminApi';
import { PaginatedResult } from '../../services/api/apiTypes';
import { AdminError, adminInput, EditorField, RecordDialog } from './RecordDialog';
import ActionButton from '../../components/common/ActionButton';
import PaginationFooter from '../../components/common/PaginationFooter';

export default function SupplierAdministration() {
  const en = useTranslation().i18n.language.startsWith('en');
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  const allowed = session?.role === 'Admin' || session?.role === 'WarehouseManager';
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<{ id?: string; mode: 'create' | 'edit' | 'delete' | 'detail' } | null>(null);
  const list = useQuery({ queryKey: ['private', 'administration', 'suppliers', page, search], queryFn: ({ signal }) => adminRead<PaginatedResult<SupplierRecord>>('Suppliers', signal, { pageNumber: page, pageSize: 10, searchTerm: search.trim() }), enabled: allowed, retry: false });
  const detail = useQuery({ queryKey: ['private', 'administration', 'supplier', edit?.id], queryFn: ({ signal }) => adminRead<SupplierRecord>(`Suppliers/${edit!.id}`, signal), enabled: allowed && !!edit?.id, retry: false });
  const record = detail.data;
  const fields: EditorField[] = [
    { key: 'code', label: en ? 'Supplier code' : 'Mã nhà cung cấp', value: record?.code, required: true, maxLength: 50 },
    { key: 'name', label: en ? 'Supplier name' : 'Tên nhà cung cấp', value: record?.name, required: true, maxLength: 200 },
    { key: 'email', label: 'Email', value: record?.email, type: 'email', maxLength: 100 },
    { key: 'phone', label: en ? 'Phone' : 'Số điện thoại', value: record?.phone, maxLength: 20 },
    { key: 'address', label: en ? 'Address' : 'Địa chỉ', value: record?.address },
  ];
  if (!allowed) return <div className="p-6"><AdminError error={{ status: 403 }} /></div>;
  return <section className="p-4 sm:p-6 space-y-5 text-slate-900"><header className="flex flex-wrap justify-between gap-3 items-center"><div><h1 className="text-xl font-bold">{en ? 'Suppliers' : 'Nhà cung cấp'}</h1><p className="text-xs text-slate-500 mt-1">{en ? 'Manage supplier identities and contact information.' : 'Quản lý thông tin định danh và liên hệ nhà cung cấp.'}</p></div><div className="flex gap-2"><ActionButton variant="secondary" disabled={list.isFetching} icon={<RefreshCw className="w-4 h-4" />} onClick={() => void list.refetch()}>{en ? 'Refresh' : 'Tải lại'}</ActionButton><ActionButton icon={<Plus className="w-4 h-4" />} onClick={() => setEdit({ mode: 'create' })}>{en ? 'Add supplier' : 'Thêm nhà cung cấp'}</ActionButton></div></header>
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-3 shadow-2xs"><div className="p-3 rounded-xl bg-blue-50 text-blue-600"><Truck className="w-5 h-5" /></div><div><p className="text-xs text-slate-500">{en ? 'Matching suppliers' : 'Nhà cung cấp phù hợp'}</p><p className="font-bold text-2xl mt-1">{list.data?.totalCount ?? '—'}</p></div></div>
    <div className="bg-white border border-slate-200 rounded-2xl p-4"><input className={adminInput} aria-label={en ? 'Search suppliers' : 'Tìm nhà cung cấp'} placeholder={en ? 'Search supplier code or name…' : 'Tìm mã hoặc tên nhà cung cấp…'} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
    {list.isPending && <p role="status" className="text-xs">{en ? 'Loading suppliers…' : 'Đang tải nhà cung cấp…'}</p>}{list.isError && <AdminError error={list.error} />}
    {list.isSuccess && <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden"><h2 className="p-4 font-bold text-sm border-b border-slate-200">{en ? 'Supplier directory' : 'Danh sách nhà cung cấp'}</h2><div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-slate-50 text-slate-500 uppercase text-[10px]"><tr>{[en ? 'Code' : 'Mã', en ? 'Supplier' : 'Nhà cung cấp', 'Email', en ? 'Phone' : 'Điện thoại', en ? 'Address' : 'Địa chỉ', en ? 'Actions' : 'Thao tác'].map(h => <th className="p-4" key={h}>{h}</th>)}</tr></thead><tbody>{list.data.items.map(s => <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="p-4 font-mono font-semibold">{s.code}</td><td className="p-4 font-semibold min-w-40">{s.name}</td><td className="p-4 break-all">{s.email || '—'}</td><td className="p-4 whitespace-nowrap">{s.phone || '—'}</td><td className="p-4 min-w-40">{s.address || '—'}</td><td className="p-3"><div className="flex gap-1">{([['detail', Eye, en ? 'Inspect' : 'Chi tiết'], ['edit', Pencil, en ? 'Edit' : 'Sửa'], ['delete', Trash2, en ? 'Delete' : 'Xóa']] as const).map(([mode, Icon, label]) => <ActionButton key={mode} variant="ghost" isIconOnly size="sm" aria-label={`${label} ${s.code}`} tooltip={label} onClick={() => setEdit({ id: s.id, mode })} icon={<Icon className={`w-3.5 h-3.5 ${mode === 'delete' ? 'text-rose-600' : ''}`} />} />)}</div></td></tr>)}</tbody></table></div>{list.data.items.length === 0 && <p className="p-8 text-sm text-slate-500 text-center">{en ? 'No matching suppliers.' : 'Không có nhà cung cấp phù hợp.'}</p>}<PaginationFooter pageIndex={page} pageSize={10} totalCount={list.data.totalCount} totalPages={list.data.totalPages} onPageChange={setPage} /></div>}
    {edit?.id && detail.isPending && <p role="status" className="text-xs">{en ? 'Loading current supplier…' : 'Đang tải nhà cung cấp hiện tại…'}</p>}{edit?.id && detail.isError && <div className="space-y-2"><AdminError error={detail.error} /><ActionButton variant="secondary" onClick={() => setEdit(null)}>{en ? 'Close' : 'Đóng'}</ActionButton></div>}
    {edit && (!edit.id || detail.isSuccess) && <RecordDialog key={`${edit.mode}-${edit.id ?? 'new'}`} resource="Suppliers" id={edit.id} title={`${edit.mode === 'create' ? (en ? 'Add supplier' : 'Thêm nhà cung cấp') : edit.mode === 'edit' ? (en ? 'Edit supplier' : 'Sửa nhà cung cấp') : edit.mode === 'delete' ? (en ? 'Delete supplier' : 'Xóa nhà cung cấp') : (en ? 'Supplier details' : 'Chi tiết nhà cung cấp')}`} fields={edit.id ? fields : fields.map(f => ({ ...f, value: '' }))} remove={edit.mode === 'delete'} readOnly={edit.mode === 'detail'} onClose={() => setEdit(null)} />}
  </section>;
}
