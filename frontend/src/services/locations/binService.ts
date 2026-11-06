/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IBinProvider } from "./types";
import { apiBinProvider } from "./apiBinProvider";
import { mockBinProvider, resetMockBinsStore } from "./mockBinProvider";
import { getLocationDataMode, isLocationMockMode } from "./warehouseService";
import { isLocationMutationEnabled } from "./apiWarehouseProvider";

const getActiveBinProvider = (): IBinProvider => {
  if (getLocationDataMode() === "api") {
    return apiBinProvider;
  }
  return mockBinProvider;
};

export const binService: IBinProvider = {
  getBins: (params) => getActiveBinProvider().getBins(params),
  getBinsList: (params) => getActiveBinProvider().getBinsList(params),
  getBinById: (id) => getActiveBinProvider().getBinById(id),
  getBinContents: (id) => getActiveBinProvider().getBinContents(id),
  createBin: (request) => getActiveBinProvider().createBin(request),
  updateBin: (id, request) => getActiveBinProvider().updateBin(id, request),
  deleteBin: (id) => getActiveBinProvider().deleteBin(id),
};

export { isLocationMutationEnabled, isLocationMockMode, resetMockBinsStore };
