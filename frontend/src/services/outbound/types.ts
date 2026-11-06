/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tracking Mode Enum matching Backend Outbound B3 Checkpoint
 * None = 0, Lot = 1, Serial = 2
 * Note: Stable Direct-Pick UI only supports None (0) and Lot (1).
 * Serial (2) is unsupported in B3 stable direct-pick workflow.
 */
export enum TrackingMode {
  None = 0,
  Lot = 1,
  Serial = 2,
}

/**
 * Lifecycle Status of Outbound Order:
 * Pending → Allocated → Picked → Packed → Shipped
 */
export type OutboundOrderStatus =
  | "Pending"
  | "Allocated"
  | "Picked"
  | "Packed"
  | "Shipped"
  | "Cancelled";

/**
 * Stock Allocation Reservation returned from GET /api/v1/OutboundOrders/{id}
 */
export interface OutboundOrderReservation {
  id: string;
  allocationId: string;
  sourceBinInventoryId: string;
  sourceBinCode?: string;
  lotNumber: string | null;
  expirationDate: string | null;
  quantity: number;
  pickedQuantity: number;
  shippedQuantity: number;
  releasedQuantity: number;
  status: string;
}

/**
 * Outbound Order Line Item
 */
export interface OutboundOrderItem {
  id?: string;
  productId: string;
  sku?: string;
  productName?: string;
  unit?: string;
  quantity: number;
  trackingModeSnapshot: number; // 0 = None, 1 = Lot, 2 = Serial
  reservedQuantity: number;
  pickedQuantity: number;
  shippedQuantity: number;
  status: string;
  isDirectPick?: boolean;
  reservations: OutboundOrderReservation[];
}

/**
 * Outbound Order Detail - Authoritative Source of Truth
 */
export interface OutboundOrderDetail {
  id: string;
  orderNumber: string;
  binId: string;
  binCode?: string;
  customerId?: string | null;
  customerName?: string;
  status: OutboundOrderStatus;
  isDirectPick?: boolean;
  expectedShipDate?: string | null;
  priority?: string | null;
  notes?: string | null;
  createdAt?: string;
  carrier?: string;
  address?: string;
  items: OutboundOrderItem[];
}

/**
 * Request payload for POST /api/v1/OutboundOrders item
 */
export interface CreateOutboundOrderItemDto {
  productId: string;
  requestedQuantity: number;
}

/**
 * Request payload for POST /api/v1/OutboundOrders
 */
export interface CreateOutboundOrderRequest {
  orderNumber: string;
  binId: string;
  customerId?: string | null;
  expectedShipDate?: string | null;
  priority?: string | null;
  notes?: string | null;
  items: CreateOutboundOrderItemDto[];
}

/**
 * Request payload for POST /api/v1/OutboundOrders/allocate-pick-task
 * Note: Never send assignedUserId in B3 direct-pick workflow.
 */
export interface AllocateOutboundOrderRequest {
  outboundOrderId: string;
}

/**
 * Request item for POST /api/v1/OutboundOrders/{id}/pick
 */
export interface PickReservationItem {
  reservationId: string;
  quantity: number;
}

/**
 * Request payload for POST /api/v1/OutboundOrders/{id}/pick
 */
export interface PickOutboundOrderRequest {
  items: PickReservationItem[];
}

/**
 * Outbound Provider Contract
 */
export interface IOutboundProvider {
  getOutboundOrders(): Promise<OutboundOrderDetail[]>;
  getOutboundOrderById(id: string): Promise<OutboundOrderDetail>;
  createOutboundOrder(request: CreateOutboundOrderRequest): Promise<OutboundOrderDetail>;
  allocateOutboundOrder(id: string): Promise<OutboundOrderDetail>;
  pickOutboundOrder(id: string, items: PickReservationItem[]): Promise<OutboundOrderDetail>;
  packOutboundOrder(id: string): Promise<OutboundOrderDetail>;
  shipOutboundOrder(id: string): Promise<OutboundOrderDetail>;
  cancelOutboundOrder(id: string): Promise<void>;
}

/**
 * Available actions per Outbound status
 */
export interface OutboundAvailableActions {
  canAllocate: boolean;
  canPick: boolean;
  canPack: boolean;
  canShip: boolean;
  canCancel: boolean;
  isReadOnly: boolean;
}

/**
 * Centralized Action State helper
 * Pending: Allocate, Cancel
 * Allocated: Reservations, Pick, Cancel
 * Picked: Pack
 * Packed: Ship
 * Shipped: Read-only
 */
export function getOutboundAvailableActions(
  status: OutboundOrderStatus | string
): OutboundAvailableActions {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "pending":
      return {
        canAllocate: true,
        canPick: false,
        canPack: false,
        canShip: false,
        canCancel: true,
        isReadOnly: false,
      };
    case "allocated":
      return {
        canAllocate: false,
        canPick: true,
        canPack: false,
        canShip: false,
        canCancel: true,
        isReadOnly: false,
      };
    case "picked":
      return {
        canAllocate: false,
        canPick: false,
        canPack: true,
        canShip: false,
        canCancel: false,
        isReadOnly: false,
      };
    case "packed":
      return {
        canAllocate: false,
        canPick: false,
        canPack: false,
        canShip: true,
        canCancel: false,
        isReadOnly: false,
      };
    case "shipped":
      return {
        canAllocate: false,
        canPick: false,
        canPack: false,
        canShip: false,
        canCancel: false,
        isReadOnly: true,
      };
    default:
      return {
        canAllocate: false,
        canPick: false,
        canPack: false,
        canShip: false,
        canCancel: false,
        isReadOnly: true,
      };
  }
}
