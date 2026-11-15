# Rancang ulang "Satu Ruang, Tiga Kedalaman" (rancangan Fable, disetujui Rialto)

Tanggal: 2026-11-14 · Menggantikan rencana fase P0-P6 di `2026-11-14-showoff-demo-design.md` (dokumen itu tetap berlaku untuk tujuan, batasan, dan keputusan). Belum ada kode yang dibangun.

## Keputusan Rialto atas rancangan ini
- Navigasi mengikuti 4 hub peta: Money, Time, Health, Goals (menggantikan Money / Time&goals / Invest&career / Life).
- Tanpa glassmorphism: layar detail = lempeng opak di atas kanvas yang dibekukan.
- Gerbang H1: bila prototipe scene persisten gagal, langsung pakai "scene hanya di Home + Map" (keputusan sore H1), layar lain konstelasi CSS statis.
- Poles penuh 10 layar demo: Home, Map, Budget, Debts, Week, Ygoals, Gym, Ask, Built, Wrapped; sisanya token baru + Slab.
- Perangkat demo: MacBook Pro + HDMI ke proyektor (chip belum diketahui). Rekomendasi: mode extended 1080p, Chrome dipindah ke proyektor, charger terpasang, DPR kanvas dikunci 1.5 (uji 1.25); tes performa H1 dijalankan Rialto di MacBook itu lewat HDMI.
- Hasil gerbang F0 (2026-11-14): GO, scene persisten dipertahankan; angka di plan `2026-11-14-showoff-upgrade.md`. Fix stacking: kanvas non-explore `z-[-1]` dan `main` tanpa stacking context.
- Masih terbuka (diminta saat tiba): izin menulis akun/household demo Brandt ke DB rideff-life + email/password dummy (H1).

## Temuan kode yang mengubah rencana (dari Fable, sebagian belum diverifikasi)
1. P0-P3 lama belum ada di kode; rancang ulang harus di awal (H1-2), bukan H7-8.
2. Scene dibuat/dibuang di dalam layar (`life-map.tsx:164-181`, overlay z-55); belum ada flyTo/setVoice/pause.
3. Risiko GPU = fill-rate (titik lembut x DPR 2 di 1080p), bukan jumlah partikel (~8-10 ribu); satu `THREE.Points` per node.
4. Next 16 + cacheComponents menyimpan <=3 rute via `<Activity>` dan menjalankan cleanup saat disembunyikan; scene harus hidup di shell/layout.
5. `<ViewTransition>` sudah di `app-shell.tsx:94` dengan `key={screen}`; interaksi dengan Activity belum diverifikasi.
6. Motion/Framer tidak ada di package.json; tidak ditambah (fallback = crossfade CSS `.page`).
7. Hub peta (`money,time,health,goals`) tidak sejajar modul nav (`money,time,invest,life`).
8. e2e menyapu 29 rute di 390/360px; bergantung pada `data-screen-label` (Home hero, Quick start, Empty state, Upsell), heading Gym/Diese Woche, tinggi tautan 44px.
9. `--bg` Noir masih #000, `--mut2` #75726C terlalu redup untuk proyektor; `Card` ganda (ui.tsx, page-header.tsx).

## Arsitektur
| Kedalaman | Rute | Kanvas | Isi |
|---|---|---|---|
| Panggung | `/`, `/map`, `/ask`, `/wrapped` | hidup 60fps | teks langsung di atas ruang |
| Lempeng | semua layar detail | beku (rAF berhenti, diredupkan scrim CSS) | satu kolom dokumen opak, 720px |
| Padam | settings, plan, setup, import, report(s), help, legal, login | tidak dibuat | lempeng saja |
Tray (bottom sheet) untuk form, detail node, utas Clopar, Atlas. Deep link (`/budget` langsung) tidak membuat scene (konstelasi CSS statis). Cmd+K tetap, tapi navigasi terlihat wajib (Kompas). Kanvas `aria-hidden`, daftar hub/node DOM (`life-map.tsx:110-131`) dipertahankan; reduced-motion = kamera memotong. DPR dikunci 1.5 (uji 1.25), tier dikunci setelah benchmark pra-panggung.

