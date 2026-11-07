## Mục tiêu

- Mô tả ngắn yêu cầu và nguyên nhân thay đổi.

## Phạm vi

- File/module thay đổi:
- API/DTO/DB/RBAC thay đổi? Nếu có, nêu cụ thể:
- Tác động tới dữ liệu tồn kho hoặc mutation? Nếu có, mô tả rủi ro:

## Kiểm thử thực tế

- [ ] Backend build trên commit hiện tại
- [ ] Frontend typecheck/build trên commit hiện tại
- [ ] Frontend tests liên quan
- [ ] SQL/API integration trên fixture riêng (nếu có nghiệp vụ ghi dữ liệu)
- [ ] Kiểm tra regression bất biến WMS (nếu liên quan)

Ghi **lệnh, môi trường, PASS/FAIL/BLOCKED/NOT RUN** và link evidence; không dùng PASS lịch sử làm kết quả hiện tại.

## Data safety

- [ ] Không dùng database SmartWMS_DB thực cho bài kiểm thử có ghi
- [ ] Không thay đổi stock semantics (physical/ATP, inbound delta, B3 Pick, transfer cùng warehouse, cycle-count ownership, Kitting atomic)
- [ ] Không ghi secrets, JWT, connection strings vào diff/log

## Rollback & release

- Phương án hoàn tác:
- Migration có cần thiết không? Có rollback kế hoạch không?
- Vấn đề còn mở:
