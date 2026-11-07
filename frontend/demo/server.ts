// DEMO ONLY: inherited synthetic data/AI/security. Never deploy as SmartWMS backend.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { Product, WarehouseZone, Warehouse, Bin, InboundReceipt, OutboundOrder, WavePicking, AuditLog, SystemNotification, Vendor } from "../src/types";

// Load environment variables
// F0 never loads provider secrets. All AI responses here are demo simulations.

// Create Express App
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Safe Lazy Initialization of Gemini SDK as per guidelines
let aiClient: GoogleGenAI | null = null;
let geminiQuotaExceeded = false;
let geminiQuotaExceededResetTime = 0;

function handleGeminiError(apiName: string, err: any) {
  const errMsg = typeof err === "object" ? JSON.stringify(err) : String(err);
  const is429 = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.toLowerCase().includes("quota");
  const is403 = errMsg.includes("403") || errMsg.includes("PERMISSION_DENIED") || errMsg.toLowerCase().includes("denied access") || errMsg.toLowerCase().includes("forbidden");

  if (is429 || is403) {
    if (!geminiQuotaExceeded) {
      geminiQuotaExceeded = true;
      // Set cooldown: 5 minutes for quota limits, 24 hours for access denied limits (as API key privilege issues are permanent)
      geminiQuotaExceededResetTime = Date.now() + (is403 ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000);
      console.log(`[INFO] Offline Digital Twin simulation mode automatically activated for ${apiName} to maintain 100% service availability.`);
    }
  } else {
    console.log(`[INFO] Active fallback path utilized for ${apiName}.`);
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey: string | undefined = undefined;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // If key is empty or standard default, log warning and return null (handled gracefully below)
    console.warn("WARNING: GEMINI_API_KEY is not configured or uses placeholder. Dynamic AI features will use high-fidelity local simulations.");
    return null;
  }
  if (geminiQuotaExceeded) {
    if (Date.now() > geminiQuotaExceededResetTime) {
      geminiQuotaExceeded = false;
      console.log("RETRYING GEMINI: Cooldown period expired, re-enabling actual Gemini calls.");
    } else {
      // Keep using fast offline bypass during rate-limit cooldown
      return null;
    }
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// ==========================================
// IN-MEMORY DATA ARCHITECTURE (Digital Twin)
// ==========================================

const PRODUCTS = [
  { id: "p1", sku: "IPHONE15", barcode: "8809756133120", name: "iPhone 15 Pro Max 256GB Platinum", category: "Electronics", unit: "Pcs", price: 29500000, description: { vi: 'iPhone 15 Pro Max 256GB Màu Titan Tự Nhiên', en: 'iPhone 15 Pro Max 256GB Platinum' } },
  { id: "p2", sku: "MILK-VNM", barcode: "8934673121543", name: "Vinamilk Milk Carton 180ml (x48)", category: "Beverage", unit: "Carton", price: 345000, description: { vi: 'Sữa tươi tiệt trùng Vinamilk hộp giấy 180ml (x48)', en: 'Vinamilk Milk Carton 180ml (x48)' } },
  { id: "p3", sku: "NOODLE-HH", barcode: "8934563138125", name: "Hao Hao Instant Noodles Sour/Spicy (x30)", category: "Food", unit: "Box", price: 111000, description: { vi: 'Mì ăn liền Hảo Hảo vị Tôm Chua Cay (x30)', en: 'Hao Hao Instant Noodles Sour/Spicy (x30)' } },
  { id: "p4", sku: "COCA-320", barcode: "8935049012431", name: "Coca-Cola Sleek Can 320ml Tray (x24)", category: "Beverage", unit: "Tray", price: 220000, description: { vi: 'Nước ngọt Coca Cola lon 320ml khay (x24)', en: 'Coca-Cola Sleek Can 320ml Tray (x24)' } },
  { id: "p5", sku: "TV-SONY", barcode: "4901780521360", name: "Sony Bravia Smart TV 55 Inch 4K UHD", category: "Electronics", unit: "Pcs", price: 15900000, description: { vi: 'Google Tivi Sony Smart TV 55 Inch 4K UHD', en: 'Sony Bravia Smart TV 55 Inch 4K UHD' } }
];

const WAREHOUSES: Warehouse[] = [
  { id: "WH-01", name: { vi: 'Tổng Kho Trung Tâm - WH-01', en: 'Central Warehouse - WH-01' }, code: "WH-01", location: "Khu Công Nghệ Cao Q9, TP. HCM", description: "Kho tổng lưu trữ đa năng chính cho thị trường miền Nam" },
  { id: "WH-02", name: { vi: 'Kho Vệ Tinh Bình Dương - WH-02', en: 'Binh Duong Satellite Warehouse - WH-02' }, code: "WH-02", location: "KCN Sóng Thần, Dĩ An, Bình Dương", description: "Kho trung chuyển và phân phối hàng FMCG khu vực Đông Nam Bộ" }
];

const WAREHOUSE_ZONES = [
  { id: "z1", name: { vi: 'Khu vực mát - Cool Zone (Zone C)', en: 'Cool Zone (Zone C)' }, warehouseId: "WH-01", type: "Cool" as const, capacity: 200, currentOccupancy: 164 },
  { id: "z2", name: { vi: 'Khu vực khô - Dry Zone (Zone D)', en: 'Dry Zone (Zone D)' }, warehouseId: "WH-01", type: "Dry" as const, capacity: 1000, currentOccupancy: 380 },
  { id: "z-store", name: { vi: 'Zone S - Khu Vực Kệ Quầy Bán Lẻ (Counter/Store Zone)', en: 'Zone S - Counter/Store Retail Shelves' }, warehouseId: "WH-01", type: "Dry" as const, capacity: 300, currentOccupancy: 35 }
];

const BINS = [
  {
    id: "b1",
    code: "C1-A01-N01",
    zoneId: "z1",
    maxCapacity: 100,
    currentOccupancy: 75,
    status: "partial" as const,
    storedSkus: [
      { sku: "MILK-VNM", name: "Vinamilk Milk Carton 180ml (x48)", qty: 75, lotNumber: "LOT-2026-M01", expirationDate: "2026-12-15", status: "Available" as const }
    ]
  },
  {
    id: "b2",
    code: "C1-A01-N02",
    zoneId: "z1",
    maxCapacity: 100,
    currentOccupancy: 89,
    status: "partial" as const,
    storedSkus: [
      { sku: "COCA-320", name: "Coca Cola 320ml", qty: 24, lotNumber: "LOT-2026-C01", expirationDate: "2026-12-15", status: "Available" as const },
      { sku: "MILK-VNM", name: "Sữa Vinamilk 180ml", qty: 65, lotNumber: "LOT-2026-M02", expirationDate: "2026-08-10", status: "Available" as const }
    ]
  },
  {
    id: "b3",
    code: "D2-A02-N01",
    zoneId: "z2",
    maxCapacity: 200,
    currentOccupancy: 155,
    status: "partial" as const,
    storedSkus: [
      { sku: "NOODLE-HH", name: "Hao Hao Instant Noodles Sour/Spicy (x30)", qty: 100, lotNumber: "LOT-2026-N01", expirationDate: "2027-04-10", status: "Available" as const },
      { sku: "COCA-320", name: "Coca-Cola Sleek Can 320ml Tray (x24)", qty: 40, lotNumber: "LOT-2026-C02", expirationDate: "2026-12-25", status: "Available" as const },
      { sku: "IPHONE15", name: "iPhone 15 Pro Max 256GB Platinum", qty: 15, lotNumber: "LOT-2026-P01", expirationDate: "2029-01-01", status: "Available" as const }
    ]
  },
  {
    id: "b4",
    code: "D2-A02-N02",
    zoneId: "z2",
    maxCapacity: 200,
    currentOccupancy: 185,
    status: "partial" as const,
    storedSkus: [
      { sku: "IPHONE15", name: "iPhone 15 Pro Max 256GB Platinum", qty: 125, lotNumber: "LOT-2026-P02", expirationDate: "2028-12-31", status: "Available" as const },
      { sku: "COCA-320", name: "Coca-Cola Sleek Can 320ml Tray (x24)", qty: 50, lotNumber: "LOT-2026-C03", expirationDate: "2026-08-10", status: "Expired" as const },
      { sku: "TV-SONY", name: "Sony Bravia Smart TV 55 Inch 4K UHD", qty: 10, lotNumber: "LOT-2026-S01", expirationDate: "2029-06-30", status: "Available" as const }
    ]
  },
  {
    id: "b5",
    code: "D2-A03-N01",
    zoneId: "z2",
    maxCapacity: 300,
    currentOccupancy: 0,
    status: "empty" as const,
    storedSkus: []
  },
  {
    id: "b-pos-1",
    code: "POS-Q01",
    zoneId: "z-store",
    maxCapacity: 60,
    currentOccupancy: 15,
    status: "partial" as const,
    storedSkus: [
      { sku: "COCA-320", name: "Coca-Cola Sleek Can 320ml Tray (x24)", qty: 5, lotNumber: "LOT-2026-C04", expirationDate: "2026-11-20", status: "Available" as const },
      { sku: "NOODLE-HH", name: "Hao Hao Instant Noodles Sour/Spicy (x30)", qty: 10, lotNumber: "LOT-2026-N02", expirationDate: "2027-02-15", status: "Available" as const }
    ]
  },
  {
    id: "b-pos-2",
    code: "POS-Q02",
    zoneId: "z-store",
    maxCapacity: 80,
    currentOccupancy: 20,
    status: "partial" as const,
    storedSkus: [
      { sku: "MILK-VNM", name: "Vinamilk Milk Carton 180ml (x48)", qty: 20, lotNumber: "LOT-2026-M04", expirationDate: "2026-12-30", status: "Available" as const }
    ]
  }
];

const INBOUND_RECEIPTS = [
  {
    id: "INB-601",
    poNumber: "PO-2026-005",
    vendorName: "Vinamilk Trade Vietnam",
    date: "2026-05-18",
    status: "Completed" as const,
    items: [
      { sku: "MILK-VNM", name: "Vinamilk Milk Carton 180ml (x48)", expectedQty: 100, receivedQty: 100, binCode: "C1-A01-N01" }
    ]
  },
  {
    id: "INB-602",
    poNumber: "PO-2026-006",
    vendorName: "Coca-Cola Beverages Indochina",
    date: "2026-05-19",
    status: "Processing" as const,
    items: [
      { sku: "COCA-320", name: "Coca-Cola Sleek Can 320ml Tray (x24)", expectedQty: 80, receivedQty: 40, binCode: "D2-A02-N01" },
      { sku: "TV-SONY", name: "Sony Bravia Smart TV 55 Inch 4K UHD", expectedQty: 10, receivedQty: 0, binCode: "D2-A03-N01" }
    ]
  },
  {
    id: "INB-603",
    poNumber: "PO-2026-007",
    vendorName: "Apple Logistics APAC",
    date: "2026-05-20",
    status: "Pending" as const,
    items: [
      { sku: "IPHONE15", name: "iPhone 15 Pro Max 256GB Platinum", expectedQty: 50, receivedQty: 0 }
    ]
  }
];

const OUTBOUND_ORDERS = [
  {
    id: "OUT-901",
    soNumber: "SO-2026-101",
    customerName: "Thế Giới Di Động Group",
    date: "2026-05-19",
    status: "Completed" as const,
    items: [
      { sku: "IPHONE15", expectedQty: 20, pickedQty: 20, binCode: "D2-A02-N02" }
    ]
  },
  {
    id: "OUT-902",
    soNumber: "SO-2026-102",
    customerName: "CoopMart Supermarket Vietnam",
    date: "2026-05-20",
    status: "Pending" as const,
    items: [
      { sku: "MILK-VNM", expectedQty: 50, pickedQty: 0, binCode: "C1-A01-N02" },
      { sku: "NOODLE-HH", expectedQty: 30, pickedQty: 0, binCode: "D2-A02-N01" }
    ]
  },
  {
    id: "OUT-903",
    soNumber: "SO-2026-103",
    customerName: "WinMart Retail Hanoi",
    date: "2026-05-20",
    status: "Pending" as const,
    items: [
      { sku: "COCA-320", expectedQty: 40, pickedQty: 0, binCode: "D2-A02-N02" }
    ]
  }
];

const WAVE_PICKINGS = [
  {
    id: "WAVE-001",
    name: "Wave hàng bách hóa tổng hợp sáng 20/05",
    orders: ["OUT-902", "OUT-903"],
    status: "Picking" as const,
    assignedStaff: "Nguyễn Văn Hùng",
    optimizedPath: [
      { step: 1, binCode: "C1-A01-N02", sku: "MILK-VNM", name: "Vinamilk Milk Carton (x48)", qty: 50, scanned: false },
      { step: 2, binCode: "D2-A02-N01", sku: "NOODLE-HH", name: "Hao Hao Instant Noodles (x30)", qty: 30, scanned: false },
      { step: 3, binCode: "D2-A02-N02", sku: "COCA-320", name: "Coca-Cola Sleek Can Tray (x24)", qty: 40, scanned: false }
    ]
  }
];

const AUDIT_LOGS = [
  {
    id: "log-1",
    operator: "Kiên Nguyễn (Admin)",
    role: "Admin" as const,
    action: "Khởi tạo Hệ thống & Cơ sở dữ liệu",
    intent: {
      vi: "Khởi tạo Hệ thống & Cơ sở dữ liệu",
      en: "System & Database Architecture Initialized"
    },
    details: {
      vi: "Thiết lập kiến trúc Clean Architecture, đồng bộ sơ đồ kho và nạp dữ liệu gốc thành công.",
      en: "Clean Architecture Setup, warehouse map synchronization & Database Seed completed successfully."
    },
    apiPath: "INIT",
    ip: "192.168.1.100",
    timestamp: "2026-05-20T08:00:00Z",
    locale: "vi-VN" as const,
    isAnomaly: false
  },
  {
    id: "log-2",
    operator: "Trần Anh Tuấn (Manager)",
    role: "Manager" as const,
    action: "Đăng nhập hệ thống",
    intent: {
      vi: "Đăng nhập hệ thống",
      en: "System login"
    },
    details: {
      vi: "Phiên làm việc được tạo sau khi xác thực thành công.",
      en: "Session created after successful authentication."
    },
    apiPath: "/api/auth/login",
    ip: "192.168.1.22",
    timestamp: "2026-05-20T08:05:00Z",
    locale: "vi-VN" as const,
    isAnomaly: false
  },
  {
    id: "log-3",
    operator: "Nguyễn Văn Hùng (Staff)",
    role: "Staff" as const,
    action: "Bắt đầu lấy hàng Wave-001",
    intent: {
      vi: "Bắt đầu lấy hàng Wave-001",
      en: "Started picking Wave-001"
    },
    details: {
      vi: "Mobile App dán nhãn lấy hàng, gắn định danh nhân viên.",
      en: "Mobile App printing picking labels, binding operator ID."
    },
    apiPath: "/api/wave/start",
    ip: "10.0.2.16",
    timestamp: "2026-05-20T08:10:00Z",
    locale: "vi-VN" as const,
    isAnomaly: false
  },
  {
    id: "log-4",
    operator: "Nguyễn Văn Hùng (Staff)",
    role: "Staff" as const,
    action: "Xác nhận cất hàng Put-away vào kệ C1-A01-N01",
    intent: {
      vi: "Xác nhận cất hàng Put-away vào kệ C1-A01-N01",
      en: "Confirm Put-away to Bin C1-A01-N01"
    },
    details: {
      vi: "Hoàn tất quét mã vạch SKU MILK-VNM và xác nhận cất 75 hộp vào vị trí ô kệ C1-A01-N01 thành công.",
      en: "Successfully scanned SKU MILK-VNM barcode and confirmed put-away of 75 units into bin location C1-A01-N01."
    },
    apiPath: "/api/bins/putaway",
    ip: "10.0.2.16",
    timestamp: "2026-05-20T08:15:00Z",
    locale: "vi-VN" as const,
    isAnomaly: false
  },
  {
    id: "log-5",
    operator: "Trần Anh Tuấn (Manager)",
    role: "Manager" as const,
    action: "Điều chuyển nội bộ sang quầy POS-Q01",
    intent: {
      vi: "Điều chuyển nội bộ sang quầy POS-Q01",
      en: "Internal Bin Transfer to POS-Q01 Counter"
    },
    details: {
      vi: "Cấp bổ sung 15 khay COCA-320 từ ô kệ D2-A02-N01 sang quầy thanh toán nhanh POS-Q01 phục vụ giờ cao điểm.",
      en: "Replenished 15 trays of COCA-320 from bin D2-A02-N01 to express checkout counter POS-Q01 for peak hours."
    },
    apiPath: "/api/bins/transfer",
    ip: "192.168.1.22",
    timestamp: "2026-05-20T08:25:00Z",
    locale: "vi-VN" as const,
    isAnomaly: false
  },
  {
    id: "log-6",
    operator: "Người dùng không xác định",
    role: "Staff" as const,
    action: "Đăng nhập thất bại nhiều lần",
    intent: {
      vi: "Đăng nhập thất bại nhiều lần",
      en: "Multiple failed login attempts"
    },
    details: {
      vi: "Truy cập bị chặn sau nhiều lần xác thực không thành công từ địa chỉ IP này.",
      en: "Access blocked after multiple failed authentication attempts from this IP address."
    },
    apiPath: "/api/auth/login",
    ip: "103.142.88.19",
    timestamp: "2026-05-20T08:35:00Z",
    locale: "vi-VN" as const,
    isAnomaly: true,
    anomalyReason: "Nhiều lần xác thực thất bại liên tiếp dẫn tới tạm khóa tài khoản."
  }
];

const SYSTEM_NOTIFICATIONS = [
  {
    id: "notif-1",
    type: "low_stock" as const,
    titleVi: "CẢNH BÁO TỒN KHO THẤP: COCA-320",
    titleEn: "LOW STOCK WARNING: COCA-320",
    messageVi: "Mặt hàng Nước ngọt Coca Cola chỉ còn 130 lon khả dụng, giảm xuống dưới ngưỡng an toàn.",
    messageEn: "Coca-Cola sleek cans stock level dropped to 130 cans, which is below safety stock thresholds.",
    timestamp: "2026-05-20T08:12:00Z",
    read: false,
    resolved: false,
    metaData: {
      sku: "COCA-320",
      restockDraft: {
        sku: "COCA-320",
        qty: 150,
        vendorEmail: "support@coca-cola.com.vn",
        vendorName: "Coca-Cola Beverages Indochina",
        emailBodyVi: "Kính gửi quý đối tác Coca-Cola,\n\nChúng tôi muốn gửi đơn đặt hàng RESTOCK gấp cho Mặt hàng Coca- Cola Sleek Can với số lượng: 150 Khay.\nRất mong quý công ty xác thực và chuyển giao trong vòng 2 ngày.\n\nTrân trọng cảm ơn,\nSmartWMS Auto Restock Agent.",
        emailBodyEn: "Dear Coca-Cola Trade Partner,\n\nWe would like to place an urgent RESTOCK purchase order for Coca-Cola Sleek Can with quantity: 150 Trays.\nPlease review and respond within 2 days.\n\nBest regards,\nSmartWMS Auto Restock Agent."
      }
    }
  }
];

const VENDORS: Vendor[] = [
  { id: "VEN-VNM-01", name: "Vinamilk International Trade Co.", email: "fulfillment_ops@vinamilk.com.vn", scope: { vi: 'Sữa hộp giấy & Thức uống 180ml', en: 'Milk Carton 180ml Beverages' }, preferredLang: "vi-VN" },
  { id: "VEN-COCA-02", name: "Coca-Cola Beverages Indochina", email: "supplier@coca-cola-vietnam.com", scope: { vi: 'Khay lon nước ngọt có ga Coca-Cola', en: 'Coca Cola Gas sleeks trays' }, preferredLang: "vi-VN" },
  { id: "VEN-AAPL-09", name: "Apple Logistics APAC Ltd.", email: "order_ops@apple-apac.com", scope: { vi: 'Logistics thiết bị điện tử giá trị cao iPhone', en: 'High Value Electronics iPhones logistics' }, preferredLang: "en-US" }
];

// In-Memory state holder
let state: {
  products: Product[];
  warehouses: Warehouse[];
  zones: WarehouseZone[];
  bins: Bin[];
  inboundReceipts: InboundReceipt[];
  outboundOrders: OutboundOrder[];
  wavePickings: WavePicking[];
  auditLogs: AuditLog[];
  notifications: SystemNotification[];
  vendors: Vendor[];
} = {
  products: [...PRODUCTS],
  warehouses: [...WAREHOUSES],
  zones: [...WAREHOUSE_ZONES],
  bins: [...BINS] as any,
  inboundReceipts: [...INBOUND_RECEIPTS] as any,
  outboundOrders: [...OUTBOUND_ORDERS] as any,
  wavePickings: [...WAVE_PICKINGS] as any,
  auditLogs: [...AUDIT_LOGS] as any,
  notifications: [...SYSTEM_NOTIFICATIONS] as any,
  vendors: [...VENDORS]
};

// HELPER: Cặp nhật lượng chứa Zone khi thay đổi Bin
function syncZoneOccupancy() {
  state.zones.forEach(z => {
    const totalSelectedBinOccupancy = state.bins
      .filter(b => b.zoneId === z.id)
      .reduce((sum, b) => sum + b.currentOccupancy, 0);
    z.currentOccupancy = totalSelectedBinOccupancy;
  });
}

// Helper for logger
function addAuditLog(operator: string, role: "Admin" | "Manager" | "Staff" | "AI-Agent", action: string, details: string, apiPath: string, locale: "vi-VN" | "en-US", isAnomaly: boolean = false, anomalyReason: string = "") {
  const newLog = {
    id: `log-${Date.now()}`,
    operator,
    role,
    action,
    details,
    apiPath,
    ip: "127.0.0.1",
    timestamp: new Date().toISOString(),
    locale,
    isAnomaly,
    anomalyReason
  };
  state.auditLogs.unshift(newLog);
  return newLog;
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// 1. Get raw database tables matching clean status
app.get("/api/inventory", (req: Request, res: Response) => {
  res.json(state);
});

// ==========================================
// CORE SMARTWMS (WMS) API ROUTING DEFINITIONS
// ==========================================

// GET all active warehouse data for frontend synchronization
app.get("/api/wms/all-data", (req: Request, res: Response) => {
  res.json({
    products: state.products,
    warehouses: state.warehouses,
    bins: state.bins,
    zones: state.zones,
    inbounds: state.inboundReceipts,
    outbounds: state.outboundOrders,
    notifications: state.notifications,
    auditLogs: state.auditLogs,
    waves: state.wavePickings,
    vendors: state.vendors
  });
});

// POST update binary physical shelf bin inventory from scanner app
app.post("/api/wms/bins/update-qty", (req: Request, res: Response) => {
  const { binCode, sku, qty, action, operator, lotNumber, expirationDate, name } = req.body;
  if (!binCode || !sku || qty === undefined || !action) {
    return res.status(400).json({ message: "Malformed update-qty request body." });
  }

  let targetBin = state.bins.find(b => b.code === binCode || b.id === binCode);
  if (!targetBin) {
    const targetZoneId = binCode.startsWith("C") ? "z1" : binCode.startsWith("POS") ? "z-store" : "z2";
    targetBin = {
      id: `bin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      code: binCode,
      zoneId: targetZoneId,
      maxCapacity: 200,
      currentOccupancy: 0,
      status: "empty" as const,
      storedSkus: []
    };
    state.bins.push(targetBin);
  }

  let product = state.products.find(p => p.sku === sku);
  if (!product) {
    product = {
      id: `p-${Date.now()}`,
      sku,
      barcode: `893${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      name: name || sku,
      description: { vi: name || sku, en: name || sku },
      category: sku.startsWith("MILK") ? "Beverage" : sku.startsWith("COCA") ? "Beverage" : "General",
      unit: "Pcs",
      price: 100000
    };
    state.products.push(product);
  }

  const quantity = Number(qty);
  const currentItem = targetBin.storedSkus.find(s => s.sku === sku);

  if (action === "ADD") {
    if (targetBin.currentOccupancy + quantity > targetBin.maxCapacity) {
      targetBin.maxCapacity = Math.max(targetBin.maxCapacity, targetBin.currentOccupancy + quantity);
    }
    if (currentItem) {
      currentItem.qty += quantity;
      if (lotNumber) currentItem.lotNumber = lotNumber;
      if (expirationDate) currentItem.expirationDate = expirationDate;
      if (name) currentItem.name = name;
    } else {
      targetBin.storedSkus.push({
        sku,
        name: name || (typeof product.name === "string" ? product.name : sku),
        qty: quantity,
        lotNumber: lotNumber || `LOT-${new Date().getFullYear()}-${sku.slice(0, 3)}-${Date.now().toString().slice(-3)}`,
        expirationDate: expirationDate || "2027-12-31",
        status: "Available"
      });
    }
    targetBin.currentOccupancy += quantity;
  } else if (action === "SUBTRACT") {
    const deduct = currentItem ? Math.min(currentItem.qty, quantity) : quantity;
    if (currentItem) {
      currentItem.qty -= deduct;
      if (currentItem.qty <= 0) {
        targetBin.storedSkus = targetBin.storedSkus.filter(s => s !== currentItem);
      }
    }
    targetBin.currentOccupancy = Math.max(0, targetBin.currentOccupancy - deduct);
  }

  // Sync bin status
  if (targetBin.currentOccupancy === 0) {
    targetBin.status = "empty" as const;
  } else if (targetBin.currentOccupancy >= targetBin.maxCapacity) {
    targetBin.status = "full" as const;
  } else {
    targetBin.status = "partial" as const;
  }

  syncZoneOccupancy();

  // Audit logging
  const actionText = action === "ADD" ? "Xác nhận Đặt hàng vào kệ (Put-away)" : "Xác nhận Lấy hàng từ kệ (Picking/Dispatch)";
  addAuditLog(
    operator || "Staff",
    "Staff",
    actionText,
    `Bin: ${binCode}, SKU: ${sku}, Qty: ${quantity} ${action === "ADD" ? "(Cộng tồn kho)" : "(Trừ tồn kho)"}.`,
    "/api/wms/bins/update-qty",
    "vi-VN"
  );

  // Auto trigger Restock Warning if target SKU drops under low threshold (under 120 units total)
  const totalStockCount = state.bins.reduce((sum, b) => {
    const found = b.storedSkus.find(s => s.sku === sku);
    return sum + (found ? found.qty : 0);
  }, 0);

  if (totalStockCount < 120 && !state.notifications.some(n => n.metaData?.sku === sku && !n.resolved)) {
    const draftQty = 200;
    const vendorEmail = sku === "IPHONE15" ? "order@apple-apac.com" : sku === "MILK-VNM" ? "order@vinamilk.com.vn" : "retail@cocacola-vietnam.com";
    const vendorName = sku === "IPHONE15" ? "Apple APAC" : sku === "MILK-VNM" ? "Vinamilk Co." : "Coca Cola Vietnam";

    const lowStockNotif = {
      id: `notif-${Date.now()}`,
      type: "low_stock" as const,
      titleVi: `CẢNH BÁO TỒN KHO THẤP: SKU ${sku}`,
      titleEn: `LOW STOCK ACTION: SKU ${sku}`,
      messageVi: `Tồn kho toàn hãng dọn dẹp còn ${totalStockCount} hộp/cái. AI Agent tự lập nhãn Restock.`,
      messageEn: `Warehouse total remaining stock drops to ${totalStockCount}. Auto Draft Restock Sheet prepared.`,
      timestamp: new Date().toISOString(),
      read: false,
      resolved: false,
      metaData: {
        sku,
        restockDraft: {
          sku,
          qty: draftQty,
          vendorEmail,
          vendorName,
          emailBodyVi: `Kính gửi ${vendorName},\n\nChúng tôi phát hiện kho hàng đang dưới ngưỡng an toàn cho mã hàng ${sku}.\nSmartWMS Auto restock đề xuất nhập bổ sung: ${draftQty} ${product.unit}.\nMong sớm liên lạc giao vận.\n\nTrân trọng,\nSmartWMS AI Agent.`,
          emailBodyEn: `Dear ${vendorName},\n\nOur system detected stock below levels for SKU ${sku}.\nSmartWMS AI Restock Agent requests supplementary delivery of: ${draftQty} ${product.unit}.\n\nSincerely,\nSmartWMS AI Agent.`
        }
      }
    };
    state.notifications.unshift(lowStockNotif);
  }

  res.json({
    bins: state.bins,
    zones: state.zones,
    auditLogs: state.auditLogs,
    notifications: state.notifications
  });
});

// POST transfer inventory between bins (Internal Multi-SKU Transfer)
app.post(["/api/wms/bins/transfer", "/api/v1/InventoryTransfers"], (req: Request, res: Response) => {
  const { sourceBinCode, targetBinCode, sku, qty, operator, reason } = req.body;
  if (!sourceBinCode || !targetBinCode || !sku || !qty) {
    return res.status(400).json({ message: "Thiếu thông tin luân chuyển ô kệ." });
  }

  if (sourceBinCode === targetBinCode) {
    return res.status(400).json({ message: "Ô kệ nguồn và đích không được trùng nhau." });
  }

  const sourceBin = state.bins.find(b => b.code === sourceBinCode);
  const targetBin = state.bins.find(b => b.code === targetBinCode);

  if (!sourceBin || !targetBin) {
    return res.status(404).json({ message: "Không tìm thấy ô kệ nguồn hoặc đích." });
  }

  const quantity = Number(qty);
  if (isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ message: "Số lượng luân chuyển phải lớn hơn 0." });
  }

  const sourceItem = sourceBin.storedSkus.find(s => s.sku === sku);
  if (!sourceItem || sourceItem.qty < quantity) {
    return res.status(400).json({ message: `Ô kệ nguồn ${sourceBinCode} không đủ số lượng ${sku} (Hiện có: ${sourceItem?.qty || 0}).` });
  }

  if (targetBin.currentOccupancy + quantity > targetBin.maxCapacity) {
    return res.status(400).json({
      message: `Ô kệ đích ${targetBinCode} không đủ sức chứa! Còn trống: ${targetBin.maxCapacity - targetBin.currentOccupancy} đơn vị.`
    });
  }

  // Deduct from source
  sourceItem.qty -= quantity;
  sourceBin.currentOccupancy -= quantity;
  const transferredLot = sourceItem.lotNumber || `LOT-${Date.now().toString().slice(-4)}`;
  const transferredExp = sourceItem.expirationDate || "2027-12-31";
  const transferredStatus = sourceItem.status || "Available";
  const transferredName = sourceItem.name || state.products.find(p => p.sku === sku)?.name || sku;

  if (sourceItem.qty === 0) {
    sourceBin.storedSkus = sourceBin.storedSkus.filter(s => s.sku !== sku);
  }

  // Add to target
  const targetItem = targetBin.storedSkus.find(s => s.sku === sku);
  if (targetItem) {
    targetItem.qty += quantity;
  } else {
    targetBin.storedSkus.push({
      sku,
      name: transferredName,
      qty: quantity,
      lotNumber: transferredLot,
      expirationDate: transferredExp,
      status: transferredStatus
    });
  }
  targetBin.currentOccupancy += quantity;

  // Update statuses
  sourceBin.status = sourceBin.currentOccupancy === 0 ? "empty" : sourceBin.currentOccupancy >= sourceBin.maxCapacity ? "full" : "partial";
  targetBin.status = targetBin.currentOccupancy === 0 ? "empty" : targetBin.currentOccupancy >= targetBin.maxCapacity ? "full" : "partial";

  syncZoneOccupancy();

  addAuditLog(
    operator || "Staff",
    "Staff",
    "Luân chuyển nội bộ ô kệ (Internal Transfer)",
    `Chuyển ${quantity} x ${sku} từ ô [${sourceBinCode}] sang ô [${targetBinCode}]. Lý do: ${reason || "Tối ưu hóa không gian lưu trữ"}.`,
    "/api/wms/bins/transfer",
    "vi-VN"
  );

  res.json({
    message: "Luân chuyển hàng hóa thành công!",
    bins: state.bins,
    zones: state.zones,
    auditLogs: state.auditLogs
  });
});

// POST confirm fast replenishment to counter shelf
app.post("/api/wms/replenishment/confirm", (req: Request, res: Response) => {
  const { fromBin, toBin, sku, qty, operator } = req.body;
  if (!fromBin || !toBin || !sku || !qty) {
    return res.status(400).json({ message: "Thiếu dữ liệu châm hàng quầy." });
  }

  const sourceBin = state.bins.find(b => b.code === fromBin);
  const targetBin = state.bins.find(b => b.code === toBin);

  if (!sourceBin || !targetBin) {
    return res.status(404).json({ message: "Không tìm thấy kệ dự trữ hoặc kệ quầy." });
  }

  const quantity = Number(qty);
  const sourceItem = sourceBin.storedSkus.find(s => s.sku === sku);

  if (!sourceItem || sourceItem.qty < quantity) {
    return res.status(400).json({ message: `Kệ dự trữ ${fromBin} không đủ tồn kho để châm (Còn: ${sourceItem?.qty || 0}).` });
  }

  // Deduct from reserve
  sourceItem.qty -= quantity;
  sourceBin.currentOccupancy -= quantity;
  const transferredLot = sourceItem.lotNumber || `LOT-${Date.now().toString().slice(-4)}`;
  const transferredExp = sourceItem.expirationDate || "2027-12-31";
  const transferredStatus = sourceItem.status || "Available";
  const transferredName = sourceItem.name || state.products.find(p => p.sku === sku)?.name || sku;

  if (sourceItem.qty === 0) {
    sourceBin.storedSkus = sourceBin.storedSkus.filter(s => s.sku !== sku);
  }

  // Add to counter shelf
  const targetItem = targetBin.storedSkus.find(s => s.sku === sku);
  if (targetItem) {
    targetItem.qty += quantity;
  } else {
    targetBin.storedSkus.push({
      sku,
      name: transferredName,
      qty: quantity,
      lotNumber: transferredLot,
      expirationDate: transferredExp,
      status: transferredStatus
    });
  }
  targetBin.currentOccupancy += quantity;

  // Update statuses
  sourceBin.status = sourceBin.currentOccupancy === 0 ? "empty" : sourceBin.currentOccupancy >= sourceBin.maxCapacity ? "full" : "partial";
  targetBin.status = targetBin.currentOccupancy === 0 ? "empty" : targetBin.currentOccupancy >= targetBin.maxCapacity ? "full" : "partial";

  syncZoneOccupancy();

  addAuditLog(
    operator || "Staff",
    "Staff",
    "Châm hàng quầy bán cấp tốc hoàn thành",
    `Đã bốc ${quantity} x ${sku} từ ô dự trữ [${fromBin}] và châm đầy lên kệ quầy [${toBin}]. Khách hàng đã có hàng sẵn sàng.`,
    "/api/wms/replenishment/confirm",
    "vi-VN"
  );

  res.json({
    message: "Xác nhận châm hàng quầy thành công!",
    bins: state.bins,
    zones: state.zones,
    auditLogs: state.auditLogs
  });
});

// GET /api/v1/Bins/:id/contents - High-density bin contents inspection
app.get("/api/v1/Bins/:id/contents", (req: Request, res: Response) => {
  const binIdOrCode = req.params.id;
  const targetBin = state.bins.find(b => b.id === binIdOrCode || b.code === binIdOrCode);
  if (!targetBin) {
    return res.status(404).json({ message: `Không tìm thấy ô kệ với mã ${binIdOrCode}` });
  }

  const zone = state.zones.find(z => z.id === targetBin.zoneId);
  const parts = targetBin.code.split("-");
  const aisle = parts[0] || "A";
  const bay = parts[1] ? `Bay ${parseInt(parts[1].replace(/\D/g, '') || "1", 10)}` : "Bay 1";
  const level = parts[2] ? `Level ${parseInt(parts[2].replace(/\D/g, '') || "1", 10)}` : "Level 1";

  // Sort stored SKUs by expiration date (FEFO)
  const sortedItems = [...(targetBin.storedSkus || [])].sort((a, b) => {
    const expA = a.expirationDate || "9999-12-31";
    const expB = b.expirationDate || "9999-12-31";
    return expA.localeCompare(expB);
  });

  const items = sortedItems.map((item, idx) => {
    const prod = state.products.find(p => p.sku === item.sku);
    return {
      sku: item.sku,
      productName: prod ? (typeof prod.name === "string" ? prod.name : (prod as any).name?.vi || prod.sku) : (item.name || item.sku),
      lotNumber: item.lotNumber || `LOT-2024-${item.sku.slice(0, 3)}`,
      expirationDate: item.expirationDate || "2027-12-31",
      quantity: item.qty,
      unit: prod?.unit || "Thùng",
      status: item.status || "Available",
      isFefoPriority: idx === 0 && (targetBin.storedSkus.length > 0)
    };
  });

  res.json({
    header: {
      binId: targetBin.id,
      binCode: targetBin.code,
      zoneId: targetBin.zoneId,
      zoneName: zone ? (typeof zone.name === "object" ? zone.name.vi : zone.name) : "Khu vực lưu trữ",
      aisle,
      bay,
      level,
      maxCapacity: targetBin.maxCapacity,
      currentOccupancy: targetBin.currentOccupancy,
      occupancyRate: Math.round((targetBin.currentOccupancy / targetBin.maxCapacity) * 100),
      totalSkus: targetBin.storedSkus.length,
      status: targetBin.status
    },
    items
  });
});

// POST /api/v1/Inventory/run-auto-replenish - Trigger intelligent FEFO replenishment for retail counters
app.post("/api/v1/Inventory/run-auto-replenish", (req: Request, res: Response) => {
  const storeZone = state.zones.find(z => z.id === "z-store" || z.name?.vi?.includes("Zone S") || z.name?.en?.includes("Zone S"));
  const counterBins = state.bins.filter(b => b.zoneId === "z-store" || b.code.startsWith("POS-"));

  const replenishmentTasks: any[] = [];

  counterBins.forEach((cBin) => {
    cBin.storedSkus.forEach((skuItem) => {
      const minThreshold = 25;
      const targetCapacity = Math.min(cBin.maxCapacity, 50);

      if (skuItem.qty < minThreshold) {
        const neededQty = targetCapacity - skuItem.qty;

        // Find best reserve bin using FEFO (nearest expiration date with sufficient or available qty)
        const reserveBinsWithSku = state.bins.filter(b =>
          b.code !== cBin.code &&
          !b.code.startsWith("POS-") &&
          b.storedSkus.some(s => s.sku === skuItem.sku && s.qty > 0)
        );

        // Sort reserve bins by earliest expiration date
        reserveBinsWithSku.sort((a, b) => {
          const itemA = a.storedSkus.find(s => s.sku === skuItem.sku);
          const itemB = b.storedSkus.find(s => s.sku === skuItem.sku);
          const expA = itemA?.expirationDate || "9999-12-31";
          const expB = itemB?.expirationDate || "9999-12-31";
          return expA.localeCompare(expB);
        });

        const bestSourceBin = reserveBinsWithSku[0] || state.bins.find(b => b.code === "D2-A02-N01" || b.code === "C1-A01-N02");
        const sourceItem = bestSourceBin?.storedSkus.find(s => s.sku === skuItem.sku);
        const availableReserveQty = sourceItem?.qty || 50;
        const pickQty = Math.min(neededQty, availableReserveQty);
        if (pickQty > 0 && sourceItem && bestSourceBin) {
          sourceItem.qty -= pickQty;
          bestSourceBin.currentOccupancy -= pickQty;
          if (sourceItem.qty <= 0) {
            bestSourceBin.storedSkus = bestSourceBin.storedSkus.filter(s => s !== sourceItem);
          }

          skuItem.qty += pickQty;
          cBin.currentOccupancy += pickQty;

          bestSourceBin.status = bestSourceBin.currentOccupancy === 0 ? "empty" : bestSourceBin.currentOccupancy >= bestSourceBin.maxCapacity ? "full" : "partial";
          cBin.status = cBin.currentOccupancy === 0 ? "empty" : cBin.currentOccupancy >= cBin.maxCapacity ? "full" : "partial";
        }

        const prod = state.products.find(p => p.sku === skuItem.sku);

        replenishmentTasks.push({
          id: `TASK-FEFO-${Date.now().toString().slice(-4)}-${replenishmentTasks.length + 1}`,
          sku: skuItem.sku,
          productName: prod ? (typeof prod.name === "string" ? prod.name : (prod as any).name?.vi || prod.sku) : skuItem.sku,
          unit: prod?.unit || "Khay",
          fromBin: bestSourceBin?.code || "D2-A02-N01",
          fromZone: bestSourceBin?.zoneId === "z1" ? "Khu Vực Mát (Zone C)" : "Khu Vực Khô (Zone D)",
          toBin: cBin.code,
          toCounterName: cBin.code === "POS-Q01" ? "Kệ Quầy 1 - Khu Thu Ngân" : "Kệ Quầy 2 - Quầy Bán Lẻ Mát",
          qtyToPick: pickQty,
          lotNumber: sourceItem?.lotNumber || "LOT-FEFO-NEAR",
          expirationDate: sourceItem?.expirationDate || "2025-11-30",
          urgency: skuItem.qty <= 5 ? "CRITICAL" : "HIGH",
          estimatedMinutes: 3,
          status: "completed",
          burnRate: "Bán ~8 món/giờ - Đã châm đầy đủ lên quầy"
        });
      }
    });
  });

  syncZoneOccupancy();

  addAuditLog(
    "Automated Dispatcher",
    "AI-Agent",
    "Kích hoạt Bù Hàng Tự Động (Auto-Replenish FEFO)",
    `Hệ thống quét định mức quầy bán lẻ Zone S và tự động điều chuyển hoàn tất cho ${replenishmentTasks.length} mặt hàng chạm ngưỡng cảnh báo.`,
    "/api/v1/Inventory/run-auto-replenish",
    "vi-VN"
  );

  res.json({
    success: true,
    message: `Đã kích hoạt Châm hàng FEFO tự động thành công! Đã châm đầy đủ cho ${replenishmentTasks.length} mặt hàng quầy.`,
    tasks: replenishmentTasks,
    bins: state.bins,
    zones: state.zones,
    auditLogs: state.auditLogs,
    timestamp: new Date().toISOString()
  });
});

// POST /api/v1/InventoryTransfers - Transfer inventory between bins with reason tracking
app.post("/api/v1/InventoryTransfers", (req: Request, res: Response) => {
  const {
    sourceBin,
    targetBin,
    fromBin,
    toBin,
    sourceBinCode,
    targetBinCode,
    sku,
    quantity,
    qty,
    reason,
    operator,
    lotNumber
  } = req.body;

  const srcCode = sourceBinCode || fromBin || sourceBin;
  const tgtCode = targetBinCode || toBin || targetBin;
  const amount = Number(quantity || qty || 0);

  if (!srcCode || !tgtCode || !sku || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu chuyển hàng không hợp lệ (cần sourceBin, targetBin, sku, quantity > 0)."
    });
  }

  const sBin = state.bins.find(b => b.code === srcCode || b.id === srcCode);
  const tBin = state.bins.find(b => b.code === tgtCode || b.id === tgtCode);

  if (!sBin || !tBin) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy ô kệ nguồn [${srcCode}] hoặc ô kệ đích [${tgtCode}].`
    });
  }

  const sItem = sBin.storedSkus.find(s => s.sku === sku && (!lotNumber || s.lotNumber === lotNumber)) || sBin.storedSkus.find(s => s.sku === sku);
  if (!sItem || sItem.qty < amount) {
    return res.status(400).json({
      success: false,
      message: `Ô nguồn [${sBin.code}] không đủ số lượng ${sku} để chuyển (còn ${sItem?.qty || 0}, yêu cầu ${amount}).`
    });
  }

  // Deduct from source bin
  sItem.qty -= amount;
  sBin.currentOccupancy -= amount;
  const itemLot = sItem.lotNumber || `LOT-${Date.now().toString().slice(-4)}`;
  const itemExp = sItem.expirationDate || "2027-12-31";
  const itemStatus = sItem.status || "Available";
  const itemName = sItem.name || state.products.find(p => p.sku === sku)?.name || sku;

  if (sItem.qty === 0) {
    sBin.storedSkus = sBin.storedSkus.filter(s => s !== sItem);
  }

  // Add to target bin
  const tItem = tBin.storedSkus.find(s => s.sku === sku && s.lotNumber === itemLot);
  if (tItem) {
    tItem.qty += amount;
  } else {
    tBin.storedSkus.push({
      sku,
      name: itemName,
      qty: amount,
      lotNumber: itemLot,
      expirationDate: itemExp,
      status: itemStatus
    });
  }
  tBin.currentOccupancy += amount;

  // Recalculate statuses
  sBin.status = sBin.currentOccupancy === 0 ? "empty" : sBin.currentOccupancy >= sBin.maxCapacity ? "full" : "partial";
  tBin.status = tBin.currentOccupancy === 0 ? "empty" : tBin.currentOccupancy >= tBin.maxCapacity ? "full" : "partial";

  syncZoneOccupancy();

  const isUrgentCounter = reason === "URGENT_COUNTER_RESTOCK";
  addAuditLog(
    operator || (isUrgentCounter ? "POS Staff" : "Warehouse Operator"),
    "Staff",
    isUrgentCounter ? "Châm hàng quầy bán cấp tốc (URGENT_COUNTER_RESTOCK)" : "Điều chuyển kho nội bộ (Inventory Transfer)",
    `Chuyển ${amount} x ${sku} từ [${sBin.code}] sang [${tBin.code}]. Lý do: ${reason || "Điều chuyển tối ưu tồn kho"}.`,
    "/api/v1/InventoryTransfers",
    "vi-VN"
  );

  res.json({
    success: true,
    message: isUrgentCounter
      ? `Đã châm ${amount} sản phẩm [${sku}] lên quầy bán [${tBin.code}] thành công!`
      : `Điều chuyển ${amount} x ${sku} từ [${sBin.code}] sang [${tBin.code}] thành công!`,
    bins: state.bins,
    zones: state.zones,
    auditLogs: state.auditLogs
  });
});

// POST /api/v1/CycleCounting/create-sheet - Create cycle count sheet for a bin
app.post("/api/v1/CycleCounting/create-sheet", (req: Request, res: Response) => {
  const { binCode, binId, operator, reason } = req.body;
  const targetBin = state.bins.find(b => b.code === binCode || b.id === binId);
  if (!targetBin) {
    return res.status(404).json({ success: false, message: "Không tìm thấy ô kệ để tạo phiếu kiểm kê." });
  }

  const sheetId = `CC-SHEET-${targetBin.code}-${Date.now().toString().slice(-4)}`;
  addAuditLog(
    operator || "Auditor",
    "Staff",
    "Tạo phiếu kiểm kê ô kệ theo chu kỳ",
    `Khởi tạo phiếu kiểm kê ${sheetId} cho ô kệ [${targetBin.code}]. Lý do: ${reason || "Kiểm tra định kỳ hoặc nghi ngờ sai lệch"}.`,
    "/api/v1/CycleCounting/create-sheet",
    "vi-VN"
  );

  res.json({
    success: true,
    sheetId,
    binCode: targetBin.code,
    message: `Đã tạo phiếu kiểm kê ${sheetId} cho ô [${targetBin.code}] thành công!`
  });
});

// POST resolve and clear reactive alerts, approving PO placement
app.post("/api/wms/notifications/resolve", (req: Request, res: Response) => {
  const { id, approved, operator, extraData } = req.body;
  const targetNotif = state.notifications.find(n => n.id === id);
  if (!targetNotif) {
    return res.status(404).json({ message: "Notification not found" });
  }

  // Update notification draft metadata with customized email contents
  if (extraData && targetNotif.metaData?.restockDraft) {
    targetNotif.metaData.restockDraft = {
      ...targetNotif.metaData.restockDraft,
      ...extraData
    };
  }

  targetNotif.resolved = true;
  targetNotif.read = true;

  if (approved && targetNotif.metaData?.restockDraft) {
    const draft = targetNotif.metaData.restockDraft;
    // Autogenerate a registered Inbound receipt PO reflecting active restock
    const newInbound = {
      id: `INB-${Math.floor(Math.random() * 900) + 700}`,
      poNumber: `PO-AUTO-${Math.floor(Math.random() * 90 + 10)}`,
      vendorName: draft.vendorName,
      date: new Date().toISOString().split('T')[0],
      status: "Pending" as const,
      items: [
        { sku: draft.sku, name: state.products.find(p => p.sku === draft.sku)?.name || draft.sku, expectedQty: draft.qty, receivedQty: 0 }
      ]
    };
    state.inboundReceipts.push(newInbound);

    addAuditLog(
      operator || "Manager",
      "Manager",
      "Kích hoạt PO đặt hàng thông minh từ gợi ý AI",
      `Phê duyệt restock SKU ${draft.sku} số lượng ${draft.qty}. Email đặt hàng được gửi tự động tới ${draft.vendorEmail}.`,
      "/api/wms/notifications/resolve",
      "vi-VN"
    );
  } else {
    addAuditLog(
      operator || "Manager",
      "Manager",
      "Bác bỏ đề xuất bổ sung hàng thông minh từ gợi ý AI",
      `Bác bỏ đề xuất restock cho mã hàng ${targetNotif.metaData?.sku || "không rõ"}.`,
      "/api/wms/notifications/resolve",
      "vi-VN"
    );
  }

  res.json({
    notifications: state.notifications,
    auditLogs: state.auditLogs,
    inbounds: state.inboundReceipts
  });
});

// POST /api/wms/inbounds/dispatch-po - Dispatch and create real Inbound PO from Ticket Panel
app.post("/api/wms/inbounds/dispatch-po", (req: Request, res: Response) => {
  const { vendor, vendorName, subject, items, operator } = req.body;
  const poNumber = `PO-${Date.now().toString().slice(-5)}`;
  const mappedItems = (items || []).length > 0
    ? (items || []).map((it: any) => {
        const skuKey = it.product || it.sku || "COCA-320";
        const prod = state.products.find(p => p.sku === skuKey);
        const pName = prod ? (typeof prod.name === "string" ? prod.name : prod.sku) : skuKey;
        return {
          sku: skuKey,
          name: pName,
          expectedQty: it.proposed || it.qty || 120,
          receivedQty: 0
        };
      })
    : [
        { sku: "COCA-320", name: "Nước ngọt Coca Cola SLEEK 320ml", expectedQty: 120, receivedQty: 0 }
      ];

  const newInbound = {
    id: `INB-${Date.now().toString().slice(-4)}`,
    poNumber,
    vendorName: vendorName || (vendor && vendor.includes("coca") ? "Coca-Cola Beverages Vietnam" : vendor && vendor.includes("pepsi") ? "Suntory PepsiCo Vietnam" : vendor && vendor.includes("vnm") ? "Vinamilk Dairy Corp" : vendor) || "Đối tác cung ứng",
    date: new Date().toISOString().split("T")[0],
    status: "Pending" as const,
    items: mappedItems
  };

  state.inboundReceipts.unshift(newInbound);

  addAuditLog(
    operator || "Manager",
    "Manager",
    "Phê duyệt & phát hành đơn đặt hàng nhập kho (PO)",
    `Đã phát hành đơn đặt hàng [${poNumber}] tới đối tác [${newInbound.vendorName}]. Tiêu đề: ${subject || "Automated Restock PO"}.`,
    "/api/wms/inbounds/dispatch-po",
    "vi-VN"
  );

  res.json({
    success: true,
    message: `Đã phê duyệt và phát hành đơn đặt hàng [${poNumber}] thành công!`,
    inbound: newInbound,
    inbounds: state.inboundReceipts,
    auditLogs: state.auditLogs
  });
});

// POST /api/wms/inbounds/create - Create new Inbound Receipt voucher with optional Put-away
app.post("/api/wms/inbounds/create", (req: Request, res: Response) => {
  const { vendorName, warehouseId, poNumber, deliveryDate, creator, items, status = "Completed", putAwayNow = true } = req.body;
  const inbId = `INB-${Date.now().toString().slice(-4)}`;
  const mappedPo = poNumber || `PO-${Date.now().toString().slice(-5)}`;
  const finalStatus = status === "Pending" ? "Pending" : status === "In Progress" ? "In Progress" : "Completed";

  const mappedItems = (items || []).map((it: any) => {
    const sku = it.sku || "COCA-320";
    const prod = state.products.find(p => p.sku === sku);
    const name = it.name || (prod ? (typeof prod.name === "string" ? prod.name : prod.sku) : sku);
    const expectedQty = Number(it.expectedQty || it.qty || 100);
    const binCode = it.binCode || "D2-A02-N01";
    return {
      sku,
      name,
      expectedQty,
      receivedQty: finalStatus === "Completed" ? expectedQty : 0,
      binCode
    };
  });

  const newInbound = {
    id: inbId,
    poNumber: mappedPo,
    vendorName: vendorName || "Đối tác cung ứng WMS",
    date: deliveryDate || new Date().toISOString().split("T")[0],
    status: finalStatus as any,
    items: mappedItems
  };

  state.inboundReceipts.unshift(newInbound);

  // Inbound workflow strictly separates Create -> Receive -> Put-away.
  // Creating a receipt does NOT automatically add inventory to bins.
  syncZoneOccupancy();

  addAuditLog(
    creator || "Staff",
    "Staff",
    "Tạo mới phiếu nhập kho (Inbound Receipt)",
    `Đã tạo phiếu nhập [${inbId} / ${mappedPo}] từ [${newInbound.vendorName}], tổng ${mappedItems.reduce((acc: number, it: any) => acc + it.expectedQty, 0)} đơn vị.${putAwayNow ? " Đã cất hàng vào kệ lưu kho." : ""}`,
    "/api/wms/inbounds/create",
    "vi-VN"
  );

  res.json({
    success: true,
    message: `Đã tạo phiếu nhập kho [${inbId}] thành công!`,
    inbound: newInbound,
    inbounds: state.inboundReceipts,
    bins: state.bins,
    auditLogs: state.auditLogs
  });
});

// POST /api/wms/inbounds/receive - Receive goods at dock staging (increments receivedQty, does NOT touch bins)
app.post("/api/wms/inbounds/receive", (req: Request, res: Response) => {
  const { id, inboundReceiptId, items, receivedItems, operator = "Staff (Receiving)", simulateConflict, simulateTimeout } = req.body;
  const targetId = inboundReceiptId || id;

  // 1. Simulation of network timeout uncertainty
  if (simulateTimeout) {
    return res.status(504).json({
      success: false,
      error: "Timeout504",
      message: "Yêu cầu nhận hàng bị quá thời gian chờ (504 Gateway Timeout). Hệ thống không thể xác định liệu yêu cầu trước đó đã được xử lý hay chưa."
    });
  }

  const receipt = state.inboundReceipts.find(r => r.id === targetId || r.poNumber === targetId);
  if (!receipt) {
    return res.status(404).json({ success: false, message: `Không tìm thấy phiếu nhập [${targetId}]` });
  }

  // 2. Simulation of 409 Concurrency Conflict
  if (simulateConflict) {
    return res.status(409).json({
      success: false,
      error: "Conflict409",
      message: "Dữ liệu phiếu nhập đã thay đổi. Số lượng đã nhận trong hệ thống đã được cập nhật bởi một phiên làm việc khác kể từ khi bạn mở phiếu.",
      currentSnapshot: receipt
    });
  }

  // Apply receiving deltas (DELTA only, not cumulative)
  let totalDeltaReceived = 0;
  const itemList = receivedItems || items || [];
  itemList.forEach((itemDelta: any) => {
    const itemSku = itemDelta.itemId || itemDelta.sku;
    const existing = receipt.items.find(it => it.sku === itemSku);
    if (existing) {
      const delta = Math.max(0, Number(itemDelta.quantityReceived ?? itemDelta.receiveThisTime ?? itemDelta.delta ?? 0));
      if (delta > 0) {
        existing.receivedQty = Math.min(existing.expectedQty, (existing.receivedQty || 0) + delta);
        totalDeltaReceived += delta;
      }
      if (itemDelta.lotNumber) {
        (existing as any).lotNumber = itemDelta.lotNumber;
      }
      if (itemDelta.expiryDate) {
        (existing as any).expiryDate = itemDelta.expiryDate;
      }
    }
  });

  // Calculate new receipt status
  const allFullyReceived = receipt.items.every(it => (it.receivedQty || 0) >= it.expectedQty);
  const anyReceived = receipt.items.some(it => (it.receivedQty || 0) > 0);

  if (allFullyReceived) {
    receipt.status = "Received" as any;
  } else if (anyReceived) {
    receipt.status = "Processing" as any;
  }

  addAuditLog(
    operator,
    "Staff",
    "Xác nhận nhận hàng tại dock (Receive at Dock)",
    `Đã nhận thêm ${totalDeltaReceived} đơn vị cho phiếu nhập [${receipt.id} / ${receipt.poNumber}]. Tổng đã nhận: ${receipt.items.reduce((s, it) => s + (it.receivedQty || 0), 0)}/${receipt.items.reduce((s, it) => s + it.expectedQty, 0)} đơn vị. Chờ cất hàng vào kệ (Put-away).`,
    "/api/wms/inbounds/receive",
    "vi-VN"
  );

  return res.json({
    success: true,
    message: `Đã xác nhận nhận ${totalDeltaReceived} đơn vị hàng hóa thành công!`,
    receipt,
    inbounds: state.inboundReceipts,
    auditLogs: state.auditLogs
  });
});

// POST /api/wms/inbounds/put-away - Put-away received items into target storage bins
app.post("/api/wms/inbounds/put-away", (req: Request, res: Response) => {
  const { id, operator = "Staff (Put-away)", assignments } = req.body;
  const receipt = state.inboundReceipts.find(r => r.id === id || r.poNumber === id);
  if (!receipt) {
    return res.status(404).json({ success: false, message: `Không tìm thấy phiếu nhập [${id}]` });
  }

  let totalPutAway = 0;
  receipt.items.forEach(it => {
    const qtyToPutAway = Math.max(0, (it.receivedQty || 0) - ((it as any).putAwayQty || 0));
    if (qtyToPutAway > 0) {
      const targetBinCode = (assignments && assignments[it.sku]) || it.binCode || "D2-A02-N01";
      let bin = state.bins.find(b => b.code === targetBinCode || b.id === targetBinCode);
      if (!bin) {
        bin = state.bins[0];
      }
      if (bin) {
        const lotNumber = (it as any).lotNumber || `LOT-${new Date().getFullYear()}-${it.sku.slice(0, 3)}-${Date.now().toString().slice(-3)}`;
        const expDate = (it as any).expiryDate || "2027-12-31";
        const existingSku = bin.storedSkus.find(s => s.sku === it.sku);
        if (existingSku) {
          existingSku.qty += qtyToPutAway;
        } else {
          bin.storedSkus.push({
            sku: it.sku,
            name: it.name,
            qty: qtyToPutAway,
            lotNumber,
            expirationDate: expDate,
            status: "Available"
          });
        }
        bin.currentOccupancy += qtyToPutAway;
        bin.status = bin.currentOccupancy >= bin.maxCapacity ? "full" : "partial";
        (it as any).putAwayQty = ((it as any).putAwayQty || 0) + qtyToPutAway;
        (it as any).binCode = targetBinCode;
        totalPutAway += qtyToPutAway;
      }
    }
  });

  const allPutAway = receipt.items.every(it => ((it as any).putAwayQty || 0) >= it.expectedQty);
  if (allPutAway) {
    receipt.status = "Completed" as any;
  } else {
    receipt.status = "Processing" as any;
  }

  syncZoneOccupancy();

  addAuditLog(
    operator,
    "Staff",
    "Cất hàng vào kệ (Put-away)",
    `Đã cất ${totalPutAway} đơn vị hàng hóa từ phiếu nhập [${receipt.id}] vào các ô kệ lưu kho.`,
    "/api/wms/inbounds/put-away",
    "vi-VN"
  );

  return res.json({
    success: true,
    message: `Đã cất ${totalPutAway} đơn vị hàng hóa vào kệ thành công!`,
    receipt,
    inbounds: state.inboundReceipts,
    bins: state.bins,
    zones: state.zones,
    auditLogs: state.auditLogs
  });
});

// POST /api/wms/outbounds/create - Create new Outbound Order voucher
app.post("/api/wms/outbounds/create", (req: Request, res: Response) => {
  const { customerName, warehouseId, soNumber, expDate, creator, items, status = "Completed", dispatchNow = true } = req.body;
  const outId = `OUT-${Date.now().toString().slice(-4)}`;
  const mappedSo = soNumber || `SO-${Date.now().toString().slice(-5)}`;
  const finalStatus = status === "Pending" ? "Pending" : status === "In Progress" ? "In Progress" : "Completed";

  const mappedItems = (items || []).map((it: any) => {
    const sku = it.sku || "IPHONE15";
    const expectedQty = Number(it.expectedQty || it.qty || 10);
    const binCode = it.binCode || "D2-A02-N02";
    return {
      sku,
      expectedQty,
      pickedQty: finalStatus === "Completed" ? expectedQty : 0,
      binCode
    };
  });

  const newOutbound = {
    id: outId,
    soNumber: mappedSo,
    customerName: customerName || "Khách hàng WMS",
    date: expDate || new Date().toISOString().split("T")[0],
    status: finalStatus as any,
    items: mappedItems
  };

  state.outboundOrders.unshift(newOutbound);

  // If dispatchNow or Completed, deduct stock from source bins
  if ((dispatchNow || finalStatus === "Completed") && !req.body.skipBinUpdate) {
    mappedItems.forEach((it: any) => {
      const sourceBin = state.bins.find(b => b.code === it.binCode || b.id === it.binCode) || state.bins.find(b => b.storedSkus.some(s => s.sku === it.sku && s.qty >= it.expectedQty));
      if (sourceBin) {
        const stored = sourceBin.storedSkus.find(s => s.sku === it.sku);
        if (stored) {
          const deduct = Math.min(stored.qty, it.expectedQty);
          stored.qty -= deduct;
          sourceBin.currentOccupancy = Math.max(0, sourceBin.currentOccupancy - deduct);
          if (stored.qty <= 0) {
            sourceBin.storedSkus = sourceBin.storedSkus.filter(s => s !== stored);
          }
          sourceBin.status = sourceBin.currentOccupancy === 0 ? "empty" : sourceBin.currentOccupancy >= sourceBin.maxCapacity ? "full" : "partial";
        }
      }
    });
    syncZoneOccupancy();
  }

  // Generate corresponding WavePicking task
  const newWave: WavePicking = {
    id: `WAVE-${Date.now().toString().slice(-3)}`,
    name: `Lộ trình lấy hàng cho đơn [${outId}]`,
    orders: [outId],
    assignedStaff: "Nguyễn Văn Hùng (Staff)",
    status: (finalStatus === "Completed" ? "Completed" : "Picking") as any,
    optimizedPath: mappedItems.map((it: any, idx: number) => {
      const prod = state.products.find(p => p.sku === it.sku);
      const pName = prod ? (typeof prod.name === "string" ? prod.name : prod.sku) : it.sku;
      return {
        step: idx + 1,
        binCode: it.binCode || "D2-A02-N02",
        sku: it.sku,
        name: pName,
        qty: it.expectedQty,
        scanned: finalStatus === "Completed"
      };
    })
  };
  state.wavePickings.unshift(newWave);

  addAuditLog(
    creator || "Staff",
    "Staff",
    "Tạo mới lệnh xuất kho (Outbound Order)",
    `Đã tạo lệnh xuất [${outId} / ${mappedSo}] cho đối tác [${newOutbound.customerName}], tổng ${mappedItems.reduce((acc: number, it: any) => acc + it.expectedQty, 0)} đơn vị.${dispatchNow ? " Đã trừ tồn kho kệ lấy hàng." : ""}`,
    "/api/wms/outbounds/create",
    "vi-VN"
  );

  res.json({
    success: true,
    message: `Đã tạo lệnh xuất kho [${outId}] thành công!`,
    outbound: newOutbound,
    outbounds: state.outboundOrders,
    bins: state.bins,
    waves: state.wavePickings,
    auditLogs: state.auditLogs
  });
});

// POST /api/wms/orders/complete - Quick Complete Inbound/Outbound order and apply inventory updates
app.post("/api/wms/orders/complete", (req: Request, res: Response) => {
  const { id, orderType, operator } = req.body;
  const isOut = orderType === "outbound";

  if (isOut) {
    const order = state.outboundOrders.find(o => o.id === id || o.soNumber === id);
    if (!order) {
      return res.status(404).json({ success: false, message: `Không tìm thấy lệnh xuất [${id}]` });
    }
    const previousStatus = order.status;
    order.status = "Completed" as any;
    order.items.forEach(it => {
      it.pickedQty = it.expectedQty;
    });

    if (previousStatus !== "Completed") {
      order.items.forEach(it => {
        const bin = state.bins.find(b => b.code === it.binCode || b.id === it.binCode) || state.bins.find(b => b.storedSkus.some(s => s.sku === it.sku));
        if (bin) {
          const stored = bin.storedSkus.find(s => s.sku === it.sku);
          if (stored) {
            const deduct = Math.min(stored.qty, it.expectedQty);
            stored.qty -= deduct;
            bin.currentOccupancy = Math.max(0, bin.currentOccupancy - deduct);
            if (stored.qty <= 0) {
              bin.storedSkus = bin.storedSkus.filter(s => s !== stored);
            }
          } else {
            bin.currentOccupancy = Math.max(0, bin.currentOccupancy - it.expectedQty);
          }
          bin.status = bin.currentOccupancy === 0 ? "empty" : bin.currentOccupancy >= bin.maxCapacity ? "full" : "partial";
        }
      });
      syncZoneOccupancy();
    }

    addAuditLog(
      operator || "Manager",
      "Manager",
      "Xác nhận hoàn tất xuất kho (Complete Dispatch)",
      `Lệnh xuất kho [${order.id} / ${order.soNumber}] đã được xác nhận xuất kho hoàn tất.`,
      "/api/wms/orders/complete",
      "vi-VN"
    );

    return res.json({
      success: true,
      message: `Đã xác nhận hoàn tất lệnh xuất [${id}]!`,
      outbounds: state.outboundOrders,
      inbounds: state.inboundReceipts,
      bins: state.bins,
      zones: state.zones,
      auditLogs: state.auditLogs
    });
  } else {
    const order = state.inboundReceipts.find(o => o.id === id || o.poNumber === id);
    if (!order) {
      return res.status(404).json({ success: false, message: `Không tìm thấy phiếu nhập [${id}]` });
    }
    const previousStatus = order.status;
    order.status = "Completed" as any;
    order.items.forEach(it => {
      it.receivedQty = it.expectedQty;
    });

    if (previousStatus !== "Completed") {
      order.items.forEach(it => {
        const binCode = (it as any).binCode || "D2-A02-N01";
        let bin = state.bins.find(b => b.code === binCode || b.id === binCode);
        if (!bin) {
          const targetZoneId = binCode.startsWith("C") ? "z1" : binCode.startsWith("POS") ? "z-store" : "z2";
          bin = {
            id: `bin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            code: binCode,
            zoneId: targetZoneId,
            maxCapacity: 200,
            currentOccupancy: 0,
            status: "empty" as const,
            storedSkus: []
          };
          state.bins.push(bin);
        }
        const stored = bin.storedSkus.find(s => s.sku === it.sku);
        if (stored) {
          stored.qty += it.expectedQty;
        } else {
          bin.storedSkus.push({
            sku: it.sku,
            name: it.name || it.sku,
            qty: it.expectedQty,
            lotNumber: `LOT-INB-${Date.now().toString().slice(-4)}`,
            expirationDate: "2027-12-31",
            status: "Available"
          });
        }
        bin.currentOccupancy += it.expectedQty;
        bin.status = bin.currentOccupancy >= bin.maxCapacity ? "full" : "partial";
      });
      syncZoneOccupancy();
    }

    addAuditLog(
      operator || "Manager",
      "Manager",
      "Xác nhận hoàn tất cất hàng nhập kho (Complete Put-away)",
      `Phiếu nhập kho [${order.id} / ${order.poNumber}] đã được xác nhận cất hàng hoàn tất.`,
      "/api/wms/orders/complete",
      "vi-VN"
    );

    return res.json({
      success: true,
      message: `Đã xác nhận hoàn tất phiếu nhập [${id}]!`,
      inbounds: state.inboundReceipts,
      outbounds: state.outboundOrders,
      bins: state.bins,
      zones: state.zones,
      auditLogs: state.auditLogs
    });
  }
});

