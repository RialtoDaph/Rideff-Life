# HANDOFF (2026-11-12)

## Status
- Branch `fase-0`, pushed, commit `2fff18e` (Fase A–E dalam satu commit). Belum ada PR untuk branch ini.
- Rencana lengkap + audit: `UPGRADE_PLAN.md` (Fase A–H). Selesai: A (kebocoran), B (hukum/hapus akun), C (motion), D (Home), E (Life Map). Belum: F poles layar, G landing page, H uji nyata & rilis.
- Cek lokal terakhir: tsc, eslint, vitest 140, build, Playwright 11 tes semua hijau.

## Belum beres
- Migrasi `supabase/migrations/20261112000000_fase_a_limits.sql` BELUM dipasang di DB `rideff-life` (`jfvgfbmilavkkdjohmcl`). Harus dipasang SEBELUM deploy kode ini (kalau tidak: baca file, briefing, webhook Stripe gagal).
- Alamat Impressum kosong di `src/content/legal/operator.ts` (banner "Entwurf" tetap tampil). USt-IdNr belum ada.
- Teks hukum = draf tanpa nasihat hukum; perlu dicek pengacara (tombol batal tanpa login §312k BGB, Widerruf elektronik, klausul perpanjangan tahunan).
- Butuh akun/dashboard user: captcha (Turnstile/hCaptcha + setting Supabase Auth), leaked-password protection, Sentry, env `APP_URL` di Vercel.
- Ekspor data hanya profil/setting/memori, bukan transaksi (privasi menjanjikan "ekspor salinan").
- Belum teruji nyata: hapus akun vs DB+Stripe asli, CSP vs suara OpenAI & checkout Stripe, HP asli/Safari, fallback 2D Life Map, turun tingkat performa, mode listen/confirm Clopar, efek mengetik briefing, toast bertumpuk.
- Skeleton belum ada di Report, What-if, layar tools. `loading.tsx` per segmen tidak dibuat (halaman statis, data dimuat di klien).

## Keputusan & alasan
- Trial 14 hari habis → jatuh ke Life (bukan terkunci): data tetap bisa diakses/ekspor. Satu-satunya household live masih trial/Together.
- Tidak ada gate paket via RLS: akan mengunci orang dari datanya sendiri; biaya nyata (AI, suara, kursi) dijaga di SQL (`ai_use`, `private.ai_plan`).
- CSP tanpa nonce: nonce memaksa render dinamis. Inline script diizinkan, `connect-src` dibatasi.
- Hapus akun: orang terakhir → household ikut terhapus; pemilik dengan anggota lain → partner paling awal jadi pemilik, pelanggan Stripe dihapus (langganan berakhir, tanpa refund otomatis).
- Life Score: rumus dipertahankan, kecuali target tahunan dinilai menurut laju (bukan lulus/gagal) agar "Goals 0" hilang.
- Life Map: bloom/DOF dibuat di shader (bukan post-processing) supaya latar transparan, tema terang, dan HP ringan.
- Email publik Impressum `hallo@rideff.com`; telepon +49 176 32572420 (user setuju dipublikasi).

## Aturan kerja user
- Jawab bahasa Indonesia. Berhenti & lapor tiap fase. Jangan commit/push/pasang migrasi tanpa diminta.
- Pakai hanya Supabase `rideff-life`; project lama `Effendy Family` (fmdbgxtdkzzmdnlekhth) read-only, jangan dihapus.
- Teks UI di `scripts/messages-*.json` → jalankan `node scripts/build-messages.mjs` (jangan edit `src/messages/*.json` langsung).
- Next 16 ada breaking change: baca `node_modules/next/dist/docs/` sebelum menulis kode (AGENTS.md).

## Langkah berikutnya
1. Tanya user: pasang migrasi Fase A ke `rideff-life`? Lalu buka PR `fase-0` → `claude/effendy-family-app-setup-fe1wl1`.
2. Minta alamat Impressum; isi `operator.ts`.
3. Fase F (poles layar & alur), G (landing; tanya dulu: publik/indexable?), H (uji nyata & rilis).

## Perintah
- `npx tsc --noEmit && npx eslint src tests && npx vitest run`
- E2E: `lsof -ti:3100,54399 | xargs kill; npm run test:e2e:build && npx playwright test` (stub di `tests/e2e/stub.cjs`)
