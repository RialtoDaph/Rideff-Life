# rideff Life — Audit penuh & rencana upgrade

Tanggal: 11 Nov 2026 · Branch yang diaudit: `fase-0` (HEAD 4cb5fea) · Status: **rencana saja, belum ada yang dibangun**

Cara audit: baca kode (shell, tokens, ±30 layar, semua route API, migrasi), cek database live `rideff-life`
(advisor Supabase + SQL hak akses), dan jalankan app melawan stub e2e di 390px dan 1280px
(Home, Life Map, Budget, More, Plan, Login).
Belum dicek: layar lain satu per satu di browser, HP sungguhan, Stripe/OpenAI/push dengan kunci asli.

---

## 1. Ringkasan

Fondasinya sehat: RLS aktif di semua tabel publik, `authorize()` di server benar, aksi AI menunggu
konfirmasi, token konsisten, tiga bahasa lengkap. Yang kurang ada di tiga tempat:

1. **Uang & keamanan bocor di pinggir** — trial tidak pernah ditegakkan, dua endpoint AI tanpa batas,
   webhook Telegram bisa dibajak dari preview deployment.
2. **App terasa "diam"** — tidak ada sistem motion sama sekali (0 `@keyframes`), sheet dan toast muncul
   tanpa transisi, tidak ada skeleton, tidak ada `loading.tsx`/`error.tsx`.
3. **Pesan tidak sampai** — tidak ada landing page (`/` langsung ke login, `noindex`), Life Map belum
   bercerita, Life Score belum disetujui rumusnya.

---

## 2. Temuan

### 2.1 Keamanan & bisnis (urut dari yang paling mendesak)

| # | Temuan | Bukti | Dampak |
|---|---|---|---|
| S1 | **Trial 14 hari tidak ditegakkan.** `current_period_end` diisi `now() + 14 days`, tapi `private.ai_plan()` hanya melihat `status`/`plan`. Hanya `plan.tsx` yang menampilkan "trial over". | `20261104000000_rideff_v4.sql:137`, `20261107000000_assistant.sql:18`, `plan.tsx:35` | Setiap pendaftar baru punya paket Together selamanya: chat Opus tak terbatas + 120 menit suara/bulan, gratis. |
| S2 | **`/api/read` tanpa kuota/rate limit.** File 4 MB, sampai 64k token output Opus per panggilan. | `src/app/api/read/route.ts`, `src/lib/ai-read-server.ts` | Satu akun bisa membakar biaya AI tanpa batas. |
| S3 | **Mode briefing di `/api/ask` gratis dan tanpa batas.** Kuota hanya untuk mode `ask` di paket Life. | `src/app/api/ask/route.ts` | Sama seperti S2. |
| S4 | **`/api/telegram/link` memanggil `setWebhook` dengan origin request.** | `src/app/api/telegram/link/route.ts` | Preview deployment dengan token bot yang sama bisa memindahkan webhook produksi. |
| S5 | **Sign-up terbuka tanpa captcha / rate limit** (email OTP = daftar + masuk). | `login/page.tsx`, `auth/email-code.tsx` | Digabung S1–S3: pendaftaran massal = biaya AI massal. |
| S6 | **Tidak ada CSP dan Permissions-Policy.** Hanya 3 header. | `next.config.ts` | Tidak ada lapisan kedua kalau ada XSS; sesi disimpan di localStorage. |
| S7 | **Gate paket hanya di klien** (`PlanGate` → layar Upsell). Data tetap terjangkau lewat RLS. | `src/components/plan-gate.tsx` | Fitur berbayar bisa dipakai lewat API langsung. |
| S8 | **Webhook Stripe tanpa idempotensi / urutan event.** Hanya 3 jenis event subscription. | `src/app/api/billing/webhook/route.ts` | Event lama yang datang terlambat bisa menimpa status baru; `invoice.payment_failed` tidak ditangani. |
| S9 | **Leaked-password protection mati** di Supabase Auth. | Advisor Supabase (WARN) | Kata sandi bocor tetap diterima. |
| S10 | **Tidak ada halaman hukum dan hapus akun.** Hanya label "Datenschutz"/"AGB"; tidak ada Impressum, Widerruf, atau alur hapus akun (hanya export + reset data). | grep `src/`, `scripts/messages-*.json` | Wajib di Jerman (DDG §5, DSGVO Art. 17, hak Widerruf) sebelum buka ke publik. |
| S11 | **Tidak ada error tracking / analytics.** | tidak ada Sentry/Vercel Analytics | Error produksi tidak terlihat. |
| S12 | PIN lock hanya di perangkat (localStorage) — ini kunci tampilan, bukan keamanan. | `src/components/lock.tsx` | Perlu dijelaskan jujur di UI. |
| S13 | `npm audit`: 2 critical `tinypool` (via vitest, hanya dev) + 8 moderate dev. | `npm audit` | Tidak kena produksi; butuh vitest 5 (breaking). |

