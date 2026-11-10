# AGENTS.md — SmartWMS repository working rules

> Scope: toàn bộ repository SmartWMS. Cập nhật: 2026-11-10 (Phase B1a).
> Mục đích: hướng dẫn Codex làm việc an toàn và có thể kiểm chứng. Tài liệu ngữ cảnh đi kèm: [PROJECT_CONTEXT](docs/PROJECT_CONTEXT.md). Active guides: [development workflow](docs/DEVELOPMENT_WORKFLOW.md), [test strategy](docs/TEST_STRATEGY.md).
> Lưu ý: thông tin trạng thái trong tài liệu ngữ cảnh là **snapshot**, không thay cho việc kiểm tra Git/source hiện tại.

## 1. Start every task with evidence

1. Đọc yêu cầu người dùng và xác định chế độ: **audit/read-only**, **implementation**, hay **verification**. Nếu yêu cầu chỉ là khảo sát, không được tạo/sửa/xóa file.
2. Đọc `docs/PROJECT_CONTEXT.md` nếu tồn tại; tiếp theo kiểm tra `git status --short`, branch, HEAD và **các file hiện có liên quan**. Không suy đoán từ tài liệu cũ thay vì đọc code.
3. Kiểm tra có `AGENTS.md`/`AGENTS.override.md` khác trong các thư mục con liên quan và tuân theo hướng dẫn áp dụng.
4. Phân biệt rõ: **đã xác minh từ source/đã chạy test**, **bằng chứng lịch sử**, **chưa xác minh**, **đề xuất**.
5. Không tự thay đổi yêu cầu nghiệp vụ, RBAC, API contract hay cơ sở dữ liệu để làm cho test “pass”. Nếu yêu cầu mơ hồ và ảnh hưởng bất biến nghiệp vụ, trình bày phương án và chờ quyết định.

Giữ source provenance: M là selected main; P là PR #7 chưa merge; O là original enhancements; G0/G1A là verification infrastructure độc lập. Chỉ có trong O/P/G không có nghĩa đã có trong M. SHA và unknowns nằm trong PROJECT_CONTEXT; kiểm tra lại trước task mới.

## 2. Architecture and source of truth

- Backend: .NET 10 / ASP.NET Core. Project references: Api → Application + Infrastructure; Application → Domain; Infrastructure → Application + Domain. Luồng xử lý: controller → MediatR/validator/handler → persistence/provider interfaces → Infrastructure (EF Core/SQL Server, coordinator, JWT, Gemini). Không coi Domain → Infrastructure là dependency.
- Frontend: `frontend/` (React, TypeScript, Vite, TanStack Query, Axios). Khi sửa màn hình, lần ngược từ production routing tại `frontend/src/app/App.tsx`, không nhầm mock/demo/legacy components với production UI.
- API routes chủ yếu có tiền tố `/api/v1`; đối chiếu **controller/handler/DTO hiện hành** trước khi cập nhật frontend. `docs/FE_API_HANDOFF.md` là tài liệu hỗ trợ, có thể đã cũ.
- SQL Server/EF Core là nguồn tồn kho; không đưa nghiệp vụ tồn kho cốt lõi sang AI hoặc frontend.
- Giữ cách làm hiện có khi hợp lý; không refactor kiến trúc diện rộng chỉ vì lý tưởng hóa Clean Architecture.

## 3. Non-negotiable inventory invariants

- **Physical quantity khác ATP**: ATP = Quantity - ReservedQuantity. Không đổi ý nghĩa `stock-summary` đang thể hiện physical stock.
- **Inbound receiving**: `quantityReceived` là delta; phải bảo toàn precondition `expectedReceivedQuantity`. Không chuyển thành tổng tích lũy hay bỏ concurrency guard.
- **Outbound B3**: allocate → pick → pack → ship; Pick trừ physical stock đúng một lần; Pack/Ship không trừ lại. B3 là direct-pick có giới hạn (một source bin/order, None/Lot, không LPN).
- **Transfer**: nguồn và đích phải cùng warehouse; không nới lỏng guard, capacity, stock metadata hoặc stock availability.
- **Cycle Count**: bảo toàn snapshot, kiểm tra đầy đủ counted items, ownership của Staff và override của Admin/WarehouseManager.
- **Kitting**: recipe theo request, không tự suy ra stored BOM; atomic stock movement. Không tự retry/replay sau kết quả không rõ.
- **Replenishment**: `run-auto-replenish` là mutation toàn cục không có body; kết quả 0 movement vẫn hợp lệ.
- Không gỡ transaction boundaries, SQL locks, rowversion, constraints, audit/ledger và conflict handling để “đơn giản hóa” code.
- Không cho auto-retry các lệnh thay đổi tồn kho khi chưa có idempotency/reconciliation contract. Với timeout hoặc lost response, ưu tiên đối soát kết quả trước khi gửi lại.
- Serial/LPN/Wave, stored BOM, cross-warehouse transfer, mobile/PDA thật và post-pick reversal là phạm vi **chưa được chứng nhận end-to-end**. Không biến chúng thành “đã hỗ trợ” bằng việc bỏ validation.

## 4. Security, roles, AI