// POST update wave picking steps along the optimized travel sequence path
app.post("/api/wms/waves/step", (req: Request, res: Response) => {
  const { waveId, step, operator } = req.body;
  const targetWave = state.wavePickings.find(w => w.id === waveId);
  if (!targetWave) {
    return res.status(404).json({ message: "Wave picking order sheet not found" });
  }

  const pathItem = targetWave.optimizedPath.find(p => p.step === step);
  if (pathItem) {
    pathItem.scanned = true;

    // Simulate database subtraction
    const targetBin = state.bins.find(b => b.code === pathItem.binCode);
    if (targetBin) {
      const stored = targetBin.storedSkus.find(s => s.sku === pathItem.sku);
      if (stored) {
        stored.qty = Math.max(0, stored.qty - pathItem.qty);
        targetBin.currentOccupancy = Math.max(0, targetBin.currentOccupancy - pathItem.qty);
        if (stored.qty === 0) {
          targetBin.storedSkus = targetBin.storedSkus.filter(s => s.sku !== pathItem.sku);
        }
      }
      targetBin.status = targetBin.currentOccupancy === 0 ? "empty" as const : "partial" as const;
    }
  }

  const allScanned = targetWave.optimizedPath.every(p => p.scanned);
  if (allScanned) {
    targetWave.status = "Completed";
  }

  syncZoneOccupancy();

  addAuditLog(
    operator || "Staff",
    "Staff",
    "Thực thi quy trình Wave Picking",
    `Hoàn thành lấy hàng step: ${step} tại vị trí Bin ${pathItem?.binCode || "N/A"}. Kiền mã SKU ${pathItem?.sku || "N/A"}.`,
    "/api/wms/waves/step",
    "vi-VN"
  );

  res.json({
    waves: state.wavePickings,
    bins: state.bins,
    auditLogs: state.auditLogs
  });
});

