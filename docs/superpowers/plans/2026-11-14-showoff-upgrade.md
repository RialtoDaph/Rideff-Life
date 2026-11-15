# rideff Life "Satu Ruang" Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ubah rideff Life menjadi satu ruang kontinu (Life Map persisten, Kompas/Dok/Atlas, lempeng opak) yang siap didemokan live ke komunitas AI, dengan Clopar yang menyatu dengan scene 3D dan akun demo berisi data dummy.

**Architecture:** Scene three.js pindah dari dalam layar ke provider di shell (`SceneHost`) yang hidup sekali dan punya empat mode (`hero|explore|backdrop|off`). Layar detail menjadi lempeng opak di atas kanvas yang dibekukan. Fase dikerjakan berurutan dengan gerbang go/no-go di akhir F0.

**Tech Stack:** Next 16.4 (cacheComponents, `<ViewTransition>`), React 19.3, Tailwind 4, three 0.187, next-intl, Supabase, vitest 3 (hanya `src/**/*.test.ts`, tanpa DOM), Playwright (stub di `tests/e2e/stub.cjs`, port 3100).

**Spec:** `docs/superpowers/specs/2026-11-14-showoff-demo-design.md` (tujuan, batasan, keputusan) dan `docs/superpowers/specs/2026-11-14-layout-redesign-fable.md` (arsitektur, peta layar, token, kontrak scene, risiko). Baca keduanya sebelum mengerjakan.

**Cakupan rencana ini:** F0 rinci (task di bawah). F1-F6 berupa kerangka; rencana rinci tiap fase ditulis setelah fase sebelumnya berhenti-lapor, karena F0 menentukan bentuk F1+ (terutama hasil gerbang). Jalur data demo (SQL Brandt + akun) rencananya ditulis terpisah saat dimulai, setelah membaca `supabase/migrations`.

## Global Constraints

