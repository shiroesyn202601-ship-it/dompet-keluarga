# Dompet Keluarga

Catat keuangan keluarga bersama dari HP. Gratis, tanpa iklan, dan **semua data tersimpan di Google Drive Anda sendiri**.

**Buka aplikasi:** https://shiroesyn202601-ship-it.github.io/dompet-keluarga/

> Pemilik deployment atau developer? Lihat [docs/PEMILIK.md](docs/PEMILIK.md) (setup Google Cloud, bot Telegram, struktur data).

## Mulai (±2 menit)
1. Buka alamat di atas, ketuk **Masuk dengan Google**, lalu centang semua akses yang diminta.
2. Pilih dompet yang Anda pakai (Tunai, BCA, GoPay, dan lain-lain), lalu isi **saldonya sekarang**. Boleh dikira-kira dulu.
3. Ketuk **Mulai pakai**. Aplikasi membuat spreadsheet **Dompet Keluarga** di Google Drive Anda.
4. Supaya terasa seperti aplikasi biasa, pasang ke layar utama HP: buka **⚙️**, lalu ikuti kartu **Pasang sebagai aplikasi**.

Selama aplikasi dipakai, sesi Google diperpanjang otomatis (jendela Google kadang berkedip sebentar). Kalau aplikasi lama tidak dibuka, Google meminta konfirmasi ulang: cukup ketuk **Lanjutkan sebagai …**, isian Anda tidak hilang.

## Mencatat bersama keluarga
- **Mengundang:** buka **⚙️ → Anggota keluarga**, isi email Google-nya, lalu ketuk **Undang**. Bisa juga salin link undangan dan kirim lewat WhatsApp.
- **Mengeluarkan:** di **⚙️ → Anggota keluarga**, ketuk **✕** di samping namanya. Aksesnya ke spreadsheet, foto struk, dan bot Telegram ikut dicabut; transaksi yang sudah dicatatnya tetap ada.
- **Diundang:** buka link undangan, masuk dengan akun Google yang diundang, ketuk **Pilih spreadsheet**, lalu pilih file **Dompet Keluarga**. Cukup sekali.

## Fitur
- **Catat** pemasukan, pengeluaran, dan transfer antardompet lewat tombol **＋**.
- **Catat lebih cepat:** di form catat, ketik saja `bakso 25rb gopay` lalu Enter, dan semua isian terisi sendiri. Transaksi yang sering diulang (kopi, parkir, bensin) muncul sebagai tombol **⚡** sekali ketuk.
- **Foto struk:** ketuk **Foto struk**, nominal, tanggal, dan kategori terisi otomatis. Tetap periksa totalnya sebelum menyimpan.
- **Lampiran foto:** foto struk otomatis tersimpan bersama transaksinya (📎), di folder "Dompet Keluarga - Struk" di Google Drive Anda. Bisa juga melampirkan bukti transfer lewat **📎 Lampirkan foto**.
  Untuk hasil yang lebih akurat, isi kunci Gemini gratis di **⚙️ → Baca struk lebih akurat** (opsional).
