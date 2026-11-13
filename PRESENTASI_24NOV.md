# Presentasi 24 November — rencana "personal assistant yang bikin wow"

Disusun 13 Nov 2026 (Jumat). Hari presentasi: Selasa 24 Nov. Sisa waktu: **11 hari**.
Status: **rencana saja. Belum ada kode aplikasi yang diubah, belum ada commit, belum ada Fable.**

Masukan Anda: audiens campuran, demo langsung di layar besar, momen puncak = ngobrol suara,
tujuan = komunitas orang yang mau belajar AI.

---

## 1. Kesimpulan satu paragraf

Aplikasinya sehat secara teknis, tapi **bercerita sebagai aplikasi budget, bukan sebagai personal assistant**.
Clopar (asisten) hanya widget kecil di sudut kartu; fitur suara, yang jadi momen puncak Anda, adalah ikon
mic 40 px di kotak chat. Saat Clopar bicara, penonton tidak melihat apa pun terjadi di layar selain
satu kalimat kecil di bawah partikel. Dan jalur suara **belum pernah diuji di stack asli** (HANDOFF sendiri
mencatatnya). Untuk komunitas yang mau belajar AI, peluang terbesar justru kebalikannya: **tunjukkan
bagaimana asisten itu bekerja, bukan hanya bahwa ia bisa bicara.** Rekomendasi saya: jangan memoles 30 layar.
Bangun **satu jalur demo sinematik** (Stage Mode) dan sembunyikan sisanya selama presentasi.

---

## 2. Apa yang saya periksa, dan batasnya

Saya periksa:
- Seluruh dokumen: README, HANDOFF, UPGRADE_PLAN, handoff desain (`AI_ASSISTANT.md`, README desain).
- Kode jalur suara: `assistant.tsx`, `assistant-client.ts`, `assistant-prompt.ts`, `assistant-tools.ts`, `api/assistant/session/route.ts`.
- Menjalankan app (build produksi + stub data) dan screenshot Home, Life Map, Ask, Budget, More di **1280×720**
  (ukuran proyektor) dan **390×844** (HP). Saya melihat langsung Home desktop, Life Map, Ask, dan Home HP.

Batas, supaya Anda tahu seberapa jauh bisa percaya:
- **Suara tidak saya uji.** Tidak ada kunci OpenAI dan tidak ada mikrofon di sini. Semua klaim soal suara berasal dari membaca kode.
- Life Map dirender dengan GL perangkat lunak. Di GPU laptop asli kemungkinan lebih halus, jadi jangan menilai kualitas partikelnya dari screenshot saya.
- Saya tidak mengecek database/Vercel produksi. Status migrasi di bawah dikutip dari HANDOFF.

---

## 3. Temuan jujur

### 3.1 Strategi / pesan
| Temuan | Bukti |
|---|---|
| Layar pertama berkata "budget app". Judul kartu: *Flexible money left €843*. Kata "assistant" hanya ada di sidebar. | `desk-home.png` |
| Clopar itu karakter kuat (partikel + mata), tapi tampil ±200 px di pojok kartu, dengan teks abu-abu terpotong ("Ask anything about your money, tim…"). | `desk-home.png` |
| Halaman Ask = chatbot generik: judul "Ask about your money", empat chip saran, kotak input. Tidak ada yang membedakannya dari bungkus ChatGPT. | `desk-ask.png` |
| Untuk audiens belajar-AI, hal paling menarik di app ini **tersembunyi**: asisten memakai *tools*, tulisan harus lewat kartu konfirmasi, memori dipisah private/shared, data pasangan tidak bocor ke AI (`ask-context.ts`). Penonton tidak bisa melihat satu pun. | kode |

