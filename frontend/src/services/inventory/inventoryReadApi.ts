// F2 audited read contracts. Intentionally independent of prototype providers/local caches.
import { httpClient, normalizeApiError } from '../api/httpClient';
import { Role } from '../../features/auth/session';

export interface StockSummary { totalProducts: number; totalQuantity: number; lowStockItems: number }
export interface LowStockAlert { productId: string; sku: string; productName: string; currentStock: number }
export interface StockHistory {
  id: string; productId: string; productName: string; transactionType: string;
  quantityChanged: number; sourceBinCode: string; destinationBinCode: string;
  reasonCode: string; createdAt: string; createdBy: string | null;
}
export interface HistoryPage {
  items: StockHistory[]; pageIndex: number; pageSize: number; totalCount: number;
  totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean;
}
export interface HistoryFilter { pageIndex: number; pageSize: number; productId?: string; transactionType?: string }
export interface WarehouseRead { id: string; code: string; name: string }
export interface ZoneRead extends WarehouseRead { warehouseId: string }
export interface BinRead { id: string; code: string; zoneId: string; purpose: number; maxCapacity: number; currentOccupancy: number }
// Existing selectors consume a projection; canonical detail requires description.
export interface ProductRead { id: string; sku: string; name: string; barcode: string; unit: string; weight: number; trackingMode: number; description?: string }
export interface ProductDetail extends ProductRead { description: string }
export interface BarcodeResolution { productId: string; sku: string; productName: string; lotNumber: string; expirationDate: string | null; stockStatus: string }
export interface ProductPage { items: ProductRead[]; pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean }
export interface BinStockRow {
  productId: string; sku: string; productName: string; lotNumber: string;
  quantity: number; expirationDate: string; status: string;
}
export interface BinContents {
  binId: string; binCode: string; purpose: number; maxCapacity: number;
  currentOccupancy: number; utilizationPercentage: number; items: BinStockRow[];
}

type Guard<T> = (value: unknown) => value is T;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: Record<string, any>, keys: string[]) => keys.every(k => typeof v[k] === 'string');
const count = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const guid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(v);
const array = <T>(guard: Guard<T>): Guard<T[]> => (v): v is T[] => Array.isArray(v) && v.every(guard);
const purpose = (v: unknown) => v === 0 || v === 1;
const isSummary: Guard<StockSummary> = (v): v is StockSummary => object(v) && ['totalProducts', 'totalQuantity', 'lowStockItems'].every(k => count(v[k]));
const isAlert: Guard<LowStockAlert> = (v): v is LowStockAlert => object(v) && guid(v.productId) && strings(v, ['sku', 'productName']) && count(v.currentStock);
const isHistory: Guard<StockHistory> = (v): v is StockHistory => object(v) && guid(v.id) && guid(v.productId) &&
  strings(v, ['productName', 'transactionType', 'sourceBinCode', 'destinationBinCode', 'reasonCode', 'createdAt']) &&
  Number.isFinite(Date.parse(v.createdAt)) && Number.isSafeInteger(v.quantityChanged) && (v.createdBy === null || typeof v.createdBy === 'string');
const isPage: Guard<HistoryPage> = (v): v is HistoryPage => object(v) && array(isHistory)(v.items) &&
  count(v.pageIndex) && v.pageIndex > 0 && count(v.pageSize) && v.pageSize > 0 && v.pageSize <= 100 &&
  count(v.totalCount) && count(v.totalPages) && v.totalPages === Math.ceil(v.totalCount / v.pageSize) &&
  v.hasPreviousPage === (v.pageIndex > 1) && v.hasNextPage === (v.pageIndex < v.totalPages) && v.items.length <= v.pageSize;
const isWarehouse: Guard<WarehouseRead> = (v): v is WarehouseRead => object(v) && guid(v.id) && strings(v, ['code', 'name']);
const isZone: Guard<ZoneRead> = (v): v is ZoneRead => object(v) && guid(v.warehouseId) && isWarehouse(v);
const isBin: Guard<BinRead> = (v): v is BinRead => object(v) && guid(v.id) && guid(v.zoneId) && strings(v, ['code']) && purpose(v.purpose) && finite(v.maxCapacity) && finite(v.currentOccupancy);
const isProduct: Guard<ProductRead> = (v): v is ProductRead => object(v) && guid(v.id) && strings(v, ['sku', 'name', 'barcode', 'unit']) && finite(v.weight) && [0, 1, 2].includes(v.trackingMode) && (v.description === undefined || typeof v.description === 'string');
const isProductDetail: Guard<ProductDetail> = (v): v is ProductDetail => isProduct(v) && typeof v.description === 'string';
const isResolution: Guard<BarcodeResolution> = (v): v is BarcodeResolution => object(v) && guid(v.productId) && strings(v, ['sku', 'productName', 'lotNumber', 'stockStatus']) &&
  (v.expirationDate === null || typeof v.expirationDate === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v.expirationDate) && Number.isFinite(Date.parse(v.expirationDate)));
