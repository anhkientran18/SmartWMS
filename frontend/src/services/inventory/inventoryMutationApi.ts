import i18n from '../../i18n';
import { isDemoMode } from '../../app/dataMode';
import { Role, sessionStore } from '../../features/auth/session';
import { httpClient, normalizeApiError } from '../api/httpClient';
import { InventoryStatus } from './types';

export const MAX_STATUS_REASON = 500;

export const ALLOWED_MANUAL_STOCK_STATUSES = [
  InventoryStatus.Available,
  InventoryStatus.QCHold,
  InventoryStatus.Damaged,
  InventoryStatus.Expired,
] as const;

export const STATUS_REASON_CODES = [
  'QC_INSPECTION',
  'DEFECT_FOUND',
  'EXPIRY_APPROACH',
  'QC_PASSED',
  'OTHER',
] as const;

export type StatusReasonCode = (typeof STATUS_REASON_CODES)[number];

export const canMutateInventory = (role?: Role | string): boolean =>
  role === 'Admin' || role === 'WarehouseManager';

export const guid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value) &&
  !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export interface ChangeStockStatusPayload {
  binId: string;
  productId: string;
  lotNumber: string;
  newStatus: InventoryStatus;
  reasonCode: string;
}

export async function changeStockStatus(
  payload: ChangeStockStatusPayload,
  signal?: AbortSignal,
): Promise<boolean> {
  const role = sessionStore.get()?.role;
  if (!canMutateInventory(role) || isDemoMode) {
    throw normalizeApiError(403);
  }

  if (
    !isObject(payload) ||
    !guid(payload.binId) ||
    !guid(payload.productId) ||
    typeof payload.lotNumber !== 'string' && payload.lotNumber !== undefined ||
    payload.newStatus === InventoryStatus.Reserved ||
    !(ALLOWED_MANUAL_STOCK_STATUSES as readonly number[]).includes(payload.newStatus) ||
    typeof payload.reasonCode !== 'string' ||
    !payload.reasonCode.trim() ||
    payload.reasonCode.trim().length > MAX_STATUS_REASON
  ) {
    throw normalizeApiError(400, {
      code: 'FE_STATUS_CONTRACT',
      message: i18n.t('f2.errors.invalidStatusPayload', {
        defaultValue:
          'Trạng thái chuyển đổi không hợp lệ. Không được chuyển sang Đã giữ (Reserved).',
      }),
    });
  }

  const { data } = await httpClient.post<unknown>(
    '/api/v1/Inventory/change-status',
    {
      binId: payload.binId,
      productId: payload.productId,
      lotNumber: payload.lotNumber?.trim() ?? '',
      newStatus: payload.newStatus,
      reasonCode: payload.reasonCode.trim(),
    },
    { signal },
  );

  if (!isObject(data) || data.isSuccess !== true || data.data !== true) {
    throw normalizeApiError(502, {
      code: 'FE_STATUS_CONTRACT',
    });
  }

  return true;
}

export interface ExportExcelResult {
  filename: string;
  size: number;
}

export async function exportInventoryExcel(
  signal?: AbortSignal,
): Promise<ExportExcelResult> {
  const role = sessionStore.get()?.role;
  if (!canMutateInventory(role) || isDemoMode) {
    throw normalizeApiError(403);
  }

  const response = await httpClient.get<Blob>('/api/v1/Reports/export/excel', {
    responseType: 'blob',
    signal,
  });

  const blob = response?.data as unknown;
  const size =
    blob instanceof Blob
      ? blob.size
      : blob && typeof (blob as { size?: unknown }).size === 'number'
        ? (blob as { size: number }).size
        : ArrayBuffer.isView(blob)
          ? blob.byteLength
          : 0;

  if (!blob || size <= 0) {
    throw normalizeApiError(502, {
      code: 'FE_EXPORT_CONTRACT',
      message: i18n.t('f2.errors.exportFailed', {
        defaultValue: 'Xuất báo cáo Excel sức chứa ô kệ thất bại.',
      }),
    });
  }

  const contentDisposition = String(
    response.headers?.['content-disposition'] ?? '',
  );
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '')
    .replace('T', '_');
  let filename = `BaoCaoSucChuaOLuuTru_${timestamp}.xlsx`;

  const match = contentDisposition.match(
    /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i,
  );
  if (match && match[1]) {
    const parsedName = match[1].replace(/['"]/g, '').trim();
    if (parsedName) {
      filename = parsedName;
    }
  }

  if (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function' &&
    typeof window.URL?.createObjectURL === 'function' &&
    blob instanceof Blob
  ) {
    const url = window.URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute?.('download', filename);
      document.body?.appendChild?.(link);
      link.click?.();
      link.remove?.();
    } finally {
      window.URL.revokeObjectURL?.(url);
    }
  }

  return { filename, size };
}