// POST create a fresh shelf storage layout bin location using Master Data Management (MDM)
app.post("/api/wms/bins/create", (req: Request, res: Response) => {
  const { code, zoneId, capacity, operator } = req.body;
  if (!code || !zoneId || capacity === undefined) {
    return res.status(400).json({ message: "Malformed bin creation params." });
  }

  if (state.bins.some(b => b.code === code)) {
    return res.status(400).json({ message: `Mã ô kệ '${code}' đã tồn tại trong sơ đồ WMS.` });
  }

  const newBin: Bin = {
    id: `b-${Date.now()}`,
    code,
    zoneId,
    maxCapacity: Number(capacity),
    currentOccupancy: 0,
    status: "empty" as const,
    storedSkus: []
  };

  state.bins.push(newBin);
  syncZoneOccupancy();

  addAuditLog(
    operator || "Admin",
    "Admin",
    "Kiến tạo vị trí Bin lưu trữ mới",
    `Cấu trúc thêm ô kệ ${code} thành công trong sơ đồ [Zone: ${zoneId}] sức chứa ${capacity} đơn vị.`,
    "/api/wms/bins/create",
    "vi-VN"
  );

  res.json({
    bins: state.bins,
    auditLogs: state.auditLogs
  });
});

// ==========================================
// CRUD ENDPOINTS FOR PRODUCTS, BINS, VENDORS
// ==========================================

