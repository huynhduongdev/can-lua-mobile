# Cân Lúa Thông Minh

Web app tĩnh để nhập cân lúa theo cột trên điện thoại, tự tính kg và thành tiền, phù hợp deploy lên GitHub Pages.

## Tính năng chính

- Nhập nhanh theo từng ô trong bảng 5 cột.
- Tự cộng từng cột và tổng chung.
- Thiết lập đơn giá `/kg` để tính tiền tự động.
- Có trừ bì, trừ tạp chất, tiền cọc, tiền đã trả.
- Lưu phiếu trên trình duyệt của máy, mở lại hoặc xóa phiếu cũ.
- Có service worker để cache giao diện, dùng ổn khi mạng yếu.

## Cách chạy local

Chỉ cần mở `index.html` hoặc chạy bằng một static server bất kỳ.

## Deploy GitHub Pages

1. Đưa toàn bộ file trong thư mục này lên một GitHub repository.
2. Vào `Settings` -> `Pages`.
3. Chọn branch deploy, thường là `main`, và thư mục `/ (root)`.
4. Lưu lại, GitHub sẽ cấp link web sau vài phút.

## Lưu ý dữ liệu

- Phiếu được lưu trong `localStorage` của trình duyệt trên đúng thiết bị đang dùng.
- Nếu đổi điện thoại hoặc xóa dữ liệu trình duyệt, các phiếu đã lưu có thể mất.
