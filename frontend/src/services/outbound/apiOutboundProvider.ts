// F0: INHERITED / UNVERIFIED. Historical contract claims below require F1 audit.
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { httpClient } from "../api/httpClient";
import { Result } from "../api/apiTypes";
import {
  IOutboundProvider,
  OutboundOrderDetail,
  CreateOutboundOrderRequest,
  PickReservationItem,
} from "./types";

/**
 * Real API Outbound Provider connecting to SmartWMS Backend B3 Checkpoint.
 * Base: /api/v1/OutboundOrders
 * Conforms strictly to backend contract:
 * Pending → Allocated → Picked → Packed → Shipped
 */
export const apiOutboundProvider: IOutboundProvider = {
  /**
   * GET /api/v1/OutboundOrders
   */
  async getOutboundOrders(): Promise<OutboundOrderDetail[]> {
    const response = await httpClient.get<Result<OutboundOrderDetail[]> | OutboundOrderDetail[]>(
      "/api/v1/OutboundOrders"
    );
    const body = response.data;
    if (body && typeof body === "object" && "data" in body) {
      return (body as Result<OutboundOrderDetail[]>).data || [];
    }
    return (body as OutboundOrderDetail[]) || [];
  },

  /**
   * GET /api/v1/OutboundOrders/{id}
   * Authoritative Source of Truth for lifecycle state and reservations.
   */
  async getOutboundOrderById(id: string): Promise<OutboundOrderDetail> {
    const response = await httpClient.get<Result<OutboundOrderDetail> | OutboundOrderDetail>(
      `/api/v1/OutboundOrders/${encodeURIComponent(id)}`
    );
    const body = response.data;
    if (body && typeof body === "object" && "data" in body) {
      return (body as Result<OutboundOrderDetail>).data;
    }
    return body as OutboundOrderDetail;
  },

  /**
   * POST /api/v1/OutboundOrders
   * Creates order in Pending status. Never reserve or deduct stock at Create.
   */
  async createOutboundOrder(
    request: CreateOutboundOrderRequest
  ): Promise<OutboundOrderDetail> {
    const response = await httpClient.post<Result<OutboundOrderDetail> | OutboundOrderDetail>(
      "/api/v1/OutboundOrders",
      request
    );
    const body = response.data;
    const created =
      body && typeof body === "object" && "data" in body
        ? (body as Result<OutboundOrderDetail>).data
        : (body as OutboundOrderDetail);

    const targetId = created?.id || request.orderNumber;
    return await this.getOutboundOrderById(targetId);
  },

  /**
   * POST /api/v1/OutboundOrders/allocate-pick-task
   * Body: { outboundOrderId } (Never send assignedUserId in B3 direct-pick).
   * Pending → Allocated
   */
  async allocateOutboundOrder(id: string): Promise<OutboundOrderDetail> {
    await httpClient.post<Result<unknown>>(
      "/api/v1/OutboundOrders/allocate-pick-task",
      {
        outboundOrderId: id,
      }
    );
    return await this.getOutboundOrderById(id);
  },

  /**
   * POST /api/v1/OutboundOrders/{id}/pick
   * Body: { items: [{ reservationId, quantity }] }
   * Allocated → Picked
   */
  async pickOutboundOrder(
    id: string,
    items: PickReservationItem[]
  ): Promise<OutboundOrderDetail> {
    await httpClient.post<Result<unknown>>(
      `/api/v1/OutboundOrders/${encodeURIComponent(id)}/pick`,
      {
        items,
      }
    );
    return await this.getOutboundOrderById(id);
  },

  /**
   * POST /api/v1/OutboundOrders/{id}/pack
   * No body.
   * Picked → Packed
   */
  async packOutboundOrder(id: string): Promise<OutboundOrderDetail> {
    await httpClient.post<Result<unknown>>(
      `/api/v1/OutboundOrders/${encodeURIComponent(id)}/pack`
    );
    return await this.getOutboundOrderById(id);
  },

  /**
   * POST /api/v1/OutboundOrders/{id}/ship
   * Body: {}
   * Packed → Shipped
   */
  async shipOutboundOrder(id: string): Promise<OutboundOrderDetail> {
    await httpClient.post<Result<unknown>>(
      `/api/v1/OutboundOrders/${encodeURIComponent(id)}/ship`,
      {}
    );
    return await this.getOutboundOrderById(id);
  },

  /**
   * DELETE /api/v1/OutboundOrders/{id}
   * Allowed only for Pending and Allocated orders.
   */
  async cancelOutboundOrder(id: string): Promise<void> {
    await httpClient.delete<Result<unknown>>(
      `/api/v1/OutboundOrders/${encodeURIComponent(id)}`
    );
  },
};