- **Tanpa sinyal?** Aplikasi tetap terbuka dengan data terakhir, dan transaksi baru disimpan di HP lalu dikirim otomatis begitu ada sinyal (📤 di atas layar menunjukkan berapa yang menunggu).
- **Saldo tidak cocok?** Buka tab **Dompet**, ketuk dompetnya, lalu ganti angka **Saldo sekarang** dengan saldo sebenarnya. Riwayat transaksi tidak berubah.
- **Tabungan:** tab **Dompet → ＋ Tambah tabungan**. Boleh dengan target (mis. Dana Darurat Rp10 juta) atau tanpa batas. Ketuk tabungannya untuk **Setor** atau **Tarik**. Aplikasi menghitung berapa yang perlu disetor per bulan supaya target tercapai.
- **Tagihan rutin:** saat mencatat listrik, internet, cicilan, atau gaji, pilih **🔁 Ulangi tiap bulan**. Menjelang jatuh tempo, tagihannya muncul di Beranda; ketuk untuk mencatat (nominal bisa diubah), atau **Lewati kali ini**. Kelola semuanya di **⚙️ → Tagihan & transaksi rutin**.
- **Utang & piutang:** tab **Dompet → ＋ Catat utang / piutang**, pilih *Saya meminjamkan* atau *Saya meminjam*. Tidak dihitung sebagai pengeluaran/pemasukan. Ketuk nama orangnya untuk **Terima pembayaran**, **Bayar utang**, atau **Ingatkan lewat WhatsApp**. Kalau diberi jatuh tempo, muncul di Beranda menjelang tanggalnya.
- **Patungan:** bayar makan bareng teman? Di form catat pengeluaran ketuk **👥 Bagi tagihan**. Bagian Anda jadi pengeluaran, bagian teman otomatis tercatat sebagai piutang.
- **Anggaran:** ketuk **Atur** di kartu Anggaran (Beranda), lalu isi batas belanja per kategori. Muncul **⚠️ Hampir habis** di 80% dan **⛔ Lewat** saat melebihi batas.
- **Anggaran amplop:** centang **📨 Amplop** di sebuah kategori supaya sisa anggaran bulan ini menambah anggaran bulan depan.
- **Gajian bukan tanggal 1?** Atur di **⚙️ → Periode gajian** (mis. tanggal 25). Ringkasan, anggaran, dan laporan lalu dihitung dari tanggal 25 sampai 24 bulan berikutnya.
- **Aman dibelanjakan per hari:** di kartu saldo Beranda tertulis berapa yang aman dipakai per hari sampai gajian berikutnya, sudah dikurangi tagihan rutin yang belum dibayar. Ketuk untuk melihat hitungannya.
- **Laporan:** pemasukan dan pengeluaran per bulan, pengeluaran per kategori, perbandingan dengan bulan lalu, dan siapa yang belanja.
- **Cari di semua waktu:** tab **Riwayat → Filter**, pilih rentang (3 bulan, tahun ini, semua waktu, atau tanggal sendiri), kategori, dompet, atau siapa yang mencatat. Ketik kata kunci, mis. "kopi", untuk melihat total jajan kopi tahun ini.
- **Bagikan ringkasan:** di tab **Laporan**, ketuk **📤 Bagikan ringkasan** untuk mengirim gambar ringkasan bulan itu ke WhatsApp.
- **Kekayaan bersih & aset:** tab **Dompet** menunjukkan kekayaan bersih (semua uang, tabungan, aset, dan piutang dikurangi utang). Tambahkan emas, reksadana, atau kendaraan lewat **＋ Tambah aset**.
- **Zakat:** tab **Dompet → 🕌 Hitung zakat** untuk perkiraan zakat maal dan penghasilan.
- **Beberapa buku:** pisahkan keuangan Keluarga, Pribadi, dan Usaha di **⚙️ → Buku keuangan**. Tiap buku bisa dibagikan ke orang berbeda.
- **Privasi di HP:** ketuk **👁** di Beranda untuk menyamarkan angka, atau aktifkan **⚙️ → Kunci aplikasi** (PIN atau sidik jari). Tema gelap/terang bisa dipilih di **⚙️ → Tampilan & keamanan**.
- **Bot Telegram** (kalau pemilik sudah memasangnya): catat cukup dengan chat, mis. *makan bakso 25rb* atau *bensin 30rb pakai gopay*, atau kirim foto struk. Tautkan akun di **⚙️ → Bot Telegram** (menu ini hanya muncul kalau bot sudah terpasang).

## Privasi
Aplikasi ini tidak punya server. Semua catatan ada di spreadsheet di Google Drive Anda, dan hanya Anda serta orang yang Anda undang yang bisa membukanya.
Aplikasi hanya bisa membuka file yang dibuatnya sendiri atau yang Anda pilih. Lihat [kebijakan privasi](web/privasi.html).

Data juga bisa dilihat langsung di Google Sheets lewat **⚙️ → Buka spreadsheet**, atau diunduh sebagai file Excel/CSV lewat **⚙️ → Unduh & cadangan data**. Salah hapus? Google Sheets menyimpan histori versi (**File → Histori versi**). Jangan mengganti nama sheet atau menggeser kolom, karena aplikasi membacanya berdasarkan posisi kolom.
