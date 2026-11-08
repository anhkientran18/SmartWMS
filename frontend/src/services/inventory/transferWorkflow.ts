import { BinContents, BinRead, BinStockRow, ProductRead, WarehouseRead, ZoneRead } from './inventoryReadApi';
import { MAX_TRANSFER_QUANTITY, MAX_TRANSFER_REASON, TransferRequest, isTransferGuid } from './transferApi';

export interface TransferDraft {
  warehouseId: string; sourceBinId: string; productId: string; lotNumber: string | null;
  destinationBinId: string; quantity: string; reason: string;
}
export const emptyTransferDraft = (): TransferDraft => ({ warehouseId: '', sourceBinId: '', productId: '',
  lotNumber: null, destinationBinId: '', quantity: '', reason: '' });
export function changeTransferDraft<K extends keyof TransferDraft>(draft: TransferDraft, key: K, value: TransferDraft[K]): TransferDraft {
  const next = { ...draft, [key]: value };
  if (key === 'warehouseId') next.sourceBinId = '';
  if (key === 'warehouseId' || key === 'sourceBinId') next.productId = '';
  if (key === 'warehouseId' || key === 'sourceBinId' || key === 'productId') next.lotNumber = null;
  if (['warehouseId', 'sourceBinId', 'productId', 'lotNumber'].includes(key)) { next.destinationBinId = ''; next.quantity = ''; }
  return next;
}
export interface TransferContext {
  fresh: boolean; warehouses: WarehouseRead[]; zones: ZoneRead[]; bins: BinRead[]; products: ProductRead[]; contents?: BinContents;
}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const canonicalTransferLot = (lot: string) => lot.trim() || 'LOT-DEFAULT';
export function warehouseForBin(id: string, context: TransferContext): string | undefined {
  const bins = context.bins.filter(bin => same(bin.id, id));
  if (bins.length !== 1) return;
  const zones = context.zones.filter(zone => same(zone.id, bins[0].zoneId));
  if (zones.length !== 1) return;
  const warehouses = context.warehouses.filter(warehouse => same(warehouse.id, zones[0].warehouseId));
  return warehouses.length === 1 ? warehouses[0].id : undefined;
}
export function supportedSourceRows(context: TransferContext): BinStockRow[] {
  const available = (context.contents?.items ?? []).filter(row => row.status === 'Available');
  return available.filter(row => row.quantity > 0 &&
    context.products.filter(product => same(product.id, row.productId)).length === 1 &&
    context.products.some(product => same(product.id, row.productId) && [0, 1].includes(product.trackingMode)) &&
    available.filter(other => same(other.productId, row.productId) && canonicalTransferLot(other.lotNumber) === canonicalTransferLot(row.lotNumber)).length === 1);
}
export type TransferValidation = 'context' | 'selection' | 'sameBin' | 'warehouse' | 'quantity' | 'reason';
export function validateTransferDraft(draft: TransferDraft, context: TransferContext): TransferValidation | undefined {
  if (!context.fresh || !context.contents || !same(context.contents.binId, draft.sourceBinId)) return 'context';
  if (![draft.warehouseId, draft.sourceBinId, draft.destinationBinId, draft.productId].every(isTransferGuid)) return 'selection';
  if (same(draft.sourceBinId, draft.destinationBinId)) return 'sameBin';
  const sourceWarehouse = warehouseForBin(draft.sourceBinId, context), destinationWarehouse = warehouseForBin(draft.destinationBinId, context);
  if (!sourceWarehouse || !destinationWarehouse || !same(sourceWarehouse, draft.warehouseId) || !same(destinationWarehouse, draft.warehouseId)) return 'warehouse';
  if (draft.lotNumber === null || !supportedSourceRows(context).some(row => same(row.productId, draft.productId) && row.lotNumber === draft.lotNumber)) return 'selection';
  if (!/^\d+$/.test(draft.quantity) || !Number.isInteger(Number(draft.quantity)) || Number(draft.quantity) < 1 || Number(draft.quantity) > MAX_TRANSFER_QUANTITY) return 'quantity';
  if (!draft.reason.trim() || draft.reason.length > MAX_TRANSFER_REASON) return 'reason';
}
export const draftTransferRequest = (draft: TransferDraft): TransferRequest => ({ productId: draft.productId,
  sourceBinId: draft.sourceBinId, destinationBinId: draft.destinationBinId, transferQuantity: Number(draft.quantity),
  lotNumber: draft.lotNumber ?? '', reason: draft.reason.trim() });
