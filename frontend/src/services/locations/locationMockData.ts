/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  WarehouseDto,
  ZoneDto,
  BinDto,
  BinContentHeaderDto,
} from "../api/apiTypes";

/**
 * Standard relational mock data with genuine UUIDs for UI Preview in AI Studio.
 * Strictly conforms to DTO schemas without invented properties.
 */

export const INITIAL_MOCK_WAREHOUSES: WarehouseDto[] = [
  {
    id: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0001",
    code: "WH-HN-01",
    name: "Kho Trung Tâm Hà Nội",
    address: "Lô CN5, KCN Đài Tư, Quận Long Biên, Hà Nội",
  },
  {
    id: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0002",
    code: "WH-HCM-01",
    name: "Kho Tổng Miền Nam",
    address: "Khu Chế Xuất Tân Thuận, Phường Tân Thuận Đông, Quận 7, TP. Hồ Chí Minh",
  },
  {
    id: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0003",
    code: "WH-DN-01",
    name: "Kho Bán Lẻ & Trung Chuyển Đà Nẵng",
    address: "Đường số 3, KCN Hòa Khánh, Quận Liên Chiểu, Đà Nẵng",
  },
];

export const INITIAL_MOCK_ZONES: ZoneDto[] = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    code: "ZONE-C",
    name: "Phân khu mát",
    warehouseId: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0001",
  },
  {
    id: "a1b2c3d4-0002-4000-8000-000000000002",
    code: "ZONE-D",
    name: "Phân khu khô",
    warehouseId: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0001",
  },
  {
    id: "a1b2c3d4-0003-4000-8000-000000000003",
    code: "ZONE-POS",
    name: "Khu vực quầy bán lẻ",
    warehouseId: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0001",
  },
  {
    id: "a1b2c3d4-0004-4000-8000-000000000004",
    code: "ZONE-HCM-A",
    name: "Phân khu tiêu chuẩn A",
    warehouseId: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0002",
  },
  {
    id: "a1b2c3d4-0005-4000-8000-000000000005",
    code: "ZONE-HCM-B",
    name: "Phân khu lưu trữ B",
    warehouseId: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0002",
  },
  {
    id: "a1b2c3d4-0006-4000-8000-000000000006",
    code: "ZONE-DN-HUB",
    name: "Phân khu trung chuyển",
    warehouseId: "e5b9f71c-4b5d-4f2b-8a8b-3b3d1e1f0003",
  },
];

