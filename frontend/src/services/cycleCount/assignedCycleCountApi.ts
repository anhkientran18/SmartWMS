import { httpClient, normalizeApiError } from '../api/httpClient';
import { sessionStore } from '../../features/auth/session';
import { isDemoMode } from '../../app/dataMode';
import { guid } from '../inbound/inboundApi';

export interface CountAssignee { id: string; username: string; fullName: string }
export interface CountTask { countSheetId: string; itemId: string; sheetNumber: string; binId: string; binCode: string; lotNumber: string; systemQuantity: number; productId: string; sku: string; productName: string; abcClassification: string; scheduledIntervalDays: number; targetZone: string; priorityMessage: string }
export interface CountItem { id: string; binId: string; binCode: string; lotNumber: string; status: string; productId: string; productName: string; sku: string; systemQuantity: number; countedQuantity: number | null; variance: number | null }
export interface CountSheet { id: string; sheetNumber: string; batchCode: string; zoneId: string | null; zoneName: string; binId: string | null; binCode: string; status: string; assignedUserId: string | null; notes: string; createdAt: string; createdBy: string | null; items: CountItem[] }
export interface CreateCount { binId: string | null; zoneId: string | null; assignedUserId: string | null; notes: string }
export interface ConfirmCount { countSheetId: string; notes: string; countedItems: { itemId: string; countedQuantity: number }[] }
export const canManageCounts = (role?: string) => role === 'Admin' || role === 'WarehouseManager';
export const canExecuteCounts = (role?: string) => canManageCounts(role) || role === 'Staff';
export const countQuantity = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 2147483647;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: Record<string, any>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
const nullableGuid = (v: unknown) => v === null || guid(v);
export function countContractError(): never { throw normalizeApiError(502, { code: 'FE_CYCLE_COUNT_CONTRACT' }); }
function authorize(manager = false) { const role = sessionStore.get()?.role; if (isDemoMode || !(manager ? canManageCounts(role) : canExecuteCounts(role))) throw normalizeApiError(403); }
function unwrap(v: unknown): any { if (!object(v) || v.isSuccess !== true) countContractError(); return v.data; }
export function parseCountSheet(v: unknown): CountSheet {
  if (!object(v) || !guid(v.id) || ![v.zoneId, v.binId, v.assignedUserId].every(nullableGuid) ||
    !strings(v, ['sheetNumber','batchCode','zoneName','binCode','status','notes','createdAt']) || !Number.isFinite(Date.parse(v.createdAt)) ||
    !(v.createdBy === null || typeof v.createdBy === 'string') || !Array.isArray(v.items)) countContractError();
  for (const i of v.items) if (!object(i) || ![i.id,i.binId,i.productId].every(guid) ||
    !strings(i,['binCode','lotNumber','status','productName','sku']) || !countQuantity(i.systemQuantity) ||
    !(i.countedQuantity === null || countQuantity(i.countedQuantity)) || !(i.variance === null || Number.isInteger(i.variance))) countContractError();
  if (new Set(v.items.map((i: CountItem) => i.id)).size !== v.items.length) countContractError();
  return v as CountSheet;
}
export function countForm(sheet: CountSheet, values: Record<string, string>) {
  const entered = sheet.items.filter(i => values[i.id]?.trim() !== '' && values[i.id] !== undefined && countQuantity(Number(values[i.id])));
  const unique = new Set(sheet.items.map(i => i.id)).size === sheet.items.length;
  return { entered: entered.length, complete: unique && sheet.items.length > 0 && entered.length === sheet.items.length,
    variance: entered.reduce((sum, i) => sum + Number(values[i.id]) - i.systemQuantity, 0) };
}
export function countSubmission(sheet: CountSheet, values: Record<string, string>, notes: string): ConfirmCount {
  if (!['Pending','Counting'].includes(sheet.status) || !countForm(sheet, values).complete) countContractError();
  return { countSheetId: sheet.id, notes, countedItems: sheet.items.map(i => ({ itemId: i.id, countedQuantity: Number(values[i.id]) })) };
}
export const assignedCountApi = {
  assignees: async (signal?: AbortSignal): Promise<CountAssignee[]> => {
    authorize(true); const v = unwrap((await httpClient.get('/api/v1/CycleCounting/assignees', { signal })).data);
    if (!Array.isArray(v) || v.some(x => !object(x) || !guid(x.id) || !strings(x,['username','fullName']))) countContractError();
    return v.map(({ id,username,fullName }) => ({ id,username,fullName }));
  },
  pendingTasks: async (signal?: AbortSignal): Promise<CountTask[]> => {
    authorize(); const v = unwrap((await httpClient.get('/api/v1/CycleCounting/pending-tasks', { signal })).data);
    if (!Array.isArray(v) || v.some(x => !object(x) || ![x.countSheetId,x.itemId,x.binId,x.productId].every(guid) ||
      !strings(x,['sheetNumber','binCode','lotNumber','sku','productName','abcClassification','targetZone','priorityMessage']) ||
      !countQuantity(x.systemQuantity) || !countQuantity(x.scheduledIntervalDays))) countContractError();
    return v;
  },
  detail: async (id: string, signal?: AbortSignal) => {
    authorize(); if (!guid(id)) countContractError();
    const sheet = parseCountSheet(unwrap((await httpClient.get(`/api/v1/CycleCounting/${id}`, { signal })).data));
    if (sheet.id !== id) countContractError(); return sheet;
  },
  create: async (body: CreateCount): Promise<string> => {
    authorize(true);
    const { binId,zoneId,assignedUserId,notes } = body;
    if (![binId,zoneId,assignedUserId].every(nullableGuid) || (!binId && !zoneId) || typeof notes !== 'string') countContractError();
    const id = unwrap((await httpClient.post('/api/v1/CycleCounting/create-sheet', { requestData: { binId,zoneId,assignedUserId,notes } })).data);
    if (!guid(id)) countContractError(); return id;
  },
  confirm: async (body: ConfirmCount) => {
    authorize(); const { countSheetId,notes,countedItems } = body;
    if (!guid(countSheetId) || typeof notes !== 'string' || !countedItems.length || new Set(countedItems.map(i => i.itemId)).size !== countedItems.length || countedItems.some(i => !guid(i.itemId) || !countQuantity(i.countedQuantity))) countContractError();
    if (unwrap((await httpClient.post('/api/v1/CycleCounting/confirm', { countSheetId,notes,countedItems: countedItems.map(({ itemId,countedQuantity }) => ({ itemId,countedQuantity })) })).data) !== true) countContractError();
  },
};