Yang sudah benar dan tidak perlu diubah: RLS semua tabel publik, anon hanya bisa 4 fungsi, semua
definer function pakai `search_path`, verifikasi tanda tangan Stripe, token OpenAI ephemeral,
`ai_pending_actions` untuk tulis data.

### 2.2 UI / visual (dari app yang berjalan)

- **FAB menutupi konten** di 390px: ujung progress bar Emergency fund di Budget, baris di More, dekat tombol "+ Add" di Home.
- **Hero Home boros ruang**: kartu setinggi ±440px berisi satu baris teks kecil + partikel. Di desktop (1280px) hero kosong melebar, angka `€843` tidak tampil besar seperti di Budget.
- **Life Map**: label saling tindih (label inti "Est. worth" terbaca di belakang bola), node jarang dan kontras rendah, tidak ada rasa kedalaman. Skor "Goals 0" muncul padahal ada goal Emergency fund → perlu cek logika skor.
- **More**: daftar polos 12 baris, tidak ada pengelompokan visual atau status.
- **Login**: bersih, tapi satu-satunya "pintu depan" produk — tidak ada penjelasan apa itu rideff Life.
- Orb Clopar di tab bar tampak kosong setelah pindah halaman saat tes (pane browser tersembunyi, jadi **belum pasti bug** — perlu dicek ulang di HP).

### 2.3 Motion

- 0 `@keyframes`, 0 token motion di `tokens.css`. Handoff sudah menetapkan angka (160–220ms ease-out, sheet 280ms `cubic-bezier(.2,.8,.2,1)`, Clopar 420ms) tapi belum dipakai.
- `Sheet` dan `Toast` muncul/hilang seketika. Tidak ada transisi antar halaman, tidak ada animasi angka, tidak ada stagger daftar.
- Loading = teks "loading" atau `null`. Tidak ada skeleton.

### 2.4 3D

- `life-map-scene.ts`: `PointsMaterial` standar, tanpa shader, bloom, depth-of-field, atau fog. Kamera hanya orbit.
- Clopar: kanvas 2D partikel (900–3200), 5 mode. Karakternya kuat, tapi hanya muncul di hero, sidebar, tab.
- Tidak ada tingkatan performa untuk HP lemah (jumlah partikel tetap per varian).

### 2.5 UX / flow

- ±30 layar, 4 modul + tools; navigasi mobile 5 tab. Modul sekunder hanya lewat More → terasa dalam.
- Onboarding 5 langkah ada (`GettingStarted`), tapi belum ada momen "aha" pertama (mis. impor bank → angka hero langsung hidup).
- Tidak ada `error.tsx`/`global-error.tsx` → error render = layar putih.
- 69 dari 105 file `.tsx` adalah client component; semua data diambil setelah mount → kedip kosong di tiap layar.

### 2.6 Logic & integrasi

- **Tidak ada realtime**: perubahan pasangan tidak muncul sampai reload — padahal Together adalah paket termahal.
- **`sw.js` precache tanpa prefix locale** → offline hanya jalan untuk `en`; `/de/…` dan `/id/…` tidak.
- **Life Score** (`src/lib/life-score.ts`) rumusnya belum kamu setujui, tapi sudah tampil di Life Map.
- Belum pernah dites nyata: login sungguhan end-to-end, Stripe live, push di HP, OpenAI realtime.
- `.claude/launch.json`: `supabase-stub` menunjuk path scratchpad lama; stub sekarang di `tests/e2e/stub.cjs`.

---

## 3. Rencana upgrade (8 fase, berhenti dan lapor tiap fase)

Ukuran: S = ±1 sesi, M = 2–3 sesi, L = 4+ sesi.

### Fase A — Tutup kebocoran (M) · *wajib sebelum publik*
1. Tegakkan trial di server: `private.ai_plan()` mengembalikan `'life'` (atau `'none'`) bila `status='trial'` dan `current_period_end < now()`. (S1)
2. Kuota + rate limit untuk `/api/read` dan briefing: hitung di tabel `usage`, batas per paket, batas harian per member. (S2, S3)
3. Telegram: `setWebhook` hanya ke URL dari env `APP_URL`, dan hanya di production. (S4)
4. Captcha (Turnstile/hCaptcha lewat Supabase Auth) + rate limit OTP. (S5)
5. CSP (nonce) + Permissions-Policy (mikrofon hanya self). (S6)
6. Gate paket di server: cek paket di RPC/route fitur berbayar. (S7)
7. Stripe: tabel `stripe_events` (idempotensi), abaikan event lebih tua, tangani `invoice.payment_failed` dan `checkout.session.completed`. (S8)
8. Nyalakan leaked-password protection. (S9)
9. Sentry (atau Vercel Observability) + `error.tsx`/`global-error.tsx`. (S11)

Selesai bila: akun trial kedaluwarsa tidak bisa memanggil AI; tes vitest untuk tiap batas; advisor Supabase bersih.

