/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApiError } from "../api/apiTypes";
import {
  IOutboundProvider,
  OutboundOrderDetail,
  CreateOutboundOrderRequest,
  PickReservationItem,
  TrackingMode,
} from "./types";
import { INITIAL_MOCK_OUTBOUND_ORDERS } from "./outboundMockData";

let mockOutboundStore: OutboundOrderDetail[] = INITIAL_MOCK_OUTBOUND_ORDERS.map(
  (o) => JSON.parse(JSON.stringify(o))
);

export const resetMockOutboundStore = () => {
  mockOutboundStore = INITIAL_MOCK_OUTBOUND_ORDERS.map((o) =>
    JSON.parse(JSON.stringify(o))
  );
};

export const mockOutboundProvider: IOutboundProvider = {
  async getOutboundOrders(): Promise<OutboundOrderDetail[]> {
    return JSON.parse(JSON.stringify(mockOutboundStore));
  },

  async getOutboundOrderById(id: string): Promise<OutboundOrderDetail> {
    const order = mockOutboundStore.find(
      (o) => o.id === id || o.orderNumber === id
    );
    if (!order) {
      const err: ApiError = {
        status: 404,
        message: "Đơn hàng không còn tồn tại hoặc đã bị hủy.",
      };
      throw err;
    }
    return JSON.parse(JSON.stringify(order));
  },

  async createOutboundOrder(
    request: CreateOutboundOrderRequest
  ): Promise<OutboundOrderDetail> {
    if (!request.items || request.items.length === 0) {
      const err: ApiError = {
        status: 400,
        message: "Lệnh xuất kho cần có ít nhất 1 mặt hàng.",
      };
      throw err;
    }

    for (const it of request.items) {
      if (it.requestedQuantity <= 0) {
        const err: ApiError = {
          status: 400,
          message: "Số lượng xuất kho phải lớn hơn 0.",
        };
        throw err;
      }
    }

    const orderId = `OUT-${Math.floor(Math.random() * 900 + 100)}`;
    const newOrder: OutboundOrderDetail = {
      id: orderId,
      orderNumber: request.orderNumber,
      binId: request.binId,
      binCode: request.binId.startsWith("b") ? "D2-A02-N02" : request.binId,
      customerId: request.customerId || null,
      customerName: "Thế Giới Di Động Group",
      status: "Pending",
      isDirectPick: true,
      expectedShipDate: request.expectedShipDate || new Date().toISOString().split("T")[0],
      priority: request.priority || "Normal",
      notes: request.notes || null,
      createdAt: new Date().toISOString().split("T")[0],
      carrier: "DHL Express",
      address: "Số 128 Trần Quang Khải, P. Tân Định, Quận 1, TP. HCM",
      items: request.items.map((it, idx) => ({
        id: `item-${orderId}-${idx + 1}`,
        productId: it.productId,
        sku: it.productId.toUpperCase(),
        productName: `Sản phẩm ${it.productId.toUpperCase()}`,
        unit: "Pcs",
        quantity: it.requestedQuantity,
        trackingModeSnapshot: it.productId.toLowerCase().includes("milk") || it.productId.toLowerCase().includes("iphone") ? TrackingMode.Lot : TrackingMode.None,
        reservedQuantity: 0,
        pickedQuantity: 0,
        shippedQuantity: 0,
        status: "Pending",
        isDirectPick: true,
        reservations: [],
      })),
    };

    mockOutboundStore.unshift(newOrder);
    return JSON.parse(JSON.stringify(newOrder));
  },

  async allocateOutboundOrder(id: string): Promise<OutboundOrderDetail> {
    const order = mockOutboundStore.find(
      (o) => o.id === id || o.orderNumber === id
    );
    if (!order) {
      const err: ApiError = {
        status: 404,
        message: "Đơn hàng không còn tồn tại hoặc đã bị hủy.",
      };
      throw err;
    }

    if (order.status !== "Pending") {
      const err: ApiError = {
        status: 409,
        message:
          "Dữ liệu đơn hàng hoặc tồn kho đã thay đổi. Vui lòng tải lại thông tin trước khi tiếp tục.",
      };
      throw err;
    }

    order.status = "Allocated";
    const allocId = `alloc-${Date.now().toString().slice(-4)}`;

    order.items.forEach((item, idx) => {
      item.reservedQuantity = item.quantity;
      item.status = "Allocated";

      const isLot = item.trackingModeSnapshot === TrackingMode.Lot;
      const reservationId = `res-${order.id}-${idx + 1}-${Date.now().toString().slice(-3)}`;

      item.reservations = [
        {
          id: reservationId,
          allocationId: allocId,
          sourceBinInventoryId: `bin-inv-${item.sku || item.productId}`,
          sourceBinCode: order.binCode || "D2-A02-N02",
          lotNumber: isLot ? `LOT-2026-${(item.sku || "PROD").slice(0, 3)}` : null,
          expirationDate: isLot ? "2027-12-31" : null,
          quantity: item.quantity,
          pickedQuantity: 0,
          shippedQuantity: 0,
          releasedQuantity: 0,
          status: "Reserved",
        },
      ];
    });

    return JSON.parse(JSON.stringify(order));
  },

  async pickOutboundOrder(
    id: string,
    items: PickReservationItem[]
  ): Promise<OutboundOrderDetail> {
    const order = mockOutboundStore.find(
      (o) => o.id === id || o.orderNumber === id
    );
    if (!order) {
      const err: ApiError = {
        status: 404,
        message: "Đơn hàng không còn tồn tại hoặc đã bị hủy.",
      };
      throw err;
    }

    if (order.status !== "Allocated") {
      const err: ApiError = {
        status: 409,
        message:
          "Dữ liệu đơn hàng hoặc tồn kho đã thay đổi. Vui lòng tải lại thông tin trước khi tiếp tục.",
      };
      throw err;
    }

    // Backend B3 enforces Full Pick
    const allReservations = order.items.flatMap((it) => it.reservations);
    if (items.length !== allReservations.length) {
      const err: ApiError = {
        status: 400,
        message: "Quy trình B3 yêu cầu lấy toàn bộ hàng (Full Pick) theo các chỉ định phân bổ.",
      };
      throw err;
    }

    order.items.forEach((item) => {
      item.reservations.forEach((res) => {
        const pickReq = items.find((p) => p.reservationId === res.id);
        if (pickReq) {
          res.pickedQuantity = pickReq.quantity;
          res.status = "Picked";
        }
      });
      item.pickedQuantity = item.quantity;
      item.status = "Picked";
    });

    order.status = "Picked";
    return JSON.parse(JSON.stringify(order));
  },

  async packOutboundOrder(id: string): Promise<OutboundOrderDetail> {
    const order = mockOutboundStore.find(
      (o) => o.id === id || o.orderNumber === id
    );
    if (!order) {
      const err: ApiError = {
        status: 404,
        message: "Đơn hàng không còn tồn tại hoặc đã bị hủy.",
      };
      throw err;
    }

    if (order.status === "Packed") {
      return JSON.parse(JSON.stringify(order));
    }

    if (order.status !== "Picked") {
      const err: ApiError = {
        status: 409,
        message:
          "Dữ liệu đơn hàng hoặc tồn kho đã thay đổi. Vui lòng tải lại thông tin trước khi tiếp tục.",
      };
      throw err;
    }

    order.status = "Packed";
    order.items.forEach((item) => {
      item.status = "Packed";
      item.reservations.forEach((res) => {
        res.status = "Packed";
      });
    });

    return JSON.parse(JSON.stringify(order));
  },

  async shipOutboundOrder(id: string): Promise<OutboundOrderDetail> {
    const order = mockOutboundStore.find(
      (o) => o.id === id || o.orderNumber === id
    );
    if (!order) {
      const err: ApiError = {
        status: 404,
        message: "Đơn hàng không còn tồn tại hoặc đã bị hủy.",
      };
      throw err;
    }

    if (order.status !== "Packed") {
      const err: ApiError = {
        status: 409,
        message:
          "Dữ liệu đơn hàng hoặc tồn kho đã thay đổi. Vui lòng tải lại thông tin trước khi tiếp tục.",
      };
      throw err;
    }

    order.status = "Shipped";
    order.items.forEach((item) => {
      item.shippedQuantity = item.quantity;
      item.status = "Shipped";
      item.reservations.forEach((res) => {
        res.shippedQuantity = res.quantity;
        res.status = "Shipped";
      });
    });

    return JSON.parse(JSON.stringify(order));
  },

  async cancelOutboundOrder(id: string): Promise<void> {
    const order = mockOutboundStore.find(
      (o) => o.id === id || o.orderNumber === id
    );
    if (!order) {
      const err: ApiError = {
        status: 404,
        message: "Đơn hàng không còn tồn tại hoặc đã bị hủy.",
      };
      throw err;
    }

    if (order.status !== "Pending" && order.status !== "Allocated") {
      const err: ApiError = {
        status: 400,
        message: "Chỉ có thể hủy đơn hàng ở trạng thái Chờ xử lý hoặc Đã phân bổ.",
      };
      throw err;
    }

    if (order.status === "Allocated") {
      order.items.forEach((item) => {
        item.reservedQuantity = 0;
        item.reservations.forEach((res) => {
          res.releasedQuantity = res.quantity;
          res.status = "Released";
        });
      });
    }

    order.status = "Cancelled";
  },
};
