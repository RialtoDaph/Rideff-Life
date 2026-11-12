import type { LegalText } from ".";

export const id: LegalText = {
  impressum: (op) => ({
    title: "Impressum",
    sections: [
      {
        h: "Penyedia layanan (§ 5 DDG)",
        p: [
          op.lines.join("\n"),
          ...(op.representative ? [`Diwakili oleh: ${op.representative}`] : []),
          ...(op.register ? [`Nomor register: ${op.register}`] : []),
          ...(op.vatId ? [`Nomor identifikasi PPN (§ 27a UStG): ${op.vatId}`] : []),
        ],
      },
      { h: "Kontak", p: [[`Email: ${op.email}`, ...(op.phone ? [`Telepon: ${op.phone}`] : [])].join("\n")] },
      { h: "Penanggung jawab isi (§ 18 ayat 2 MStV)", p: [op.lines.slice(0, 3).join("\n")] },
      {
        h: "Penyelesaian sengketa konsumen",
        p: ["Kami tidak bersedia dan tidak wajib mengikuti proses penyelesaian sengketa di badan arbitrase konsumen."],
      },
      {
        h: "Tentang isi aplikasi",
        p: [
          "rideff Life membantu menata uang, waktu, dan keseharian. Aplikasi dan asistennya tidak menggantikan nasihat pajak, hukum, investasi, atau medis. Perhitungan dan jawaban AI bisa keliru; periksa sendiri angka yang penting.",
        ],
      },
    ],
  }),

  privacy: (op) => ({
    title: "Kebijakan privasi",
    sections: [
      {
        h: "1. Pengendali data",
        p: [`${op.lines.join(", ")}\nEmail: ${op.email}`, "Hubungi alamat ini untuk pertanyaan apa pun tentang datamu."],
      },
      {
        h: "2. Data yang kami proses",
        p: [
          "Data akun: alamat email, nama tampilan, bahasa, peran dalam rumah tangga, passkey atau hash kata sandi, waktu masuk.",
          "Yang kamu masukkan: pemasukan, pengeluaran, anggaran, utang, langganan, shift, target, catatan jurnal dan latihan, berkas yang diunggah seperti struk dan rekening koran, serta pesanmu ke asisten dan hal yang diingatnya.",
          "Data pembayaran: paket yang dipilih, status tagihan, dan nomor pelanggan di Stripe. Kami tidak pernah melihat atau menyimpan data kartu atau rekening; Stripe yang menyimpannya.",
          "Data teknis: alamat IP, waktu, alamat yang diminta, dan keterangan browser di log server, serta alamat push perangkatmu jika notifikasi dinyalakan.",
        ],
      },
      {
        h: "3. Tujuan dan dasar hukum",
        p: [
          "Menyediakan aplikasi, akunmu, dan fitur berbayar: pelaksanaan kontrak (Pasal 6 ayat 1 huruf b GDPR).",
          "Keamanan, pencegahan penyalahgunaan, dan pencarian kesalahan: kepentingan yang sah (Pasal 6 ayat 1 huruf f GDPR).",
          "Asisten suara, sambungan Telegram, dan notifikasi push: persetujuanmu, yang bisa dicabut kapan saja di Pengaturan (Pasal 6 ayat 1 huruf a GDPR).",
          "Jika kamu memilih memasukkan keterangan kesehatan, misalnya di jurnal atau catatan latihan, kami memprosesnya hanya untuk menampilkannya kepadamu, berdasarkan persetujuan tegasmu (Pasal 9 ayat 2 huruf a GDPR).",
          "Faktur dan bukti pembayaran: kewajiban penyimpanan menurut hukum (Pasal 6 ayat 1 huruf c GDPR).",
        ],
      },
      {
        h: "4. Penerima dan pemroses data",
        p: [
          "Supabase (basis data, proses masuk, penyimpanan berkas): disimpan di Frankfurt am Main, Uni Eropa.",
          "Vercel (hosting dan penyajian aplikasi): fungsi server berjalan di Frankfurt am Main; perusahaannya berkedudukan di AS.",
          "Stripe Payments Europe, Irlandia (pembayaran).",
          "Anthropic, AS (asisten AI): menerima pertanyaanmu, bagian datamu yang diperlukan untuk menjawab, dan berkas yang kamu minta dibacakan.",
          "OpenAI, Irlandia/AS (asisten suara): menerima audio percakapanmu selama berlangsung, dan hanya jika kamu memulai mode suara.",
          "Telegram (hanya jika akunmu disambungkan): menerima pesan yang dikirim bot kepadamu.",
          "Layanan push dari Apple, Google, atau Mozilla (hanya jika notifikasi menyala): menerima notifikasi terenkripsi.",
          "Kami punya perjanjian pemrosesan data dengan penyedia yang bekerja atas nama kami. Kami tidak menjual data dan tidak menampilkan iklan.",
        ],
      },
      {
        h: "5. Pengiriman ke luar Uni Eropa",
        p: [
          "Beberapa penyedia berkedudukan di AS atau memproses data di sana. Pengiriman didasarkan pada keputusan kecukupan untuk EU-US Data Privacy Framework bila penyedianya tersertifikasi, dan selain itu pada klausul kontrak standar Komisi Eropa.",
        ],
      },
      {
        h: "6. Asisten AI",
        p: [
          "Asisten menjawab berdasarkan catatanmu sendiri. Menurut ketentuan para penyedia AI, isi yang dikirim lewat antarmuka mereka tidak dipakai untuk melatih model.",
          "Tidak ada keputusan otomatis yang berakibat hukum menurut Pasal 22 GDPR. Asisten mengusulkan perubahan pada datamu; kamu yang mengonfirmasi.",
        ],
      },
      {
        h: "7. Cookie dan penyimpanan di perangkatmu",
        p: [
          "Kami hanya memakai yang diperlukan aplikasi secara teknis (§ 25 ayat 2 TDDDG): cookie untuk bahasa, sesi masuk, salinan offline datamu, pengaturan tampilan, dan hash PIN jika kamu menyalakannya. Tidak ada cookie pelacak atau iklan dan tidak ada layanan analitik.",
        ],
      },
      {
        h: "8. Lama penyimpanan dan penghapusan",
        p: [
          "Kami menyimpan datamu selama akunmu ada. Di Pengaturan → Data kamu bisa mengekspor salinan, menghapus catatanmu, atau menghapus akun sepenuhnya. Menghapus akun langsung menghilangkan catatan dan berkasmu; cadangan milik penyedia kami berakhir sesuai jangka waktu tetap mereka.",
          "Data faktur dan pembayaran tetap ada di Stripe dan pada kami selama diwajibkan hukum. Log server dihapus setelah waktu singkat.",
        ],
      },
      {
        h: "9. Rumah tangga bersama",
        p: [
          "Jika kamu bergabung dengan sebuah rumah tangga, anggotanya melihat catatan bertanda “Keluarga” dan apa yang dibagikan pemilik kepadamu. Catatan pribadi tetap hanya terlihat olehmu.",
        ],
      },
      {
        h: "10. Hak-hakmu",
        p: [
          "Kamu berhak atas akses, perbaikan, penghapusan, pembatasan pemrosesan, portabilitas data, dan keberatan (Pasal 15 sampai 21 GDPR). Persetujuan bisa dicabut kapan saja dan berlaku ke depan.",
          "Kamu bisa mengadu ke otoritas perlindungan data, misalnya di tempat tinggalmu (Pasal 77 GDPR).",
          "Alamat email diperlukan untuk akun. Semua isian lain bersifat sukarela.",
        ],
      },
    ],
  }),

  terms: (op) => ({
    title: "Syarat dan ketentuan",
    sections: [
      {
        h: "1. Ruang lingkup dan penyedia",
        p: [
          `Ketentuan ini berlaku untuk penggunaan rideff Life. Penyedia dan pihak dalam kontrak adalah ${op.name}, ${op.street}, ${op.city}. Layanan ini ditujukan bagi konsumen berusia 18 tahun ke atas.`,
        ],
      },
      {
        h: "2. Layanan",
        p: [
          "rideff Life adalah aplikasi web untuk menata uang, waktu, dan keseharian rumah tanggamu. Cakupannya bergantung pada paket (Life, Life Plus, Together) dan dijelaskan di halaman paket.",
          "Aplikasi dan asisten AI-nya tidak memberi nasihat pajak, hukum, investasi, atau medis. Jawaban dan perhitungan bisa tidak lengkap atau keliru. Keputusan ada di tanganmu.",
          "Fitur AI memiliki batas harian atau bulanan yang tertera di halaman paket.",
        ],
      },
      {
        h: "3. Akun dan masa coba",
        p: [
          "Mendaftar dengan email membuat akun gratis dengan masa coba 14 hari. Tidak perlu data pembayaran, dan masa coba tidak pernah berubah sendiri menjadi paket berbayar.",
          "Setelah masa coba, tanpa paket berbayar hanya tersedia fitur terbatas. Datamu tetap tersimpan dan tetap bisa diekspor.",
          "Jaga kerahasiaan data masukmu dan hanya masukkan data yang boleh kamu gunakan.",
        ],
      },
      {
        h: "4. Terjadinya kontrak paket berbayar",
        p: [
          "Tampilan paket bukan penawaran yang mengikat. Kamu mengajukan penawaran dengan mengonfirmasi pembelian di proses pembayaran penyedia kami, Stripe. Kontrak terjadi saat kami membuka paketnya. Teks kontrak bisa dibaca di halaman ini kapan saja; bahasa kontrak adalah bahasa Jerman.",
        ],
      },
      {
        h: "5. Harga dan pembayaran",
        p: [
          "Yang berlaku adalah harga akhir dalam euro yang ditampilkan saat pembayaran. Sesuai pilihanmu, tagihan dibayar di muka per bulan atau per tahun lewat cara pembayaran yang tersimpan di Stripe.",
          "Jika pembayaran gagal, kami boleh mengunci fitur berbayar sampai tagihan dilunasi.",
        ],
      },
      {
        h: "6. Jangka waktu dan pembatalan",
        p: [
          "Paket berbayar berlaku satu bulan atau satu tahun dan diperpanjang untuk jangka yang sama jika tidak dibatalkan. Setelah tahun pertama, paket tahunan berlanjut tanpa batas waktu dan bisa dibatalkan kapan saja dengan pemberitahuan satu bulan; kelebihan pembayaran kami kembalikan secara proporsional.",
          `Kamu bisa membatalkan kapan saja untuk akhir periode berjalan: di aplikasi lewat Paket → Kelola pembayaran, atau lewat email ke ${op.email}. Hak mengakhiri kontrak karena alasan penting tetap berlaku.`,
          "Akun bisa dihapus kapan saja di Pengaturan → Data. Dengan itu paket berbayar juga langsung berakhir.",
        ],
      },
      {
        h: "7. Hak pembatalan (Widerruf)",
        p: ["Konsumen memiliki hak pembatalan menurut undang-undang. Rinciannya ada di pemberitahuan hak pembatalan."],
      },
      {
        h: "8. Ketersediaan dan perubahan",
        p: [
          "Kami berusaha agar layanan berjalan tanpa henti, tetapi gangguan karena pemeliharaan atau kerusakan tidak bisa dikesampingkan. Kami menyediakan pembaruan yang diperlukan agar layanan tetap sesuai kontrak.",
          "Kami boleh mengembangkan aplikasi selama inti paket yang kamu pesan tetap ada. Perubahan penting pada ketentuan ini atau harga kami beritahukan lewat email sedikitnya enam minggu sebelumnya; kamu lalu boleh membatalkan per tanggal perubahan. Perubahan harga baru berlaku pada periode tagihan berikutnya dan hanya dengan persetujuanmu.",
        ],
      },
      {
        h: "9. Tanggung jawab",
        p: [
          "Kami bertanggung jawab tanpa batas atas kesengajaan dan kelalaian berat, atas cedera pada nyawa, tubuh, atau kesehatan, dan menurut undang-undang tanggung jawab produk. Atas pelanggaran kewajiban pokok kontrak karena kelalaian ringan, tanggung jawab kami terbatas pada kerugian yang lazim dan dapat diperkirakan. Selebihnya tanggung jawab dikecualikan. Hak garansi menurut undang-undang untuk produk digital tetap berlaku.",
        ],
      },
      {
        h: "10. Ketentuan penutup",
        p: [
          "Berlaku hukum Jerman. Aturan perlindungan konsumen yang bersifat memaksa di negara tempat tinggalmu tetap berlaku.",
          "Kami tidak bersedia dan tidak wajib mengikuti proses penyelesaian sengketa di badan arbitrase konsumen.",
          "Jika satu ketentuan tidak sah, ketentuan lainnya tetap berlaku.",
        ],
      },
    ],
  }),

  withdrawal: (op) => ({
    title: "Pemberitahuan hak pembatalan",
    sections: [
      {
        h: "Hak pembatalan",
        p: [
          "Kamu berhak membatalkan kontrak ini dalam empat belas hari tanpa menyebutkan alasan. Jangka waktunya empat belas hari sejak hari kontrak terjadi.",
          `Untuk menggunakan hak ini, kamu harus memberi tahu kami (${op.lines.join(", ")}, email: ${op.email}) tentang keputusanmu membatalkan kontrak ini dengan pernyataan yang jelas, misalnya lewat email atau surat. Kamu boleh memakai contoh formulir di bawah, tetapi tidak wajib.`,
          "Jangka waktu terpenuhi jika pemberitahuan dikirim sebelum jangka waktu pembatalan berakhir.",
        ],
      },
      {
        h: "Akibat pembatalan",
        p: [
          "Jika kamu membatalkan kontrak ini, kami mengembalikan semua pembayaran yang kami terima darimu tanpa menunda dan paling lambat empat belas hari sejak pemberitahuanmu kami terima. Pengembalian memakai cara pembayaran yang sama dengan pembayaran awal, kecuali disepakati lain secara tegas; kamu tidak dikenai biaya untuk itu.",
          "Jika kamu meminta layanan dimulai selama jangka waktu pembatalan, kamu membayar jumlah yang wajar sebanding dengan layanan yang sudah diberikan sampai pembatalan, dibanding seluruh cakupan kontrak.",
        ],
      },
      {
        h: "Contoh formulir pembatalan",
        p: [
          "Jika ingin membatalkan kontrak, isi formulir ini dan kirimkan kembali.",
          `Kepada ${op.lines.join(", ")}, email: ${op.email}`,
          "Dengan ini saya/kami (*) membatalkan kontrak yang saya/kami (*) buat untuk layanan berikut: rideff Life, paket ______",
          "Dipesan pada: ______\nNama konsumen: ______\nAlamat email akun: ______\nAlamat konsumen: ______\nTanggal: ______",
          "(*) Coret yang tidak perlu.",
        ],
      },
    ],
  }),
};