### 3.2 Jalur suara (momen puncak Anda)
1. **Masuk lewat ikon mic kecil** di kanan kotak input Ask. Tidak ada tombol "bicara dengan Clopar" yang besar, tidak ada pintasan keyboard untuk presenter.
2. **Saat bicara, layar nyaris diam.** `caption` hanya kalimat pertama balasan (2 baris). Pemanggilan tool (`get_budget`, `simulate`…) tidak terlihat. Penonton di barisan belakang, dengan suara ruangan, kehilangan semuanya.
3. **Asisten tidak bisa "menunjukkan".** Tool yang ada hanya baca (`get_*`, `simulate`) dan usul (`propose_*`, `remember`). Tidak ada tool untuk membuka layar, menyorot di Life Map, atau menampilkan grafik sambil bicara.
4. **Tidak ada momen proaktif lewat suara.** Briefing pagi hanya teks + tombol putar di Home. Asisten tidak pernah "menyapa duluan".
5. **Partikel bereaksi pada *peristiwa*, bukan pada *suara*.** Mode `calm/listen/think/speak/confirm` berganti menurut event; tidak ada amplitudo audio, jadi Clopar tidak terlihat "berbicara" mengikuti suaranya.
6. **Risiko gema panggung.** Speaker ruangan + mic terbuka + `semantic_vad`: Clopar bisa terpotong atau menjawab suaranya sendiri. Perlu headset/lavalier atau mode tekan-untuk-bicara.
7. **Kuota suara**: paket Together 120 menit/bulan; setiap latihan memakainya. Trial 14 hari lalu turun ke Life (tanpa suara, 20 pesan AI). Akun demo bisa tiba-tiba kehilangan suara kalau trialnya habis.
8. **Belum pernah diuji nyata** menurut HANDOFF: CSP vs suara OpenAI, HP asli/Safari, mode listen/confirm. Ini risiko nomor satu.

### 3.3 UI / visual (pada ukuran proyektor dan HP)
- **Desktop 1280×720:** rapi, tapi hierarki membaca seperti dashboard SaaS gelap. Teks sekunder 12–13 px, tidak terbaca dari jarak 5+ meter. Sidebar 248 px memakan 20% layar yang tidak berguna bagi penonton.
- **Life Map:** bagus sebagai pembuka. Tapi label 11–12 px; teks "Life score" di bawah angka 80 tertutup; Clopar kecil di pojok kanan bawah dan terpisah dari cerita.
- **HP 390 px:** tombol FAB (+) menimpa tautan "Ask Clopar →" di hero; tab bar menutupi bagian bawah kartu. (Ini sudah tercatat di audit lama sebagai "FAB menutupi konten"; masih terjadi.)
- Hero Home menampilkan tiga angka, tapi tidak ada "momen". Tidak ada animasi angka naik yang terlihat di screenshot diam; perlu dicek di rekaman.

### 3.4 Kesiapan teknis yang berpengaruh pada demo
- Menurut HANDOFF (12 Nov), migrasi `20261112000000_fase_a_limits.sql` **belum dipasang** di DB `rideff-life`; kode yang di-deploy tanpa migrasi itu membuat "baca file, briefing, webhook Stripe gagal". Perlu dipastikan sebelum apa pun.
- Alamat Impressum kosong, teks hukum masih draf. **Tidak relevan untuk demo**, jangan dikerjakan dulu.
- Realtime dua akun (Together) dan cache offline **belum diuji nyata**. Padahal "pasangan menyimpan, layar saya ikut berubah" adalah momen demo yang bagus.

---

## 4. Strategi: cerita yang menjual ke komunitas belajar-AI

Jangan jual "aplikasi keuangan keluarga". Jual ini:

> **"Empat hal yang membuat AI menjadi asisten, bukan chatbot. Dan saya tunjukkan semuanya bekerja, di hidup nyata saya."**

| # | Konsep | Yang dilihat penonton | Sudah ada di kode? |
|---|---|---|---|
| 1 | **Konteks**: AI tahu data Anda lewat *tools*, bukan menebak | Panel "X-ray" menampilkan `get_budget → €843` waktu Clopar menjawab | Tools ada; panel belum |
| 2 | **Bertindak dengan izin**: AI mengusulkan, manusia menyimpan | Kartu Save/Edit/Undo; kalender di perangkat kedua ikut berubah | Kartu ada; sinkron live ada (Together), belum diuji |
| 3 | **Privasi**: AI hanya melihat apa yang boleh dilihat penggunanya | Tanya dari akun Mira tentang jurnal Alex → ditolak, X-ray menunjukkan tak ada data masuk | Aturan ada (RLS + `buildContext`); belum ada visualnya |
| 4 | **Multimodal**: foto → data terstruktur | Foto struk/jadwal → kartu terbaca → Save | Ada (`/api/read`, Telegram); belum ada flow panggung |

Nilai pembeda untuk audiens belajar: **X-ray mode** (melihat tool call, data yang masuk, dan yang *tidak* boleh masuk).
Itu bukan hiasan; itu pelajaran. Dan hampir tidak ada demo asisten AI di komunitas yang menunjukkannya.

---

## 5. Naskah demo ±12 menit (versi 5 menit = beat 1, 3, 5, 7)