export const INITIAL_MOCK_BINS: BinDto[] = [
  // 0% occupancy (Empty case)
  {
    id: "b1010000-0000-4000-8000-000000000001",
    code: "C1-A01-N01",
    zoneId: "a1b2c3d4-0001-4000-8000-000000000001",
    maxCapacity: 100,
    currentOccupancy: 0,
  },
  // ~25% occupancy (Low / light stock)
  {
    id: "b1010000-0000-4000-8000-000000000002",
    code: "C1-A01-N02",
    zoneId: "a1b2c3d4-0001-4000-8000-000000000001",
    maxCapacity: 100,
    currentOccupancy: 25,
  },
  // ~70% occupancy (Normal operational range)
  {
    id: "b1010000-0000-4000-8000-000000000003",
    code: "D2-A02-N01",
    zoneId: "a1b2c3d4-0002-4000-8000-000000000002",
    maxCapacity: 100,
    currentOccupancy: 70,
  },
  // ~90% occupancy (Warning high occupancy)
  {
    id: "b1010000-0000-4000-8000-000000000004",
    code: "D2-A02-N02",
    zoneId: "a1b2c3d4-0002-4000-8000-000000000002",
    maxCapacity: 100,
    currentOccupancy: 90,
  },
  // 100% occupancy (Full case)
  {
    id: "b1010000-0000-4000-8000-000000000005",
    code: "POS-Q01",
    zoneId: "a1b2c3d4-0003-4000-8000-000000000003",
    maxCapacity: 80,
    currentOccupancy: 80,
  },
  // Edge case: maxCapacity = 0 (Testing division by zero resilience)
  {
    id: "b1010000-0000-4000-8000-000000000006",
    code: "POS-Q02",
    zoneId: "a1b2c3d4-0003-4000-8000-000000000003",
    maxCapacity: 0,
    currentOccupancy: 0,
  },
  // Additional realistic bins across other zones
  {
    id: "b1010000-0000-4000-8000-000000000007",
    code: "HCM-A-01",
    zoneId: "a1b2c3d4-0004-4000-8000-000000000004",
    maxCapacity: 150,
    currentOccupancy: 45,
  },
  {
    id: "b1010000-0000-4000-8000-000000000008",
    code: "HCM-A-02",
    zoneId: "a1b2c3d4-0004-4000-8000-000000000004",
    maxCapacity: 150,
    currentOccupancy: 120,
  },
  {
    id: "b1010000-0000-4000-8000-000000000009",
    code: "HCM-B-01",
    zoneId: "a1b2c3d4-0005-4000-8000-000000000005",
    maxCapacity: 200,
    currentOccupancy: 160,
  },
  {
    id: "b1010000-0000-4000-8000-000000000010",
    code: "HCM-B-02",
    zoneId: "a1b2c3d4-0005-4000-8000-000000000005",
    maxCapacity: 200,
    currentOccupancy: 0,
  },
  {
    id: "b1010000-0000-4000-8000-000000000011",
    code: "DN-HUB-01",
    zoneId: "a1b2c3d4-0006-4000-8000-000000000006",
    maxCapacity: 120,
    currentOccupancy: 30,
  },
  {
    id: "b1010000-0000-4000-8000-000000000012",
    code: "DN-HUB-02",
    zoneId: "a1b2c3d4-0006-4000-8000-000000000006",
    maxCapacity: 120,
    currentOccupancy: 105,
  },
];

/**
 * Mock Bin Contents mapped strictly by bin UUID.
 * Includes: empty bin, 1 SKU, multi SKU, lot with expiry, and lot with empty expiry.
 */
