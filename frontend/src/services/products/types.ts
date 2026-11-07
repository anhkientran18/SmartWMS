/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  PaginatedResult,
  ProductDto,
  GetProductsParams,
  ParsedBarcodeDto,
  CreateProductRequest,
  UpdateProductRequest,
} from "../api/apiTypes";

/**
 * Common Product Provider contract shared between MockProvider and ApiProvider
 */
export interface IProductProvider {
  getProducts(params: GetProductsParams): Promise<PaginatedResult<ProductDto>>;
  getProductsList(searchKeyword?: string): Promise<ProductDto[]>;
  getProductById(id: string): Promise<ProductDto>;
  getProductQrCode(sku: string): Promise<string>;
  parseBarcode(rawBarcodeData: string): Promise<ParsedBarcodeDto>;
  createProduct(request: CreateProductRequest): Promise<string>;
  updateProduct(id: string, request: UpdateProductRequest): Promise<boolean>;
  deleteProduct(id: string): Promise<boolean>;
}
