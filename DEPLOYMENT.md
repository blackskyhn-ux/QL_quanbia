# Hướng Dẫn Triển Khai & Deploy Hệ Thống POS Quán Bia

Tài liệu hướng dẫn đóng gói, kiểm thử và triển khai (Deploy) Hệ thống POS Quản lý Quán Bia lên môi trường Production (Vercel, VPS Server, Turso Cloud Database).

---

## 📋 1. Chuẩn Bị Môi Trường (Prerequisites)

- **Node.js**: phiên bản `>= 18.17.0` (Khuyên dùng Node 20 LTS).
- **Trình quản lý gói**: `npm` hoặc `pnpm` / `yarn`.
- **Database**:
  - **Môi trường Local**: SQLite `file:local.db` (Không cần cài đặt thêm server DB).
  - **Môi trường Cloud (Production)**: Turso Cloud Database (LibSQL).

---

## 🗄️ 2. Môi Trường Cơ Sở Dữ Liệu Turso Cloud (Production)

Để kết nối với Turso Cloud Database:

1. **Cài đặt Turso CLI**:
   ```bash
   # Windows (PowerShell)
   irm https://get.tur.so/install.ps1 | iex
   ```

2. **Đăng nhập và tạo Database mới**:
   ```bash
   turso auth login
   turso db create quan-bia-pos
   ```

3. **Lấy Connection URL và Auth Token**:
   ```bash
   turso db show quan-bia-pos --url
   turso db tokens create quan-bia-pos
   ```

4. **Cấu hình `.env.production` hoặc Environment Variables trên Vercel**:
   ```env
   TURSO_DATABASE_URL="libsql://quan-bia-pos-your-org.turso.io"
   TURSO_AUTH_TOKEN="your-turso-jwt-auth-token"
   JWT_SECRET="quan-bia-pos-secret-key-super-secure-2026-production"
   ```

5. **Đẩy Schema & Seed Data lên Turso Cloud**:
   ```bash
   npm run db:push
   npm run db:seed
   ```

---

## 🚀 3. Triển Khai Lên Vercel (Recommended)

1. Đẩy mã nguồn dự án lên GitHub / GitLab repository.
2. Đăng nhập vào [Vercel Dashboard](https://vercel.com).
3. Chọn **Add New Project** -> Import repository `QL_quanbia`.
4. Trong phần **Environment Variables**, điền các giá trị:
   - `TURSO_DATABASE_URL`: `libsql://...`
   - `TURSO_AUTH_TOKEN`: `...`
   - `JWT_SECRET`: `...`
5. Nhấn **Deploy**. Vercel sẽ tự động build và cấp tên miền HTTPS miễn phí (e.g. `quan-bia-pos.vercel.app`).

---

## 🖥️ 4. Triển Khai Lên VPS Linux Server (Ubuntu / Debian / Docker)

Nếu chạy ứng dụng trên máy chủ riêng (VPS) hoặc máy tính đặt tại quán:

### Cách 1: Chạy trực tiếp với PM2 (Node.js Process Manager)
1. **Clone mã nguồn và cài đặt dependencies**:
   ```bash
   git clone <repo-url>
   cd QL_quanbia
   npm install
   ```

2. **Khởi tạo dữ liệu**:
   ```bash
   npm run db:push
   npm run db:seed
   ```

3. **Build bản Production**:
   ```bash
   npm run build
   ```

4. **Cài đặt & Khởi động PM2**:
   ```bash
   npm install -g pm2
   pm2 start npm --name "quanbia-pos" -- start -- -p 3000
   pm2 save
   pm2 startup
   ```

---

## 🧪 5. Kiểm Thử Hệ Thống (Testing & Audit)

### Danh mục kiểm thử luồng bán hàng trọn vẹn (End-to-End Checklist):
- [x] **Xác thực**: Đăng nhập tài khoản `admin` và `thungan1`, chuyển hướng đúng middleware.
- [x] **Mở ca**: Khai báo tiền mở két tại `/shifts` trước khi tạo đơn hàng.
- [x] **Gọi món**: Chọn bàn trên sơ đồ -> Thêm món nhậu & bia -> Chỉnh số lượng & ghi chú -> Lưu đơn bếp.
- [x] **Trạng thái Bàn**: Bàn tự động chuyển từ màu Xanh (Trống) sang màu Vàng Amber (Có khách).
- [x] **Thanh toán**: Mở modal thanh toán -> Quét mã VietQR động -> Nhấn "HOÀN TẤT THANH TOÁN".
- [x] **Trả bàn**: Bàn tự động về lại màu Xanh (Trống) sau khi thanh toán.
- [x] **In Hóa Đơn**: Kiểm tra hiển thị mẫu hóa đơn K80/K57 và nút in.
- [x] **Chốt ca**: Nhập số tiền thực tế đếm trong két -> Chốt ca thành công & kiểm tra đối soát lệch két.
- [x] **Báo cáo**: Kiểm tra số tiền doanh thu ghi nhận trên `/reports`.

---

## 🛠️ 6. Các Lệnh Thường Dùng (Scripts Summary)

| Lệnh | Mô tả |
| :--- | :--- |
| `npm run dev` | Khởi động Dev Server tại `http://localhost:3000` |
| `npm run build` | Biến dịch kiểm tra TypeScript và đóng gói ứng dụng Production |
| `npm start` | Chạy ứng dụng Production đã build |
| `npm run db:push` | Đồng bộ cấu trúc Schema Drizzle với CSDL SQLite/Turso |
| `npm run db:seed` | Nạp dữ liệu mẫu ban đầu (Admin, Sơ đồ bàn, Thực đơn) |
| `npm run db:studio` | Mở giao diện quản lý dữ liệu Drizzle Studio |

---
*Hệ thống POS Quán Bia đã sẵn sàng 100% để đưa vào hoạt động chính thức!*