export const isProductQr: Guard<string> = (v): v is string => typeof v === 'string' && v.length <= 2_000_000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(v);
export const canReadProducts = (role?: string) => role === 'Admin' || role === 'WarehouseManager' || role === 'Staff';
const isProductPage: Guard<ProductPage> = (v): v is ProductPage => object(v) && array(isProduct)(v.items) &&
  count(v.pageIndex) && v.pageIndex > 0 && count(v.pageSize) && v.pageSize > 0 && count(v.totalCount) && count(v.totalPages) &&
  v.totalPages === Math.ceil(v.totalCount / v.pageSize) && v.items.length <= v.pageSize &&
  v.hasPreviousPage === (v.pageIndex > 1) && v.hasNextPage === (v.pageIndex < v.totalPages);
const isBinRow: Guard<BinStockRow> = (v): v is BinStockRow => object(v) && guid(v.productId) &&
  strings(v, ['sku', 'productName', 'lotNumber', 'expirationDate', 'status']) && count(v.quantity);
const isContents: Guard<BinContents> = (v): v is BinContents => object(v) && guid(v.binId) && strings(v, ['binCode']) && purpose(v.purpose) &&
  finite(v.maxCapacity) && finite(v.currentOccupancy) && finite(v.utilizationPercentage) && array(isBinRow)(v.items);

async function read<T>(route: string, guard: Guard<T>, signal?: AbortSignal, params?: Record<string, unknown>): Promise<T> {
  const { data } = await httpClient.get<unknown>(route, { signal, params });
  if (!object(data) || data.isSuccess !== true || !guard(data.data)) throw normalizeApiError(502, { code: 'FE_INVENTORY_CONTRACT' });
  return data.data;
}
export const canReadBinContext = (role?: Role) => role === 'Admin' || role === 'WarehouseManager';
export const inventoryReadApi = {
  summary: (signal?: AbortSignal) => read('/api/v1/Inventory/stock-summary', isSummary, signal),
  alerts: (signal?: AbortSignal) => read('/api/v1/Inventory/low-stock-alerts', array(isAlert), signal),
  history: (filter: HistoryFilter, signal?: AbortSignal) => read('/api/v1/Inventory/stock-history', isPage, signal, { ...filter }),
  warehouses: (signal?: AbortSignal) => read('/api/v1/Warehouses/list', array(isWarehouse), signal),
  zones: (signal?: AbortSignal) => read('/api/v1/Zones/list', array(isZone), signal),
  bins: (signal?: AbortSignal) => read('/api/v1/Bins/list', array(isBin), signal),
  products: (signal?: AbortSignal) => read('/api/v1/Products/list', array(isProduct), signal),
  product: async (id: string, signal?: AbortSignal) => {
    if (!guid(id)) throw normalizeApiError(400);
    const product = await read(`/api/v1/Products/${encodeURIComponent(id)}`, isProductDetail, signal);
    if (product.id.toLowerCase() !== id.toLowerCase()) throw normalizeApiError(502, { code: 'FE_PRODUCT_CONTRACT' });
    return product;
  },
  productQr: (sku: string, signal?: AbortSignal) => {
    if (!sku.trim() || sku.length > 50) return Promise.reject(normalizeApiError(400));
    return read(`/api/v1/Products/${encodeURIComponent(sku)}/qrcode`, isProductQr, signal);
  },
  resolveBarcode: async (rawBarcodeData: string, signal?: AbortSignal): Promise<BarcodeResolution> => {
    if (!rawBarcodeData.trim() || rawBarcodeData.length > 163) throw normalizeApiError(400);
    const { data } = await httpClient.post<unknown>('/api/v1/Products/parse-barcode', { rawBarcodeData }, { signal });
    if (!object(data) || data.isSuccess !== true || !isResolution(data.data)) throw normalizeApiError(502, { code: 'FE_PRODUCT_CONTRACT' });
    return data.data;
  },
  productsPage: async (pageNumber: number, searchKeyword: string, signal?: AbortSignal) => {
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) throw normalizeApiError(400);
    const page = await read('/api/v1/Products', isProductPage, signal, { pageNumber, pageSize: 20, searchKeyword: searchKeyword.trim() });
    if (page.pageIndex !== pageNumber || page.pageSize !== 20) throw normalizeApiError(502, { code: 'FE_INVENTORY_CONTRACT' });
    return page;
  },
  bin: async (id: string, signal?: AbortSignal) => {
    const value = await read(`/api/v1/Bins/${encodeURIComponent(id)}`, isBin, signal);
    if (value.id !== id) throw normalizeApiError(502, { code: 'FE_INVENTORY_CONTRACT' });
    return value;
  },
  contents: async (id: string, signal?: AbortSignal) => {
    const value = await read(`/api/v1/Bins/${encodeURIComponent(id)}/contents`, isContents, signal);
    if (value.binId !== id) throw normalizeApiError(502, { code: 'FE_INVENTORY_CONTRACT' });
    return value;
  },
};