| Menit | Beat | Apa yang terjadi | Wow-nya |
|---|---|---|---|
| 0:00 | **1. Pembuka gelap** | Layar hitam. Partikel Clopar menyusun diri. Clopar menyapa **duluan, dengan suara**: "Selamat siang, Alex. Hari ini ada tiga hal…" (pintasan keyboard, bukan klik) | Asisten yang datang ke Anda |
| 1:30 | **2. Bertanya** | "Berapa sisa uang kita bulan ini?" Jawaban bersuara; angka terbang masuk sebagai kartu; X-ray: `get_budget` | Melihat AI "membaca" data |
| 3:00 | **3. Bertindak** | "Besok jam tiga ada urusan pajak sama Mira." Muncul kartu. Anda tekan Save → Clopar tersenyum | Izin manusia |
| 4:30 | **4. Layar kedua** | HP Mira (di meja, ditampilkan di proyektor atau cermin) ikut menampilkan acara baru, saat itu juga | Sinkron live |
| 5:30 | **5. Privasi** | Dari akun Mira: "Apa isi jurnal Alex?" → ditolak. X-ray: nol baris | Pelajaran paling berkesan |
| 7:00 | **6. Foto** | Seorang penonton memberikan struk/jadwal kerja; Anda foto; kartu terbaca; Save | Interaksi penonton |
| 9:00 | **7. Bagaimana kalau** | "Kalau kita hemat 100 euro sebulan, kapan dana darurat selesai?" → `simulate`; Life Map berdenyut dan tanggal goal bergeser | Peta hidup yang bereaksi |
| 10:30 | **8. Penutup** | Kamera menjauh di Life Map. Satu slide arsitektur (4 kotak), QR ke komunitas/materi | Ajakan belajar |

Semua beat harus punya **jalur cadangan** (lihat bagian 8).

---

## 6. Yang perlu dibangun (Track A, khusus presentasi)

Ukuran: S ≈ setengah hari, M ≈ 1 hari, L ≈ 2 hari kerja.

| # | Pekerjaan | Ukuran | Alasan |
|---|---|---|---|
| A0 | **Verifikasi suara end-to-end di stack asli** (kunci, CSP, WebRTC, kuota, mikrofon, Chrome di laptop panggung). Pasang migrasi bila belum. | M | Tanpa ini semuanya sia-sia |
| A1 | **Akun/household demo** dengan data fiktif yang bagus, paket Together diset manual, kuota direset; satu skrip "reset demo". Jangan pernah menampilkan data keuangan asli keluarga Anda di depan banyak orang. | S | Privasi + kepastian |
| A2 | **Stage Mode** (`/stage`): layar penuh, tanpa sidebar, tipografi besar (≥24 px), Clopar besar di tengah, transkrip langsung di bawah, pintasan keyboard (Spasi = bicara, 1–8 = beat). | L | Inti dari semua |
| A3 | **X-ray panel**: aliran tool call (nama, argumen, ringkasan hasil, "tidak ada data privat masuk"). Hanya menampilkan event yang sudah lewat `runCalls`. | M | Pelajaran bagi audiens |
| A4 | **Clopar bereaksi pada suara**: amplitudo audio keluaran menggerakkan partikel; dari `listen` ke `speak` ada transisi yang terlihat. | M | Terasa hidup |
| A5 | **Kartu jawaban visual**: angka terbang masuk, kartu konfirmasi lebih besar dan lebih jelas di Stage Mode. | M | Terbaca dari belakang |
| A6 | **Tool baru `show_on_screen`** (buka layar/sorot node di Life Map/tampilkan grafik) + Life Map bereaksi pada `simulate`. | M–L | Asisten "menunjukkan", bukan cuma bicara |
| A7 | **Sapaan proaktif bersuara** (briefing yang dibacakan Clopar, dipicu pintasan). | S | Pembuka yang kuat |
| A8 | **Mode cadangan**: replay sesi yang direkam (suara + event + layar) bila internet/AI gagal; plus video backup. | M | Satu-satunya asuransi nyata |
| A9 | **Tombol tekan-untuk-bicara** (opsional di Stage Mode) agar gema ruangan tidak mengganggu. | S | Risiko gema |
| A10 | Perbaikan kecil layar HP (FAB menimpa tautan hero). Hanya bila HP dipakai di panggung. | S | Kebersihan |

Total ≈ 9–11 hari kerja kalau serial. Muat dalam 11 hari **hanya** bila A0 jalan dulu dan fitur dibekukan 21 Nov.
Jika waktu mepet, potong dari bawah: A10, A9, lalu A6 (cukup `simulate` + Life Map yang sudah ada).

---

## 7. Jadwal

