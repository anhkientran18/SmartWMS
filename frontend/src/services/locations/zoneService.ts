/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IZoneProvider } from "./types";
import { apiZoneProvider } from "./apiZoneProvider";
import { mockZoneProvider, resetMockZonesStore } from "./mockZoneProvider";
import { getLocationDataMode, isLocationMockMode } from "./warehouseService";
import { isLocationMutationEnabled } from "./apiWarehouseProvider";

const getActiveZoneProvider = (): IZoneProvider => {
  if (getLocationDataMode() === "api") {
    return apiZoneProvider;
  }
  return mockZoneProvider;
};

export const zoneService: IZoneProvider = {
  getZones: (params) => getActiveZoneProvider().getZones(params),
  getZonesList: (searchKeyword) => getActiveZoneProvider().getZonesList(searchKeyword),
  getZonesByWarehouse: (warehouseId) => getActiveZoneProvider().getZonesByWarehouse(warehouseId),
  createZone: (request) => getActiveZoneProvider().createZone(request),
  updateZone: (id, request) => getActiveZoneProvider().updateZone(id, request),
  deleteZone(id) {
    return getActiveZoneProvider().deleteZone(id);
  },
};

export { isLocationMutationEnabled, isLocationMockMode, resetMockZonesStore };