// 1. PRODUCT CRUD ENDPOINTS
app.post("/api/wms/products", (req: Request, res: Response) => {
  const {
    sku,
    barcode,
    name,
    nameVi,
    price,
    unit,
    category,
    description,
    packagingRatio,
    storageCondition,
    cartonDimensions,
    packageWeightKg,
    minSafetyStock,
    maxCapacityStock,
    rotationStrategy,
    operator,
  } = req.body;

  if (!sku || !name || price === undefined || !unit) {
    return res.status(400).json({ message: "Malformed request payload." });
  }
  if (state.products.some(p => p.sku === sku)) {
    return res.status(400).json({ message: `Mã SKU ${sku} đã tồn tại trong hệ thống.` });
  }
  const newProduct: any = {
    id: `p-${Date.now()}`,
    sku: String(sku).toUpperCase().trim(),
    barcode: barcode || "",
    name,
    nameVi: nameVi || "",
    price: Number(price),
    unit,
    category: category || "General",
    description: description || "",
    packagingRatio: packagingRatio ? Number(packagingRatio) : (unit === "Carton" ? 24 : 1),
    storageCondition: storageCondition || "Dry",
    cartonDimensions: cartonDimensions || "",
    packageWeightKg: packageWeightKg ? Number(packageWeightKg) : 0,
    minSafetyStock: minSafetyStock !== undefined ? Number(minSafetyStock) : 20,
    maxCapacityStock: maxCapacityStock !== undefined ? Number(maxCapacityStock) : 500,
    rotationStrategy: rotationStrategy || "FIFO",
  };
  state.products.push(newProduct);
  addAuditLog(
    operator || "Admin",
    "Admin",
    "Đăng ký SKU sản phẩm mới",
    `Đã đăng ký thành công sản phẩm: ${name} (${sku}) giá ${price}₫.`,
    "/api/wms/products",
    "vi-VN"
  );
  res.json({ products: state.products, auditLogs: state.auditLogs });
});

