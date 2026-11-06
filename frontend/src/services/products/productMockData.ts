/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProductDto } from "../api/apiTypes";

/**
 * Mock Product Master Data used purely for UI design & development in AI Studio.
 * Strictly adheres to backend ProductDto schema without any invented fields:
 * - id: string UUID
 * - sku: string
 * - barcode: string
 * - name: string
 * - description: string
 * - unit: string
 * - weight: number
 */
export const INITIAL_MOCK_PRODUCTS: ProductDto[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    sku: "COCA-320",
    barcode: "8935049012431",
    name: "Coca-Cola Sleek Can 320ml",
    description: "Thùng 24 lon sleek 320ml chính hãng",
    unit: "Can",
    weight: 0.35,
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    sku: "VNM-180",
    barcode: "8934673123456",
    name: "Sữa tươi tiệt trùng Vinamilk có đường 180ml",
    description: "Thùng 48 hộp giấy 180ml",
    unit: "Carton",
    weight: 9.2,
  },
  {
    id: "c3333333-3333-4333-8333-333333333333",
    sku: "TH-MILK-110",
    barcode: "8936036011234",
    name: "Sữa chua uống tiệt trùng TH true MILK hương dâu tự nhiên 110ml",
    description: "Lốc 4 hộp x 110ml",
    unit: "Box",
    weight: 0.48,
  },
  {
    id: "d4444444-4444-4444-8444-444444444444",
    sku: "AAPL-IP15PM-256",
    barcode: "195949012345",
    name: "Điện thoại di động Apple iPhone 15 Pro Max 256GB Titan Tự Nhiên - Phân phối chính hãng VN/A",
    description: "Thiết bị nguyên hộp seal chống giả",
    unit: "Pcs",
    weight: 0.221,
  },
  {
    id: "e5555555-5555-4555-8555-555555555555",
    sku: "PEPSI-330",
    barcode: "8934588012345",
    name: "Pepsi Không Calo vị chanh lon 330ml",
    description: "", // Description rỗng để test UI
    unit: "Can",
    weight: 0.36,
  },
  {
    id: "f6666666-6666-4666-8666-666666666666",
    sku: "CHINSU-250",
    barcode: "8934563012987",
    name: "Tương ớt Chinsu chai 250g",
    description: "Chai nhựa nắp bật 250g",
    unit: "Bottle",
    weight: 0.28,
  },
  {
    id: "a7777777-7777-4777-8777-777777777777",
    sku: "LAYS-SNACK-95",
    barcode: "", // Thiếu barcode để test lọc SKU thiếu mã vạch
    name: "Snack khoai tây Lay's vị tự nhiên Classic 95g",
    description: "Khay 12 gói x 95g",
    unit: "Tray",
    weight: 1.25,
  },
  {
    id: "b8888888-8888-4888-8888-888888888888",
    sku: "NESCAFE-3IN1",
    barcode: "8934804011223",
    name: "Cà phê hòa tan NESCAFÉ 3in1 Đậm Đà Hài Hòa",
    description: "Túi 46 gói x 17g tiện dụng",
    unit: "Box",
    weight: 0.85,
  },
  {
    id: "c9999999-9999-4999-8999-999999999999",
    sku: "WATER-AQUA-500",
    barcode: "8934588022114",
    name: "Nước tinh khiết Aquafina 500ml",
    description: "Thùng 24 chai x 500ml",
    unit: "Bottle",
    weight: 12.5,
  },
  {
    id: "d0000000-0000-4000-8000-000000000001",
    sku: "CARD-VOUCHER-50K",
    barcode: "8938501234567",
    name: "Thẻ quà tặng Gift Voucher 50.000đ",
    description: "Thẻ phát hành điện tử kích hoạt quà tặng",
    unit: "Unit",
    weight: 0, // Trọng lượng 0 cho quà tặng điện tử để test UI weight=0
  },
  {
    id: "e0000000-0000-4000-8000-000000000002",
    sku: "PLASTIC-PALLET-1210",
    barcode: "", // Thiếu barcode để test lọc SKU thiếu mã vạch
    name: "Pallet nhựa công nghiệp 1200x1000mm",
    description: "Pallet kê hàng kho tiêu chuẩn công nghiệp",
    unit: "Pcs",
    weight: 14.5,
  },
  {
    id: "f0000000-0000-4000-8000-000000000003",
    sku: "MILO-180",
    barcode: "8934804023456",
    name: "Sữa lúa mạch Nestlé MILO ít đường hộp 180ml",
    description: "Thùng 48 hộp giấy 180ml",
    unit: "Carton",
    weight: 9.8,
  },
];
