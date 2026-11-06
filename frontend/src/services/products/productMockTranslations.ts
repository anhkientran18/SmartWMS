/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProductDto } from "../api/apiTypes";

/**
 * Mock presentation translation content definition.
 * Strictly decoupled from backend ProductDto contract.
 */
export interface MockProductContent {
  name: string;
  description: string;
}

export interface MockProductTranslationEntry {
  vi: MockProductContent;
  en: MockProductContent;
}

/**
 * Presentation translations for default 12 enterprise mock products.
 * Used exclusively when VITE_DATA_MODE=mock for professional multilingual demonstration.
 * Brand names (Coca-Cola, Vinamilk, TH true MILK, Lay's, NESCAFÉ, Aquafina, Apple)
 * are strictly preserved.
 */
export const PRODUCT_MOCK_TRANSLATIONS: Record<string, MockProductTranslationEntry> = {
  "COCA-320": {
    vi: {
      name: "Coca-Cola Sleek Can 320ml",
      description: "Thùng 24 lon sleek 320ml chính hãng",
    },
    en: {
      name: "Coca-Cola Sleek Can 320ml",
      description: "Original 24-can sleek pack 320ml",
    },
  },
  "VNM-180": {
    vi: {
      name: "Sữa tươi tiệt trùng Vinamilk có đường 180ml",
      description: "Thùng 48 hộp giấy 180ml",
    },
    en: {
      name: "Vinamilk Sweetened UHT Milk 180ml",
      description: "Case of 48 paper cartons 180ml",
    },
  },
  "TH-MILK-110": {
    vi: {
      name: "Sữa chua uống tiệt trùng TH true MILK hương dâu tự nhiên 110ml",
      description: "Lốc 4 hộp x 110ml",
    },
    en: {
      name: "TH true MILK Natural Strawberry Drinking Yogurt 110ml",
      description: "Pack of 4 small boxes x 110ml",
    },
  },
  "AAPL-IP15PM-256": {
    vi: {
      name: "Điện thoại di động Apple iPhone 15 Pro Max 256GB Titan Tự Nhiên - Phân phối chính hãng VN/A",
      description: "Thiết bị nguyên hộp seal chống giả",
    },
    en: {
      name: "Apple iPhone 15 Pro Max 256GB Natural Titanium (VN/A Official Distribution)",
      description: "Brand new factory sealed authentic box",
    },
  },
  "PEPSI-330": {
    vi: {
      name: "Pepsi Không Calo vị chanh lon 330ml",
      description: "",
    },
    en: {
      name: "Pepsi Zero Calories Lime Can 330ml",
      description: "",
    },
  },
  "CHINSU-250": {
    vi: {
      name: "Tương ớt Chinsu chai 250g",
      description: "Chai nhựa nắp bật 250g",
    },
    en: {
      name: "Chinsu Chili Sauce 250g",
      description: "Squeeze bottle with flip cap 250g",
    },
  },
  "LAYS-SNACK-95": {
    vi: {
      name: "Snack khoai tây Lay's vị tự nhiên Classic 95g",
      description: "Khay 12 gói x 95g",
    },
    en: {
      name: "Lay's Classic Potato Chips 95g",
      description: "Tray pack of 12 pouches x 95g",
    },
  },
  "NESCAFE-3IN1": {
    vi: {
      name: "Cà phê hòa tan NESCAFÉ 3in1 Đậm Đà Hài Hòa",
      description: "Túi 46 gói x 17g tiện dụng",
    },
    en: {
      name: "NESCAFÉ 3in1 Rich & Balanced Instant Coffee",
      description: "Value bag of 46 sachets x 17g",
    },
  },
  "WATER-AQUA-500": {
    vi: {
      name: "Nước tinh khiết Aquafina 500ml",
      description: "Thùng 24 chai x 500ml",
    },
    en: {
      name: "Aquafina Purified Water 500ml",
      description: "Case of 24 PET bottles x 500ml",
    },
  },
  "CARD-VOUCHER-50K": {
    vi: {
      name: "Thẻ quà tặng Gift Voucher 50.000đ",
      description: "Thẻ phát hành điện tử kích hoạt quà tặng",
    },
    en: {
      name: "50,000 VND Gift Voucher",
      description: "Digital electronic voucher card for gift redemption",
    },
  },
  "PLASTIC-PALLET-1210": {
    vi: {
      name: "Pallet nhựa công nghiệp 1200x1000mm",
      description: "Pallet kê hàng kho tiêu chuẩn công nghiệp",
    },
    en: {
      name: "Heavy-Duty Industrial Plastic Pallet 1200x1000mm",
      description: "Standard warehouse floor & racking storage pallet",
    },
  },
  "MILO-180": {
    vi: {
      name: "Sữa lúa mạch Nestlé MILO ít đường hộp 180ml",
      description: "Thùng 48 hộp giấy 180ml",
    },
    en: {
      name: "Nestlé MILO Less Sugar Malt Drink 180ml",
      description: "Case of 48 paper cartons 180ml",
    },
  },
};

/**
 * Localizes mock product name and description for presentation layer.
 *
 * STRICT ARCHITECTURAL CONSTRAINTS:
 * 1. Does NOT mutate the input ProductDto.
 * 2. In API mode (VITE_DATA_MODE=api), NEVER translates; returns raw backend data untouched.
 * 3. In Mock mode, overlays English/Vietnamese content based on locale ('en' or 'vi').
 * 4. If SKU is not present in PRODUCT_MOCK_TRANSLATIONS (e.g. newly created products),
 *    safely falls back to the original ProductDto.name and ProductDto.description.
 */
export function getLocalizedMockProduct(product: ProductDto, locale: string): ProductDto {
  if (!product) return product;

  // In API mode, always preserve exact backend data without modification
  const isApiMode = (import.meta as any).env?.VITE_DATA_MODE?.trim().toLowerCase() === "api";
  if (isApiMode) {
    return { ...product };
  }

  const langKey = locale?.toLowerCase().startsWith("en") ? "en" : "vi";
  const translation = PRODUCT_MOCK_TRANSLATIONS[product.sku];

  if (!translation) {
    return { ...product };
  }

  const localizedContent = translation[langKey];
  return {
    ...product,
    name: localizedContent.name ?? product.name,
    description: localizedContent.description ?? product.description,
  };
}
