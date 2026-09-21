# Production Readiness Report

**Ngày đánh giá:** 2026-09-21  
**Revision gốc:** `7fc6879` + working tree hardening chưa commit  
**Verdict production:** **NOT READY**  
**Verdict local development:** **READY**

## Tóm tắt

Các blocker P0 đã biết trong secret management, phân quyền payment, webhook integrity,
inventory durability và production Compose đã được khắc phục và có regression test.
Các gate local gồm schema validation, lint, typecheck, production build, unit/tooling test,
34 integration cases trên MySQL, Compose health và HTTP browser smoke test đều đã pass.

Không được phát hành production cho tới khi các gate bên ngoài ở mục "Release blockers"
được hoàn tất trên đúng revision sẽ triển khai.

## Thay đổi chính

- Loại bỏ TLS private key/certificate khỏi Git; certificate chỉ được mount từ thư mục ngoài repository.
- Thêm secret scanning trong CI và thay các JWT test cũ bằng placeholder.
- Không công khai credential MoMo; MoMo mặc định tắt và fail-fast khi bật thiếu cấu hình.
- Áp dụng owner-scope cho payment reads/retry và giữ quyền staff/admin rõ ràng.
- Webhook PAID kiểm tra đúng amount, exact attempt identifiers và claim nguyên tử.
- VietQR webhook fail-closed nếu thiếu/sai `x-vietqr-webhook-secret`; mỗi attempt có transfer reference riêng.
- Production bắt buộc khai báo tài khoản ngân hàng thật, không thể chạy bằng tài khoản mẫu.
- Callback FAILED/EXPIRED không trực tiếp release inventory; expiry worker quyết định dựa trên trạng thái payment.
- Callback PAID hợp lệ có thể phục hồi đúng attempt FAILED/EXPIRED và tạo durable `COMMIT_INVENTORY` intent.
- Xác nhận thanh toán thủ công dùng atomic claim, không tạo transaction/audit kép khi gọi đồng thời.
- Worker compensation có claim, timeout, retry/backoff, stale recovery và không chạy chồng lấn.
- Production Compose chạy migration one-shot trước application services, giảm attack surface và tắt Swagger production.
- Local Compose dùng Nginx HTTP-only; API Gateway chỉ phát HSTS trong production.
- CI Gitleaks được pin đúng SHA/version; tám finding lịch sử đã biết được baseline bằng fingerprint chính xác, không nới rule cho finding mới.

## Ma trận kiểm chứng

| Gate | Kết quả | Bằng chứng |
|---|---:|---|
| Prisma validate | PASS | 6/6 schemas hợp lệ |
| Lint | PASS | Tất cả workspaces, 0 error |
| Typecheck | PASS | Tất cả workspaces, 0 error |
| Production build | PASS | 12 workspaces; Next.js tạo đủ 29 routes |
| Unit/tooling tests | PASS | Root `npm test`; không skip/disable test |
| Auth integration | PASS | 5/5 |
| Inventory integration | PASS | 6/6 |
| Order/payment integration | PASS | 23/23 |
| Payment security regressions | PASS | 13/13 |
| Webhook financial integrity regressions | PASS | 9/9 |
| Compose syntax/interpolation | PASS | Dev và production `docker compose config -q` |
| Local runtime health | PASS | 12/12 services healthy |
| Local HTTP/browser smoke | PASS | `/`, `/healthz`, `/api/v1/products` đều 200; không `Location`, không HSTS; browser giữ URL `http://localhost/` |
| Production order-service image | PASS | Image `phanbonshop-order:latest` build thành công và chứa webhook secret, attempt nonce, production bank guard |
| Production hardening tests | PASS | 5/5 |
| Production-like boot | PASS (pre-final patch) | Các production containers từng healthy; cần CI chạy lại trên revision cuối |
| Gitleaks 8.30.1 offline | PASS | Full history và toàn bộ tracked/untracked non-ignored files không có finding mới |
| Runtime dependency audit | FAIL / BLOCKER | 17 advisories: 1 Critical, 5 High, 10 Moderate, 1 Low; đề xuất sửa gồm major upgrades Next.js/NestJS |

## Security decisions

### VietQR webhook

Webhook chuyển khoản chỉ hoạt động khi adapter/bridge tin cậy gửi secret riêng qua TLS.
Không có secret hoặc secret sai luôn trả kết quả không hợp lệ. Nội dung chuyển khoản chứa
`<orderNumber>-<attemptNonce>` để webhook map đúng payment attempt thay vì chọn attempt mới nhất.

### Callback hết hạn và inventory

Provider callback không được release inventory trực tiếp vì callback PAID có thể đến muộn hoặc
chạy đồng thời. Inventory expiry worker là chủ sở hữu duy nhất của quyết định release và phải hỏi
order-service về disposition trước khi thay đổi reservation.

## Release blockers

1. GitHub Actions phải chạy xanh trên commit/revision cuối, bao gồm Gitleaks và production-like Compose boot.
2. Phải xử lý hoặc chấp nhận rủi ro bằng văn bản cho dependency audit runtime: 1 Critical ở Next.js và 5 High (gồm Next.js/PostCSS, Multer, js-yaml, lodash). Không chạy `npm audit fix --force` vì công cụ đề xuất nâng major Next.js/NestJS và có nguy cơ breaking change.
3. Trước go-live phải inject và xác minh secret/certificate/tài khoản ngân hàng thật; tuyệt đối không dùng giá trị `CHANGE_ME` hoặc test fixture.
4. Các thay đổi hiện còn ở working tree và cần được review/commit theo quy trình repository trước khi deploy.

## Finding không chặn phát hành

Hai helper trực tiếp `commitOrderInventory` và `releaseOrderInventory` trong `PaymentsService`
không còn caller sau khi chuyển sang durable worker/payment-aware expiry. Chúng được giữ nguyên
trong lần hardening này để tránh xóa code ngoài phạm vi mà chưa có phê duyệt.

## Quyết định phát hành

**LOCAL READY / PRODUCTION NOT READY** — lỗi tự chuyển HTTPS ở local đã được loại bỏ và
stack local đã pass smoke test. Production vẫn bị chặn bởi dependency audit và các release
gate bên ngoài chưa có bằng chứng pass trên revision cuối.
