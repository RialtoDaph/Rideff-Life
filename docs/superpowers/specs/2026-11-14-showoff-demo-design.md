# rideff Life: upgrade "Observatorium hidup" untuk demo publik

Tanggal: 2026-11-14 · Status: MENUNGGU PERSETUJUAN · Sumber: rencana Fable + 3 riset agent + jawaban Rialto

## Maksud dan alasan
rideff Life (upgrade dari app yang ada, bukan app baru) dipamerkan ke komunitas AI antusias dalam presentasi "how to build". App ini show-off, bukan produk yang dirilis. Reaksi yang dituju: "ini bisa dibuat di sini?!" Karya kebanggaan Ridev, jelas bukan template.

## Tujuan
- Tiga momen wow: Life Map 3D, Clopar (suara), kerapian seluruh layar.
- Demo tidak boleh gagal di panggung (fallback berlapis).
- Cerita "how to build" terlihat di dalam app.

## Bukan tujuan
Landing publik (G), uji rilis penuh (H), billing/Stripe, fitur yang tidak terlihat dalam 10 menit demo (Clopar Watch, generative UI, capture batch, haptik, scroll-driven CSS).

## Anti-tujuan
Menampilkan data keluarga asli; menyentuh DB `rideff-life`; terasa seperti dashboard template.

## Batasan (keras)
en/de/id tanpa teks hardcode (scripts/messages-*.json lalu build-messages.mjs); privasi via RLS; target 44px; tanpa scroll horizontal 360-390px; tsc/eslint/vitest/playwright hijau; baca node_modules/next/dist/docs sebelum memakai API Next 16; tidak commit/push/deploy/pasang migrasi tanpa izin; berhenti dan lapor tiap fase.

## Keputusan Rialto
- Perangkat: laptop Chrome ke proyektor + hotspot sendiri.
- OpenAI Realtime: Rialto menyatakan Clopar sudah terhubung; dibuktikan lewat /stage-check (belum terverifikasi dari kode lokal).
- Scene Life Map persisten (Home ke Map tanpa putus), dengan jalan mundur ke overlay bila belum stabil akhir Hari 6.
- Persona "Sari & Tom Brandt, Leipzig"; semua data contoh lama diganti.
- Akun demo di database `rideff-life` (household terpisah), login dengan email dummy.
- Deployment demo terpisah di Vercel (izin deploy diminta saat tiba).
- Tingkat ubahan: rancang ulang total layout dan navigasi.
- Dikunci (disetujui Rialto): UI Inggris, bicara ke Clopar Indonesia lalu Jerman; Noir+champagne dikunci saat demo; kredit "Dibangun bersama Claude Code oleh Ridev" di /built.
- Skill yang dipakai: desain & motion (design-taste-frontend, motion-design, design-system, design-critique), kualitas UX (accessibility-review, ux-copy), Next.js & performa (nextjs, react-best-practices, verification, performance-optimizer). Proses disiplin tidak diminta Rialto.
- Life Wrapped DIKEMBALIKAN (keputusan saya atas delegasi Rialto): kartu rekap 9:16 yang bisa dibagikan, adegan penutup tur (H9). Haptik, Clopar Watch, generative UI tetap dibuang.
- Layout total dirancang oleh Fable setelah riset lanjutan dan "oke Fable" baru dari Rialto.

## Pendekatan yang dipertimbangkan
1. Poles besar-besaran layar saja: aman, tapi tidak memberi momen wow.
2. Rencana Fable (dipilih): mode demo + sabuk pengaman suara dulu, lalu wow (Clopar, Life Map), lalu kerapian, cerita, gladi. Wow dan keandalan ditangani berurutan.
3. Bangun ulang app demo terpisah: ditolak, membuang fondasi dan cerita upgrade.

## CATATAN: rencana 10 hari di bawah DIGANTIKAN oleh `2026-11-14-layout-redesign-fable.md` (rancang ulang "Satu Ruang", fase F0-F6). Bagian lain dokumen ini tetap berlaku.

## Rencana (10 hari, versi lama)
- H1 P0 Akun demo sungguhan (REVISI 2026-11-14, keputusan Rialto): satu akun login (email dummy, Rialto pilih email/password sendiri) + satu household demo di `rideff-life`, terisolasi lewat RLS dari data keluarga asli. Data dummy persona "Sari & Tom Brandt" dengan tanggal relatif, skrip reset (SQL), lencana "Demo". Penulisan ke DB hanya setelah izin eksplisit Rialto; data asli dan household lain tidak disentuh. Adapter klien dari Fable menjadi opsi cadangan, bukan jalur utama.
- H2 P1 Suara 3 tingkat (realtime, /api/ask + speechSynthesis, Replay pra-rekam) + /stage-check + tombol "Bangunkan Clopar".
- H3-4 P2 Clopar hidup: AnalyserNode mic+output, setLevel, scene.setVoice, flyTo via tool `show`, jejak penalaran, transkrip besar.
- H5-6 P3 Life Map panggung: scene persisten, ?stage=1, tur otomatis 3 menit, data padat (>=6 node/hub).
- H7-8 P4 RANCANG ULANG TOTAL (REVISI, keputusan Rialto: boleh ubah habis-habisan): navigasi, struktur layar, dan penempatan komponen dirancang ulang di sekitar satu bahasa visual baru (ruang kontinu, Life Map sebagai kanvas tetap, panel mengambang, tipografi raksasa). Rute dan tes e2e ikut disesuaikan. Termasuk: token, HeroNumber/Row/Section/Stat, skeleton, angkat Career/Learn/Journal/Help/Business/Invest/Alerts, hapus ComingSoon, hapus Card ganda.
- H9 P5 Cerita: /built (garis waktu A-F, keputusan, angka nyata), "Lihat mesin", kartu penutup.
- H10 P6 Gladi, uji nyata di perangkat dan proyektor, video cadangan, beku.

## Risiko yang harus diuji nyata
Kunci OpenAI + model realtime; WebRTC di jaringan venue; mic/autoplay/AudioContext; analyser pada stream WebRTC (Safari iOS: bukan target utama karena laptop); CSP pada build produksi; FPS scene persisten; kontras di proyektor; token ephemeral kedaluwarsa; cold start; View Transitions di non-Chrome.

## Pembagian kerja paralel
Jalur A demo data; B suara; C scene; D sistem desain (beku setelah H2); E layar (setelah D); F cerita. Titik bentrok: scripts/messages-*.json (tambah messages-demo/stage sekali, satu integrator), app-shell.tsx (C dulu), kontrak API scene (flyTo/setVoice) disepakati awal H3.

## Diserahkan ke pembangun
Nama token, bentuk primitif, isi dataset, koreografi kamera, teks UI, urutan polesan layar, struktur tes.
