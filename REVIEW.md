# Nhánh `web-updates`: bản thử để xem và chọn

Nhánh này gom các thử nghiệm cho trang. Mỗi phần dưới đây có thể giữ, chỉnh hoặc bỏ riêng.
Hầu hết thông số nằm trong một bảng ở đầu file, sửa số là thấy ngay khi chạy dev.

## Chạy thử

Cần **Node 22.23.4 trở lên** (Astro 7 yêu cầu). Trình duyệt nên là Chrome/Edge mới (shader chữ dùng WebGPU;
không có WebGPU thì chữ vẫn hiện màu tím như cũ).

```bash
git fetch origin
git switch web-updates
npm ci
npm run dev
```

Mở http://localhost:4321.

## Các thay đổi

### 1. Con gà băng thay cụm ảnh fan ở hero — `src/scripts/ice.js`, `public/assets/logo-ice.glb`

- Con gà chong chóng bằng băng, khúc xạ chính chữ và đường kẻ của trang, đứng giữa màn hình.
- Cuộn qua hero: con gà lên giữa màn hình, to hơn, xoay theo cuộn suốt 4 màn hình trống.
- Tracking: các vệt sáng trên băng được đóng khung hồng kèm từ khoá khoá học, các ô nhỏ bám theo điểm sáng.
- Khi section tím "You have enough love for design?" lên, con gà bay vào giữa hai dấu ngoặc và chuyển sang
  kiểu dither tím đen.
- Cụm ảnh fan cũ không còn vẽ (`PRINTS = false` trong `src/scripts/fan.js`); vòng ảnh ở footer vẫn giữ.

Thông số: bảng `ICE` đầu `ice.js` (kích thước `size`, vị trí `y`, số vòng xoay `turns`, độ to khi cuộn
`scrollGrow`, độ khúc xạ `refract`, tracking `trackMax`/`marks`/`featShare`, giàn giáo `scaffold`...).
Từ khoá tracking: `KEYWORDS` ngay dưới.

**Bỏ hẳn:** xoá `import('../scripts/ice.js')` trong `src/pages/index.astro`. Muốn lấy lại cụm ảnh fan và
đoạn cuộn dài cũ thì cần trả lại cả cấu trúc trang (xem mục 4) — dễ nhất là lấy lại từ `main` các file liên quan.

### 2. Shader cho chữ lớn — `src/scripts/title-shader.js`

- Tiêu đề hero, heading phần giá, hai số tiền và tiêu đề footer làm bằng băng như con gà: cùng shader của `ice.js`
  (khúc xạ các vạch kẻ hồng/xanh nhạt phía sau, tách 6 màu ở mép, thân xanh đen, viền hồng→xanh, loé theo chuột),
  trên các nét chữ được vát thành khối từ chính hình chữ. Mỗi tiêu đề mọc ra từ băng giá khi hiện. Heading "by lavi"
  trên nền hồng giữ chữ thường.
- WebGL 2, một context dùng chung, chỉ vẽ chữ đang trên màn hình; không dùng thư viện ngoài.

Thông số: bảng `LOOK` đầu file (`bevel` độ vát, `reach` và `glow` quầng sáng, `bend` độ khúc xạ, `rim` viền).
Độ mềm của vạch sáng: `line` trong hàm `behind()`. Danh sách chữ được tô: `TITLES`.
Còn ba kiểu khác để so: thêm `?title=cells` (Voronoi shaders.com cũ), `?title=neon`, `?title=club` vào địa chỉ.

**Bỏ hẳn:** xoá `import('../scripts/title-shader.js')` trong `src/pages/index.astro`.

### 3. Loading mới — cuối `src/partials/body.html`, hàm `intro()` trong `src/scripts/motion.js`

- Loading là chính cụm tiêu đề ở giữa màn hình, chữ trơn, hai dấu sao xoay; tải xong (font + con gà)
  từng dòng trượt lên vị trí, chữ nhỏ mở ra theo phía của nó, đường kẻ vẽ từ hai mép vào giữa (dưới lên),
  con gà hiện ra; shader chữ hiện dần khi tiêu đề yên vị.
- Màn loading cũ (chồng ảnh bay vào fan) đã bỏ.

Nhịp: `REST`, `LINES` trong `intro()`; tốc độ dấu sao `PERIOD`, `STOP` trong script cuối `body.html`.
Loader chạy đều `PACE` (2,5 giây cả vòng) khi đang tải; tải xong thì chạy nốt với `DONE` (tối đa nửa giây).

### 4. Cấu trúc trang đơn giản hơn — `src/styles/landing.css`, `src/scripts/motion.js`

- Section tím "You have enough love for design?" là một section bình thường, cách hero 400vh
  (`.finale { margin-top: 400vh }`).
- Bỏ hiệu ứng chữ trồi lên, uốn cong khi cuộn, và hoạt ảnh của giá (giá hiện sẵn 5.000.000đ, giá cũ đã gạch).
- Level up vẫn giữ phần ghim và bậc thang chạy theo cuộn.

### 5. Lens Reveal — hàm `xray()` trong `src/scripts/motion.js`

- Mặc định tắt (nút Reveal góc dưới phải); bật lên thì kính mở ở mọi section, theo con trỏ, kể cả khi đang cuộn.
  Trình duyệt nhớ lựa chọn của người xem cho lần sau.
- Chữ nhỏ trong lens hiện đặc cho dễ đọc; chữ lớn vẫn là nét viền.
- Đường kẻ của By Lavi chạy vào xen kẽ từ trái và phải khi section vào khung nhìn (`byRulesIn()`).

Thông số: bảng `LENS` đầu `xray()` — bật/tắt từng lớp (cột, khung ảnh, đường kẻ, nhãn, khoảng cách...),
`outlineFrom` là cỡ chữ (px) từ đó trở lên vẽ nét viền.

## Lưu ý

- `tools/sync-from-static.py` đồng bộ trang từ bản HTML tĩnh gốc; chạy lại script đó sẽ ghi đè các thay đổi
  trong `src/scripts`, `src/styles`, `src/partials`. Nếu tiếp tục dùng bản tĩnh làm gốc thì cần đưa các thay đổi
  chọn giữ vào đó.
- Con gà và shader chữ chạy bằng GPU; trên máy yếu có thể giảm tải bằng `marks`, `trackMax` (tracking) hoặc
  bỏ phần shader chữ.
