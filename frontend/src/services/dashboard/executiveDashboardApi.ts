import { httpClient, normalizeApiError } from '../api/httpClient';
import { isDemoMode } from '../../app/dataMode';
import { sessionStore } from '../../features/auth/session';

export interface LowStockAlertItem {
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
}

export interface RecentLedgerTransaction {
  sku: string;
  transactionType: string;
  quantityChanged: number;
  location: string;
  createdAt: string;
}

export interface WarehouseDashboardData {
  totalProducts: number;
  totalActiveBins: number;
  globalOccupancyRate: number;
  lowStockAlerts: LowStockAlertItem[];
  recentTransactions: RecentLedgerTransaction[];
}

export interface InventorySummaryData {
  totalProducts: number;
  totalQuantity: number;
  lowStockItems: number;
}

export interface DashboardInsightData {
  totalProducts: number;
  totalBins: number;
  overallOccupancyPercentage: number;
  aiExecutiveSummary: string;
  aiAvailable: boolean;
  aiErrorCode: string | null;
}

export interface ExecutiveDashboardData {
  warehouse: WarehouseDashboardData;
  inventory: InventorySummaryData;
  inboundReceiptsByStatus: Record<string, number>;
  outboundOrdersByStatus: Record<string, number>;
  aiInsight: DashboardInsightData;
}

export const canViewExecutiveDashboard = (role?: string): boolean =>
  role === 'Admin' || role === 'WarehouseManager';

export function normalizeExecutiveDashboardData(raw: any): ExecutiveDashboardData {
  const w = raw?.warehouse ?? raw?.Warehouse ?? {};
  const inv = raw?.inventory ?? raw?.Inventory ?? {};
  const ai = raw?.aiInsight ?? raw?.AiInsight ?? {};

  const lowStockAlerts: LowStockAlertItem[] = Array.isArray(w.lowStockAlerts ?? w.LowStockAlerts)
    ? (w.lowStockAlerts ?? w.LowStockAlerts).map((a: any) => ({
        productId: String(a?.productId ?? a?.ProductId ?? ''),
        sku: String(a?.sku ?? a?.SKU ?? ''),
        productName: String(a?.productName ?? a?.ProductName ?? ''),
        currentStock: Number(a?.currentStock ?? a?.CurrentStock ?? 0),
      }))
    : [];

  const recentTransactions: RecentLedgerTransaction[] = Array.isArray(w.recentTransactions ?? w.RecentTransactions)
    ? (w.recentTransactions ?? w.RecentTransactions).map((t: any) => ({
        sku: String(t?.sku ?? t?.SKU ?? ''),
        transactionType: String(t?.transactionType ?? t?.TransactionType ?? ''),
        quantityChanged: Number(t?.quantityChanged ?? t?.QuantityChanged ?? 0),
        location: String(t?.location ?? t?.Location ?? ''),
        createdAt: String(t?.createdAt ?? t?.CreatedAt ?? ''),
      }))
    : [];

  const inboundByStatus: Record<string, number> = {};
  const rawInbound = raw?.inboundReceiptsByStatus ?? raw?.InboundReceiptsByStatus ?? {};
  if (rawInbound && typeof rawInbound === 'object') {
    for (const [k, v] of Object.entries(rawInbound)) {
      inboundByStatus[k] = Number(v) || 0;
    }
  }

  const outboundByStatus: Record<string, number> = {};
  const rawOutbound = raw?.outboundOrdersByStatus ?? raw?.OutboundOrdersByStatus ?? {};
  if (rawOutbound && typeof rawOutbound === 'object') {
    for (const [k, v] of Object.entries(rawOutbound)) {
      outboundByStatus[k] = Number(v) || 0;
    }
  }

  return {
    warehouse: {
      totalProducts: Number(w?.totalProducts ?? w?.TotalProducts ?? 0),
      totalActiveBins: Number(w?.totalActiveBins ?? w?.TotalActiveBins ?? 0),
      globalOccupancyRate: Number(w?.globalOccupancyRate ?? w?.GlobalOccupancyRate ?? 0),
      lowStockAlerts,
      recentTransactions,
    },
    inventory: {
      totalProducts: Number(inv?.totalProducts ?? inv?.TotalProducts ?? 0),
      totalQuantity: Number(inv?.totalQuantity ?? inv?.TotalQuantity ?? 0),
      lowStockItems: Number(inv?.lowStockItems ?? inv?.LowStockItems ?? 0),
    },
    inboundReceiptsByStatus: inboundByStatus,
    outboundOrdersByStatus: outboundByStatus,
    aiInsight: {
      totalProducts: Number(ai?.totalProducts ?? ai?.TotalProducts ?? 0),
      totalBins: Number(ai?.totalBins ?? ai?.TotalBins ?? 0),
      overallOccupancyPercentage: Number(ai?.overallOccupancyPercentage ?? ai?.OverallOccupancyPercentage ?? 0),
      aiExecutiveSummary: String(ai?.aiExecutiveSummary ?? ai?.AiExecutiveSummary ?? '').trim(),
      aiAvailable: Boolean(ai?.aiAvailable ?? ai?.AiAvailable ?? false),
      aiErrorCode: ai?.aiErrorCode ?? ai?.AiErrorCode ? String(ai?.aiErrorCode ?? ai?.AiErrorCode) : null,
    },
  };
}

export async function getExecutiveDashboard(signal?: AbortSignal): Promise<ExecutiveDashboardData> {
  const session = sessionStore.get();
  if (!canViewExecutiveDashboard(session?.role)) {
    throw normalizeApiError(403);
  }
  if (isDemoMode) {
    throw normalizeApiError(403);
  }
  const { data } = await httpClient.get('/api/v1/Dashboard/executive', { signal, timeout: 60000 });
  if (data?.isSuccess !== true || !data?.data) {
    throw normalizeApiError(502);
  }
  return normalizeExecutiveDashboardData(data.data);
}