## Navigasi
- Sidebar 248px, tab bar 5 kolom, FAB, MobileHeader dihapus.
- Kompas (atas): 4 hub, klik = kamera terbang lalu indeks hub. Dok (bawah tengah): orb Clopar + "Search or ask ⌘K" + `+`. Atlas: tray indeks semua layar per hub (isi `/more`).
- Settings/Plan/Help/Setup lewat avatar dan Cmd+K. Saudara dalam hub dipindah dengan `‹ ›` atau `[` `]` (menggantikan ModuleTabs).
- Home: satu angka pahlawan, satu kalimat insight, tiga hal hari ini; briefing/Up next/Goals di bawah lipatan. `/map` = scene yang sama, HUD mundur, kamera menjauh.
- Clopar aktif di rute mana pun: caption transkrip di atas dok, status 4 keadaan (idle/listen/think/speak) dengan timer, kartu tool call, "See trace"; utas penuh = tray dari dok; tool baru `show` membuat Clopar bernavigasi + flyTo.
- Presenter `?stage=1`: skala 1.25, tool call terbuka, HUD (RT ms, fps, tier, dpr, realtime), tombol 1-5 lompat adegan, `.` beat berikut, `B` bekukan, `R` putar contoh tersimpan. Tidak ada teks <16px.
- Mobile 390px: scene 44vh, dok 3 tombol >=48px (Atlas, Clopar, +), mengecil saat scroll.

## Peta layar (tidak ada URL berubah/dihapus)
Panggung: `/`, `/map`, `/ask` (tray utas terbuka), `/wrapped` (baru). Lempeng hub money: budget, debts, recur, remit, biz, tax, invest, sim (import = Padam). Time: week, shifts, learn, career. Health: gym, together, journal. Goals: ygoals, whatif. Alerts = lempeng + tray dari chip Home. report/reports/settings/plan/setup/help = Padam, di luar nav utama. `/more` = Atlas. Baru: `/wrapped`, `/built`, `/stage-check` (tambah ke SCREENS e2e dan PAGES sw.js). `coming-soon.tsx` dihapus. `/subs` tetap redirect.
e2e: label/heading dijaga, tautan dok+Kompas `hit44`, ModuleTabs scroll horizontal diganti, teks baru via messages-*.json; tes baru: Home->Budget tanpa galat konsol, deep link tanpa kanvas, `?stage=1`; tes baru pakai getByRole (Activity menyisakan DOM tersembunyi).

## Sistem desain "Noir Observatory" (blok `[data-palette="noir"]` saja)
- Token (oklch, nilai perkiraan; hitung ulang hex): bg ≈ #0B0A09, ink ≈ oklch(.96 .008 85), acc ≈ #E8D9B5; elevasi s1/s2/s3 = color-mix bg+ink 4/7/11%; line 16%, line2 26%; mut 68%, mut2 54%. Alias --card/--soft/--soft2 ke --s* agar tidak memecah 30 layar.
- Radius 6/12/20/28/999. Huruf: display serif 400 pada 144/96/64, judul serif 32, isi sans 15/22, label mono 11 uppercase .14em; bobot hanya 400 dan 600; --scale 1 (1.25 presenter). Grain SVG feTurbulence 128px data-URI, opasitas .06 (CSP img-src data: sudah ada).
- Primitif baru di `src/components/ds/`: HeroNumber (serif diam; digit berputar mono tabular + @property; prop shareName untuk ViewTransition), Slab (menggantikan kedua Card), Tray (bungkus sheet.tsx; tinggi peek/half/full; origin dari pemicu), Row (56px), Stat (maks 3), Skeleton (hero/row/stat), EmptyState (konstelasi redup; label `Empty state` dijaga).
- Motion: dur 160/220/320ms, spring-soft (tray, dok), spring-snap (pil); kamera JS 900ms (hub), 1400ms (Home->Map). Hanya 3 hal boleh >220ms: angka pahlawan pindah layar, kamera terbang, Clopar ganti keadaan. Stagger daftar dihapus.
- Proyektor: teks utama >=12:1, redup >=6:1, garis >=16%, champagne maks 3 elemen/layar, scrim gradien di bawah teks di atas kanvas hidup, tanpa info yang hanya dibedakan abu berdekatan.

## Tiga momen wow
- Life Map: buka app, kamera masuk, angka terbentuk; klik MONEY, kamera terbang 900ms, lempeng naik, angka terbang ke kepala lempeng, kanvas beku; `Esc` mundur. Tur `?stage=1`: 5 beat, ~3 menit, dipicu `.` (presenter pegang tempo). Min 6 node/hub dari data Brandt; label HTML maks 24.
- Clopar: tahan Space, bicara Indonesia, transkrip mengetik, inti bernapas (AnalyserNode mic + output; bass=skala inti, mid=twinkle, high=aliran), "THINKING" + timer, kartu `get_budget · 212ms`, jawaban serif besar; "Tunjukkan dana darurat" -> tool `show` -> flyTo + tray node; ganti ke Jerman; aksi tulis lewat `assistant-card.tsx` (pratinjau, Approve/Dismiss, Undo); "See trace" = tray alur nyata dari `s.tools`/`s.turns` (`assistant.tsx:132`), tanpa migrasi.
- Kerapian: satu kolom, satu angka pahlawan, satu aksen; skeleton berbentuk sama dengan isi.