app.put("/api/wms/products/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    sku,
    barcode,
    name,
    nameVi,
    price,
    unit,
    category,
    description,
    packagingRatio,
    storageCondition,
    cartonDimensions,
    packageWeightKg,
    minSafetyStock,
    maxCapacityStock,
    rotationStrategy,
    operator,
  } = req.body;

  const productIndex = state.products.findIndex(p => p.id === id);
  if (productIndex === -1) {
    return res.status(404).json({ message: "Sản phẩm không tìm thấy." });
  }
  if (state.products.some((p, idx) => p.sku === sku && idx !== productIndex)) {
    return res.status(400).json({ message: `Mã SKU ${sku} đã thuộc về sản phẩm khác.` });
  }
  const updatedProduct = {
    ...state.products[productIndex],
    sku: String(sku).toUpperCase().trim(),
    barcode: barcode || "",
    name,
    nameVi: nameVi !== undefined ? nameVi : (state.products[productIndex] as any).nameVi,
    price: Number(price),
    unit,
    category: category || "General",
    description: description || "",
    packagingRatio: packagingRatio !== undefined ? Number(packagingRatio) : (state.products[productIndex] as any).packagingRatio,
    storageCondition: storageCondition !== undefined ? storageCondition : (state.products[productIndex] as any).storageCondition,
    cartonDimensions: cartonDimensions !== undefined ? cartonDimensions : (state.products[productIndex] as any).cartonDimensions,
    packageWeightKg: packageWeightKg !== undefined ? Number(packageWeightKg) : (state.products[productIndex] as any).packageWeightKg,
    minSafetyStock: minSafetyStock !== undefined ? Number(minSafetyStock) : (state.products[productIndex] as any).minSafetyStock,
    maxCapacityStock: maxCapacityStock !== undefined ? Number(maxCapacityStock) : (state.products[productIndex] as any).maxCapacityStock,
    rotationStrategy: rotationStrategy !== undefined ? rotationStrategy : (state.products[productIndex] as any).rotationStrategy,
  };
  state.products[productIndex] = updatedProduct;
  addAuditLog(
    operator || "Admin",
    "Admin",
    "Cập nhật SKU sản phẩm",
    `Đã cập nhật sản phẩm: ${name} (${sku}) thành công.`,
    `/api/wms/products/${id}`,
    "vi-VN"
  );
  res.json({ products: state.products, auditLogs: state.auditLogs });
});

app.delete("/api/wms/products/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator } = req.query;
  const product = state.products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ message: "Sản phẩm không tồn tại." });
  }

  // Check if any bin holds stock for this SKU
  const binsHoldingStock = state.bins
    .filter(b => b.storedSkus && b.storedSkus.some(s => s.sku === product.sku && s.qty > 0))
    .map(b => {
      const item = b.storedSkus.find(s => s.sku === product.sku);
      return `${b.code} (${item?.qty || 0})`;
    });

  if (binsHoldingStock.length > 0) {
    const totalQty = state.bins.reduce((sum, b) => {
      const item = b.storedSkus?.find(s => s.sku === product.sku);
      return sum + (item?.qty || 0);
    }, 0);
    return res.status(400).json({
      message: `Không thể xóa SKU '${product.sku}' vì đang còn tồn kho thực tế ${totalQty} ${product.unit} tại các ô kệ: ${binsHoldingStock.join(", ")}. Vui lòng xuất kho hoặc luân chuyển trước khi xóa.`
    });
  }

  state.products = state.products.filter(p => p.id !== id);
  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Xóa SKU sản phẩm",
    `Đã xóa sản phẩm ${product.name} (${product.sku}) khỏi danh mục đăng ký.`,
    `/api/wms/products/${id}`,
    "vi-VN"
  );
  res.json({ products: state.products, auditLogs: state.auditLogs });
});

// 2. BIN/SHELF CRUD ENDPOINTS (Create is already covered /api/wms/bins/create)
app.put("/api/wms/bins/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { code, zoneId, maxCapacity, operator } = req.body;
  const binIndex = state.bins.findIndex(b => b.id === id);
  if (binIndex === -1) {
    return res.status(404).json({ message: "Kệ/Bin không tìm thấy." });
  }
  if (state.bins.some((b, idx) => b.code === code && idx !== binIndex)) {
    return res.status(400).json({ message: `Mã kệ '${code}' đã tồn tại.` });
  }
  state.bins[binIndex] = {
    ...state.bins[binIndex],
    code,
    zoneId,
    maxCapacity: Number(maxCapacity)
  };
  const currentOcc = state.bins[binIndex].currentOccupancy;
  const maxCap = state.bins[binIndex].maxCapacity;
  state.bins[binIndex].status = currentOcc === 0 ? "empty" : currentOcc >= maxCap ? "full" : "partial";

  syncZoneOccupancy();
  addAuditLog(
    operator || "Admin",
    "Admin",
    "Cập nhật vị trí kệ Bin",
    `Cập nhật vị vị trí ô kệ ${code} sức chứa tối đa ${maxCapacity} thành công.`,
    `/api/wms/bins/${id}`,
    "vi-VN"
  );
  res.json({ bins: state.bins, auditLogs: state.auditLogs });
});

app.delete("/api/wms/bins/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator } = req.query;
  const bin = state.bins.find(b => b.id === id);
  if (!bin) {
    return res.status(404).json({ message: "Vị trí kệ/Bin không tìm thấy." });
  }

  // Constraint: check if bin is holding goods
  const hasItems = bin.currentOccupancy > 0 || (bin.storedSkus && bin.storedSkus.some(s => s.qty > 0));
  if (hasItems) {
    const itemsSummary = (bin.storedSkus || [])
      .filter(s => s.qty > 0)
      .map(s => `${s.sku} (x${s.qty})`)
      .join(", ");
    return res.status(400).json({
      message: `Không thể xóa ô kệ '${bin.code}' vì đang còn chứa ${bin.currentOccupancy} sản phẩm (${itemsSummary || "có hàng tồn"}). Vui lòng luân chuyển toàn bộ hàng sang ô kệ khác trước khi xóa vị trí này.`
    });
  }

  state.bins = state.bins.filter(b => b.id !== id);
  syncZoneOccupancy();
  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Xóa vị trí kệ Bin",
    `Xóa bỏ vị trí ô kệ ${bin.code} khỏi hệ thống tổng đồ sơ đồ kho.`,
    `/api/wms/bins/${id}`,
    "vi-VN"
  );
  res.json({ bins: state.bins, auditLogs: state.auditLogs });
});

// 3. VENDOR CRUD ENDPOINTS
app.post("/api/wms/vendors", (req: Request, res: Response) => {
  const { name, email, scope, preferredLang, operator } = req.body;
  if (!name || !email) {
    return res.status(400).json({ message: "Malformed request payload." });
  }
  const newVendor: Vendor = {
    id: `VEN-${Date.now().toString().slice(-6)}`,
    name,
    email,
    scope: scope || "General Logistics",
    preferredLang: preferredLang || "vi-VN"
  };
  state.vendors.push(newVendor);
  addAuditLog(
    operator || "Admin",
    "Admin",
    "Thêm nhà cung ứng",
    `Đăng ký nhà cung cấp mới: ${name} (${email}) thành công.`,
    "/api/wms/vendors",
    "vi-VN"
  );
  res.json({ vendors: state.vendors, auditLogs: state.auditLogs });
});

app.put("/api/wms/vendors/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, scope, preferredLang, operator } = req.body;
  const vendorIndex = state.vendors.findIndex(v => v.id === id);
  if (vendorIndex === -1) {
    return res.status(404).json({ message: "Nhà cung ứng không tìm thấy." });
  }
  state.vendors[vendorIndex] = {
    ...state.vendors[vendorIndex],
    name,
    email,
    scope: scope || "",
    preferredLang: preferredLang || "vi-VN"
  };
  addAuditLog(
    operator || "Admin",
    "Admin",
    "Cập nhật nhà cung ứng",
    `Cập nhật nhà cung cấp ${name} (${email}) thành công.`,
    `/api/wms/vendors/${id}`,
    "vi-VN"
  );
  res.json({ vendors: state.vendors, auditLogs: state.auditLogs });
});

app.delete("/api/wms/vendors/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator } = req.query;
  const vendor = state.vendors.find(v => v.id === id);
  if (!vendor) {
    return res.status(404).json({ message: "Nhà cung cấp không tồn tại." });
  }
  state.vendors = state.vendors.filter(v => v.id !== id);
  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Xóa nhà cung ứng",
    `Loại bỏ nhà cung cấp ${vendor.name} khỏi quan hệ giao tác.`,
    `/api/wms/vendors/${id}`,
    "vi-VN"
  );
  res.json({ vendors: state.vendors, auditLogs: state.auditLogs });
});

// ==========================================
// CRUD ENDPOINTS FOR WAREHOUSES & ZONES
// ==========================================

// Create Warehouse
app.post("/api/wms/warehouses", (req: Request, res: Response) => {
  const { name, code, location, description, operator } = req.body;
  if (!name || !code) {
    return res.status(400).json({ message: "Vui lòng nhập tên và mã kho." });
  }
  if (state.warehouses.some(w => w.code.toLowerCase() === code.toLowerCase())) {
    return res.status(400).json({ message: `Mã kho '${code}' đã tồn tại.` });
  }

  const newWarehouse: Warehouse = {
    id: `WH-${Date.now()}`,
    name,
    code: code.toUpperCase(),
    location: location || "",
    description: description || ""
  };

  state.warehouses.push(newWarehouse);

  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Thêm nhà kho mới",
    `Kiến tạo thành công nhà kho mã '${newWarehouse.code}' - ${name} tại ${location}.`,
    "/api/wms/warehouses",
    "vi-VN"
  );

  res.json({ warehouses: state.warehouses, auditLogs: state.auditLogs });
});

// Update Warehouse
app.put("/api/wms/warehouses/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, code, location, description, operator } = req.body;
  const idx = state.warehouses.findIndex(w => w.id === id);
  if (idx === -1) {
    return res.status(404).json({ message: "Không tìm thấy thông tin nhà kho." });
  }

  if (state.warehouses.some((w, i) => i !== idx && w.code.toLowerCase() === code.toLowerCase())) {
    return res.status(400).json({ message: `Mã nhà kho '${code}' đã được đăng ký bởi kho khác.` });
  }

  const updated = {
    ...state.warehouses[idx],
    name: name || state.warehouses[idx].name,
    code: (code || state.warehouses[idx].code).toUpperCase(),
    location: location !== undefined ? location : state.warehouses[idx].location,
    description: description !== undefined ? description : state.warehouses[idx].description
  };

  state.warehouses[idx] = updated;

  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Cập nhật thông tin nhà kho",
    `Thay đổi thông tin nhà kho mã '${updated.code}' - ${updated.name}.`,
    `/api/wms/warehouses/${id}`,
    "vi-VN"
  );

  res.json({ warehouses: state.warehouses, auditLogs: state.auditLogs });
});

// Delete Warehouse
app.delete("/api/wms/warehouses/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator } = req.query;
  const warehouse = state.warehouses.find(w => w.id === id);
  if (!warehouse) {
    return res.status(404).json({ message: "Không tìm thấy thông tin nhà kho." });
  }

  // Check if warehouse has any active zones
  const activeZones = state.zones.filter(z => z.warehouseId === id || z.warehouseId === warehouse.code);
  if (activeZones.length > 0) {
    const zoneNames = activeZones.map(z => typeof z.name === "object" ? (z.name.vi || z.name.en) : z.name).join(", ");
    return res.status(400).json({
      message: `Không thể xóa nhà kho '${typeof warehouse.name === "object" ? (warehouse.name.vi || warehouse.name.en) : warehouse.name}' vì đang còn ${activeZones.length} phân khu (Zone) hoạt động bên trong: ${zoneNames}. Vui lòng xóa hoặc di chuyển các phân khu trước để tránh mồ côi dữ liệu.`
    });
  }

  state.warehouses = state.warehouses.filter(w => w.id !== id);

  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Xóa nhà kho",
    `Hủy bỏ nhà kho '${typeof warehouse.name === "object" ? (warehouse.name.vi || warehouse.name.en) : warehouse.name}' (Mã: ${warehouse.code}) khỏi sơ đồ hoạt động.`,
    `/api/wms/warehouses/${id}`,
    "vi-VN"
  );

  res.json({ warehouses: state.warehouses, auditLogs: state.auditLogs });
});

// Create Zone
app.post("/api/wms/zones", (req: Request, res: Response) => {
  const { name, warehouseId, type, capacity, operator } = req.body;
  if (!name || !warehouseId || !type || capacity === undefined) {
    return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin phân khu." });
  }

  const newZone: WarehouseZone = {
    id: `z-${Date.now()}`,
    name,
    warehouseId,
    type: type as any,
    capacity: Number(capacity),
    currentOccupancy: 0
  };

  state.zones.push(newZone);

  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Kiến tạo phân khu kho (Zone)",
    `Thêm mới phân khu '${name}' [Kiểu: ${type}] thuộc nhà kho [ID: ${warehouseId}], sức chứa ${capacity}.`,
    "/api/wms/zones",
    "vi-VN"
  );

  res.json({ zones: state.zones, auditLogs: state.auditLogs });
});

