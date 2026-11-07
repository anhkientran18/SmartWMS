import { httpClient, normalizeApiError } from '../api/httpClient';
import { sessionStore } from '../../features/auth/session';
import { isDemoMode } from '../../app/dataMode';
import { guid } from '../inbound/inboundApi';

export interface Reservation { id: string; allocationId: string; sourceBinInventoryId: string; lotNumber: string | null; expirationDate: string | null; quantity: number; pickedQuantity: number; shippedQuantity: number; releasedQuantity: number; status: string }
export interface OutboundLine { id: string; productId: string; productName: string; sku: string; quantity: number; isDirectPick: boolean; trackingModeSnapshot: number | null; reservedQuantity: number; pickedQuantity: number; shippedQuantity: number; status: string; reservations: Reservation[] }
export interface Outbound { id: string; orderNumber: string; isDirectPick: boolean; customerId: string | null; customerName: string; binId: string; status: string; createdAt: string; createdBy: string | null; items: OutboundLine[] }
export interface OutboundFilter { pageNumber: number; pageSize: number; searchTerm?: string; customerId?: string }
export interface OutboundPage { items: Outbound[]; pageIndex: number; pageSize: number; totalCount: number; totalPages: number }
export interface Customer { id: string; code: string; name: string }
export interface CreateOutbound { orderNumber: string; customerId: string | null; binId: string; expectedShipDate: string; priority: string; notes: string; items: { productId: string; requestedQuantity: number }[] }
export type OutboundAction = 'allocate' | 'pick' | 'pack' | 'ship' | 'cancel';
export interface OutboundCommand { id: string; action: OutboundAction; items?: { reservationId: string; quantity: number }[] }
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 2147483647;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function outboundContractError(): never { throw normalizeApiError(502, { code: 'FE_OUTBOUND_CONTRACT' }); }
export const canExecuteOutbound = (role?: string) => ['Admin', 'WarehouseManager', 'Staff'].includes(role ?? '');
function authorize() { if (isDemoMode || !canExecuteOutbound(sessionStore.get()?.role)) throw normalizeApiError(403); }
function unwrap(v: unknown): any { if (!object(v) || v.isSuccess !== true) outboundContractError(); return v.data; }
export const outboundStatuses = ['Pending', 'Allocated', 'Picked', 'Packed', 'Shipped', 'Cancelled', 'Waved'] as const;
export const outboundStatusKey = (s: string) => outboundStatuses.find(value => value === s);
export function outboundOrder(v: unknown): Outbound {
  if (!object(v) || !guid(v.id) || !guid(v.binId) || !(v.customerId === null || guid(v.customerId)) ||
    !['orderNumber', 'customerName', 'status'].every(k => typeof v[k] === 'string') || typeof v.isDirectPick !== 'boolean' ||
    !date(v.createdAt) || !(v.createdBy === null || typeof v.createdBy === 'string') || !Array.isArray(v.items)) outboundContractError();
  const reservationIds = new Set<string>();
  for (const line of v.items) {
    if (!object(line) || !guid(line.id) || !guid(line.productId) || !['productName', 'sku', 'status'].every(k => typeof line[k] === 'string') ||
      typeof line.isDirectPick !== 'boolean' || !(line.trackingModeSnapshot === null || [0, 1, 2].includes(line.trackingModeSnapshot)) ||
      !count(line.quantity) || line.quantity === 0 || !['reservedQuantity', 'pickedQuantity', 'shippedQuantity'].every(k => count(line[k]) && line[k] <= line.quantity) ||
      line.shippedQuantity > line.pickedQuantity || !Array.isArray(line.reservations)) outboundContractError();
    for (const r of line.reservations) {
      if (!object(r) || ![r.id, r.allocationId, r.sourceBinInventoryId].every(guid) || reservationIds.has(r.id) ||
        !(r.lotNumber === null || typeof r.lotNumber === 'string') || !(r.expirationDate === null || date(r.expirationDate)) ||
        typeof r.status !== 'string' || !count(r.quantity) || r.quantity === 0 ||
        !['pickedQuantity', 'shippedQuantity', 'releasedQuantity'].every(k => count(r[k]) && r[k] <= r.quantity) ||
        r.shippedQuantity > r.pickedQuantity || r.releasedQuantity + r.pickedQuantity > r.quantity) outboundContractError();
      reservationIds.add(r.id);
    }
  }
  if (new Set(v.items.map((line: OutboundLine) => line.id)).size !== v.items.length) outboundContractError();
  return v as Outbound;
}
export function availableOutboundActions(order: Outbound): OutboundAction[] {
  if (!order.isDirectPick || !order.items.length || order.items.some(l => !l.isDirectPick || l.trackingModeSnapshot === 2)) return [];
  switch (order.status) {
    case 'Pending': return ['allocate', 'cancel'];
    case 'Allocated': return ['pick', 'cancel'];
    case 'Picked': return ['pack'];
    case 'Packed': return ['ship'];
    default: return [];
  }
}
export function outboundCommand(order: Outbound, action: OutboundAction): OutboundCommand {
  if (!availableOutboundActions(order).includes(action)) outboundContractError();
  if (action !== 'pick') return { id: order.id, action };
  const reservations = order.items.flatMap(l => l.reservations);
  if (!reservations.length || order.items.some(l => l.reservedQuantity !== l.quantity || l.pickedQuantity !== 0 ||
    l.reservations.reduce((n, r) => n + r.quantity, 0) !== l.quantity) ||
    reservations.some(r => r.status !== 'Active' || r.pickedQuantity !== 0 || r.releasedQuantity !== 0)) outboundContractError();
  return { id: order.id, action, items: reservations.map(r => ({ reservationId: r.id, quantity: r.quantity })) };
}
export function validateOutboundCreate(body: CreateOutbound) {
  const today = new Date().toISOString().slice(0, 10);
  if (!body.orderNumber.trim() || body.orderNumber.length > 50 || !guid(body.binId) || !(body.customerId === null || guid(body.customerId)) ||
    !date(body.expectedShipDate) || Date.parse(body.expectedShipDate) < Date.parse(`${today}T00:00:00Z`) ||
    !['Normal', 'High', 'Urgent'].includes(body.priority) || typeof body.notes !== 'string' || !body.items.length ||
    body.items.some(l => !guid(l.productId) || !count(l.requestedQuantity) || l.requestedQuantity === 0)) outboundContractError();
  return body;
}
export const outboundApi = {
  list: async (filter: OutboundFilter, signal?: AbortSignal): Promise<OutboundPage> => {
    authorize();
    if (!count(filter.pageNumber) || !filter.pageNumber || !count(filter.pageSize) || !filter.pageSize || filter.pageSize > 100 || (filter.customerId && !guid(filter.customerId))) outboundContractError();
    const v = unwrap((await httpClient.get('/api/v1/OutboundOrders', { params: { ...filter }, signal })).data);
    if (!object(v) || !Array.isArray(v.items) || ![v.pageIndex, v.pageSize, v.totalCount, v.totalPages].every(count) ||
      v.pageIndex !== filter.pageNumber || v.pageSize !== filter.pageSize || v.totalPages !== Math.ceil(v.totalCount / v.pageSize) || v.items.length > v.pageSize) outboundContractError();
    return { ...v, items: v.items.map(outboundOrder) } as OutboundPage;
  },
  detail: async (id: string, signal?: AbortSignal) => {
    authorize(); if (!guid(id)) outboundContractError();
    const v = outboundOrder(unwrap((await httpClient.get(`/api/v1/OutboundOrders/${id}`, { signal })).data));
    if (v.id !== id) outboundContractError(); return v;
  },
  customers: async (signal?: AbortSignal): Promise<Customer[]> => {
    authorize(); const v = unwrap((await httpClient.get('/api/v1/Customers/list', { signal })).data);
    if (!Array.isArray(v) || v.some(c => !object(c) || !guid(c.id) || typeof c.code !== 'string' || typeof c.name !== 'string')) outboundContractError();
    return v.map(({ id, code, name }) => ({ id, code, name }));
  },
  create: async (body: CreateOutbound) => {
    authorize(); validateOutboundCreate(body);
    const { orderNumber, customerId, binId, expectedShipDate, priority, notes, items } = body;
    const id = unwrap((await httpClient.post('/api/v1/OutboundOrders', { orderNumber, customerId, binId, expectedShipDate, priority, notes, items: items.map(({ productId, requestedQuantity }) => ({ productId, requestedQuantity })) })).data);
    if (!guid(id)) outboundContractError(); return id;
  },
  execute: async (command: OutboundCommand) => {
    authorize(); const { id, action, items } = command;
    if (!guid(id)) outboundContractError();
    let result;
    switch (action) {
      case 'allocate': result = await httpClient.post('/api/v1/OutboundOrders/allocate-pick-task', { outboundOrderId: id }); break;
      case 'pick':
        if (!items?.length || new Set(items.map(r => r.reservationId)).size !== items.length || items.some(r => !guid(r.reservationId) || !count(r.quantity) || !r.quantity)) outboundContractError();
        result = await httpClient.post(`/api/v1/OutboundOrders/${id}/pick`, { items: items.map(({ reservationId, quantity }) => ({ reservationId, quantity })) }); break;
      case 'pack': result = await httpClient.post(`/api/v1/OutboundOrders/${id}/pack`); break;
      case 'ship': result = await httpClient.post(`/api/v1/OutboundOrders/${id}/ship`, {}); break;
      case 'cancel': result = await httpClient.delete(`/api/v1/OutboundOrders/${id}`); break;
      default: outboundContractError();
    }
    if (unwrap(result.data) !== true) outboundContractError();
  },
};
