import { httpClient, normalizeApiError } from '../api/httpClient';
import { sessionStore } from '../../features/auth/session';
import { isDemoMode } from '../../app/dataMode';

export interface CreateProductPayload {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  unit: string;
  weight: number;
  trackingMode: 0 | 1 | 2;
}

export interface UpdateProductPayload {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  unit: string;
  weight: number;
  trackingMode: 0 | 1 | 2;
}

export const canManageProducts = (role?: string) =>
  role === 'Admin' || role === 'WarehouseManager';

function authorize() {
  if (isDemoMode || !canManageProducts(sessionStore.get()?.role)) {
    throw normalizeApiError(403);
  }
}

export const productMutationApi = {
  createProduct: async (payload: CreateProductPayload): Promise<string> => {
    authorize();
    const body: CreateProductPayload = {
      sku: payload.sku.trim(),
      barcode: payload.barcode?.trim() || '',
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      unit: payload.unit.trim() || 'Pcs',
      weight: Number(payload.weight) || 0,
      trackingMode: Number(payload.trackingMode) as 0 | 1 | 2,
    };
    const { data } = await httpClient.post('/api/v1/Products', body);
    if (!data?.isSuccess || typeof data?.data !== 'string') {
      throw normalizeApiError(502, data);
    }
    return data.data;
  },

  updateProduct: async (payload: UpdateProductPayload): Promise<boolean> => {
    authorize();
    const body: UpdateProductPayload = {
      id: payload.id,
      sku: payload.sku.trim(),
      barcode: payload.barcode?.trim() || '',
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      unit: payload.unit.trim() || 'Pcs',
      weight: Number(payload.weight) || 0,
      trackingMode: Number(payload.trackingMode) as 0 | 1 | 2,
    };
    const { data } = await httpClient.put(`/api/v1/Products/${payload.id}`, body);
    if (!data?.isSuccess) {
      throw normalizeApiError(502, data);
    }
    return true;
  },
};