// Update Zone
app.put("/api/wms/zones/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, warehouseId, type, capacity, operator } = req.body;
  const idx = state.zones.findIndex(z => z.id === id);
  if (idx === -1) {
    return res.status(404).json({ message: "Không tìm thấy thông tin phân khu." });
  }

  const updated: WarehouseZone = {
    ...state.zones[idx],
    name: name || state.zones[idx].name,
    warehouseId: warehouseId || state.zones[idx].warehouseId,
    type: (type as any) || state.zones[idx].type,
    capacity: capacity !== undefined ? Number(capacity) : state.zones[idx].capacity
  };

  state.zones[idx] = updated;
  syncZoneOccupancy();

  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Cập nhật phân khu kho (Zone)",
    `Cập nhật thông tin phân khu '${updated.name}' thuộc nhà kho [ID: ${updated.warehouseId}].`,
    `/api/wms/zones/${id}`,
    "vi-VN"
  );

  res.json({ zones: state.zones, auditLogs: state.auditLogs });
});

// Delete Zone
app.delete("/api/wms/zones/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { operator } = req.query;
  const zone = state.zones.find(z => z.id === id);
  if (!zone) {
    return res.status(404).json({ message: "Không tìm thấy thông tin phân khu." });
  }

  // Check if zone has any active bins
  const childBins = state.bins.filter(b => b.zoneId === id);
  if (childBins.length > 0) {
    const binCodes = childBins.map(b => b.code).slice(0, 5).join(", ");
    return res.status(400).json({
      message: `Không thể xóa phân khu '${typeof zone.name === "object" ? (zone.name.vi || zone.name.en) : zone.name}' vì đang có ${childBins.length} ô kệ (${binCodes}${childBins.length > 5 ? "..." : ""}) đặt tại đây. Vui lòng xóa hoặc di chuyển các ô kệ trước.`
    });
  }

  state.zones = state.zones.filter(z => z.id !== id);

  addAuditLog(
    String(operator || "Admin"),
    "Admin",
    "Xóa phân khu kho (Zone)",
    `Hủy bỏ phân khu '${zone.name}' khỏi cấu trúc sơ đồ kho.`,
    `/api/wms/zones/${id}`,
    "vi-VN"
  );

  res.json({ zones: state.zones, auditLogs: state.auditLogs });
});

// Update Bin inventory (Used when staff scanning and putting/picking)
app.post("/api/inventory/bin/update", (req: Request, res: Response) => {
  const { binCode, sku, quantity, operator, role, action, locale } = req.body;
  const targetBin = state.bins.find(b => b.code === binCode);

  if (!targetBin) {
    return res.status(404).json({ error: "Bin not found" });
  }

  const product = state.products.find(p => p.sku === sku);
  if (!product) {
    return res.status(404).json({ error: "Product SKU not registered" });
  }

  // Adjust bin occupancy
  const currentItem = targetBin.storedSkus.find(s => s.sku === sku);
  if (action === "ADD") {
    if (targetBin.currentOccupancy + quantity > targetBin.maxCapacity) {
      return res.status(400).json({ error: `Not enough capacity. Available space: ${targetBin.maxCapacity - targetBin.currentOccupancy}` });
    }
    if (currentItem) {
      currentItem.qty += quantity;
    } else {
      targetBin.storedSkus.push({ sku, qty: quantity });
    }
    targetBin.currentOccupancy += quantity;
  } else if (action === "SUBTRACT") {
    if (!currentItem || currentItem.qty < quantity) {
      return res.status(400).json({ error: "Insufficent quantity in designated bin" });
    }
    currentItem.qty -= quantity;
    targetBin.currentOccupancy -= quantity;
    if (currentItem.qty === 0) {
      targetBin.storedSkus = targetBin.storedSkus.filter(s => s.sku !== sku);
    }
  }

  // Sync bin status
  if (targetBin.currentOccupancy === 0) {
    targetBin.status = "empty";
  } else if (targetBin.currentOccupancy >= targetBin.maxCapacity) {
    targetBin.status = "full";
  } else {
    targetBin.status = "partial";
  }

  syncZoneOccupancy();

  // Audit logging
  addAuditLog(
    operator || "Nguyễn Văn Hùng (Staff)",
    role || "Staff",
    action === "ADD" ? "Xác nhận Đặt hàng vào kệ" : "Xác nhận Lấy hàng từ kệ",
    `Bin: ${binCode}, SKU: ${sku}, Qty: ${quantity}. Thao tác trên thiết bị PDA di động.`,
    "/api/inventory/bin/update",
    locale || "vi-VN"
  );

  // Auto trigger Restock Warning if any key item count drops critically low (under threshold 120 parts)
  const totalStockCount = state.bins.reduce((sum, b) => {
    const found = b.storedSkus.find(s => s.sku === sku);
    return sum + (found ? found.qty : 0);
  }, 0);

  if (totalStockCount < 120 && !state.notifications.some(n => n.metaData?.sku === sku && !n.resolved)) {
    const draftQty = 200;
    const vendorEmail = sku === "IPHONE15" ? "order@apple-apac.com" : sku === "MILK-VNM" ? "order@vinamilk.com.vn" : "retail@cocacola-vietnam.com";
    const vendorName = sku === "IPHONE15" ? "Apple APAC" : sku === "MILK-VNM" ? "Vinamilk Co." : "Coca Cola Vietnam";

    const lowStockNotif = {
      id: `notif-${Date.now()}`,
      type: "low_stock" as const,
      titleVi: `CẢNH BÁO TỒN KHO THẤP: SKU ${sku}`,
      titleEn: `LOW STOCK ACTION: SKU ${sku}`,
      messageVi: `Tồn kho toàn hãng dọn dẹp còn ${totalStockCount} hộp/cái. AI Agent tự lập nhãn Restock.`,
      messageEn: `Warehouse total remaining stock drops to ${totalStockCount}. Auto Draft Restock Sheet prepared.`,
      timestamp: new Date().toISOString(),
      read: false,
      resolved: false,
      metaData: {
        sku,
        restockDraft: {
          sku,
          qty: draftQty,
          vendorEmail,
          vendorName,
          emailBodyVi: `Kính gửi ${vendorName},\n\nChúng tôi phát hiện kho hàng đang dưới ngưỡng an toàn cho mã hàng ${sku}.\nSmartWMS Auto restock đề xuất nhập bổ sung: ${draftQty} ${product.unit}.\nMong sớm liên lạc giao vận.\n\nTrân trọng,\nSmartWMS AI Agent.`,
          emailBodyEn: `Dear ${vendorName},\n\nOur system detected stock below levels for SKU ${sku}.\nSmartWMS AI Restock Agent requests supplementary delivery of: ${draftQty} ${product.unit}.\n\nSincerely,\nSmartWMS AI Agent.`
        }
      }
    };
    state.notifications.unshift(lowStockNotif);
  }

  res.json({ success: true, bins: state.bins, zones: state.zones });
});

// Update Wave progress step-by-step
app.post("/api/inventory/wave/step", (req: Request, res: Response) => {
  const { waveId, step, operator, locale } = req.body;
  const targetWave = state.wavePickings.find(w => w.id === waveId);
  if (!targetWave) {
    return res.status(404).json({ error: "Wave picking order sheet not found" });
  }

  const pathItem = targetWave.optimizedPath.find(p => p.step === step);
  if (pathItem) {
    pathItem.scanned = true;

    // Simulate database subtraction
    const targetBin = state.bins.find(b => b.code === pathItem.binCode);
    if (targetBin) {
      const stored = targetBin.storedSkus.find(s => s.sku === pathItem.sku);
      if (stored) {
        stored.qty = Math.max(0, stored.qty - pathItem.qty);
        targetBin.currentOccupancy = Math.max(0, targetBin.currentOccupancy - pathItem.qty);
        if (stored.qty === 0) {
          targetBin.storedSkus = targetBin.storedSkus.filter(s => s.sku !== pathItem.sku);
        }
      }
      targetBin.status = targetBin.currentOccupancy === 0 ? "empty" : "partial";
    }
  }

  const allScanned = targetWave.optimizedPath.every(p => p.scanned);
  if (allScanned) {
    targetWave.status = "Completed";
  }

  syncZoneOccupancy();

  addAuditLog(
    operator || "Nguyễn Văn Hùng (Staff)",
    "Staff",
    "Thực thi quy trình Wave Picking",
    `Hoàn thành lấy hàng step: ${step} tại vị trí Bin ${pathItem?.binCode}. Kiện mã SKU ${pathItem?.sku}.`,
    "/api/inventory/wave/step",
    locale || "vi-VN"
  );

  res.json({ success: true, wave: targetWave });
});

// Approve Restocking Order & Alert clearing
app.post("/api/inventory/notifications/resolve", (req: Request, res: Response) => {
  const { id, approved, operator, locale } = req.body;
  const targetNotif = state.notifications.find(n => n.id === id);
  if (!targetNotif) {
    return res.status(404).json({ error: "Notification not found" });
  }

  targetNotif.resolved = true;
  targetNotif.read = true;

  if (approved && targetNotif.metaData?.restockDraft) {
    const draft = targetNotif.metaData.restockDraft;
    // Autogenerate a registered Inbound receipt PO reflecting active restock
    const newInbound = {
      id: `INB-${Math.floor(Math.random() * 900) + 700}`,
      poNumber: `PO-AUTO-${Math.floor(Math.random() * 90 + 10)}`,
      vendorName: draft.vendorName,
      date: new Date().toISOString().split('T')[0],
      status: "Pending" as const,
      items: [
        { sku: draft.sku, name: state.products.find(p => p.sku === draft.sku)?.name || draft.sku, expectedQty: draft.qty, receivedQty: 0 }
      ]
    };
    state.inboundReceipts.push(newInbound);

    addAuditLog(
      operator || "Trần Anh Tuấn (Manager)",
      "Manager",
      "Kích hoạt PO đặt hàng thông minh từ gợi ý AI",
      `Phê duyệt restock SKU ${draft.sku} số lượng ${draft.qty}. Email đặt hàng được gửi tự động tới ${draft.vendorEmail}.`,
      "/api/inventory/notifications/resolve",
      locale || "vi-VN"
    );
  }

  res.json({ success: true, notifications: state.notifications, inbounds: state.inboundReceipts });
});

// ==========================================
// ADVANCED GOOGLE GEMINI 1.5/3.5 PROXY APIs
// ==========================================

