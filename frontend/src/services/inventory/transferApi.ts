import { httpClient, normalizeApiError } from '../api/httpClient';

export const MAX_TRANSFER_QUANTITY = 2_147_483_647;
// Backend stores an unconstrained string. Keep the operator note bounded in this UI.
export const MAX_TRANSFER_REASON = 500;
export const isTransferGuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
export interface TransferRequest {
  productId: string; sourceBinId: string; destinationBinId: string;
  transferQuantity: number; lotNumber: string; reason: string;
}
export interface TransferRecord {
  id: string; productId: string; productName: string; sku: string; quantityTransferred: number;
  sourceBinCode: string; destinationBinCode: string; reasonCode: string;
  transferredAt: string; transferredBy: string | null;
}
export interface TransferFilter { pageNumber: number; pageSize: number; productId?: string; searchKeyword?: string }
export interface TransferPage {
  items: TransferRecord[]; pageIndex: number; pageSize: number; totalCount: number; totalPages: number;
  hasPreviousPage: boolean; hasNextPage: boolean; firstItemIndex: number; lastItemIndex: number;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const invalid = () => normalizeApiError(502, { code: 'FE_TRANSFER_CONTRACT' });
export function transferRequest(value: TransferRequest): TransferRequest {
  if (!value || ![value.productId, value.sourceBinId, value.destinationBinId].every(isTransferGuid) ||
      value.sourceBinId.toLowerCase() === value.destinationBinId.toLowerCase() ||
      !Number.isInteger(value.transferQuantity) || value.transferQuantity < 1 || value.transferQuantity > MAX_TRANSFER_QUANTITY ||
      typeof value.lotNumber !== 'string' || typeof value.reason !== 'string' ||
      !value.reason.trim() || value.reason.length > MAX_TRANSFER_REASON) throw normalizeApiError(400, { code: 'FE_TRANSFER_VALIDATION' });
  return { productId: value.productId, sourceBinId: value.sourceBinId, destinationBinId: value.destinationBinId,
    transferQuantity: value.transferQuantity, lotNumber: value.lotNumber, reason: value.reason.trim() };
}
function isRecord(value: unknown): value is TransferRecord {
  return object(value) && isTransferGuid(value.id) && isTransferGuid(value.productId) &&
    ['productName', 'sku', 'sourceBinCode', 'destinationBinCode', 'reasonCode', 'transferredAt'].every(key => typeof value[key] === 'string') &&
    Number.isInteger(value.quantityTransferred) && Number(value.quantityTransferred) > 0 && Number(value.quantityTransferred) <= MAX_TRANSFER_QUANTITY &&
    Number.isFinite(Date.parse(String(value.transferredAt))) && (value.transferredBy === null || typeof value.transferredBy === 'string');
}
function unwrap<T>(body: unknown, guard: (value: unknown) => value is T): T {
  if (!object(body) || body.isSuccess !== true || !guard(body.data)) throw invalid();
  return body.data;
}
export const transferApi = {
  async history(filter: TransferFilter, signal?: AbortSignal): Promise<TransferPage> {
    if (!Number.isInteger(filter.pageNumber) || filter.pageNumber < 1 ||
        !Number.isInteger(filter.pageSize) || filter.pageSize < 1 || filter.pageSize > 100 ||
        filter.pageNumber * filter.pageSize > MAX_TRANSFER_QUANTITY ||
        filter.productId !== undefined && !isTransferGuid(filter.productId)) throw normalizeApiError(400);
    const { data } = await httpClient.get('/api/v1/InventoryTransfers', { signal, params: { ...filter } });
    return unwrap(data, (value): value is TransferPage => {
      if (!object(value) || !Array.isArray(value.items) || !value.items.every(isRecord) ||
          value.pageIndex !== filter.pageNumber || value.pageSize !== filter.pageSize ||
          !count(value.totalCount) || !count(value.totalPages)) return false;
      const offset = (filter.pageNumber - 1) * filter.pageSize;
      return value.totalPages === Math.ceil(value.totalCount / filter.pageSize) &&
        value.hasPreviousPage === (filter.pageNumber > 1) && value.hasNextPage === (filter.pageNumber < value.totalPages) &&
        value.items.length === Math.max(0, Math.min(filter.pageSize, value.totalCount - offset)) &&
        value.firstItemIndex === offset + 1 && value.lastItemIndex === Math.min(offset + filter.pageSize, value.totalCount);
    });
  },
  async detail(id: string, signal?: AbortSignal): Promise<TransferRecord> {
    if (!isTransferGuid(id)) throw normalizeApiError(400);
    const { data } = await httpClient.get(`/api/v1/InventoryTransfers/${encodeURIComponent(id)}`, { signal });
    const row = unwrap(data, isRecord);
    if (row.id.toLowerCase() !== id.toLowerCase()) throw invalid();
    return row;
  },
  async create(value: TransferRequest): Promise<string> {
    const body = transferRequest(value);
    const { data } = await httpClient.post('/api/v1/InventoryTransfers', body);
    // A malformed success response has an UNKNOWN mutation outcome, never a safe retry.
    return unwrap(data, isTransferGuid);
  },
};
