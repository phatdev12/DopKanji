# Đớp Kanji

Website học Kanji tiếng Nhật từ **N5 đến N1** với giao diện hiện đại theo phong cách shadcn:

- Layout có **sidebar** và vùng nội dung chính.
- Cột trái có **ô tìm kiếm**, **khung viết tay** và **Kanji Graph** (cây thành phần).
- Cột phải có **tabs N5/N4/N3/N2/N1** và bảng ô vuông Kanji theo từng level.
- Bấm vào chữ Kanji sẽ mở **trang chi tiết** (nghĩa, âm đọc, từ liên quan, nút Back).

## Data thật dùng trong app

- `kanji`: JLPT list N5-N1 + decomposition tree
- `kanji.js`: dữ liệu KANJIDIC (meanings/readings/stroke/frequency)
- `kanjiapi.dev`: từ liên quan theo từng chữ Kanji
- `KanjiVG`: dữ liệu nét viết SVG để so khớp tìm kiếm vẽ tay

## Chạy dự án

```bash
pnpm install
pnpm dev
```

Build production:

```bash
pnpm build
pnpm preview
```
