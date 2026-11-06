import { httpClient, normalizeApiError } from '../api/httpClient';
import { isDemoMode } from '../../app/dataMode';
import { sessionStore } from '../../features/auth/session';
import i18n from '../../i18n';

export interface ReceiptItem { id: string; productId: string; productName: string; quantityExpected: number; quantityReceived: number; lotNumber: string; expirationDate: string | null }
export interface Receipt { id: string; receiptNumber: string; status: string; supplierId: string | null; supplierName: string; binId: string | null; expectedDeliveryDate: string; referenceDocument: string; notes: string; items: ReceiptItem[] }
export interface ReceiveRequest { inboundReceiptId: string; receivedItems: { itemId: string; quantityReceived: number; expectedReceivedQuantity: number }[] }
export interface Suggestion { binId: string; binCode: string; zoneName: string; availableSpaceBeforePutaway: number }
export interface PutawayRequest { productId: string; sourceBinId: string; destinationBinId: string; transferQuantity: number; lotNumber: string; reason: string }
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const guid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v) && v !== '00000000-0000-0000-0000-000000000000';
const integer = (v: unknown): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 2147483647;
const strings = (v: Record<string, any>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function contractError(): never { throw { code: 'FE_INBOUND_CONTRACT', message: i18n.t('f4.contractError') }; }
export const canExecuteInbound = (role?: string) => ['Admin', 'WarehouseManager', 'Staff'].includes(role ?? '');
function authorize() { if (isDemoMode || !canExecuteInbound(sessionStore.get()?.role)) throw normalizeApiError(403); }
export function receipt(value: unknown): Receipt {
  if (!object(value) || !guid(value.id) || !strings(value, ['receiptNumber', 'status', 'supplierName', 'referenceDocument', 'notes']) ||
    !(value.supplierId === null || guid(value.supplierId)) || !(value.binId === null || guid(value.binId)) || !date(value.expectedDeliveryDate) || !Array.isArray(value.items)) contractError();
  for (const item of value.items) {
    if (!object(item) || !guid(item.id) || !guid(item.productId) || !strings(item, ['productName', 'lotNumber']) ||
      !integer(item.quantityExpected) || item.quantityExpected <= 0 || !integer(item.quantityReceived) || item.quantityReceived > item.quantityExpected ||
      !(item.expirationDate === null || date(item.expirationDate))) contractError();
  }
  if (new Set(value.items.map((i: ReceiptItem) => i.id)).size !== value.items.length) contractError();
  return value as unknown as Receipt;
}
function unwrap(value: unknown): unknown { if (!object(value) || value.isSuccess !== true) contractError(); return value.data; }
const statuses = new Map([['New', 'new'], ['Pending', 'pending'], ['Processing', 'processing'], ['Completed', 'completed'], ['Draft', 'draft']]);
export const statusKey = (status: string) => statuses.get(status);
export const canReceive = (r: Receipt) => !!r.binId && ['New', 'Pending', 'Processing'].includes(r.status) && r.items.some(i => i.quantityReceived < i.quantityExpected);
export function receiveRequest(r: Receipt, deltas: Record<string, number>): ReceiveRequest {
  if (!canReceive(r) || Object.keys(deltas).some(id => !r.items.some(i => i.id === id))) contractError();
  const receivedItems = r.items.flatMap(item => {
    const quantityReceived = deltas[item.id] ?? 0;
    if (!integer(quantityReceived) || quantityReceived > item.quantityExpected - item.quantityReceived) contractError();
    return quantityReceived === 0 ? [] : [{ itemId: item.id, quantityReceived, expectedReceivedQuantity: item.quantityReceived }];
  });
  if (!receivedItems.length) contractError();
  return { inboundReceiptId: r.id, receivedItems };
}
export const inboundApi = {
  list: async (signal?: AbortSignal) => {
    authorize(); const value = unwrap((await httpClient.get('/api/v1/InboundReceipts/list', { signal })).data);
    if (!Array.isArray(value)) contractError(); return value.map(receipt);
  },
  detail: async (id: string, signal?: AbortSignal) => {
    authorize(); if (!guid(id)) contractError();
    const value = receipt(unwrap((await httpClient.get(`/api/v1/InboundReceipts/${id}`, { signal })).data));
    if (value.id !== id) contractError(); return value;
  },
  receive: async (body: ReceiveRequest) => {
    authorize();
    if (!guid(body.inboundReceiptId) || !body.receivedItems.length || new Set(body.receivedItems.map(i => i.itemId)).size !== body.receivedItems.length ||
      body.receivedItems.some(i => !guid(i.itemId) || !integer(i.quantityReceived) || i.quantityReceived === 0 || !integer(i.expectedReceivedQuantity))) contractError();
    const payload = { inboundReceiptId: body.inboundReceiptId, receivedItems: body.receivedItems.map(({ itemId, quantityReceived, expectedReceivedQuantity }) => ({ itemId, quantityReceived, expectedReceivedQuantity })) };
    if (unwrap((await httpClient.post('/api/v1/InboundReceipts/confirm-receipt', payload)).data) !== true) contractError();
  },
  suggestion: async (sku: string, quantity: number, signal?: AbortSignal): Promise<Suggestion> => {
    authorize(); if (!sku || !integer(quantity) || quantity === 0) contractError();
    const value = unwrap((await httpClient.get('/api/v1/InboundReceipts/putaway-suggestion', { params: { sku, quantity }, signal })).data);
    if (!object(value) || !guid(value.binId) || !strings(value, ['binCode', 'zoneName']) || typeof value.availableSpaceBeforePutaway !== 'number' || !Number.isFinite(value.availableSpaceBeforePutaway) || value.availableSpaceBeforePutaway < 0) contractError();
    return value as unknown as Suggestion;
  },
  putaway: async (body: PutawayRequest) => {
    authorize();
    if (![body.productId, body.sourceBinId, body.destinationBinId].every(guid) || body.sourceBinId === body.destinationBinId || !integer(body.transferQuantity) || body.transferQuantity === 0 || typeof body.lotNumber !== 'string' || !body.reason.trim()) contractError();
    const { productId, sourceBinId, destinationBinId, transferQuantity, lotNumber, reason } = body;
    const value = unwrap((await httpClient.post('/api/v1/InventoryTransfers', { productId, sourceBinId, destinationBinId, transferQuantity, lotNumber, reason })).data);
    if (!guid(value)) contractError(); return value;
  },
};
