/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IOutboundProvider } from "./types";
import { apiOutboundProvider } from "./apiOutboundProvider";
import { mockOutboundProvider, resetMockOutboundStore } from "./mockOutboundProvider";
import { getDataMode } from "../products/productService";

const getActiveProvider = (): IOutboundProvider => {
  if (getDataMode() === "api") {
    return apiOutboundProvider;
  }
  return mockOutboundProvider;
};

export const outboundService: IOutboundProvider = {
  getOutboundOrders: () => getActiveProvider().getOutboundOrders(),
  getOutboundOrderById: (id) => getActiveProvider().getOutboundOrderById(id),
  createOutboundOrder: (request) => getActiveProvider().createOutboundOrder(request),
  allocateOutboundOrder: (id) => getActiveProvider().allocateOutboundOrder(id),
  pickOutboundOrder: (id, items) => getActiveProvider().pickOutboundOrder(id, items),
  packOutboundOrder: (id) => getActiveProvider().packOutboundOrder(id),
  shipOutboundOrder: (id) => getActiveProvider().shipOutboundOrder(id),
  cancelOutboundOrder: (id) => getActiveProvider().cancelOutboundOrder(id),
};

export { resetMockOutboundStore };
export * from "./types";
export * from "./outboundMockData";
