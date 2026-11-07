/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PaginatedResult,
  SupplierDto,
  GetSuppliersParams,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from "../api/apiTypes";

/**
 * Common Supplier Provider contract shared between MockProvider and ApiProvider
 */
export interface ISupplierProvider {
  getSuppliers(params: GetSuppliersParams): Promise<PaginatedResult<SupplierDto>>;
  getSuppliersList(searchKeyword?: string): Promise<SupplierDto[]>;
  getSupplierById(id: string): Promise<SupplierDto>;
  createSupplier(request: CreateSupplierRequest): Promise<string>;
  updateSupplier(id: string, request: UpdateSupplierRequest): Promise<boolean>;
  deleteSupplier(id: string): Promise<boolean>;
}