- Backend authorization là nguồn thực thi quyền; ẩn menu frontend không phải bảo mật.
- Ba role: `Admin`, `WarehouseManager`, `Staff`. Tạo inbound receipt hiện giới hạn Admin/WM; Staff có quyền tiếp nhận theo controller. Cycle Count Staff phải tuân ownership; quyền Admin/WM được override theo handler. Kiểm tra controller và handler trước khi thay role.
- Chưa có warehouse-level ACL/multi-tenancy; không mặc định user chỉ nhìn thấy kho của mình.
- Không ghi/log secrets, JWT, connection strings, credentials hay dữ liệu cá nhân. Không tự chỉnh appsettings/user secrets để mở kết nối thật.
- Gemini UI chủ yếu advisory, nhưng **background AI job có thể tạo inbound receipt**. Không tự bật jobs, Hangfire server, seed, migration, replay hoặc AI actions có side effect.
- Với dependency AI không khả dụng, giữ lỗi/fallback trung thực; không giả dữ liệu thành kết quả thành công, không buộc Product save phụ thuộc thành công của embedding.

## 5. Safe change policy

- **Mặc định**: khảo sát trước khi sửa. Khi được giao implementation, chỉ sửa phạm vi task được phép, tránh file ngoài phạm vi.
- Chỉ clone/tạo branch/stage/commit/push/PR/merge/deploy trong phạm vi được người dùng cho phép. Approval implementation không tự cấp quyền publish. Mỗi PR giữ scope review được; không gộp O-only feature history vào docs/tooling patch.
- Bảo toàn mọi thay đổi người dùng đang có. Không `git reset --hard`, `git clean`, `checkout --`, xoá artifacts, force-push, tự commit/push hoặc đổi branch nếu chưa được yêu cầu rõ.
- Không tự chạy database migration, seed, reset, mass UPDATE/DELETE, destructive scripts hoặc Postman rehearsal có mutation lên database đang dùng. Kiểm thử có write phải dùng **database fixture/test tách biệt** đã được người dùng xác nhận.
- Trước khi thêm package, thay schema, đổi contract public, đổi quyền, chạy migration hoặc làm thao tác không dễ đảo ngược: giải thích ảnh hưởng và xin phê duyệt.
- Nếu thực thi lệnh kiểm tra: đọc script trước để biết side effects. Build sẽ ghi `bin/obj/dist`; test runners có thể tạo hoặc xóa bundle/log; không gọi trong nhiệm vụ thuần read-only nếu không được phép.
- Ưu tiên patch nhỏ, giữ compatibility và tạo/điều chỉnh test đúng cho thay đổi.

## 6. Verification standards

- Bắt đầu từ kiểm tra phù hợp phạm vi. Có thể cân nhắc typecheck **không emit** nếu frontend dependencies đã hiện diện:
  `node frontend/node_modules/typescript/bin/tsc --noEmit --incremental false --project frontend/tsconfig.json`
- Trong nhiệm vụ implementation đã phê duyệt, cân nhắc `dotnet build SmartWMS.slnx`, `npm --prefix frontend run build`, và các test phù hợp **sau khi xác định side effects**. Không chạy suite dữ liệu hoặc browser rehearsal trên database demo.
- Phân biệt tests configured từ runner/imports với tests actually executed. Selected main B1a có products → semanticProductSearch import; không suy ra mọi AI suite đã được wire hoặc đã PASS. Xem TEST_STRATEGY và kiểm tra lại wiring khi source đổi.
- Solution chỉ chứa 4 production projects; 12 console verification projects ở main nằm ngoài solution. `dotnet test SmartWMS.slnx` không chứng nhận coverage các console harness. Harness SQL-capable/certifier/mirror có side effects; không chạy mặc định. Documentation-only task ưu tiên static checks, không cần application build.
- Không gọi kết quả test lịch sử là PASS tại HEAD hiện tại. Ghi rõ lệnh đã chạy, phạm vi, kết quả, môi trường và lý do chưa chạy.

## 7. Task handoff (required at end)

Báo cáo ngắn bằng tiếng Việt, giữ tên kỹ thuật trong tiếng Anh:

1. **Goal and scope** — đã xử lý gì, có điều gì ngoài phạm vi.
2. **Git state** — branch/HEAD trước và sau; ghi rõ thay đổi đang có từ trước.
3. **Changed files** — đường dẫn file và mục đích; với read-only: ghi `Không thay đổi file`.
4. **Behavior/contract** — thay đổi API, DTO, DB, RBAC, UI hoặc bất biến nghiệp vụ (nếu có).
5. **Verification** — các lệnh đã chạy, kết quả, lệnh chưa chạy và lý do; nêu side effect nếu có.
6. **Risk/next steps** — regression risk, vấn đề còn mở, file nên đọc cho task kế tiếp.

Nếu task chưa được giải quyết, nêu blocker và bằng chứng; không tự kết luận thành công. Không trình bày mã nguồn dài hoặc secrets trong handoff.

## 8. Review checklist

- Sai lệch giữa production UI và mock/demo adapters.
- Làm thay đổi semantics stock/reservation/concurrency hoặc tạo mutation lặp.
- Nới RBAC/ownership không chủ ý.
- Thay đổi HTTP response/error shape không cập nhật frontend tương ứng.
- Migration hoặc data write chạm database không cô lập.
- Dẫn chứng test PASS cũ như thể được chạy trên HEAD mới.
- UI nhận trường mà backend không lưu; kiểm DTO/persistence theo selected source, không suy từ forms O-only.
- Ví dụ JWT secret/connection settings trong tài liệu cũ: không in/copy giá trị vào tài liệu mới, diff/log/archive hoặc ZIP. Nếu cần review deletion, redact sensitive preimage và ghi rõ giới hạn patch; giữ lịch sử Git, báo owner đánh giá exposure/rotation riêng, không tự đổi runtime config.

**Sau khi nhận hướng dẫn mới, hãy tuân theo yêu cầu task cụ thể trong phạm vi cho phép và báo rõ bất kỳ xung đột nào với các quy tắc trên.**