### Fase B — Hukum & akun (S–M)
- Halaman Impressum, Datenschutz, AGB, Widerruf (de/en/id), tautan di login + settings + checkout.
- Hapus akun sungguhan (hapus household bila pemilik terakhir, batalkan Stripe, hapus auth user).
- Teks jujur untuk PIN lock.
- *Butuh dari kamu:* nama/alamat badan usaha, dan sebaiknya teks dicek pengacara — saya bisa menyiapkan draf, bukan nasihat hukum.

### Fase C — Fondasi motion & design system (M)
- Token motion di `tokens.css`: `--dur-1: 160ms`, `--dur-2: 220ms`, `--dur-sheet: 280ms`, `--dur-clopar: 420ms`, `--ease-out`, `--ease-sheet`.
- Sheet: slide-up + backdrop fade, exit animasi, drag-to-dismiss di mobile. Toast: slide + auto-stack.
- Transisi halaman dengan View Transitions (cek dukungan di docs Next 16 dulu, sesuai AGENTS.md).
- Skeleton per pola (kartu hero, daftar, angka) + `loading.tsx` per segmen.
- Mikro-interaksi: tekan tombol (scale .98), checkbox "3 things" dengan centang tergambar, angka menghitung naik, progress bar mengisi.
- Semua dibungkus `prefers-reduced-motion`.
- Perbaiki FAB: sembunyikan saat scroll turun / beri `padding-bottom` aman di semua layar.

### Fase D — Home & Clopar (M)
- Hero baru: angka utama serif besar (seperti Budget) + Clopar di sampingnya, bukan teks kecil di kartu kosong; desktop dua kolom.
- Clopar bereaksi pada data: tenang saat aman, "listen" saat ada alert, "confirm" saat 3 things selesai.
- Briefing AI muncul sebagai teks mengetik pelan, dengan tombol dengar.
- Tetap patuh aturan handoff: satu kartu `--inv`, maksimal 3 metrik, ≤3 elemen berwarna.

### Fase E — Life Map 3D (L)
- Shader kustom untuk partikel (ukuran menurut jarak, kelap lembut, warna per status) menggantikan `PointsMaterial`.
- Bloom selektif + fog kedalaman + depth-of-field ringan.
- Koreografi kamera: intro terbang masuk, tap hub → kamera meluncur dan node anak mekar, kembali dengan satu ketukan.
- Label: deteksi tabrakan, pudar menurut kedalaman (memperbaiki tindih "Est. worth").
- Garis hubungan sebagai aliran partikel yang arahnya bermakna (uang → goal).
- Tingkat performa: high / medium / low berdasarkan `deviceMemory`, DPR dan FPS terukur; fallback 2D statis.
- Perbaiki "Goals 0".

### Fase F — Poles layar & alur (L, bisa dipecah per modul) — SELESAI (PR #9)
> Dikerjakan: More grid, skeleton, error yang bisa ditindak, empty state Clopar, Quick start, `sw.js` per locale, realtime Together. Dicoret: data layar utama ke server component (sesi ada di localStorage + app offline-first; manfaat kecil, risiko besar). Belum diuji nyata: realtime dua akun, cache offline di HP/Safari.
- Urutan: Money (Budget, Bank import, Recurring, Debts) → Time (Week, Shifts) → sisanya.
- More jadi grid modul dengan status ringkas per modul.
- Onboarding: momen pertama = impor bank atau isi 3 angka → hero langsung hidup.
- Empty state bergambar Clopar; pesan error yang bisa ditindak.
- Realtime Supabase untuk household Together (budget, 3 things, goals) + indikator "Mira baru menambah…".
- `sw.js`: precache per locale.
- Pindahkan pengambilan data layar utama ke server component bila cocok dengan `cacheComponents` (kurangi kedip kosong).

### Fase G — Landing page & pesan (M) — DILEWATI (keputusan user: app untuk pemakaian sendiri/keluarga, tidak perlu landing publik)
- `/` publik (bukan `noindex`): satu kalimat janji, Clopar hidup, demo Life Map interaktif dengan data contoh, 3 manfaat, harga, FAQ, tautan hukum.
- Tiga bahasa, OG image, metadata.
- Login tetap ringkas, tapi dengan satu baris penjelasan produk.

### Fase H — Uji nyata & rilis (M)
- Tes di HP sungguhan: push, PWA install, suara OpenAI realtime, Stripe mode test lalu live.
- Upgrade vitest 5 (hilangkan 2 critical dev). Perbaiki `launch.json`.
- Lighthouse + axe di 5 layar utama; e2e untuk alur bayar dan trial habis.

---

## 4. Keputusan yang saya butuhkan dari kamu

1. **Trial**: setelah 14 hari, turun ke Life terbatas, atau terkunci sampai bayar?
2. **Life Score**: setujui/ubah rumus sebelum Fase E (skor jadi pusat Life Map).
3. **Landing page**: mau dibuka ke publik (indexable) sekarang atau nanti?
4. **Data badan usaha** untuk Impressum.
5. **Urutan**: saran saya A → B → C → D → E → F → G → H. Kalau ingin "wow" lebih dulu untuk demo, C + D bisa maju sebelum B, tapi A tetap pertama.