- Jawab/dokumentasi Bahasa Indonesia; kode dan nama identifier Inggris.
- AGENTS.md: Next 16 punya breaking change; baca `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` dan `preserving-ui-state.md` sebelum menyentuh `<ViewTransition>` atau keadaan antar-rute.
- Teks UI hanya lewat `scripts/messages-*.json` lalu `node scripts/build-messages.mjs`; jangan edit `src/messages/*.json`. en/de/id, tanpa teks hardcode.
- Target sentuh 44px (`hit44`), tanpa scroll horizontal di 360 dan 390px, privasi lewat RLS.
- Perubahan hanya di blok `[data-palette="noir"]` untuk token baru (F1); palet lain tidak disentuh.
- **Jangan commit, push, deploy, atau pasang migrasi tanpa diminta Rialto.** Langkah "Commit" diganti "Berhenti: tampilkan `git diff --stat`; commit hanya bila Rialto minta".
- Hanya Supabase `rideff-life` (`jfvgfbmilavkkdjohmcl`); `Effendy Family` read-only. Tidak menulis ke DB tanpa izin eksplisit.
- Gerbang hijau di akhir tiap fase: `npx tsc --noEmit && npx eslint src tests && npx vitest run`, lalu `lsof -ti:3100,54399 | xargs kill; npm run test:e2e:build && npx playwright test`.
- Bloom/DOF tetap di shader, tanpa post-processing (HANDOFF). Tidak menambah dependensi animasi (tanpa Motion/Framer).
- Satu `HeroNumber` dan satu aksen champagne (#E8D9B5) per layar; hanya tiga gerak boleh >220ms (angka pahlawan pindah layar, kamera terbang, Clopar ganti keadaan).

## Review Focus

1. Deep link langsung ke `/budget` (atau rute Lempeng lain): tidak ada kanvas dibuat, tidak ada galat konsol; latar tetap terbaca.
2. WebGL tidak tersedia: `/map` memakai `StaticMap` yang sudah ada, rute lain tanpa kanvas dan tanpa crash.
3. Pindah rute cepat berulang (Home ↔ Budget 20x): tepat satu konteks WebGL, `dispose` sekali, tanpa kebocoran listener.
4. `prefers-reduced-motion`: `flyTo` selesai seketika (kamera memotong), tidak ada spin otomatis.
5. Ukuran jendela berubah saat kanvas dibekukan: satu frame dirender ulang sehingga kanvas tidak meregang atau kosong.
6. Tab disembunyikan lalu dibuka: loop berhenti dan lanjut tanpa lonjakan waktu frame yang memicu turun tier.

---

## Peta file F0

| File | Tanggung jawab |
|---|---|
| `src/lib/scene-camera.ts` (baru) | Fungsi murni: easing terbang, penguncian DPR, pemilihan mode per layar. Diuji vitest. |
| `src/lib/scene-camera.test.ts` (baru) | Tes fungsi murni di atas. |
| `src/lib/life-map-scene.ts` (ubah) | Tambah API `setMode/pause/resume/flyTo/setQuality/stats/setVoice`; tidak menambah post-processing. |
| `src/components/scene/scene-host.tsx` (baru) | Provider di shell: satu kanvas persisten, siklus hidup scene, konteks `useScene()`. |
| `src/components/shell/app-shell.tsx` (ubah) | Memasang `SceneHost`, menaikkan `main` ke `z-[1]`. |
| `src/components/screens/life-map.tsx` (ubah) | Memakai host; buang pembuatan/dispose scene sendiri. |
| `src/components/ds/hero-number.tsx` (baru) | `HeroNumber` minimal (membungkus `CountUp` + `ViewTransition name`). |
| `src/components/screens/home.tsx`, `budget.tsx` (ubah) | Memakai `HeroNumber` dengan nama bersama `hero-money`. |
| `src/components/scene/stage-hud.tsx` (baru) | HUD `?stage=1`: fps, tier, dpr dari `scene.stats()`. |
| `tests/e2e/scene.spec.ts` (baru) | Deep link tanpa kanvas, Home↔Budget 20x satu kanvas, tanpa galat konsol. |

## F0 Gerbang (Hari 1)

### Task 1: Fungsi murni kamera, DPR, dan mode

**Files:**
- Create: `src/lib/scene-camera.ts`
- Test: `src/lib/scene-camera.test.ts`

**Interfaces:**
- Produces:
  - `export type SceneMode = "hero" | "explore" | "backdrop" | "off"`
  - `export function flyEase(t: number): number` (ease in-out cubic, klem 0..1)
  - `export function lockedDpr(deviceDpr: number, cap: number): number` (`min(max(deviceDpr,1), cap)`)
  - `export function sceneModeFor(screen: string): SceneMode` (screen = nilai `useScreen()`: `""` -> `hero`, `"map"` -> `explore`, `"ask"` -> `hero`, `"wrapped"` -> `hero`, Padam (`settings, plan, setup, import, report, reports, help`) -> `off`, lainnya -> `backdrop`)

- [ ] **Step 1: Tulis tes yang gagal.** Tes: `flyEase(0)=0`, `flyEase(1)=1`, `flyEase(0.5)=0.5`, `flyEase(-1)=0`, `flyEase(2)=1`, monoton naik pada 0.1 langkah; `lockedDpr(2,1.5)=1.5`, `lockedDpr(1,1.5)=1`, `lockedDpr(0.5,1.5)=1`; `sceneModeFor` untuk `""`, `"map"`, `"budget"`, `"settings"`, `"ask"`, `"unknown-route"` (harus `backdrop`).
- [ ] **Step 2: Jalankan** `npx vitest run src/lib/scene-camera.test.ts`. Harapan: FAIL (modul belum ada).
- [ ] **Step 3: Implementasi** ketiga fungsi di `src/lib/scene-camera.ts` sesuai Interfaces.
- [ ] **Step 4: Jalankan tes lagi.** Harapan: PASS.
- [ ] **Step 5: Berhenti: `git diff --stat`.** Jangan commit.

### Task 2: Perluas API scene

**Files:**
- Modify: `src/lib/life-map-scene.ts` (tipe `LifeMapScene` di ~baris 110-120, `frame()` ~457-631, objek kembalian ~635-667)

**Interfaces:**
- Consumes: `SceneMode`, `flyEase`, `lockedDpr` dari Task 1.
- Produces (tambahan pada `LifeMapScene`, semua tipe lain tetap):
  - `setMode(m: SceneMode): void` (`hero`: spin hidup, tanpa kontrol; `explore`: perilaku sekarang; `backdrop`: `pause()` + kanvas diredupkan; `off`: `pause()`)
  - `pause(): void` / `resume(): void` (hentikan/lanjutkan `renderer.setAnimationLoop`; `pause` merender satu frame terakhir; `resume` mereset penghitung frame lambat supaya jeda tidak memicu turun tier)
  - `flyTo(target: "core" | PillarKey | string, o?: { ms?: number }): Promise<void>` (target `PillarKey` memetakan ke id `h-${key}`; menggerakkan `orbit`/`look` lewat `flyEase` selama `ms`, default 900; resolve saat selesai atau seketika bila `reduced`; panggilan baru membatalkan yang lama)
  - `setQuality(q: { maxDpr?: number; tier?: Tier; lock?: boolean }): void` (`lock` mematikan penurunan tier otomatis di `frame()`)
  - `stats(): { fps: number; tier: Tier; dpr: number }` (fps = rata-rata bergerak ~30 frame terakhir)
  - `setVoice(v: { state: "idle"|"listen"|"think"|"speak"; level: number; bass: number; mid: number; high: number }): void` (F0: simpan nilainya saja; konsumsi di F2)
- Satu frame dirender pada event `resize` saat `pause()` aktif (Review Focus 5). `visibilitychange` ke hidden memanggil `pause`, ke visible memanggil `resume` bila mode bukan `backdrop|off`.

- [ ] **Step 1:** Perluas tipe `LifeMapScene` dan objek kembalian dengan enam anggota di atas; tambahkan penghitung fps di `frame()`.
- [ ] **Step 2:** Implementasi `flyTo` dengan interpolasi `orbit.th/ph/r` dan `look` memakai `flyEase`; `reduced` -> terapkan akhir langsung.
- [ ] **Step 3:** Implementasi `pause/resume/setMode/setQuality`, dan listener `visibilitychange` (dilepas di `dispose()`).
- [ ] **Step 4: Verifikasi.** Run: `npx tsc --noEmit && npx eslint src && npx vitest run`. Harapan: bersih; tes yang ada tetap hijau.
- [ ] **Step 5: Berhenti: `git diff --stat`.**

### Task 3: SceneHost di shell

**Files:**
- Create: `src/components/scene/scene-host.tsx`
- Modify: `src/components/shell/app-shell.tsx:86-97` (pasang host; `main` mendapat `relative z-[1]`)

**Interfaces:**
- Consumes: `createLifeMapScene`, `LifeMapScene`, `sceneModeFor`, `lockedDpr`.
- Produces:
  - `export function SceneHost({ children }: { children: ReactNode }): JSX.Element` (client component)
  - `export function useScene(): { scene: LifeMapScene | null; failed: boolean; labels: RefObject<HTMLDivElement | null>; setOnSelect: (cb: (id: string | null) => void) => void }`
  - Host merender `<div class="fixed inset-0 z-0 aria-hidden">` berisi stage dan div label. Scene dibuat malas **sekali**, hanya setelah pertama kali `sceneModeFor(screen)` bukan `off` dan bukan deep link ke rute `backdrop` (Review Focus 1: scene baru dibuat setelah pengguna pernah berada di `hero|explore`). Setelahnya `setMode(sceneModeFor(screen))` tiap pergantian layar.
  - Gagal membuat scene -> `failed=true`, tidak melempar.
  - `?stage=1` di URL: panggil `setQuality({ maxDpr: 1.5, lock: true })`.

- [ ] **Step 1:** Baca `useScreen()` dan `view-transitions.md`; pastikan host berada di luar `<ViewTransition key={screen}>` sehingga tidak ikut dibuat ulang.
- [ ] **Step 2:** Implementasi `SceneHost` + `useScene`. Gunakan `MutationObserver` tema yang sudah ada di `life-map.tsx:174-175` (pindahkan ke host).
- [ ] **Step 3:** Pasang di `app-shell.tsx`; bangun `main` agar `relative z-[1]`, kanvas `fixed z-0` (tidak menutup bacaan karena kartu masih opak; verifikasi visual di Task 6).
- [ ] **Step 4: Verifikasi.** `npx tsc --noEmit && npx eslint src`. Harapan: bersih.
- [ ] **Step 5: Berhenti: `git diff --stat`.**

### Task 4: LifeMapScreen memakai host

**Files:**
- Modify: `src/components/screens/life-map.tsx` (efek pembuatan scene ~164-182, wadah `fixed inset-0 z-[55]` ~203-211)

**Interfaces:**
- Consumes: `useScene()` dari Task 3.
- Perilaku: layar tidak lagi memanggil `createLifeMapScene`/`dispose`; memakai `scene`, `labels`, dan `setOnSelect(setSelected)` dari host. `setGraph`, `setSelected`, `setSpin`, `fit` tetap dipanggil dari layar. `failed` dari host memicu `StaticMap` yang sudah ada. Tombol tutup dan `Esc` tetap kembali ke `/`. Tombol Escape juga memanggil `flyTo("core")` sebelum navigasi (kecuali `reduced`).
- Wadah layar: bukan lagi overlay penuh yang menutupi shell; `data-screen-label="Life Map"` dipertahankan (dipakai e2e).

- [ ] **Step 1:** Ganti pembuatan scene dengan `useScene()`; buang `MutationObserver` (kini di host).
- [ ] **Step 2:** Pertahankan HUD (skor, pil hub, tombol fit/spin/tutup) dan `StaticMap` apa adanya.
- [ ] **Step 3: Verifikasi.** `npx tsc --noEmit && npx eslint src && npx vitest run`. Lalu jalankan e2e `/map` yang sudah ada: `npx playwright test tests/e2e/screens.spec.ts -g map`. Harapan: lolos (label `Life Map`, gate `Upsell` utuh).
- [ ] **Step 4: Berhenti: `git diff --stat`.**

### Task 5: HeroNumber dan elemen bersama Home↔Budget

**Files:**
- Create: `src/components/ds/hero-number.tsx`
- Modify: `src/components/screens/home.tsx:228-240` (angka hero), `src/components/screens/budget.tsx:~95`

**Interfaces:**
- Produces: `export function HeroNumber(props: { value: number; format: (n: number) => string; shareName?: string; className?: string }): JSX.Element` — membungkus `CountUp`; bila `shareName` ada, dibungkus `<ViewTransition name={shareName}>` (cek bentuk API di docs lokal sebelum menulis; bila `name` tidak didukung seperti dugaan, catat dan pakai crossfade `.page` yang ada).
- Home dan Budget sama-sama memakai `shareName="hero-money"` untuk angka "sisa uang". Hanya satu elemen bernama itu di tiap layar (nama ganda membuat transisi dilewati).
- Teks `data-screen-label="Home hero"` dan `Quick start` di `home.tsx` tidak boleh hilang.

- [ ] **Step 1:** Implementasi `HeroNumber` dan pakai di dua layar; tidak ada perubahan perilaku hitungan (nilai tetap `Math.abs(budget.flexLeft)` di Home, `budget.flexLeft` di Budget).
- [ ] **Step 2: Verifikasi.** `npx tsc --noEmit && npx eslint src && npx vitest run`, lalu `npx playwright test tests/e2e/screens.spec.ts`. Harapan: hijau.
- [ ] **Step 3: Berhenti: `git diff --stat`.**

### Task 6: HUD stage dan tes e2e gerbang

**Files:**
- Create: `src/components/scene/stage-hud.tsx`, `tests/e2e/scene.spec.ts`
- Modify: `src/components/scene/scene-host.tsx` (render `StageHud` bila `?stage=1`)

**Interfaces:**
- `StageHud` membaca `scene.stats()` tiap 500ms dan menampilkan `fps · tier · dpr` (teks mono, tanpa kunci i18n karena alat internal berlabel angka saja; tidak ada kata UI).
- Tes (`tests/e2e/scene.spec.ts`, memakai `signIn`, `settle`, `LOCALES` dari `tests/e2e/helpers.ts`):
  - `deep link /budget membuat nol canvas dan nol galat konsol`
  - `Home -> Budget -> Home 20 kali menghasilkan tepat satu canvas dan nol galat konsol`
  - `/map saat WebGL dimatikan menampilkan StaticMap` (luncurkan dengan `--disable-gpu`/`--disable-webgl` atau stub `getContext`; lihat `playwright.config.ts`)
  - `main dan konten tetap terbaca: tinggi tautan nav 44px dan tanpa scroll horizontal di 390px` untuk Home dan Budget

- [ ] **Step 1: Tulis tes** di atas (gagal dulu bila fitur belum ada; `StageHud` tidak diuji e2e).
- [ ] **Step 2: Jalankan** `npx playwright test tests/e2e/scene.spec.ts`. Harapan awal: sebagian FAIL sebelum Task 3-5 selesai; setelah itu PASS.
- [ ] **Step 3: Implementasi** `StageHud`.
- [ ] **Step 4: Gerbang penuh.** Run: `npx tsc --noEmit && npx eslint src tests && npx vitest run` lalu `lsof -ti:3100,54399 | xargs kill; npm run test:e2e:build && npx playwright test`. Harapan: semua hijau (vitest + Playwright, 11 tes lama + tes baru).
- [ ] **Step 5: Berhenti: `git diff --stat`.**

### Task 7: Protokol gerbang (dijalankan Rialto)

**Files:** tidak ada kode.

- [ ] **Step 1:** Siapkan build produksi lokal: `npm run build && npm start` (atau `npm run dev`) dengan data stub; buka `http://localhost:<port>/?stage=1` di Chrome pada **MacBook yang dipakai demo, tersambung HDMI ke proyektor, mode extended, charger terpasang**.
- [ ] **Step 2:** Pindah Home -> Budget -> Home 20 kali; baca HUD: fps minimal 55 saat diam, tidak ada frame >32ms saat terbang yang terasa; biarkan 15 menit di Home.
- [ ] **Step 3:** Catat: chip MacBook, fps diam, fps saat terbang, tier akhir, bila ada tersendat.
- [ ] **Step 4: Keputusan sore H1.** Lulus -> lanjut F1 dengan scene persisten. Gagal -> varian "scene hanya di `/` dan `/map`" (set `sceneModeFor` mengembalikan `off` untuk semua rute selain `""` dan `"map"`, layar lain memakai latar konstelasi CSS statis di F1). Keputusan ini sudah disetujui Rialto; laporkan hasilnya, tanpa bertanya.

---

## F1-F6 (kerangka; rencana rinci ditulis saat fase dimulai)

| Fase | Hasil yang dapat diuji | Dasar |
|---|---|---|
| **F1** Shell + sistem desain (H2) | 29 rute lolos sapuan 390/360; Kompas/Dok/Atlas menggantikan Sidebar/MobileHeader/MobileTabBar/FAB; token Noir beku; `Slab/Tray/Row/Stat/Skeleton/EmptyState` di `src/components/ds/`; `nav.ts` 4 hub; `/more` jadi Atlas | `layout-redesign-fable.md` bagian Navigasi, Peta layar, Sistem desain |
| **F2** Clopar (H3-4) | Putus jaringan di tengah kalimat pulih <5 dtk ke tingkat 2; `/stage-check`; audio-reaktif -> `scene.setVoice`; tool `show` -> `flyTo`; tray "See trace"; kartu galat | bagian Tiga momen wow, Risiko |
| **F3** Panggung (H5-6) | Tur 5 beat di `?stage=1` (tombol `.`/`1-5`/`B`/`R`); data padat >=6 node/hub; soak 20 menit dengan suara; foto proyektor nyata | Panggung, Presenter |
| **F4** Sapu layar (H7-8) | 10 layar demo (Home, Map, Budget, Debts, Week, Ygoals, Gym, Ask, Built, Wrapped) dipoles penuh; `coming-soon.tsx` dan `Card` ganda dihapus; audit fokus/kontras | Peta layar |
| **F5** Cerita (H9) | `/built`, `/wrapped`, lencana Demo, `messages-story.json`; rute baru di `SCREENS` e2e dan `PAGES` `sw.js` | Cerita |
| **F6** Gladi (H10) | Tiga kali jalan penuh di perangkat + proyektor + hotspot; video cadangan; deploy hanya dengan izin | Risiko |
| **Jalur C** Data demo (paralel sejak H1) | Akun login dummy + household Brandt di `rideff-life`, skrip reset, `rls_leaks.sql` + login demo membaca 0 baris keluarga | Persona; **izin tulis DB dan email/password dari Rialto diminta saat dimulai** |

Titik bentrok antar jalur (kepemilikan file, kontrak scene, `build-messages.mjs` membaca tujuh file eksplisit) tercantum di `layout-redesign-fable.md` bagian Paralel.

## Self-Review

- **Cakupan spec:** F0 menutup tujuan gerbang H1 (scene persisten, `HeroNumber` Home→Budget, fallback). Bagian lain spec dipetakan ke F1-F6 dan Jalur C; rencana rinci menunggu fase sebelumnya (disengaja, karena gerbang menentukan bentuknya). Tidak ada requirement tanpa pemilik.
- **Konsistensi tipe:** `SceneMode`, `flyEase`, `lockedDpr`, `sceneModeFor` didefinisikan di Task 1 dan dipakai di Task 2-3 dengan nama sama; `LifeMapScene` tambahan (`setMode/pause/resume/flyTo/setQuality/stats/setVoice`) sesuai kontrak scene v1 di dokumen Fable.
- **Asumsi yang belum diverifikasi:** bentuk API `<ViewTransition name>` di React 19.3/Next 16.4 (Task 5 mewajibkan membaca docs lokal dan menyediakan fallback), perilaku `key={screen}` bersama `<Activity>` (Review Focus 3, diuji di Task 6), dan apakah Playwright headless dapat membuat konteks WebGL (Task 6; bila tidak, tes kanvas diganti menghitung elemen `canvas` dengan stub `getContext`).

## Hasil gerbang F0 (diukur 2026-11-14, Chrome berjendela via Playwright di Mac Rialto)

Perangkat: Apple M1, 16 GB, di baterai (36-38%), layar 2560x1600; viewport 1920x1080; `?stage=1` (DPR terkunci 1.5, tier high). **Belum diukur lewat proyektor HDMI sungguhan.**

| Skenario | dsf 2 (Retina) | dsf 1 (seperti proyektor 1080p) |
|---|---|---|
| Home diam | 60 fps, 0 frame >32 ms | 60 fps, 0 frame >32 ms |
| Peta diam | 60 fps, 0 frame >32 ms | 60 fps, 0 frame >32 ms |
| 8 penerbangan kamera 900 ms | 60 fps, 0 frame >32 ms | 60 fps, 0 frame >32 ms |
| Home↔Budget x20 (40 perpindahan) | 58,9 fps; 12 frame >32 ms, 4 >50 ms, maks 218 ms | 59,6 fps; 8 frame >32 ms, maks 48 ms |
| Soak 3 menit + perpindahan tiap 30 dtk | 60 fps, tier high, 1 scene hidup, heap JS 12-20 MB | - |

Nol galat konsol. Tersendat hanya terjadi saat navigasi (kerja React/chunk, bukan gambar WebGL).

**Keputusan: GO** untuk scene persisten (disetujui lebih dulu oleh Rialto: putuskan sendiri di sore H1). Tidak memakai varian cadangan. Sisa risiko: proyektor HDMI sungguhan (kontras, resolusi), soak 15 menit, dan tersendat navigasi (selidiki di F1 bila terasa).

## F1 selesai (2026-11-14): shell baru dan token Noir Observatory

Dibangun, belum di-commit. Gerbang: tsc, eslint, 157 unit, 17 e2e hijau; fps diukur ulang 60 (idle/peta/terbang, 0 frame >32 ms; navigasi maks 98 ms); tanpa target sentuh <44px.

- `src/lib/nav.ts`: empat hub sama dengan peta (`money, time, health, goals`; label `t.p_*`), tab per hub mengikuti peta layar Fable (invest/sim masuk Money; career masuk Time; gym/together/journal masuk Health; ygoals/whatif masuk Goals); `BOTTOM_TABS`/`bottomTabOf` dihapus; `whatif` keluar dari `TOOLS`. Prop `module=` di 10 layar disesuaikan.
- Shell: `Sidebar`, `MobileHeader`, `MobileTabBar`, FAB diganti `Compass` (atas: logo, 4 hub, lonceng, avatar; hub terbang kamera), `Dock` (bawah: Atlas, orb Clopar, cari ⌘K, +; menyingkir saat scroll turun) dan `AtlasSheet` (semua layar per hub + tools). `shell-context.ts` memisahkan konteks agar tidak melingkar. `/more` tetap ada (kartu per hub).
- Token Noir: `--bg #0B0A09`, elevasi `--s1/2/3` dari `color-mix` (4/7/11%), garis 16/26%, `--mut` dan `--mut2` dinaikkan untuk proyektor, tanpa titik latar, grain SVG 128px opasitas .05. Hanya blok `noir`; palet lain tidak disentuh.
- `ds/slab.tsx` (`Slab`) menggantikan `Card` ganda (ui.tsx re-export; page-header.tsx dibersihkan). Scene: penerbangan kamera selesai dulu baru membeku (`pausePending`).

Rulings F1: (1) `Row`, `Stat`, `Tray` belum dibuat; tiap primitif dibuat saat pertama dipakai (F4), supaya tidak ada kode mati. (2) Hub di mobile tampil sebagai satu baris di Compass (bukan di Atlas saja), karena Fable/tes butuh akses langsung; lonceng hanya di lebar >=900px, di mobile titik merah pada tombol Atlas. (3) Kanvas scene hanya terlihat di Peta sampai Home (F3) dan layar detail (F4) ditata di atasnya; di tempat lain ia berjalan/membeku tak terlihat, karena potongannya mengintip di sela kartu. (4) Pil modul (`ModuleTabs`) dipertahankan untuk pindah antar-halaman hub; diganti di F4. (5) Tes offline sekali gagal pada run penuh, lolos saat diulang dan pada 2 run penuh berikutnya: dicatat sebagai flaky, bukan regresi.

## F2 selesai (2026-11-14): Clopar hidup

Dibangun, belum di-commit. Gerbang: tsc, eslint, 166 unit, 19 e2e hijau (termasuk 2 tes suara baru).

- **Audio-reaktif:** `AnalyserNode` pada mikrofon dan suara balasan (`assistant-client.ts`, `levels()`); `src/lib/voice-level.ts` (penyimpanan level + `bandsOf`, diuji) dibaca mesin Clopar 2D (`opts.level`, mengubah radius dan denyut) dan scene 3D (`uVoice`: ukuran partikel dan cahaya inti). Loop di provider asisten per mode: mic saat listen, keluaran saat speak, denyut sintetis saat think dan saat suara browser.
- **Tiga tingkat suara:** (1) realtime, koneksi 5 dtk; (2) bila tak ada kunci atau koneksi gagal dan browser bisa: pengenalan suara browser -> `/api/ask` -> `speechSynthesis`, mendengar lagi sesudahnya (`browser-voice.ts`); gagal selain "tak ada suara" jadi kartu galat. (3) contoh tersimpan: DITUNDA (lihat Rulings).
- **Tool `show`:** `src/lib/show.ts` (`parseShow`, `hubForTool`, `SHOW_TOOL`, diuji); hanya di sesi web (`[...TOOLS, SHOW_TOOL]` di rute sesi; Telegram tidak melihatnya); dijalankan di klien. Tool baca menunjuk areanya sendiri (`get_budget` -> money). `SceneHost` mendengar `rideff:show`: kamera terbang atau layar dibuka. Prompt diberi satu baris agar model memanggil `show`.
- **Jejak:** provider mencatat tiap tool (nama, argumen, ms, keluaran) per jawaban (`traces`); tray "See trace" di `shell/voice-caption.tsx`.
- **Keterangan suara di atas Dok** (`VoiceCaption`): status, kalimat serif besar, "See trace", dan kartu galat dengan "Try again" / "Type instead". Orb Dok kini tombol bicara (bukan tautan ke /ask); varian `tab` tidak lagi menolak partikelnya sendiri dari kursor (itu membuat orb kosong setelah diklik).
- **`/stage-check`:** lampu untuk internet, WebGL, daya (Battery API), fps, mikrofon, keluaran suara, sesi realtime, koneksi WebRTC (sesi teks sungguhan lalu ditutup), suara browser. Pemeriksaan yang butuh ketukan jalan sendiri-sendiri.

Rulings F2: (1) Tidak membuat `/api/demo/*` yang menerbitkan token tanpa login (usul Fable): itu celah keamanan; akun demo masuk lewat login biasa. (2) Tingkat 3 (contoh tersimpan, audio pra-rekam) ditunda ke jalur data demo, karena jawabannya harus akurat terhadap persona Brandt yang belum ada. (3) Timeout 4 dtk jadi 5 dtk (hanya handshake data channel; pembuatan token belum diberi batas). (4) `err_browser` dibuang; tingkat 2 otomatis, bukan tombol. (5) Fps turun ke 30 saat baterai <=20% ditemukan sebagai risiko panggung: halaman kosong pun 30 fps di Chrome saat itu; baris Power dibuat di /stage-check.

Belum teruji: suara realtime sungguhan (tidak ada kunci OpenAI di lingkungan lokal), tool `show` dan jejak dengan panggilan tool nyata, analyser pada stream WebRTC jarak jauh, Safari. Gerbang fps diukur lagi saat baterai 19%: 30 fps karena batas Chrome (bukan kode); ukur ulang saat dicolok.

## F3 selesai (2026-11-14): Panggung

Dibangun, belum di-commit. tsc, eslint, 171 unit, 21 e2e hijau (tes offline pernah flaky pada run penuh pertama setelah build, lolos saat diulang).

- **Home = panggung** (`screens/home.tsx` `Hero`): angka "flexible money left" serif 84-176px di kiri tanpa kartu, scene Life Map hidup di kanan (`SceneHost`: di Home kanvas terlihat, mulai di 32% lebar layar pada layar lebar; di HP kanvas di atas 42svh dan angka di bawahnya), gradien pelindung teks, salam masuk ke panggung, filter orang dan Daftar/Peta turun ke bawah panggung; kartu lama (briefing, up next, goals) tetap di bawah lipatan.
- **Mode presenter `?stage=1`**: zoom 1.2 pada `main` (`html[data-stage]`), DPR terkunci 1.5, HUD fps/tier/dpr, dan `Presenter` (`scene/presenter.tsx`) dengan tur `lib/tour.ts` (diuji): `.`/→ beat berikut, `,`/← sebelumnya, `1`-`4` loncat, `B` bekukan/lanjutkan scene. Beat: home, map (terbang ke Money), areas (Time, Health, Goals, kembali), clopar (kembali ke Home lalu Clopar mulai mendengar). Beat `/built` dan `/wrapped` ditambah di F5. Tanpa timer: presenter memegang tempo.
- Tes e2e baru: kanvas terlihat dan menggambar di Home; tombol tur berpindah rute dan `B` membeku.

Rulings F3: (1) Race di presenter (rute dibandingkan lewat nilai efek yang basi) diganti membaca `window.location.pathname` tanpa awalan bahasa. (2) `R` (putar contoh tersimpan) tidak dibuat karena tier 3 ditunda. (3) Kepadatan >=6 node per hub bergantung pada data persona Brandt (jalur data demo), bukan kode; batas 24 label belum diterapkan (label hub/inti saja di Home). (4) Soak 20 menit dan pengukuran fps ulang belum dilakukan: baterai Mac 10-12% membuat Chrome membatasi 30 fps (diukur: halaman kosong pun 30); ulangi saat dicolok.

## F4 selesai (2026-11-14): sapu layar (bagian yang dikerjakan)

Dibangun, belum di-commit.

- **Lempeng** (`shell/app-shell.tsx`): layar detail (mode `backdrop`) kini satu kolom opak 880px dengan sudut 28px dan border di layar lebar (>=900px); di HP seluruh lebar. Kanvas beku muncul di lajur kanan di luar kolom (`scene-host.tsx`, mulai 1250px lebar; di bawah itu tersembunyi, di HP tak pernah terlihat), jadi tidak ada potongan di sela kartu.
- **`ds/hero-block.tsx`** (`HeroBlock`: label mono, angka serif 64-112px atau kalimat 32-52px, baris bawah, maksimal tiga angka kecil, aksi) dipakai di **Budget** (angka bersama Home), **Debts** (total utang, tanggal bebas utang), **Yearly goals** (ringkasan + bilah tahun), **Week** (malam bebas + jam shift/belajar). Kartu `bg-inv` dan `STAT` lama dibuang.
- `coming-soon.tsx` dihapus (tidak dipakai di mana pun).

Rulings F4: (1) `Row`, `Stat`, `Tray` terpisah tetap tidak dibuat: `HeroBlock` memuat statistiknya sendiri, dan `Sheet` yang ada sudah menjadi tray. (2) Gym tidak diubah: kartunya sudah memakai angka serif per orang. (3) Ask dibiarkan; ia layar Panggung dan akan disesuaikan bersama `/built` dan `/wrapped` di F5. (4) Skeleton Report/What-if/tools, audit fokus dan kontras penuh BELUM dikerjakan. (5) Layar demo lain (Career, Learn, Journal, Help, Invest, Alerts) hanya mendapat kolom lempeng, bukan HeroBlock.

## F5 selesai (2026-11-14): cerita how-to-build dan Wrapped

Dibangun, belum di-commit. tsc, eslint, 171 unit, 25 e2e hijau (4 tes baru).

- **`/built`** (`screens/built.tsx`, `content/built-stats.ts`, teks `scripts/messages-story.json` en/de/id lewat `build-messages.mjs`): garis waktu delapan putaran A-H (apa yang dilakukan dan apa yang salah, dari UPGRADE_PLAN/HANDOFF/sesi ini), empat keputusan beserta alasan, angka (8 putaran, 192 tes, 32 layar; dihitung tangan, perbarui di `built-stats.ts`), dan kredit "Dibuat dengan Claude Code oleh Ridev".
- **`/wrapped`** (`screens/wrapped.tsx`, `lib/wrapped-card.ts`): kartu 9:16 (Life Score, empat bagian, sisa uang, nama); pratinjau DOM dan gambar PNG 1080x1920 digambar di canvas dari angka yang sama; Bagikan (Web Share API bila bisa) dan Simpan gambar. Hanya angka, tidak ada data pribadi.
- Nav (`TOOLS`: wrapped, built), `sw.js` PAGES, tur 6 beat (`/built`, `/wrapped` ditambah; tombol 1-6), e2e (`SCREENS`, `story.spec.ts`).

Rulings F5: (1) Tombol "Lihat mesin" (event mentah) tidak dibuat: "See trace" dari F2 sudah menjadi momen under-the-hood. (2) Lencana "Demo" menunggu jalur data demo (akun Brandt). (3) Angka di /built dihitung tangan, bukan diukur saat runtime. (4) Kamera tidak terbang khusus di /built dan /wrapped (kanvas hanya terlihat di Home, Peta, dan lajur kanan layar detail).