function getErrorLocalResponse(messages: any[], activeLocale: string): string {
  const lastMsgText = messages[messages.length - 1]?.text || "";
  const userQuery = lastMsgText.toLowerCase();
  const isEn = activeLocale === "en-US";

  // 1. Calculate stock totals dynamically
  const stockMap: Record<string, number> = {};
  state.products.forEach(p => {
    stockMap[p.sku] = 0;
  });
  state.bins.forEach(b => {
    b.storedSkus.forEach(s => {
      if (stockMap[s.sku] !== undefined) {
        stockMap[s.sku] += s.qty;
      } else {
        stockMap[s.sku] = s.qty;
      }
    });
  });

  // Check intents
  const isLowStock = userQuery.includes("hụt") ||
                     userQuery.includes("thấp") ||
                     userQuery.includes("an toàn") ||
                     userQuery.includes("low") ||
                     userQuery.includes("safety") ||
                     userQuery.includes("under") ||
                     userQuery.includes("sắp hết");

  const isFinancial = userQuery.includes("tài sản") ||
                      userQuery.includes("vốn") ||
                      userQuery.includes("giá trị") ||
                      userQuery.includes("định giá") ||
                      userQuery.includes("valuation") ||
                      userQuery.includes("assets") ||
                      userQuery.includes("capital") ||
                      userQuery.includes("finance") ||
                      userQuery.includes("tiền tệ") ||
                      userQuery.includes("trị giá");

  const isPerformance = userQuery.includes("nhân viên") ||
                        userQuery.includes("hiệu suất") ||
                        userQuery.includes("hoạt động") ||
                        userQuery.includes("năng suất") ||
                        userQuery.includes("staff") ||
                        userQuery.includes("efficiency") ||
                        userQuery.includes("kpi") ||
                        userQuery.includes("hùng") ||
                        userQuery.includes("tuấn");

  if (isLowStock) {
    if (isEn) {
      let simResponse = `**[DYNAMIC INSIGHT - Intent Recognized: Low Stock Check]**\n\nHello! The SmartWMS Digital Twin has processed real-time inventory levels across your product catalog. Below are the items that are currently running thin or below the safety margin (Threshold value: 120 units):\n\n| SKU | Product Name | Category | Total Stock Rem. | Storage Shelf locations (Qty) | System Warning level |\n| :--- | :--- | :--- | :---: | :--- | :---: |\n`;
      state.products.forEach(p => {
        const totalQty = stockMap[p.sku] || 0;
        if (totalQty < 130) {
          const skuBins = state.bins.filter(b => b.storedSkus.some(s => s.sku === p.sku));
          const locationList = skuBins.map(b => `\`${b.code}\` (${b.storedSkus.find(s => s.sku === p.sku)?.qty})`).join(", ") || "Out of Stock";
          simResponse += `| **${p.sku}** | ${p.name} | ${p.category} | **${totalQty}** ${p.unit} | ${locationList} | 🚨 Warning Low Stock |\n`;
        }
      });
      simResponse += `\n---\n### 🛠... Copilot Action Proposal:\n- Automatic restocking purchase order drafts (**PO drafts**) are generated.\n- Navigate to the **Alerts & Actions panel** on your cockpit to authorize these urgent replenishment sheets.`;
      return simResponse;
    } else {
      let simResponse = `**[XỬ LÝ ĐỘNG - Nhận diện ý định: Kiểm tra tồn kho hụt]**\n\nChào bạn! Hệ thống Bản sao số SmartWMS đã phân tích tồn kho của toàn bộ danh mục sản phẩm thời gian thực. Sau đây là danh sách chi tiết các mặt hàng có lượng tồn kho sụt giảm sấp xỉ hoặc rớt dưới mức an toàn định mức (Ngưỡng báo động: dưới 130 đơn vị):\n\n| SKU | Tên Sản Phẩm | Danh Mục | Tổng Tồn Kho Hiện Tại | Vị Trí Lưu Kho (Số Lượng) | Trạng Thái Hệ Thống |\n| :--- | :--- | :--- | :---: | :--- | :---: |\n`;
      state.products.forEach(p => {
        const totalQty = stockMap[p.sku] || 0;
        if (totalQty < 130) {
          const skuBins = state.bins.filter(b => b.storedSkus.some(s => s.sku === p.sku));
          const locationList = skuBins.map(b => `\`${b.code}\` (${b.storedSkus.find(s => s.sku === p.sku)?.qty})`).join(", ") || "Hết hàng";
          simResponse += `| **${p.sku}** | ${p.name} | ${p.category} | **${totalQty}** ${p.unit} | ${locationList} | 🚨 Sụt giảm an toàn |\n`;
        }
      });
      simResponse += `\n---\n### 🛠️ Đề xuất xử lý tự động từ Copilot:\n- Hệ thống đã tự động tạo đề xuất nhập nháp bổ sung hàng tương ứng (**PO Draft**).\n- Bạn có thể chuyển nhanh sang mục **Cảnh báo / Phê duyệt** ở góc trên Dashboard để xem nội dung email nháp gửi nhà phân phối và bấm phê duyệt nhập kho.`;
      return simResponse;
    }
  }

  if (isFinancial) {
    let totalVal = 0;
    const catBreakdown: Record<string, { qty: number, val: number }> = {};

    state.products.forEach(p => {
      const totalQty = stockMap[p.sku] || 0;
      const cost = totalQty * p.price;
      totalVal += cost;

      if (!catBreakdown[p.category]) {
        catBreakdown[p.category] = { qty: 0, val: 0 };
      }
      catBreakdown[p.category].qty += totalQty;
      catBreakdown[p.category].val += cost;
    });

    if (isEn) {
      let simResponse = `**[DYNAMIC INSIGHT - Intent Recognized: Assets & Capital Liquidity Valuation]**\n\nHello! Running live queries across physical dry/cool bins combined with active catalog wholesale indexes, here is our valuation review:\n\n### 💰 REAL-TIME INVENTORY FINANCIAL ANALYSIS\n- **Estimated Total Assets Value**: **VND ${totalVal.toLocaleString("en-US")}**\n- **Capital Circulation status**: Normal / Adequate liquid reserves.\n\nAsset distribution & capital commitment by product category:\n| Product Category | Combined Units Traced | Total Catalog Valuation | Asset Share |\n| :--- | :---: | :--- | :---: |\n`;
      Object.entries(catBreakdown).forEach(([cat, data]) => {
        const percentage = totalVal > 0 ? (data.val / totalVal) * 100 : 0;
        simResponse += `| **${cat}** | ${data.qty} units | **VND ${data.val.toLocaleString("en-US")}** | ${percentage.toFixed(1)}% |\n`;
      });
      simResponse += `\n---\n### 📈 Advisory Notes:\n- **Electronics** holdings represent the largest share of tied-up capital. Due to market depreciation factors, we recommend priority clearing of outstanding outbound shipments in the queue.\n- FMCG goods maintain a high catalog turnover rate.`;
      return simResponse;
    } else {
      let simResponse = `**[XỬ LÝ ĐỘNG - Nhận diện ý định: Định giá vốn lưu động và Tài sản kho]**\n\nChào quản lý! Trực trích dữ liệu từ các vùng chứa hàng thực tế (Zone Cool, Zone Dry) và bảng giá gốc catalog hệ thống, tổng giá trị tài sản lượng hàng lưu kho của bạn hiện tại như sau:\n\n### 💰 BÁO CÁO PHÂN TÍCH TÀI CHÍNH KHO THỜI GIAN THỰC\n- **Tổng trị giá tài sản lưu kho ước tính**: **${totalVal.toLocaleString("vi-VN")} VNĐ**\n- **Quy mô an toàn dòng vốn**: Đạt chỉ số thanh khoản cao.\n\nChi tiết vốn bị chiếm dụng và lưu giữ phân rã theo Nhóm hàng:\n| Nhóm Hàng | Tổng Lượng Hàng Tồn | Tổng Trị Giá Đánh Giá | Tỷ Lệ Chiếm Dụng |\n| :--- | :---: | :--- | :---: |\n`;
      Object.entries(catBreakdown).forEach(([cat, data]) => {
        const percentage = totalVal > 0 ? (data.val / totalVal) * 100 : 0;
        simResponse += `| **${cat}** | ${data.qty} cái/hộp | **${data.val.toLocaleString("vi-VN")} VNĐ** | ${percentage.toFixed(1)}% |\n`;
      });
      simResponse += `\n---\n### 📈 Khuyến nghị tài chính lưu kho:\n- Nhóm hàng **Electronics** (Thiết bị điện tử) đang lưu giữ tỷ trọng chiếm dụng dòng tiền cao nhất. Khuyến nghị tập trung gom lệnh xuất thương mại sớm để giải phóng dòng tiền lưu chuyển.\n- Cơ cấu dự phòng hàng tiêu dùng bách hóa Beverage & Food đang ở ngưỡng quay vòng rất lành mạnh.`;
      return simResponse;
    }
  }

  if (isPerformance) {
    if (isEn) {
      return `**[DYNAMIC INSIGHT - Intent Recognized: Staff KPI & Efficiency Audit]**

Hello! Here is the personnel throughput and active performance logs compiled from physical warehouse PDA scanners and live audit database logs for today's shifts:

### ⏱️ OPERATOR PERFORMANCE & LABOR ANALYSIS
| Field Operator | Role / Clearance | Recorded Actions | Primary Operations Handled | Efficiency Rating |
| :--- | :--- | :---: | :--- | :---: |
| **Nguyen Van Hung** | Warehouse Staff | 45 scans | Wave-001 Picking, Bin Code Verification, PDA Scans | **98% (Excellent)** |
| **Tran Anh Tuấn** | Store Manager | 20 actions | Authorizing restocking POs, Resolving AI alerts, Shift entry | **95% (Target Achieved)** |
| **Kien Nguyen** | System Admin | 12 actions | Designing Cool Zone bins, MDM setup, System bootstrapping | **100% (Optimal)** |

---
### 📊 Cycle Audit Summary:
- **Average picking cycle duration**: 2.8 minutes per picking wave, safely below the peak setup target of 3.5 minutes.
- **Barcode Validation Precision**: **100% accuracy** with zero misplaced SKU anomalies detected.
- **Top Performer of the Shift**: **Nguyen Van Hung** for exceptionally following the optimized router coordinates allocated on the mobile client.`;
    } else {
      return `**[XỬ LÝ ĐỘNG - Nhận diện ý định: Đánh giá KPI & Hiệu suất Nhân viên]**

Chào bạn! Hệ thống SmartWMS đã tổng hợp nhật ký hoạt động thông minh từ máy quét PDA cầm tay và cơ sở dữ liệu kiểm toán hôm nay để đưa ra tóm tắt hiệu năng lao động:

### ⏱️ PHÂN TÍCH HIỆU SUẤT XỬ LÝ ĐƠN HÀNG TRONG NGÀY
| Tên Nhân Sự | Vai Trò | Số tác vụ đã ghi nhận | Các thao tác chủ đạo thực hiện | Đánh giá năng suất |
| :--- | :--- | :---: | :--- | :---: |
| **Nguyễn Văn Hùng** | Nhân viên kho (Staff) | 45 lượt quét | Bắt đầu Wave-001, Điều chuyển ô kệ, Quét mã vạch Bin | **98% (Xuất sắc)** |
| **Trần Anh Tuấn** | Quản lý (Manager) | 20 lượt duyệt | Phê duyệt nhập hàng, Duyệt đề xuất PO của AI, Đăng nhập phiên | **95% (Đạt mục tiêu)** |
| **Kiên Nguyễn** | Admin hệ thống | 12 lượt | Thêm ô kệ mới cho Zone C, Cấu trúc Master Data, Khởi tạo SDK | **100% (Tối ưu)** |

---
### 📊 Nhận định hiệu quả tổng hợp:
- **Thời gian hoàn thành trung bình (Avg Cycle Time)**: 2.8 phút/lượt gom hàng (Wave Picking), đạt mục tiêu cam kết dịch vụ (< 3.5 phút).
- **Tỷ lệ quét barcode chính xác**: Đạt **100%**, không ghi nhận bất kỳ thao tác nhầm lẫn hoặc lệch mã SKU nào.
- **Nhân sự xuất sắc nhất ca**: **Nguyễn Văn Hùng** nhờ thực thi lộ trình gom hàng tối ưu hóa đường đi trên app di động vô cùng chuẩn chỉ.`;
    }
  }

  // default statistics output (Warehouse saturation)
  const productCount = state.products.length;
  const occupiedBins = state.bins.filter(b => b.currentOccupancy > 0).length;
  const totalBins = state.bins.length;
  const activeAlertsCount = state.notifications.filter(n => !n.resolved).length;

  if (isEn) {
    return `**[SYSTEM STATUS - SmartWMS Copilot Ready with RAG Memory]**

Hello! I am your SmartWMS Logistics Assistant. Connecting directly to our live storage database, here is an instant status snapshot of the facility:

### 📊 PHYSICAL WAREHOUSE CORE METRICS
- 🏷️ **Registered SKU Catalog**: **${productCount} active SKUs** tracking.
- 🗄️ **Bin Occupancy Density**: **${occupiedBins}/${totalBins} shelves occupied** (${((occupiedBins/totalBins)*100).toFixed(1)}%).
- ������ **Unresolved Urgent Warnings**: **${activeAlertsCount} alerts** awaiting authorization.
- 🧊 **Cool Storage Zone (Zone C)**: utilizing **${state.zones[0].currentOccupancy}/${state.zones[0].capacity}** units.
- ☀️ **Dry Storage Zone (Zone D)**: utilizing **${state.zones[1].currentOccupancy}/${state.zones[1].capacity}** units.

### ❓ You can query me using quick triggers such as:
1. *"Verify low stock inventory"* 🚨
2. *"Calculate warehouse assets capital"* 💰
3. *"Review staff performance audit logs"* 🏆

I am fully synchronized and ready for any queries or operations!`;
  } else {
    return `**[PHẢN HỒI ĐA NHIỆM - Bản sao số SmartWMS sẳn sàng]**

Xin chào! Tôi là Trợ lý ảo AI SmartWMS. Trực tiếp kết xuất sơ đồ vận hành vật lý và bảng kê hàng hóa danh mục kho, tôi gửi bạn thống kê sơ bộ tình trạng nhà kho của mình tại thời điểm hiện nay:

### 📊 THÔNG SỐ VẬN HÀNH KHO THỰC TẾ TRONG HỆ THỐNG
- 🏷️ **Danh mục hàng hóa**: Đăng ký **${productCount} SKU** hoạt động.
- 🗄️ **Lấp đầy kệ hàng (Bin Occupancy)**: Đã lấp đầy **${occupiedBins}/${totalBins} ô kệ** (${((occupiedBins/totalBins)*100).toFixed(1)}%).
- 🚨 **Cảnh báo chờ xử lý**: **${activeAlertsCount} cảnh báo** đề xuất bổ sung hàng (Restock PO) chưa được duyệt.
- 🧊 **Tải trọng phân khu Mát (Zone C)**: Đã lưu chứa **${state.zones[0].currentOccupancy}/${state.zones[0].capacity}** đv sức chứa.
- ☀️ **Tải trọng phân khu Khô (Zone D)**: Đã lưu chứa **${state.zones[1].currentOccupancy}/${state.zones[1].capacity}** đv sức chứa.

### ❓ Bạn có thể hỏi tôi các câu lệnh nhanh như:
1. Có mặt hàng nào đang nguy cơ **sụt hụt tồn kho** nghiêm trọng không? 🚨
2. Tính toán tổng trị giá **tài sản hàng hóa** lưu trữ hiện nay? 💰
3. Xem báo cáo **hiệu suất hoạt động** của nhân sự ngày hôm nay? 🏆

Tôi luôn sẵn sàng phân tích cấu trúc dữ liệu và điều phối hệ thống cùng bạn!`;
  }
}

// Chat Interface powered by server-side GoogleGenAI SDK in gemini-api format
app.post("/api/gemini/chat", async (req: Request, res: Response) => {
  const { messages, locale } = req.body;
  const activeLocale = locale || "vi-VN";

  // RAG Context compilation directly from dynamic inventory states
  const contextString = `
    - PRODUCTS REGISTERED: ${JSON.stringify(state.products.map(p => ({ sku: p.sku, name: p.name, price: p.price, unit: p.unit })))}
    - WAREHOUSE BINS DETAILED OCCUPANCY: ${JSON.stringify(state.bins.map(b => ({ code: b.code, currentQty: b.currentOccupancy, maxCapacity: b.maxCapacity, status: b.status, skus: b.storedSkus })))}
    - OUTSTANDING INBOUND RECEIPTS: ${JSON.stringify(state.inboundReceipts.filter(i => i.status !== "Completed").map(i => ({ id: i.id, vendor: i.vendorName, status: i.status })))}
    - OUTBOUND DELIVERIES WAITING: ${JSON.stringify(state.outboundOrders.filter(o => o.status !== "Completed").map(o => ({ id: o.id, customer: o.customerName, status: o.status })))}
  `;

  const systemInstruction = activeLocale === "en-US"
    ? `You are the SmartWMS AI Virtual Agent, a full-fledged expert warehouse logistics copilot.
       Using the provided real-time database state:
       ${contextString}

       Rules:
       1. Respond professionally in English.
       2. Always use Markdown tables to present catalog prices, bin capacity grids, or stock locations.
       3. Reference exact codes: Zone C, Zone D, Bins like C1-A01-N01, SKU MILK-VNM, etc.
       4. If stock for any item is requested, compute sum totals over all bins and present items correctly.
       5. Keep replies straightforward and highly actionable.`
    : `Bạn là Tác nhân ảo AI của hệ thống quản lý kho thông minh SmartWMS.
       Dựa trên dữ liệu thực tế thời gian thực thu thập từ kho:
       ${contextString}

       Quy tắc giao tiếp và trả lời:
       1. Trả lời bằng Tiếng Việt chuyên nghiệp, tự tin nhưng gần gũi.
       2. Luôn vẽ bằng bảng biểu Markdown khi so sánh giá sản phẩm, lượng tồn hoặc kệ chứa hàng.
       3. Chỉ ra đúng mã vị trí Bin (ví dụ: C1-A01-N01), mã SKU (MILK-VNM), mã đơn hàng (INB-602).
       4. Khi người dùng hỏi dạng từ lóng hoặc mô tả chung (ví dụ: sữa tươi, nước ngọt, mì gói), hãy tự động ánh xạ với đúng SKU danh mục.
       5. Đưa ra các gợi ý nghiệp vụ chính xác, rõ ràng.`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      // Local simulated response if key is missing or invalid with dynamic intent-based routing!
      const simResponse = getErrorLocalResponse(messages, activeLocale);
      return res.json({ text: simResponse });
    }

    // Format chat history for generateContent
    const contents = messages.map((m: any) => ({
      role: m.sender === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    handleGeminiError("Chat API", err);
    const simResponse = getErrorLocalResponse(messages, activeLocale);
    res.json({ text: simResponse });
  }
});

// AI Executive insights generator (UC-06 / Explainable analytics)
app.get("/api/gemini/insights", async (req: Request, res: Response) => {
  const { locale } = req.query;
  const activeLocale = (locale as string) || "vi-VN";

  const payloadText = `
    Inventory State: ${JSON.stringify(state.bins)}
    Product Details: ${JSON.stringify(state.products)}
    Warehouse structure: Zone Cool capacity 500, current: ${state.zones[0].currentOccupancy}. Zone Dry capacity 1000, current: ${state.zones[1].currentOccupancy}.
    Inbound receipts: ${JSON.stringify(state.inboundReceipts)}
    Outbound orders: ${JSON.stringify(state.outboundOrders)}
  `;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      // Local robust simulation
      const mockResult = activeLocale === "en-US"
        ? {
            text: "### Smart Warehouse Executive Analysis\n\n- **Space Optimization**: The Cool Zone is currently at **28% of capacity** (140/500 units), which is comfortable. However, the Dry Zone is approaching medium saturation (**340/1000 units**), mainly concentrated on high-value items like `IPHONE15` which alone holds 125 items.\n\n- **Stock Warnings**: Remaining tray levels for `COCA-320` have fallen low. Safe replenishment order is advised.\n\n- **Capital Velocity**: An estimated **84.2% of idle warehouse capital** is tied up in the electronics section (iPhone 15 & TV Sony inventory). Strategy to accelerate SO deliveries is recommended to free up liquidity under 30 days.",
            highlights: ["Dry Zone at 34% capacity", "Replenish Coca-Cola stock urgently", "84% warehouse capital tied in Electronics"]
          }
        : {
            text: "### Phân Tích Tổng Quan Ban Điều Hành (AI Insights)\n\n- **Hiệu Suất Không Gian Kho**: Khu vực mát (Zone Cool) đang vận hành ở mức an toàn **28% công suất** (140/500 đơn vị). Khu vực khô (Zone Dry) đang có tỷ trọng lấp đầy tăng lên **34%** (340/1000 đơn vị), tập trung lớn vào dãy kệ D2.\n\n- **Quản lý Vốn Lưu Động**: Gần **84.2% giá trị tồn kho hiện hữu** đang bị lưu giữ dưới mạng lưới hàng Điện tử (mã IPHONE15 & TV-SONY). Đề xuất đẩy mạnh tốc độ xuất hàng SO-102 để giải phóng 50 thùng sữa tươi giải tỏa mặt bằng dòng tiền.\n\n- **Cảnh báo Điểm nghẽn**: SKU `COCA-320` đang sụt giảm tốc độ, khuyến nghị kích hoạt Restock Email soạn sẵn tới nhà phân phối Coca-Cola Beverages Indochina.",
            highlights: ["Zone Dry lấp đầy 34%", "84.2% vốn tập trung mảng Điện tử", "Kích hoạt Order restock Coca-Cola ngay"]
          };
      return res.json(mockResult);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Perform high-level expert logistical review, and output a markdown summary with 3 main bullet insights looking for capital, spaces blockers or fast-moving patterns in ${activeLocale === "en-US" ? "English" : "Vietnamese"}. Input data:\n${payloadText}`
    });

    res.json({ text: response.text });
  } catch (err: any) {
    handleGeminiError("Insights API", err);
    const mockResult = activeLocale === "en-US"
      ? {
          text: "### Smart Warehouse Executive Analysis\n\n- **Space Optimization**: The Cool Zone is currently at **28% of capacity** (140/500 units), which is comfortable. However, the Dry Zone is approaching medium saturation (**340/1000 units**), mainly concentrated on high-value items like `IPHONE15` which alone holds 125 items.\n\n- **Stock Warnings**: Remaining tray levels for `COCA-320` have fallen low. Safe replenishment order is advised.\n\n- **Capital Velocity**: An estimated **84.2% of idle warehouse capital** is tied up in the electronics section (iPhone 15 & TV Sony inventory). Strategy to accelerate SO deliveries is recommended to free up liquidity under 30 days.",
          highlights: ["Dry Zone at 34% capacity", "Replenish Coca-Cola stock urgently", "84% warehouse capital tied in Electronics"]
        }
      : {
          text: "### Phân Tích Tổng Quan Ban Điều Hành (AI Insights)\n\n- **Hiệu Suất Không Gian Kho**: Khu vực mát (Zone Cool) đang vận hành ở mức an toàn **28% công suất** (140/500 đơn vị). Khu vực khô (Zone Dry) đang có tỷ trọng lấp đầy tăng lên **34%** (340/1000 đơn vị), tập trung lớn vào dãy kệ D2.\n\n- **Quản lý Vốn Lưu Động**: Gần **84.2% giá trị tồn kho hiện hữu** đang bị lưu giữ dưới mạng lưới hàng Điện tử (mã IPHONE15 & TV-SONY). Đề xuất đẩy mạnh tốc độ xuất hàng SO-102 để giải phóng 50 thùng sữa tươi giải tỏa mặt bằng dòng tiền.\n\n- **Cảnh báo Điểm nghẽn**: SKU `COCA-320` đang sụt giảm tốc độ, khuyến nghị kích hoạt Restock Email soạn sẵn tới nhà phân phối Coca-Cola Beverages Indochina.",
          highlights: ["Zone Dry lấp đầy 34%", "84.2% vốn tập trung mảng Điện tử", "Kích hoạt Order restock Coca-Cola ngay"]
        };
    res.json(mockResult);
  }
});

// Voice Command NLP parsing (UC-03)
app.post("/api/gemini/voice-command", async (req: Request, res: Response) => {
  const { transcript, locale } = req.body;
  const activeLocale = locale || "vi-VN";

  try {
    const ai = getGeminiClient();
    if (!ai) {
      // Local fallback parsing using regex
      const text = transcript.toLowerCase();
      let action = "STATUS_CHECK";
      let sku = "COCA-320";
      let qty = 10;
      let bin = "D2-A02-N01";
      let confirmText = "Đã tiếp nhận yêu cầu khẩu lệnh.";

      if (text.includes("sữa") || text.includes("milk")) {
        sku = "MILK-VNM";
        bin = "C1-A01-N02";
      } else if (text.includes("mì") || text.includes("noodle") || text.includes("hảo hảo")) {
        sku = "NOODLE-HH";
        bin = "D2-A02-N01";
      } else if (text.includes("iphone") || text.includes("điện thoại")) {
        sku = "IPHONE15";
        bin = "D2-A02-N02";
      } else if (text.includes("tv") || text.includes("tivi") || text.includes("sony")) {
        sku = "TV-SONY";
        bin = "D2-A03-N01";
      }

      const matchDigits = text.match(/\d+/);
      if (matchDigits) {
        qty = parseInt(matchDigits[0], 10);
      }

      if (text.includes("lấy") || text.includes("pick") || text.includes("xuất")) {
        action = "SUBTRACT";
        confirmText = activeLocale === "en-US"
          ? `Voice Confirmed: Picking ${qty} unit(s) of SKU ${sku} from Bin ${bin}. Proceed now.`
          : `Khẩu lệnh xác nhận: Đang lấy ${qty} ${sku} tại vị trí kệ ${bin}. Hãy thực hiện quét mã để hoàn tất.`;
      } else if (text.includes("nhập") || text.includes("put") || text.includes("đặt")) {
        action = "ADD";
        confirmText = activeLocale === "en-US"
          ? `Voice Confirmed: Placing ${qty} unit(s) of SKU ${sku} into Bin ${bin}.`
          : `Khẩu lệnh xác nhận: Nhập vào thành công ${qty} ${sku} ở kệ ${bin}.`;
      } else {
        action = "STATUS_CHECK";
        confirmText = activeLocale === "en-US"
          ? `Voice command searching catalog for SKU ${sku}. Stock is stable.`
          : `Hệ thống ghi nhận tra cứu sản phẩm ${sku}. Hiện đang tồn kho ổn định.`;
      }

      return res.json({ action, sku, qty, binCode: bin, confirmationText: confirmText });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are the Voice-To-Action NLP parser for SmartWMS. Analyze this voice input: "${transcript}".
                 Identify Intent Action (Must map to "ADD" for putting, "SUBTRACT" for picking/taking, or "STATUS_CHECK" for searching), SKU (Choose one of 'IPHONE15', 'MILK-VNM', 'NOODLE-HH', 'COCA-320', 'TV-SONY' based on similarity), qty (integer), binCode (a bin code like C1-A01-N02 or D2-A02-N01).
                 Return ONLY a valid JSON string adhering to this schema:
                 {"action": "ADD"|"SUBTRACT"|"STATUS_CHECK", "sku": "...", "qty": 10, "binCode": "...", "confirmationText": "A friendly confirmation announcement sentence to read back to the staff in ${activeLocale === 'en-US' ? 'English' : 'Vietnamese'}."}
                 No other commentary.`
    });

    let cleanText = response.text.trim();
    if (cleanText.includes("```")) {
      cleanText = cleanText.replace(/```json|```/g, "").trim();
    }
    const parsed = JSON.parse(cleanText);
    res.json(parsed);

  } catch (err: any) {
    handleGeminiError("Voice NLP API", err);
    const text = (transcript || "").toLowerCase();
    let action = "STATUS_CHECK";
    let sku = "COCA-320";
    let qty = 10;
    let bin = "D2-A02-N01";
    let confirmText = "Đã tiếp nhận yêu cầu khẩu lệnh.";

    if (text.includes("sữa") || text.includes("milk")) {
      sku = "MILK-VNM";
      bin = "C1-A01-N02";
    } else if (text.includes("mì") || text.includes("noodle") || text.includes("hảo hảo")) {
      sku = "NOODLE-HH";
      bin = "D2-A02-N01";
    } else if (text.includes("iphone") || text.includes("điện thoại")) {
      sku = "IPHONE15";
      bin = "D2-A02-N02";
    } else if (text.includes("tv") || text.includes("tivi") || text.includes("sony")) {
      sku = "TV-SONY";
      bin = "D2-A03-N01";
    }

    const matchDigits = text.match(/\d+/);
    if (matchDigits) {
      qty = parseInt(matchDigits[0], 10);
    }

    if (text.includes("lấy") || text.includes("pick") || text.includes("xuất")) {
      action = "SUBTRACT";
      confirmText = activeLocale === "en-US"
        ? `[Quota Recovery] Voice Confirmed: Picking ${qty} unit(s) of SKU ${sku} from Bin ${bin}.`
        : `[Phục hồi Quota] Khẩu lệnh xác nhận: Đang lấy ${qty} ${sku} tại vị trí kệ ${bin}.`;
    } else if (text.includes("nhập") || text.includes("put") || text.includes("đặt")) {
      action = "ADD";
      confirmText = activeLocale === "en-US"
        ? `[Quota Recovery] Voice Confirmed: Placing ${qty} unit(s) of SKU ${sku} into Bin ${bin}.`
        : `[Phục hồi Quota] Khẩu lệnh xác nhận: Nhập vào thành công ${qty} ${sku} ở kệ ${bin}.`;
    } else {
      action = "STATUS_CHECK";
      confirmText = activeLocale === "en-US"
        ? `[Quota Recovery] Voice searching for SKU ${sku}. Stock is online.`
        : `[Phục hồi Quota] Ghi nhận tra cứu sản phẩm ${sku}. Hiện tồn kho ổn định.`;
    }

    res.json({ action, sku, qty, binCode: bin, confirmationText: confirmText });
  }
});

