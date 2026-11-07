/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  nameVi?: string;
  unit: string;
  description: { vi: string; en: string };
  category: string;
  price: number;
  imageUrl?: string;
  packagingRatio?: number;
  storageCondition?: "Dry" | "Cool" | "HighValue" | string;
  cartonDimensions?: string;
  packageWeightKg?: number;
  minSafetyStock?: number;
  maxCapacityStock?: number;
  rotationStrategy?: "FEFO" | "FIFO" | string;
}

export interface Warehouse {
  id: string;
  name: any;
  code: string;
  location: string;
  description: string;
}

export interface WarehouseZone {
  id: string;
  name: any;
  warehouseId: string;
  type: "Cool" | "Dry" | "Hazardous" | "HighValue" | "RetailCounter";
  capacity: number; // Max weight or volumes
  currentOccupancy: number;
}

export interface BinStoredSku {
  sku: string;
  qty: number;
  name?: string;
  lotNumber?: string;
  expirationDate?: string;
  status?: "Available" | "Expired" | "Damaged"; // Khả dụng / Hết hạn / Hư hỏng
}

export interface Bin {
  id: string;
  code: string;
  zoneId: string;
  maxCapacity: number; // Piece capacity
  maxWeightKg?: number; // Weight capacity in kg
  minThreshold?: number; // Safety threshold for retail replenishment
  currentOccupancy: number; // Current pieces count
  status: "empty" | "partial" | "full";
  storedSkus: BinStoredSku[];
}

export interface CounterProductStock {
  sku: string;
  name: string;
  category: string;
  counterBinCode: string;
  currentQty: number;
  minThreshold: number;
  maxCapacity: number;
  reserveBinCode: string;
  reserveQty: number;
  status: "critical" | "warning" | "ok";
  unit: string;
  urgency: "HIGH" | "MEDIUM" | "NORMAL";
}

export interface ReplenishmentTask {
  id: string;
  sku: string;
  productName: string;
  fromBin: string;
  toBin: string;
  requestedQty: number;
  currentCounterQty: number;
  targetCounterQty: number;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
  estimatedMinutes: number;
  assignedStaff?: string;
}

export interface InboundReceipt {
  id: string;
  poNumber: string;
  vendorName: string;
  date: string;
  status: "Pending" | "Processing" | "Completed";
  items: {
    sku: string;
    name: string;
    expectedQty: number;
    receivedQty: number;
    binCode?: string;
  }[];
}

export interface OutboundOrder {
  id: string;
  soNumber: string;
  customerName: string;
  date: string;
  status: "Pending" | "Processing" | "Completed";
  items: {
    sku: string;
    expectedQty: number;
    pickedQty: number;
    binCode?: string;
  }[];
}

export interface WavePicking {
  id: string;
  name: string;
  orders: string[]; // Order IDs
  status: "Pending" | "Picking" | "Completed";
  assignedStaff?: string;
  optimizedPath: {
    step: number;
    binCode: string;
    sku: string;
    name: string;
    qty: number;
    scanned: boolean;
  }[];
}

export interface AuditLog {
  id: string;
  operator: string;
  role: "Admin" | "Manager" | "Staff" | "AI-Agent";
  action: string;
  intent?: string | { vi: string; en: string };
  details: string | { vi: string; en: string };
  apiPath?: string;
  ip: string;
  timestamp: string;
  locale: string;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export interface SystemNotification {
  id: string;
  type: "low_stock" | "expiry" | "anomaly" | "order_approved";
  titleVi: string;
  titleEn: string;
  messageVi: string;
  messageEn: string;
  timestamp: string;
  read: boolean;
  resolved: boolean;
  metaData?: {
    sku?: string;
    restockDraft?: {
      sku: string;
      qty: number;
      vendorEmail: string;
      vendorName: string;
      emailBodyVi: string;
      emailBodyEn: string;
    };
  };
}

export interface AIChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  chartData?: any[];
  tableData?: any;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  scope: any;
  preferredLang: string;
}

// RBAC DTOs

export interface RoleDto {
  roleId: string;
  roleName: string;
}

export interface PermissionItemDto {
  permissionId: number;
  name: string;
  permissionKey: string;
  roleAccess: Record<string, boolean>; // e.g., { "admin": true, "manager": false }
}

export interface PermissionCategoryDto {
  categoryName: string;
  permissions: PermissionItemDto[];
}

export interface PermissionMatrixDto {
  roles: RoleDto[];
  categories: PermissionCategoryDto[];
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  warehouse: string;
}

export interface UpdateRolePermissionRequest {
  roleId: string;
  permissionKey: string;
  isEnabled: boolean;
}

export interface AssignUserRoleRequest {
  userId: string;
  newRoleName: string;
}

export interface InviteUserRequest {
  fullName: string;
  email: string;
  roleId: string;
  warehouse: string;
}

export interface CheckZoneEfficiencyResponse {
  hasSuggestion: boolean;
  messageKey: string;
  suggestedZone: string;
}
