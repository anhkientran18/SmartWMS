import i18n from '../../i18n';
import { httpClient, normalizeApiError } from '../api/httpClient';
import { isDemoMode } from '../../app/dataMode';
import { sessionStore } from '../../features/auth/session';

export const canReplenish = (role?: string) => role === 'Admin' || role === 'WarehouseManager';

// Audited InventoryController / AutoReplenishCommand: global, bodyless Result<int>.
export async function runAutoReplenishment(signal?: AbortSignal): Promise<number> {
  if (isDemoMode || !canReplenish(sessionStore.get()?.role)) throw normalizeApiError(403);
  const { data: result } = await httpClient.post('/api/v1/Inventory/run-auto-replenish', undefined, { signal });
  if (result?.isSuccess !== true || !Number.isInteger(result.data) || result.data < 0 || result.data > 2_147_483_647) {
    throw { message: i18n.t('f3.contractError'), code: 'FE_REPLENISHMENT_CONTRACT' };
  }
  return result.data;
}
