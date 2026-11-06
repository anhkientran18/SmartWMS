import { useState, useSyncExternalStore } from 'react';
import { sessionStore } from '../auth/session';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { RefreshCw, Boxes, Gauge, Package, AlertTriangle } from 'lucide-react';
import { httpClient, normalizeApiError } from '../../services/api/httpClient';
import { inventoryQueries } from '../../services/inventory/inventoryQueries';
import ActionButton from '../../components/common/ActionButton';
import KPICard from '../../components/common/KPICard';

interface ChartPoint { dateUtc: string; inboundQuantity: number; outboundQuantity: number }
interface Occupancy { warehouseId: string; warehouseCode: string; warehouseName: string; binCount: number; totalCapacity: number; currentOccupancy: number; occupancyPercentage: number | null }
async function dashboardRead<T>(route: string, signal: AbortSignal): Promise<T[]> {
  const { data } = await httpClient.get(`/api/v1/Dashboard/${route}`, { signal });
  const keys = route.startsWith('warehouse-occupancy') ? ['binCount', 'totalCapacity', 'currentOccupancy'] : ['inboundQuantity', 'outboundQuantity'];
  if (data?.isSuccess !== true || !Array.isArray(data.data) || !data.data.every((row: Record<string, unknown>) => row && keys.every(k => typeof row[k] === 'number' && Number.isFinite(row[k]) && Number(row[k]) >= 0) && (route.startsWith('warehouse-occupancy') ? typeof row.warehouseId === 'string' && typeof row.warehouseName === 'string' && typeof row.warehouseCode === 'string' && (row.occupancyPercentage === null || typeof row.occupancyPercentage === 'number' && Number.isFinite(row.occupancyPercentage)) : typeof row.dateUtc === 'string' && Number.isFinite(Date.parse(row.dateUtc))))) throw normalizeApiError(502);
  return data.data;
}
export default function OperationalDashboard() {
  const { t, i18n } = useTranslation();
  const en = i18n.language.startsWith('en');
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get);
  const canManageLocations = session?.role === 'Admin' || session?.role === 'WarehouseManager';
  const [days, setDays] = useState(7);
  const summary = useQuery(inventoryQueries.summary());
  const alerts = useQuery(inventoryQueries.alerts());
  const occupancy = useQuery({ queryKey: ['private', 'dashboard', 'occupancy'], queryFn: ({ signal }) => dashboardRead<Occupancy>('warehouse-occupancy', signal), retry: false });
  const chart = useQuery({ queryKey: ['private', 'dashboard', 'chart', days], queryFn: ({ signal }) => dashboardRead<ChartPoint>(`inbound-outbound-chart?days=${days}`, signal), retry: false });
  const queries = [summary, alerts, occupancy, chart];
  const capacity = occupancy.data?.reduce((n, w) => n + w.totalCapacity, 0);
  const used = occupancy.data?.reduce((n, w) => n + w.currentOccupancy, 0);
  const rate = capacity && used !== undefined ? `${(used / capacity * 100).toFixed(1)}%` : '—';
  return <section className="p-4 sm:p-6 space-y-5 text-slate-900">
    <header className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs"><div><h1 className="text-xl font-bold">{en ? 'Smart Warehouse Operations Center' : 'Trung Tâm Điều Hành Kho Thông Minh'}</h1><p className="text-xs text-slate-500 mt-1">{en ? 'Physical inventory, storage utilization and operational alerts across warehouses.' : 'Tổng quan tồn kho thực tế, công suất lưu trữ và cảnh báo vận hành toàn kho.'}</p></div><div className="flex flex-wrap gap-2"><Link className="inline-flex items-center h-9 px-3.5 text-xs border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold shadow-2xs transition-colors" to="/dashboard/replenishment">{t('breadcrumbs.replenishment')}</Link><ActionButton variant="secondary" disabled={queries.some(q => q.isFetching)} icon={<RefreshCw className="w-4 h-4" />} onClick={() => queries.forEach(q => void q.refetch())}>{en ? 'Refresh' : 'Tải lại'}</ActionButton></div></header>
    {queries.some(q => q.isPending) && <p role="status" className="text-xs text-slate-500">{en ? 'Loading operational data…' : 'Đang tải dữ liệu vận hành…'}</p>}
    {queries.some(q => q.isError) && <p role="alert" className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{en ? 'Some sections could not load. Refresh to try again; unavailable values are not shown as zero.' : 'Một số mục chưa tải được. Tải lại để thử; dữ liệu chưa có không được hiển thị thành số 0.'}</p>}
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">{[
      [en ? 'Physical stock quantity' : 'Tổng số lượng tồn', summary.data?.totalQuantity.toLocaleString(i18n.language) ?? '—', Boxes],
      [en ? 'Storage utilization' : 'Tỷ lệ lấp đầy', rate, Gauge],
      [en ? 'Products with stock' : 'Sản phẩm có tồn kho', summary.data?.totalProducts.toLocaleString(i18n.language) ?? '—', Package],
      [en ? 'Low-stock products' : 'Sản phẩm tồn thấp', summary.data?.lowStockItems.toLocaleString(i18n.language) ?? '—', AlertTriangle],
    ].map(([label, value, icon], index) => <KPICard appearance="inventory" key={String(label)} label={String(label)} value={String(value)} icon={icon as typeof Boxes} variant={index === 3 ? 'amber' : 'blue'} />)}</div>
    <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-bold">{en ? 'Inbound / outbound quantities' : 'Số lượng nhập / xuất kho'}</h2><select aria-label={en ? 'Chart period' : 'Khoảng thời gian biểu đồ'} className="border border-slate-200 rounded-lg p-2 text-xs" value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90].map(n => <option key={n} value={n}>{n} {en ? 'days' : 'ngày'}</option>)}</select></div><p className="text-xs text-slate-500 mt-1 mb-5">{en ? 'Daily ledger quantities, grouped by UTC date.' : 'Số lượng theo sổ giao dịch mỗi ngày, nhóm theo ngày UTC.'}</p>{chart.data && <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart.data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="dateUtc" tickFormatter={v => String(v).slice(5, 10)} fontSize={10} /><YAxis fontSize={10} /><Tooltip labelFormatter={v => String(v).slice(0, 10)} /><Legend /><Bar dataKey="inboundQuantity" name={en ? 'Inbound' : 'Nhập kho'} fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="outboundQuantity" name={en ? 'Outbound' : 'Xuất kho'} fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}</div>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs"><h2 className="text-sm font-bold mb-4">{en ? 'Low-stock alerts' : 'Cảnh báo tồn kho thấp'}</h2>{alerts.data?.slice(0, 6).map(a => <div key={a.productId} className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 text-xs"><div className="min-w-0"><p className="font-semibold break-words">{a.productName}</p><p className="text-slate-500 font-mono mt-1">{a.sku}</p></div><span className="font-bold text-amber-700">{a.currentStock}</span></div>)}{alerts.data?.length === 0 && <p className="text-xs text-slate-500">{en ? 'No low-stock alerts.' : 'Không có cảnh báo tồn thấp.'}</p>}<Link to="/dashboard/inventory" className="inline-block text-xs text-blue-600 font-semibold mt-4">{en ? 'Open inventory →' : 'Tra cứu tồn kho →'}</Link></div>
    </div>
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs"><h2 className="text-sm font-bold mb-4">{en ? 'Warehouse storage utilization' : 'Mức sử dụng vị trí kho'}</h2><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{occupancy.data?.map(w => <div key={w.warehouseId} className="block p-4 rounded-xl border border-slate-200 bg-slate-50/60"><h3 className="font-semibold text-sm break-words">{canManageLocations ? <Link className="hover:text-blue-600" to={`/dashboard/mdm/warehouses_zones?warehouseId=${w.warehouseId}`}>{w.warehouseName}</Link> : w.warehouseName}</h3><p className="text-xs text-slate-500 mt-1">{w.warehouseCode} · {w.binCount} {en ? 'bins' : 'ô kệ'}</p><div className="h-2 bg-slate-200 rounded-full my-4 overflow-hidden"><div className={`h-full rounded-full ${(w.occupancyPercentage ?? 0) >= 100 ? 'bg-rose-500' : (w.occupancyPercentage ?? 0) > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, w.occupancyPercentage ?? 0))}%` }} /></div><p className="text-xs font-mono">{w.currentOccupancy.toLocaleString(i18n.language)} / {w.totalCapacity.toLocaleString(i18n.language)} · {w.occupancyPercentage === null ? '—' : `${w.occupancyPercentage}%`}</p></div>)}</div>{occupancy.data?.length === 0 && <p className="text-xs text-slate-500">{en ? 'No warehouses configured.' : 'Chưa có nhà kho.'}</p>}</div>
  </section>;
}
