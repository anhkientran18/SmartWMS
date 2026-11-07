import { httpClient, normalizeApiError } from '../api/httpClient';
import { Result } from '../api/apiTypes';

export interface WarehouseRecord { id: string; code: string; name: string; address: string; defaultStagingBinId: string | null }
export interface ZoneRecord { id: string; code: string; name: string; warehouseId: string }
export interface BinRecord { id: string; code: string; zoneId: string; purpose: number; maxCapacity: number; currentOccupancy: number }
export interface SupplierRecord { id: string; code: string; name: string; email: string | null; phone: string | null; address: string | null }
export type AdminResource = 'Warehouses' | 'Zones' | 'Bins' | 'Suppliers' | 'Users';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: Record<string, unknown>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
export function validAdminData(path: string, value: unknown): boolean {
  const [resource, action] = path.split('/');
  const row = (v: unknown) => {
    if (!object(v) || typeof v.id !== 'string') return false;
    if (resource === 'Warehouses') return strings(v, ['code', 'name']) && (v.address == null || typeof v.address === 'string');
    if (resource === 'Zones') return strings(v, ['code', 'name', 'warehouseId']);
    if (resource === 'Bins') return strings(v, ['code', 'zoneId']) && [0, 1].includes(Number(v.purpose)) && ['maxCapacity', 'currentOccupancy'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && Number(v[k]) >= 0);
    if (resource === 'Suppliers') return strings(v, ['code', 'name']) && ['email', 'phone', 'address'].every(k => v[k] == null || typeof v[k] === 'string');
    if (resource === 'Users') return strings(v, ['username', 'firstName', 'lastName', 'fullName', 'email']) && ['Admin', 'WarehouseManager', 'Staff'].includes(String(v.role)) && typeof v.isActive === 'boolean';
    if (resource === 'AuditLogs') return strings(v, ['userId', 'type', 'tableName', 'dateTime', 'affectedColumns']) && ['oldValues', 'newValues', 'ipAddress'].every(k => v[k] === null || typeof v[k] === 'string');
    return false;
  };
  if (action === 'list') return Array.isArray(value) && value.every(row);
  if (action) return row(value);
  const totalKey = resource === 'Users' ? 'totalRecords' : 'totalCount';
  return object(value) && Array.isArray(value.items) && value.items.every(row) && Number.isInteger(value[totalKey]) && Number(value[totalKey]) >= 0 && Number.isInteger(value.totalPages) && Number(value.totalPages) >= 0;
}
export async function adminRead<T>(path: string, signal?: AbortSignal, params?: Record<string, unknown>): Promise<T> {
  const { data } = await httpClient.get<Result<T>>(`/api/v1/${path}`, { signal, params });
  if (data?.isSuccess !== true || !validAdminData(path, data.data)) throw normalizeApiError(502, { code: 'FE_ADMIN_CONTRACT' });
  return data.data;
}
export async function adminWrite(resource: AdminResource, payload: Record<string, unknown>, id?: string): Promise<string | boolean> {
  const path = `/api/v1/${resource}${id ? `/${encodeURIComponent(id)}` : ''}`;
  const { data } = id ? await httpClient.put<Result<boolean>>(path, { ...payload, id }) : await httpClient.post<Result<string>>(path, payload);
  if (data?.isSuccess !== true || (id ? data.data !== true : typeof data.data !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(data.data))) throw normalizeApiError(502, { code: 'FE_ADMIN_CONTRACT' });
  return data.data;
}
export async function adminDelete(resource: AdminResource, id: string): Promise<void> {
  const { data } = await httpClient.delete<Result<boolean>>(`/api/v1/${resource}/${encodeURIComponent(id)}`);
  if (data?.isSuccess !== true || data.data !== true) throw normalizeApiError(502);
}