export const INITIAL_MOCK_BIN_CONTENTS: Record<string, BinContentHeaderDto> = {
  // Empty bin case (b1010000-0000-4000-8000-000000000001 / C1-A01-N01)
  "b1010000-0000-4000-8000-000000000001": {
    binId: "b1010000-0000-4000-8000-000000000001",
    binCode: "C1-A01-N01",
    maxCapacity: 100,
    currentOccupancy: 0,
    utilizationPercentage: 0,
    items: [],
  },

  // Single SKU bin case (~25% / C1-A01-N02)
  "b1010000-0000-4000-8000-000000000002": {
    binId: "b1010000-0000-4000-8000-000000000002",
    binCode: "C1-A01-N02",
    maxCapacity: 100,
    currentOccupancy: 25,
    utilizationPercentage: 25,
    items: [
      {
        productId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        sku: "MILK-VNM",
        productName: "Sữa tươi Vinamilk 100% 1L",
        lotNumber: "LOT-2026-03A",
        quantity: 25,
        expirationDate: "2026-12-15",
        status: "AVAILABLE",
      },
    ],
  },

  // Multi-SKU bin case (~70% / D2-A02-N01)
  "b1010000-0000-4000-8000-000000000003": {
    binId: "b1010000-0000-4000-8000-000000000003",
    binCode: "D2-A02-N01",
    maxCapacity: 100,
    currentOccupancy: 70,
    utilizationPercentage: 70,
    items: [
      {
        productId: "e1010000-0000-4000-8000-000000000002",
        sku: "COCA-330",
        productName: "Coca Cola Sleek 330ml",
        lotNumber: "LOT-2026-04B",
        quantity: 45,
        expirationDate: "2027-01-20",
        status: "AVAILABLE",
      },
      {
        productId: "e1010000-0000-4000-8000-000000000003",
        sku: "NOODLE-HH",
        productName: "Mì Hảo Hảo Tôm Chua Cay 75g",
        lotNumber: "LOT-2026-02X",
        quantity: 25,
        expirationDate: "2026-11-10",
        status: "AVAILABLE",
      },
    ],
  },

  // Multi-SKU with empty expiration date testing (~90% / D2-A02-N02)
  "b1010000-0000-4000-8000-000000000004": {
    binId: "b1010000-0000-4000-8000-000000000004",
    binCode: "D2-A02-N02",
    maxCapacity: 100,
    currentOccupancy: 90,
    utilizationPercentage: 90,
    items: [
      {
        productId: "e1010000-0000-4000-8000-000000000004",
        sku: "WATER-AQF",
        productName: "Nước tinh khiết Aquafina 500ml",
        lotNumber: "LOT-2026-01W",
        quantity: 50,
        expirationDate: "2027-06-30",
        status: 1, // Available
        trackingMode: 1, // Lot
      },
      {
        productId: "e1010000-0000-4000-8000-000000000005",
        sku: "SNACK-OCA",
        productName: "Bánh snack Oishi Cay Cay 40g",
        lotNumber: "LOT-2026-DMG",
        quantity: 20,
        expirationDate: "2026-10-01",
        status: 4, // Damaged
        trackingMode: 1, // Lot
      },
      {
        productId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        sku: "MILK-VNM",
        productName: "Sữa tươi Vinamilk 100% 1L",
        lotNumber: "LOT-2025-EXP",
        quantity: 20,
        expirationDate: "2025-12-30",
        status: 5, // Expired
        trackingMode: 1, // Lot
      },
    ],
  },

  // 100% full bin (POS-Q01)
  "b1010000-0000-4000-8000-000000000005": {
    binId: "b1010000-0000-4000-8000-000000000005",
    binCode: "POS-Q01",
    maxCapacity: 80,
    currentOccupancy: 80,
    utilizationPercentage: 100,
    items: [
      {
        productId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        sku: "MILK-VNM",
        productName: "Sữa tươi Vinamilk 100% 1L",
        lotNumber: "LOT-2026-03A",
        quantity: 35,
        expirationDate: "2026-12-15",
        status: 2, // Reserved
        trackingMode: 1, // Lot
      },
      {
        productId: "e1010000-0000-4000-8000-000000000002",
        sku: "COCA-330",
        productName: "Coca Cola Sleek 330ml",
        lotNumber: "LOT-2026-04B",
        quantity: 30,
        expirationDate: "2027-01-20",
        status: 1, // Available
        trackingMode: 0, // None
      },
      {
        productId: "e1010000-0000-4000-8000-000000000001",
        sku: "IPHONE15",
        productName: "iPhone 15 Pro Max 256GB Platinum",
        lotNumber: "LOT-2026-QC9",
        quantity: 15,
        expirationDate: "2029-01-01",
        status: 3, // QCHold
        trackingMode: 2, // Serial
        serialNumbers: ["SN-IP15-8801", "SN-IP15-8802", "SN-IP15-8803", "SN-IP15-8804", "SN-IP15-8805"],
      },
    ],
  },

  // 0 maxCapacity edge case (POS-Q02)
  "b1010000-0000-4000-8000-000000000006": {
    binId: "b1010000-0000-4000-8000-000000000006",
    binCode: "POS-Q02",
    maxCapacity: 0,
    currentOccupancy: 0,
    utilizationPercentage: 0,
    items: [],
  },

  // HCM-A-01
  "b1010000-0000-4000-8000-000000000007": {
    binId: "b1010000-0000-4000-8000-000000000007",
    binCode: "HCM-A-01",
    maxCapacity: 150,
    currentOccupancy: 45,
    utilizationPercentage: 30,
    items: [
      {
        productId: "e1010000-0000-4000-8000-000000000003",
        sku: "NOODLE-HH",
        productName: "Mì Hảo Hảo Tôm Chua Cay 75g",
        lotNumber: "LOT-2026-HCM01",
        quantity: 45,
        expirationDate: "2026-11-28",
        status: "AVAILABLE",
      },
    ],
  },

  // HCM-A-02
  "b1010000-0000-4000-8000-000000000008": {
    binId: "b1010000-0000-4000-8000-000000000008",
    binCode: "HCM-A-02",
    maxCapacity: 150,
    currentOccupancy: 120,
    utilizationPercentage: 80,
    items: [
      {
        productId: "e1010000-0000-4000-8000-000000000002",
        sku: "COCA-330",
        productName: "Coca Cola Sleek 330ml",
        lotNumber: "LOT-2026-HCM02",
        quantity: 120,
        expirationDate: "2027-02-15",
        status: "AVAILABLE",
      },
    ],
  },

  // HCM-B-01 (160 / 200 = 80%)
  "b1010000-0000-4000-8000-000000000009": {
    binId: "b1010000-0000-4000-8000-000000000009",
    binCode: "HCM-B-01",
    maxCapacity: 200,
    currentOccupancy: 160,
    utilizationPercentage: 80,
    items: [
      {
        productId: "e1010000-0000-4000-8000-000000000004",
        sku: "WATER-AQF",
        productName: "Nước tinh khiết Aquafina 500ml",
        lotNumber: "LOT-2026-HCM03",
        quantity: 100,
        expirationDate: "2027-08-20",
        status: "AVAILABLE",
      },
      {
        productId: "e1010000-0000-4000-8000-000000000005",
        sku: "SNACK-OCA",
        productName: "Bánh snack Oishi Cay Cay 40g",
        lotNumber: "LOT-2026-HCM04",
        quantity: 60,
        expirationDate: "2026-12-30",
        status: "AVAILABLE",
      },
    ],
  },

  // HCM-B-02 (0 / 200 = 0% Empty)
  "b1010000-0000-4000-8000-000000000010": {
    binId: "b1010000-0000-4000-8000-000000000010",
    binCode: "HCM-B-02",
    maxCapacity: 200,
    currentOccupancy: 0,
    utilizationPercentage: 0,
    items: [],
  },

  // DN-HUB-01 (30 / 120 = 25%)
  "b1010000-0000-4000-8000-000000000011": {
    binId: "b1010000-0000-4000-8000-000000000011",
    binCode: "DN-HUB-01",
    maxCapacity: 120,
    currentOccupancy: 30,
    utilizationPercentage: 25,
    items: [
      {
        productId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        sku: "MILK-VNM",
        productName: "Sữa tươi Vinamilk 100% 1L",
        lotNumber: "LOT-2026-DN01",
        quantity: 30,
        expirationDate: "2026-11-25",
        status: "AVAILABLE",
      },
    ],
  },

  // DN-HUB-02 (105 / 120 = 88% - strictly consistent with BinDto)
  "b1010000-0000-4000-8000-000000000012": {
    binId: "b1010000-0000-4000-8000-000000000012",
    binCode: "DN-HUB-02",
    maxCapacity: 120,
    currentOccupancy: 105,
    utilizationPercentage: 88,
    items: [
      {
        productId: "e1010000-0000-4000-8000-000000000002",
        sku: "COCA-330",
        productName: "Coca Cola Sleek 330ml",
        lotNumber: "LOT-2026-DN02",
        quantity: 65,
        expirationDate: "2027-03-10",
        status: "AVAILABLE",
      },
      {
        productId: "e1010000-0000-4000-8000-000000000003",
        sku: "NOODLE-HH",
        productName: "Mì Hảo Hảo Tôm Chua Cay 75g",
        lotNumber: "LOT-2026-DN03",
        quantity: 40,
        expirationDate: "2026-12-18",
        status: "AVAILABLE",
      },
    ],
  },
};