| Tanggal | Fokus |
|---|---|
| Jum 13 – Sab 14 | **A0, A1**: suara terbukti jalan di stack asli; akun demo siap |
| Min 15 – Sel 17 | **A2, A3, A7**: Stage Mode, X-ray, sapaan |
| Rab 18 – Kam 19 | **A4, A5, A6**: partikel suara, kartu visual, Life Map bereaksi |
| Jum 20 – Sab 21 | **A8** + latihan penuh #1 dan #2. **Bekukan kode Sab malam.** |
| Min 22 | Latihan di perangkat dan jaringan yang sama dengan panggung; rekam video cadangan |
| Sen 23 | Latihan terakhir. **Tidak ada kode baru.** Cek kuota, baterai, headset |
| **Sel 24** | Presentasi |

---

## 8. Risiko dan jalur cadangan

| Risiko | Kemungkinan | Dampak | Cadangan |
|---|---|---|---|
| Internet venue buruk / WebRTC diblok | Sedang | Fatal bagi demo suara | Hotspot HP sendiri; replay sesi rekaman (A8); video backup |
| Kunci/kuota OpenAI habis atau error | Sedang | Fatal | Cek pagi hari; kunci kedua; replay |
| Gema speaker | Tinggi | Mengganggu | Headset/lavalier; tekan-untuk-bicara (A9) |
| AI salah dengar bahasa Indonesia dengan aksen/noise | Sedang | Memalukan | Naskah pertanyaan yang sudah teruji; ulang pelan; fallback ketik |
| AI menjawab ngawur | Rendah–sedang | Memalukan | Jangan improvisasi di panggung; semua jawaban berbasis tool; latihan 10+ kali |
| Trial/paket akun demo kedaluwarsa | Pasti kalau lupa | Suara hilang | Set paket manual; cek H-1 dan pagi hari |
| Data asli terlihat di layar | Mudah terjadi | Privasi | Hanya akun demo; tutup notifikasi, Gmail inbox card dimatikan |
| Penonton bertanya "data saya ke mana?" | Pasti | Kredibilitas | Siapkan jawaban jujur: audio ke OpenAI, tidak disimpan, memori dipisah, bisa dihapus (ada di `AI_ASSISTANT.md` §5) |
| Perubahan besar merusak yang sudah jalan | Sedang | Tinggi | Pembekuan kode 21 Nov; tes yang ada (vitest 140 + e2e) dijalankan tiap hari |

---

## 9. Yang sengaja **tidak** dikerjakan sebelum 24 Nov

Impressum/hukum, Stripe, landing page publik, captcha, vitest 5, memoles layar Money/Time/Invest, audit
aksesibilitas penuh. Semuanya benar-benar perlu **sebelum peluncuran publik**, tapi tidak satu pun terlihat
di panggung. Daftarnya tetap ada di `UPGRADE_PLAN.md`.

Satu pengecualian: jika setelah presentasi Anda ingin orang mencoba, itu keputusan terpisah dan
membutuhkan Fase B, G (landing), dan H.

---

## 10. Pertanyaan yang masih terbuka untuk Anda

1. **Venue:** resolusi proyektor, internet tersedia/andal? Boleh bawa hotspot, headset, HP kedua?
2. **Bahasa panggung:** Indonesia, Inggris, atau campur? (Menentukan naskah dan uji pengenalan suara.)
3. **Orang kedua:** adakah yang bisa berperan sebagai Mira (beat 4–5), atau saya buat dua perangkat Anda sendiri?
4. **Data:** setuju memakai household demo fiktif, bukan data keluarga asli?
5. **Durasi:** benar ±12 menit, atau ada batas lain (mis. 7 atau 20 menit)?
6. **Nama asisten:** tetap "Clopar" untuk panggung? Handoff juga menyebut "Rialna" di riwayat lama; pastikan satu nama saja.
7. **Penutup:** QR ke mana? (komunitas, repo, materi belajar)

---

## 11. Pembagian kerja dan Fable

Belum ada pekerjaan dengan Fable yang dimulai. Usul saya, **setelah Anda bilang oke**:
- **Anda/saya dulu:** A0, A1 (butuh akses akun, kunci, DB; keputusan berisiko).
- **Fable:** A2–A6 (Stage Mode, X-ray, partikel suara, kartu visual, Life Map reaktif), karena ini pekerjaan desain+animasi
  terbesar dan paling menentukan kesan "wow".
- Aturan kerja Anda tetap berlaku: berhenti dan lapor tiap tahap; jangan commit/push/pasang migrasi tanpa diminta;
  teks UI lewat `scripts/messages-*.json` lalu `node scripts/build-messages.mjs`; baca `node_modules/next/dist/docs/` sebelum menulis kode Next.

Untuk lanjut: jawab pertanyaan di bagian 10 (cukup poin 1–5), lalu katakan "oke Fable".
