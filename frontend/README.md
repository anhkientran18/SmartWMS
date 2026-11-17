# SmartWMS frontend

React 19/TypeScript/Vite với TanStack Query, Axios, Tailwind và VI/EN resources. Source snapshot theo [PROJECT_CONTEXT](../docs/PROJECT_CONTEXT.md); onboarding backend/SQL ở [root README](../README.md), checks/runner coverage ở [TEST_STRATEGY](../docs/TEST_STRATEGY.md).

## Run

Từ repository root, sau khi đã review install hooks và chuẩn bị backend/schema/account riêng:

~~~powershell
npm --prefix frontend ci --no-audit --no-fund
# Chỉ copy nếu .env.local chưa tồn tại; kiểm cấu hình trước khởi động.
if (-not (Test-Path -LiteralPath 'frontend/.env.local')) {
  Copy-Item -LiteralPath 'frontend/.env.example' -Destination 'frontend/.env.local'
}
npm --prefix frontend run dev
~~~

API mode mặc định; dùng `VITE_DATA_MODE=api` và `VITE_API_BASE_URL` là backend origin, **không kèm /api/v1**. HTTP profile ví dụ `http://localhost:5215`; chọn origin/certificate theo environment, restart Vite sau đổi settings. Không put server/provider/database secrets trong public `VITE_*`. Thiếu API origin tạo configuration error, không tự fallback mock. Frontend setup không cấp quyền migration/seed/rehearsal.

`npm --prefix frontend run dev:demo` chạy synthetic Express/Vite companion; không ASP.NET/SQL backend. Chỉ dùng synthetic accounts; không proxy demo endpoints sang API thật. Server demo reset khi restart; một số browser stores persist, sessions demo/real dùng keys riêng. Không coi demo là production backend. [Demo](demo/README.md) và [legacy](legacy/README.md) ghi ranh giới riêng.

## Production scope

Routing tại [App.tsx](src/app/App.tsx), mode tại [dataMode.ts](src/app/dataMode.ts). M/B1a có dashboard, inventory reads, global replenishment, inbound, B3 outbound, assigned Cycle Count, request Kitting, products/QR/barcode/**semantic search**, locations/bins/vendors, users/audit/profile/settings.

Dedicated transfer workspace thuộc P; inventory/customer/product operations và nhiều AI UI/NameEn enhancements thuộc O. Không coi prototype/legacy screens hoặc entity LPN/Serial/Wave là production workflows. [API catalogue](../docs/FE_API_HANDOFF.md) giữ endpoint/DTO/RBAC/provider và refresh details.

Backend inbound **create chỉ Admin/WarehouseManager** tại source B1a; Staff receiving vẫn được giữ. Tuyên bố Staff-create gap của PR0 cũ đã lỗi thời. Backend authorization và count ownership là authority; UI visibility không phải bảo mật. Staff broad master/planning/ship permissions chưa được coi là quyết định sản phẩm mới.

## UI integration rules

- Giữ shell/components/tokens đang được production routing dùng; không sửa mock/demo để nhận là production fix. Hỗ trợ VI/EN, keyboard/focus, loading/empty/error và readable responsive layouts.
- Dùng field names thực trong DTO. Không hiển thị Product dimensions như đã lưu, không suy warehouse ACL, global count listing, stored BOM hoặc physical staging từ UI mock.
- JWT nằm trong browser localStorage; logout xóa private state nhưng server không revoke JWT. Không nhập real credentials vào demo.
- Physical khác ATP; receive gửi delta + expected precondition; Pick deduct once, Pack/Ship không deduct lại. Đối soát timeout/lost response trước retry; không bật mutation auto-retry.
- Refetch chỉ endpoints role hiện tại được phép gọi. Provider unavailable phải hiện lỗi/fallback; null product embedding có thể đi cùng core-save success.
- Design-system và fixture-dataset documents chỉ có trong O được giữ tại source O; không copy dataset thật hoặc ngầm nhận O UI capabilities vào B1a.

## Verification

Typecheck/sprint/build ghi rõ ở test strategy; sprint có chín suites, products import semanticProductSearch. Tests dùng controlled adapters/mocks/SSR; không chứng nhận SQL/real API/browser/live Gemini. Demo preparation/rehearsal scripts có HTTP mutations và cần fixture riêng được xác nhận.

Build xuất dist; preview chỉ serve output local. Historical PR0 PASS (183 tests tại checkpoint cũ) không phải nghiệm thu source hiện tại; các reports gốc được giữ ở source history. Consolidation tài liệu này không chạy lại executable checks.
