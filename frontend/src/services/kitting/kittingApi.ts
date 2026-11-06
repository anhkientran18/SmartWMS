import { httpClient, normalizeApiError } from '../api/httpClient';
import { isDemoMode } from '../../app/dataMode';
import { sessionStore } from '../../features/auth/session';
import { guid } from '../inbound/inboundApi';

export interface KitComponent {
  componentProductId: string;
  sourceBinId: string;
  quantityPerKit: number;
}
export interface AssembleKitRequest {
  kitProductId: string;
  targetBinId: string;
  assembleQuantity: number;
  components: KitComponent[];
}
export const KIT_INT_MAX = 2147483647;
export const canAssembleKit = (role?: string) => role === 'Admin' || role === 'WarehouseManager';
export const kitQuantity = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0 && Number(value) <= KIT_INT_MAX;

function invalid(field: string): never {
  throw normalizeApiError(400, { code: 'FE_KITTING_INPUT', errors: { [field]: ['FE_KITTING_INPUT'] } });
}

// Whitelist wire fields. React row IDs and any caller extras never enter the body.
// GUID comparisons use logical identity, matching System.Guid rather than casing.
export function assemblyRequest(value: AssembleKitRequest): AssembleKitRequest {
  if (!value || !guid(value.kitProductId)) invalid('kitProductId');
  if (!guid(value.targetBinId)) invalid('targetBinId');
  if (!kitQuantity(value.assembleQuantity)) invalid('assembleQuantity');
  if (!Array.isArray(value.components) || !value.components.length) invalid('components');
  const totals = new Map<string, bigint>();
  const components = Array.from(value.components, (row, index) => {
    const field = `components.${index}`;
    if (!row || !guid(row.componentProductId)) invalid(`${field}.componentProductId`);
    if (row.componentProductId.toLowerCase() === value.kitProductId.toLowerCase()) invalid(`${field}.componentProductId`);
    if (!guid(row.sourceBinId)) invalid(`${field}.sourceBinId`);
    if (!kitQuantity(row.quantityPerKit)) invalid(`${field}.quantityPerKit`);
    const key = `${row.sourceBinId.toLowerCase()}/${row.componentProductId.toLowerCase()}`;
    const total = (totals.get(key) ?? 0n) + BigInt(row.quantityPerKit) * BigInt(value.assembleQuantity);
    if (total > BigInt(KIT_INT_MAX)) invalid(`${field}.quantityPerKit`);
    totals.set(key, total);
    return { componentProductId: row.componentProductId, sourceBinId: row.sourceBinId, quantityPerKit: row.quantityPerKit };
  });
  return { kitProductId: value.kitProductId, targetBinId: value.targetBinId, assembleQuantity: value.assembleQuantity, components };
}

// Local requirements only: no stock/ATP/capacity prediction or reservation.
export function assemblyPreview(value: AssembleKitRequest) {
  const body = assemblyRequest(value);
  const rows = body.components.map(row => ({ ...row, requiredQuantity: Number(BigInt(row.quantityPerKit) * BigInt(body.assembleQuantity)) }));
  const aggregated = new Map<string, { componentProductId: string; sourceBinId: string; requiredQuantity: number }>();
  for (const row of rows) {
    const key = `${row.sourceBinId.toLowerCase()}/${row.componentProductId.toLowerCase()}`;
    const prior = aggregated.get(key);
    aggregated.set(key, { componentProductId: row.componentProductId, sourceBinId: row.sourceBinId, requiredQuantity: (prior?.requiredQuantity ?? 0) + row.requiredQuantity });
  }
  return { rows, aggregated: [...aggregated.values()] };
}

export const kittingApi = {
  assemble: async (value: AssembleKitRequest): Promise<true> => {
    if (isDemoMode || !canAssembleKit(sessionStore.get()?.role)) throw normalizeApiError(403);
    const body = assemblyRequest(value);
    // Fail immediately offline, never persist/queue an inventory write.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw normalizeApiError();
    const { data } = await httpClient.post('/api/v1/Kitting/assemble', body);
    if (!data || data.isSuccess !== true || data.data !== true) {
      throw normalizeApiError(502, { code: 'FE_KITTING_CONTRACT' });
    }
    return true;
  },
};
