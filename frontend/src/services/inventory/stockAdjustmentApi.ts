import { isDemoMode } from '../../app/dataMode';
import { Role, sessionStore } from '../../features/auth/session';
import { httpClient, normalizeApiError } from '../api/httpClient';

export const MAX_ADJUSTMENT_QUANTITY = 2_147_483_647;
export const MAX_ADJUSTMENT_REASON = 500;

export const ADJUSTMENT_REASON_CODES = [
  'AUDIT_CLEANUP',
  'DAMAGED_GOODS',
  'CYCLE_COUNT_DISCREPANCY',
  'STOCK_CORRECTION',
  'OTHER',
] as const;

export type AdjustmentReasonCode = (typeof ADJUSTMENT_REASON_CODES)[number];

export interface AdjustStockRequest {
  binId: string;
  productId: string;
  lotNumber: string; // trimmed lotNumber when product trackingMode === 1 (Lot), '' otherwise
  adjustmentQuantity: number; // non-zero signed integer (+ increase, - decrease)
  reasonCode: string;
}

export const canAdjustStock = (role?: Role | string): boolean =>
  role === 'Admin' || role === 'WarehouseManager';

export const isAdjustmentGuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) &&
  !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function adjustStockRequest(
  value: AdjustStockRequest,
  productTrackingMode?: number,
): AdjustStockRequest {
  if (productTrackingMode === 2) {
    throw normalizeApiError(400, {
      code: 'FE_ADJUST_SERIAL_BLOCKED',
    });
  }

  if (
    !isObject(value) ||
    !isAdjustmentGuid(value.binId) ||
    !isAdjustmentGuid(value.productId) ||
    typeof value.lotNumber !== 'string' ||
    !Number.isSafeInteger(value.adjustmentQuantity) ||
    value.adjustmentQuantity === 0 ||
    Math.abs(value.adjustmentQuantity) > MAX_ADJUSTMENT_QUANTITY ||
    typeof value.reasonCode !== 'string' ||
    !value.reasonCode.trim() ||
    value.reasonCode.trim().length > MAX_ADJUSTMENT_REASON
  ) {
    throw normalizeApiError(400, {
      code: 'FE_ADJUST_VALIDATION',
    });
  }

  const normalizedLot =
    productTrackingMode === undefined || productTrackingMode === 1
      ? value.lotNumber.trim()
      : '';

  return {
    binId: value.binId,
    productId: value.productId,
    lotNumber: normalizedLot,
    adjustmentQuantity: value.adjustmentQuantity,
    reasonCode: value.reasonCode.trim(),
  };
}

export const stockAdjustmentApi = {
  async adjustStock(
    value: AdjustStockRequest,
    signal?: AbortSignal,
    productTrackingMode?: number,
  ): Promise<true> {
    const role = sessionStore.get()?.role;
    if (!canAdjustStock(role) || isDemoMode) {
      throw normalizeApiError(403);
    }

    const body = adjustStockRequest(value, productTrackingMode);
    const { data } = await httpClient.post<unknown>(
      '/api/v1/Inventory/adjust-stock',
      body,
      { signal },
    );

    // A malformed 2xx envelope leaves mutation commit status unknown (502 -> uncertain, never auto-retried).
    if (!isObject(data) || data.isSuccess !== true || data.data !== true) {
      throw normalizeApiError(502, {
        code: 'FE_ADJUST_CONTRACT',
      });
    }

    return true;
  },
};

export const adjustStock = stockAdjustmentApi.adjustStock;