## Rencana 10 hari (menggantikan P0-P6). (a) wajib (b) pembeda (c) polesan. Tiap fase: tsc/eslint/vitest/playwright hijau, lalu berhenti-lapor.
- H1 F0 Gerbang (a): `src/components/scene/scene-host.tsx` di shell (lazy, konteks useScene); scene API `setMode/pause/resume/flyTo/setQuality/stats`; life-map.tsx memakai host; HeroNumber minimal di home+budget dengan ViewTransition name; paralel: SQL seed/reset Brandt ditulis di luar supabase/migrations (TIDAK dijalankan), sabuk suara mulai. Lulus: di laptop demo 1920x1080 keluaran eksternal, Home->Budget->Home x20 tanpa frame >32ms saat terbang, 60fps 15 menit, satu konteks WebGL, e2e hijau. STOP go/no-go (fallback: scene hanya di / dan /map).
- H2 F1 Shell+sistem desain (a): tokens, globals, ds/*, app-shell (buang Sidebar/MobileHeader/MobileTabBar/FAB; pasang Kompas/Dok/Atlas), nav.ts 4 hub, more.tsx -> Atlas, command-palette footer aksi, messages-shell.json. Lulus: 29 rute lolos sapuan 390/360. Token beku. STOP.
- H3-4 F2 Clopar (a/b): tiga tingkat suara (realtime; /api/ask + speechSynthesis; contoh tersimpan berlabel; timeout 4s); /stage-check; components/voice/dock-unit.tsx; analyser -> scene.setVoice; tool `show` dicegat klien; tray "See trace"; kartu galat (coba lagi/ketik/contoh). Lulus: putus jaringan di tengah kalimat pulih <5s ke tingkat 2. STOP.
- H5-6 F3 Panggung (b): flyTo per hub, tur 5 beat, `?stage=1`, kepadatan data, batas 24 label, DOF+audio-reaktif di shader, soak 20 menit dengan suara. Foto layar proyektor sungguhan di H6. STOP.
- H7-8 F4 Sapu layar (a/c): 4 batch per hub; 10 layar demo penuh (Slab+HeroNumber+Row, skeleton, empty state); hapus coming-soon.tsx dan Card ganda; audit fokus/tab/kontras. STOP tiap dua batch.
- H9 F5 Cerita (b): /built (garis waktu A-F, angka nyata, kredit), /wrapped (kartu 9:16 penutup), lencana Demo, messages-story.json. STOP.
- H10 F6 Gladi (a): proyektor + hotspot nyata, tiga kali jalan penuh, video cadangan, beku; deploy hanya dengan izin.

## Risiko -> uji -> jalan mundur
Fill-rate/panas: soak 20 menit HDMI + charger -> DPR 1.25, tier medium terkunci, tombol B. Kanvas diam saat view transition: rekam 60fps -> 160ms atau crossfade. key+Activity: navigasi 4 rute, hitung konteks WebGL -> pembungkus per page. Frame beku hilang saat resize: render satu frame pada resize. WebRTC/token/autoplay: /stage-check + "Wake Clopar" -> tingkat 2 lalu contoh tersimpan. Analyser stream remote sunyi: uji H3 pagi -> level dari event output_audio / amplop semu. Hub nav bergeser tes: sapuan e2e 3 bahasa. Kontras proyektor: uji H6 -> naikkan --mut*/--line. Instrument Serif tanpa tnum (belum diverifikasi) -> digit berputar mono. RLS demo: rls_leaks.sql + login demo membaca 0 baris keluarga -> adapter data klien.

## Paralel tanpa bentrok
S Scene (life-map-scene.ts, components/scene/*, screens/life-map.tsx; messages-stage.json); D Desain/shell (tokens/globals/ds/shell/nav/more; messages-shell.json); V Suara (assistant*, api/assistant, clopar, voice/*, stage-check; messages-assistant.json); L Layar (mulai H3; screens/* selain home/life-map/more); C Cerita/data (SQL demo, built, wrapped, tests/e2e, sw.js; messages-story.json). `app-shell.tsx` milik D saja (S dan V menyetor komponen); home.tsx milik D sampai H2 lalu L; satu integrator menjalankan build-messages.mjs (cek di H1 apakah skrip membaca messages-*.json baru; saat ini membaca 7 file eksplisit).

Kontrak scene v1 (disepakati H1 pagi, beku H1 sore):
```ts
type SceneMode = "hero" | "explore" | "backdrop" | "off";
type VoiceFrame = { state: "idle"|"listen"|"think"|"speak"; level: number; bass: number; mid: number; high: number };
interface LifeScene { setMode(m: SceneMode): void; flyTo(target: "core"|PillarKey|string, o?: {ms?: number}): Promise<void>; setVoice(v: VoiceFrame): void; pause(): void; resume(): void; setQuality(q: {maxDpr?: number; tier?: Tier; lock?: boolean}): void; stats(): {fps: number; tier: Tier; dpr: number}; }
```