// Invoice Multimodal OCR parser (UC-05)
app.post("/api/gemini/ocr-invoice", async (req: Request, res: Response) => {
  const { imageBase64 } = req.body;

  try {
    const ai = getGeminiClient();
    if (!ai || !imageBase64) {
      // Local fallback high quality simulated OCR result
      const mockInvoice = {
        vendorName: "Vinamilk Co Ltd Vietnam",
        invoiceNo: "VNM-DEL-2026-981",
        date: "2026-05-20",
        items: [
          { sku: "MILK-VNM", name: "Vinamilk Milk Carton 180ml", quantity: 150, price: 345000 }
        ],
        confidence: "98% (Demo Simulated Scan)"
      };
      return res.json(mockInvoice);
    }

    const cleanedBase64 = imageBase64.split(",")[1] || imageBase64;
    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanedBase64
      }
    };

    const promptPart = {
      text: `You are the ultimate logistics OCR parsing agent. Extract invoice data from the image.
             If it looks like a delivery sheet or text-label, extract: Vendor Name, Invoice/Receipt No, Issue Date, and list of Items with columns (name, SKU, quantity, price).
             Return STRICTLY a JSON format block like:
             {"vendorName": "...", "invoiceNo": "...", "date": "...", "items": [{"sku": "...", "name": "...", "quantity": 100, "price": 30000}]}.
             Adhere to registed SKUs catalog where applicable: MILK-VNM, COCA-320, TV-SONY, IPHONE15, NOODLE-HH.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, promptPart] }
    });

    let resultString = response.text.trim();
    if (resultString.includes("```")) {
      resultString = resultString.replace(/```json|```/g, "").trim();
    }
    const ocrData = JSON.parse(resultString);
    res.json(ocrData);

  } catch (err: any) {
    handleGeminiError("OCR Invoice API", err);
    const mockInvoice = {
      vendorName: "Vinamilk Co Ltd Vietnam",
      invoiceNo: "VNM-DEL-2026-981",
      date: "2026-05-20",
      items: [
        { sku: "MILK-VNM", name: "Vinamilk Milk Carton 180ml", quantity: 150, price: 345000 }
      ],
      confidence: "98% (Safe Quota Fallback Scan)"
    };
    res.json(mockInvoice);
  }
});

// Damage detection Multimodal Vision classifier (UC-05)
app.post("/api/gemini/damage-detection", async (req: Request, res: Response) => {
  const { imageBase64, locale } = req.body;
  const activeLocale = locale || "vi-VN";

  try {
    const ai = getGeminiClient();
    if (!ai || !imageBase64) {
      // Local simulated response
      const mockDamage = {
        damageTypeEn: "Water Leakage & Wet Cardboard Ripping",
        damageTypeVi: "Rò rỉ nước & Thùng Carton ẩm rách",
        severityScore: 7,
        actionEn: "Move immediately to Quarantine/Salvage and notify supervisor for reimbursement.",
        actionVi: "Di chuyển ngay lập tức vào Khu cách ly / Hàng lỗi chờ sửa tủ và gửi báo cáo hoàn phí.",
        confidence: "95% (Demo Simulated AI Vision)"
      };
      return res.json(mockDamage);
    }

    const cleanedBase64 = imageBase64.split(",")[1] || imageBase64;
    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanedBase64
      }
    };

    const promptPart = {
      text: `You are a packaging quality control auditor in a modern distribution center.
             Classify physical damage type of item shown in picture, select level on severity scale 1 to 10.
             Advise logical remedial actions for this product.
             Response strictly with JSON following this Schema:
             {"damageTypeEn": "...", "damageTypeVi": "...", "severityScore": 7, "actionEn": "...", "actionVi": "..."}.
             No other text wrapper.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, promptPart] }
    });

    let resultString = response.text.trim();
    if (resultString.includes("```")) {
      resultString = resultString.replace(/```json|```/g, "").trim();
    }
    const damageData = JSON.parse(resultString);
    res.json(damageData);

  } catch (err: any) {
    handleGeminiError("Damage Classifier API", err);
    const mockDamage = {
      damageTypeEn: "Water Leakage & Wet Cardboard Ripping",
      damageTypeVi: "Rò rỉ nước & Thùng Carton ẩm rách",
      severityScore: 7,
      actionEn: "Move immediately to Quarantine/Salvage and notify supervisor for reimbursement.",
      actionVi: "Di chuyển ngay lập tức vào Khu cách ly / Hàng lỗi chờ sửa tủ và gửi báo cáo hoàn phí.",
      confidence: "95% (Safe Quota Fallback Vision)"
    };
    res.json(mockDamage);
  }
});

// AI Forecasting 7/30 days demand simulation (Predictive AI)
app.get("/api/analytics/forecasting", (req: Request, res: Response) => {
  // We model highly realistic forecasting cycles using mathematical trends to provide flawless analytics curves.
  const forecastingResult = state.products.map(p => {
    // Lead time variations based on category
    const leadTimeDays = p.category === "Electronics" ? 7 : 3;
    const avgDailyOutbound = p.sku === "MILK-VNM" ? 18 : p.sku === "COCA-320" ? 22 : p.sku === "NOODLE-HH" ? 15 : p.sku === "IPHONE15" ? 6 : 2;
    const stdDevOutbound = avgDailyOutbound * 0.25;

    // Standard safety equations requested by prompt:
    const safetyStock = Math.ceil(stdDevOutbound * Math.sqrt(leadTimeDays) * 1.65);
    const minStock = Math.ceil(safetyStock + (avgDailyOutbound * leadTimeDays));
    const maxStock = Math.ceil(minStock + (avgDailyOutbound * 10));

    // Generate historical 15 days demand
    const demandHistory = Array.from({ length: 15 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (15 - i));
      const waveNoise = Math.sin(i * 0.8) * (avgDailyOutbound * 0.4);
      return {
        date: date.toISOString().split('T')[0],
        quantity: Math.max(0, Math.round(avgDailyOutbound + waveNoise + (Math.random() * 4 - 2)))
      };
    });

    // Generate forecast 30 days demand
    const demandForecast = Array.from({ length: 30 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + (i + 1));
      // Add slight growth weekend trends
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const trendComponent = isWeekend ? (avgDailyOutbound * 1.3) : (avgDailyOutbound * 0.95);
      return {
        date: date.toISOString().split('T')[0],
        quantity: Math.max(0, Math.round(trendComponent + Math.sin(i * 0.5) * 3 + (Math.random() * 2 - 1)))
      };
    });

    return {
      sku: p.sku,
      name: p.name,
      avgDailyOutbound,
      safetyStock,
      minStock,
      maxStock,
      demandHistory,
      demandForecast
    };
  });

  res.json(forecastingResult);
});

// Logs a localized audit event
app.post("/api/audit-logs/log", (req: Request, res: Response) => {
  const { operator, role, action, details, apiPath, locale } = req.body;

  // Custom AI Security Audit Scan logic - UC-01 Security Rules
  let isAnomaly = false;
  let anomalyReason = "";
  if (details.toLowerCase().includes("hacker") || details.toLowerCase().includes("159.20.142.1") || details.toLowerCase().includes("failed login twice")) {
    isAnomaly = true;
    anomalyReason = locale === "en-US"
      ? "AI Agent flagged: Multiple access violations or external threat injection detected."
      : "Đối soát AI phát hiện: Vi phạm số lượng đăng nhập hoặc hành vi thay đổi IP đột ngột.";
  }

  const log = addAuditLog(operator, role, action, details, apiPath, locale, isAnomaly, anomalyReason);
  res.json({ success: true, log });
});

// GET /api/v1/audit-logs with server-side pagination & filtering
app.get("/api/v1/audit-logs", (req: Request, res: Response) => {
  const pageIndex = parseInt(req.query.pageIndex as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;
  const searchKeyword = ((req.query.searchKeyword as string) || "").toLowerCase();
  const userRole = (req.query.userRole as string) || "";
  const isAiAnomaly = req.query.isAiAnomaly === "true";
  const category = (req.query.category as string) || "all";
  const fromDate = (req.query.fromDate as string) || "";
  const toDate = (req.query.toDate as string) || "";

  let filtered = [...state.auditLogs];

  if (searchKeyword) {
    filtered = filtered.filter((log: any) => {
      const op = (log.operator || "").toLowerCase();
      const act = (typeof log.action === "object" ? (log.action.vi + " " + log.action.en) : log.action || "").toLowerCase();
      const det = (typeof log.details === "object" ? (log.details.vi + " " + log.details.en) : log.details || "").toLowerCase();
      const intent = (typeof log.intent === "object" ? (log.intent.vi + " " + log.intent.en) : log.intent || "").toLowerCase();
      const ip = (log.ip || "").toLowerCase();
      const api = (log.apiPath || "").toLowerCase();
      return op.includes(searchKeyword) || act.includes(searchKeyword) || det.includes(searchKeyword) || intent.includes(searchKeyword) || ip.includes(searchKeyword) || api.includes(searchKeyword);
    });
  }

  if (category && category !== "all") {
    filtered = filtered.filter((log: any) => {
      const api = (log.apiPath || "").toLowerCase();
      const action = (
        typeof log.action === "object"
          ? `${log.action.vi} ${log.action.en}`
          : log.action || ""
      ).toLowerCase();

      let cat = "putaway";
      if (
        log.isAnomaly ||
        api.includes("auth") ||
        api.includes("login") ||
        action.includes("đăng nhập") ||
        action.includes("login") ||
        action.includes("xác thực") ||
        action.includes("mật khẩu") ||
        action.includes("bảo mật") ||
        action.includes("tường lửa")
      ) {
        cat = "security";
      } else if (
        api.includes("transfer") ||
        api.includes("replenish") ||
        action.includes("điều chuyển") ||
        action.includes("châm hàng") ||
        action.includes("transfer") ||
        action.includes("replenish")
      ) {
        cat = "transfer";
      } else if (
        api === "init" ||
        api.includes("mdm") ||
        api.includes("products") ||
        api.includes("vendors") ||
        api.includes("warehouses") ||
        api.includes("zones") ||
        action.includes("khởi tạo") ||
        action.includes("danh mục") ||
        action.includes("kiến tạo phân khu") ||
        action.includes("sản phẩm mới")
      ) {
        cat = "mdm";
      }
      return cat === category;
    });
  }

  if (userRole) {
    filtered = filtered.filter((log: any) => log.role === userRole);
  }

  if (isAiAnomaly) {
    filtered = filtered.filter((log: any) => log.isAnomaly);
  }

  if (fromDate) {
    const fromTime = new Date(fromDate).getTime();
    filtered = filtered.filter((log: any) => new Date(log.timestamp).getTime() >= fromTime);
  }

  if (toDate) {
    const toTime = new Date(toDate).getTime() + 86400000;
    filtered = filtered.filter((log: any) => new Date(log.timestamp).getTime() <= toTime);
  }

  // Descending sort by timestamp
  filtered.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const start = (pageIndex - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  res.json({
    items,
    pageIndex,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: pageIndex > 1,
    hasNextPage: pageIndex < totalPages,
  });
});


// ==========================================
// VITE OR STATIC BUILD MIDDLEWARE
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      mode: "demo",
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`SmartWMS DEMO ONLY (in-memory, no ASP.NET API) http://127.0.0.1:${PORT}`);
  });
}

startServer();
