import { httpClient, normalizeApiError } from '../api/httpClient';
import { sessionStore } from '../../features/auth/session';
import { isDemoMode } from '../../app/dataMode';

export interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  deliveryAddress?: string;
  address?: string;
}

export interface CreateCustomerPayload {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  deliveryAddress?: string;
}

export interface UpdateCustomerPayload extends CreateCustomerPayload {
  id: string;
}

export const canManageCustomers = (role?: string) =>
  ['Admin', 'WarehouseManager', 'Staff'].includes(role ?? '');

function authorize() {
  if (isDemoMode || !canManageCustomers(sessionStore.get()?.role)) {
    throw normalizeApiError(403);
  }
}

export const customerApi = {
  createCustomer: async (payload: CreateCustomerPayload): Promise<string> => {
    authorize();
    const body: CreateCustomerPayload = {
      code: payload.code.trim(),
      name: payload.name.trim(),
      email: payload.email?.trim() || '',
      phone: payload.phone?.trim() || '',
      deliveryAddress: payload.deliveryAddress?.trim() || '',
    };
    const { data } = await httpClient.post('/api/v1/Customers', body);
    if (!data?.isSuccess || typeof data?.data !== 'string') {
      throw normalizeApiError(502, data);
    }
    return data.data;
  },

  updateCustomer: async (payload: UpdateCustomerPayload): Promise<boolean> => {
    authorize();
    const body: UpdateCustomerPayload = {
      id: payload.id,
      code: payload.code.trim(),
      name: payload.name.trim(),
      email: payload.email?.trim() || '',
      phone: payload.phone?.trim() || '',
      deliveryAddress: payload.deliveryAddress?.trim() || '',
    };
    const { data } = await httpClient.put(`/api/v1/Customers/${payload.id}`, body);
    if (!data?.isSuccess) {
      throw normalizeApiError(502, data);
    }
    return true;
  },

  getCustomerById: async (id: string): Promise<CustomerRecord> => {
    authorize();
    const { data } = await httpClient.get(`/api/v1/Customers/${id}`);
    if (!data?.isSuccess || !data?.data) {
      throw normalizeApiError(502, data);
    }
    return {
      ...data.data,
      deliveryAddress: data.data.deliveryAddress || data.data.address || '',
    };
  },
};
