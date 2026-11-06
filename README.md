# Dompet Keluarga

Catat keuangan keluarga bersama dari HP. Gratis, tanpa iklan, dan **semua data tersimpan di Google Drive Anda sendiri**.

**Buka aplikasi:** https://shiroesyn202601-ship-it.github.io/dompet-keluarga/

> Pemilik deployment atau developer? Lihat [docs/PEMILIK.md](docs/PEMILIK.md) (setup Google Cloud, bot Telegram, struktur data).

## Mulai (±2 menit)
1. Buka alamat di atas, ketuk **Masuk dengan Google**, lalu centang semua akses yang diminta.
2. Pilih dompet yang Anda pakai (Tunai, BCA, GoPay, dan lain-lain), lalu isi **saldonya sekarang**. Boleh dikira-kira dulu.
3. Ketuk **Mulai pakai**. Aplikasi membuat spreadsheet **Dompet Keluarga** di Google Drive Anda.
4. Supaya terasa seperti aplikasi biasa, pasang ke layar utama HP: buka **⚙️** (pojok kanan atas Beranda), lalu ikuti kartu **Pasang sebagai aplikasi**.

Selama aplikasi dipakai, sesi Google diperpanjang otomatis (jendela Google kadang berkedip sebentar). Kalau aplikasi lama tidak dibuka, Google meminta konfirmasi ulang: cukup ketuk **Lanjutkan sebagai …**, isian Anda tidak hilang.

## Mencatat bersama keluarga
- **Mengundang:** buka **⚙️ → Anggota keluarga**, isi email Google-nya, lalu ketuk **Undang**. Bisa juga salin link undangan dan kirim lewat WhatsApp.
- **Mengeluarkan:** di **⚙️ → Anggota keluarga**, ketuk **✕** di samping namanya. Aksesnya ke spreadsheet, foto struk, dan bot Telegram ikut dicabut; transaksi yang sudah dicatatnya tetap ada.
- **Diundang:** buka link undangan, masuk dengan akun Google yang diundang, ketuk **Pilih spreadsheet**, lalu pilih file **Dompet Keluarga**. Cukup sekali.

## Fitur
- **Navigasi:** Beranda · Riwayat · **＋** · Dompet · Laporan di bawah layar. Pengaturan ada di ikon **⚙️** di pojok kanan atas Beranda, di sebelah **🔍**.
- **Catat** pemasukan, pengeluaran, dan transfer antardompet lewat tombol **＋**. Form dimulai dari nominal; tanggal cukup pilih **Hari ini / Kemarin**. Kategori yang paling sering Anda pakai tampil paling depan, dan dompet ikut kebiasaan kategori itu (mis. Transportasi → GoPay). Ulangi tiap bulan, label acara, lampiran foto, dan patungan ada di **＋ Opsi lain**.
- **Pintasan Beranda:** ketuk **Atur** di ujung baris pintasan untuk memilih sampai 5 tombol (Foto struk, Suara, Transfer, Catatan, Sholat, Anggaran, Tabungan, Utang, Tagihan). Berlaku per HP.
- **Catat lebih cepat:** di form catat, ketik saja `bakso 25rb gopay` lalu Enter, dan semua isian terisi sendiri. Transaksi yang sering diulang (kopi, parkir, bensin) muncul sebagai tombol **⚡** sekali ketuk.
- **Catat dengan suara:** ketuk mic lalu bicara, mis. *"makan siang 35 ribu pakai tunai, parkir 5 ribu"*. Beberapa transaksi sekaligus dan tanggal lisan (*kemarin*, *Sabtu minggu lalu*) juga dipahami.
- **Foto struk:** ketuk **Foto struk**, lalu periksa kartu konfirmasinya: nominal, kategori, dompet, dan tanggal sudah terisi, dan yang kosong bisa dilengkapi langsung di kartu. Pilih **Simpan**, **Koreksi**, atau **Foto ulang**.
- **Peringatan dobel:** kalau transaksi yang mirip sudah tercatat di tanggal yang sama, aplikasi bertanya dulu sebelum menyimpan.
- **Lampiran foto:** foto struk otomatis tersimpan bersama transaksinya (📎), di folder "Dompet Keluarga - Struk" di Google Drive Anda. Bisa juga melampirkan bukti transfer lewat **＋ Opsi lain → 📎 Lampirkan foto**.
  Untuk hasil yang lebih akurat, isi kunci Gemini gratis di **⚙️ → Baca struk lebih akurat** (opsional).
- **Tanpa sinyal?** Aplikasi tetap terbuka dengan data terakhir, dan transaksi baru disimpan di HP lalu dikirim otomatis begitu ada sinyal (📤 di atas layar menunjukkan berapa yang menunggu).
- **Ikon bank & e-wallet:** saat menambah dompet, ketik namanya (mis. *BCA*, *Mandiri Ibu*, *GoPay*) dan ikon mereknya terpilih sendiri. Pilihan lengkap (bank, e-wallet, kartu & investasi) ada di bagian **Ikon**. Dompet lama bernama merek yang dikenal otomatis tampil dengan ikon mereknya.
- **Saldo tidak cocok?** Buka tab **Dompet**, ketuk dompetnya, lalu ganti angka **Saldo sekarang** dengan saldo sebenarnya. Riwayat transaksi tidak berubah.
- **Tabungan:** tab **Dompet → ＋ Tambah tabungan**. Boleh dengan target (mis. Dana Darurat Rp10 juta) atau tanpa batas. Ketuk tabungannya untuk **Setor** atau **Tarik**. Aplikasi menghitung berapa yang perlu disetor per bulan supaya target tercapai.
- **Tagihan rutin:** saat mencatat listrik, internet, cicilan, atau gaji, pilih **🔁 Ulangi tiap bulan**. Menjelang jatuh tempo, tagihannya muncul di Beranda; ketuk untuk mencatat (nominal bisa diubah), atau **Lewati kali ini**. Kelola semuanya di **⚙️ → Tagihan & transaksi rutin**.
- **Utang & piutang:** tab **Dompet → ＋ Catat utang / piutang**, pilih *Saya meminjamkan* atau *Saya meminjam*. Tidak dihitung sebagai pengeluaran/pemasukan. Ketuk nama orangnya untuk **Terima pembayaran**, **Bayar utang**, atau **Ingatkan lewat WhatsApp**. Kalau diberi jatuh tempo, muncul di Beranda menjelang tanggalnya.
- **Patungan:** bayar makan bareng teman? Di form catat pengeluaran buka **＋ Opsi lain → 👥 Bagi tagihan**. Bagian Anda jadi pengeluaran, bagian teman otomatis tercatat sebagai piutang.
- **Anggaran:** ketuk **Atur** di kartu Anggaran (Beranda), lalu isi batas belanja per kategori. Muncul **⚠️ Hampir habis** di 80% dan **⛔ Lewat** saat melebihi batas.
- **Anggaran amplop:** centang **📨 Amplop** di sebuah kategori supaya sisa anggaran bulan ini menambah anggaran bulan depan.
- **Gajian bukan tanggal 1?** Atur di **⚙️ → Periode gajian** (mis. tanggal 25). Ringkasan, anggaran, dan laporan lalu dihitung dari tanggal 25 sampai 24 bulan berikutnya.
- **Aman dibelanjakan per hari:** di kartu saldo Beranda tertulis berapa yang aman dipakai per hari sampai gajian berikutnya, sudah dikurangi tagihan rutin yang belum dibayar. Ketuk untuk melihat hitungannya.
- **Riwayat:** ketuk transaksi untuk melihat detailnya (foto, siapa yang mencatat, riwayat perubahan) lalu ubah, duplikat, atau hapus. Geser ke **kiri** untuk hapus (bisa diurungkan), ke **kanan** untuk mencatat lagi hari ini. **Tekan lama** untuk memilih banyak transaksi, lalu ganti kategori/dompet atau hapus sekaligus. Ketuk **📎** untuk melihat foto lampiran, atau pakai filter **Ada lampiran**.
- **Kalender:** ketuk ikon kalender di **Riwayat** untuk melihat pengeluaran per hari. Salah tanggal? Tekan lama transaksi di bawah kalender lalu seret ke hari yang benar (bisa diurungkan).
- **Label acara:** tulis **#lebaran** atau **#liburan** di catatan transaksi. Totalnya lintas kategori tampil di Laporan dan bisa diberi anggaran sendiri.
- **Laporan:** pemasukan dan pengeluaran per bulan, kekayaan bersih dari bulan ke bulan, dan anggaran vs realisasi tiap kategori sepanjang tahun. Rincian periode (pilih dengan panah ‹ ›) menampilkan pengeluaran atau pemasukan per kategori, pola belanja harian, transaksi terbesar, siapa yang belanja, dan perbandingan dengan periode lalu atau periode yang sama tahun lalu (periode berjalan dibanding sampai hari yang sama). Ketuk sebuah kategori untuk melihat trennya 12 bulan dan transaksinya. Untuk periode berjalan ada perkiraan pengeluaran sampai akhir periode, dan kalau kunci Gemini terisi, **✨ Jelaskan periode ini dengan AI**.
- **Cari di semua waktu:** tab **Riwayat → Filter**, pilih rentang (3 bulan, tahun ini, semua waktu, atau tanggal sendiri), kategori, dompet, atau siapa yang mencatat. Ketik kata kunci, mis. "kopi", untuk melihat total jajan kopi tahun ini. Ikon **🔍** di Beranda mencari transaksi, catatan, sekaligus fitur aplikasi.
- **Bagikan & cetak:** di tab **Laporan**, kirim gambar ringkasan bulan atau **📤 Kilas balik** setahun ke WhatsApp, atau **🖨️ Cetak / simpan PDF**.
- **Kekayaan bersih & aset:** tab **Dompet** menunjukkan kekayaan bersih (semua uang, tabungan, aset, dan piutang dikurangi utang). Tambahkan emas, reksadana, atau kendaraan lewat **＋ Tambah aset**.
- **Zakat:** tab **Dompet → 🕌 Hitung zakat** untuk perkiraan zakat maal dan penghasilan.
- **Catatan & jadwal:** pintasan **Catatan** berisi kalender, daftar belanja/tugas, dan pengingat. Item belanja yang dicentang bisa langsung jadi pengeluaran. Pintasan **Sholat** menampilkan jadwal sholat dan arah kiblat.
- **Aktivitas keluarga:** **⚙️ → Aktivitas keluarga** menunjukkan siapa menambah, mengubah, atau menghapus transaksi.
- **Beberapa buku:** pisahkan keuangan Keluarga, Pribadi, dan Usaha di **⚙️ → Buku keuangan**. Tiap buku bisa dibagikan ke orang berbeda.
- **Privasi di HP:** ketuk **👁** di Beranda untuk menyamarkan angka, atau aktifkan **⚙️ → Kunci aplikasi** (PIN atau sidik jari). Tema gelap/terang dan **Ukuran tampilan** (Normal, Besar, Sangat besar) bisa dipilih di **⚙️ → Tampilan & keamanan**.
- **Lupa caranya?** **⚙️ → Tips & trik** merangkum fitur yang tidak kelihatan (ketik cepat, geser, tekan lama, label). Ada juga **Tur singkat aplikasi** dan **Apa yang baru** (riwayat pembaruan) di bagian Bantuan. Ikon **🔍** juga menemukan fitur, mis. ketik *zakat* atau *tema gelap*. Aplikasi memperbarui dirinya sendiri di latar belakang.
- **Bahasa Inggris:** pilih **English** di **⚙️ → Tampilan & keamanan → Bahasa** (atau di layar masuk). Berlaku per HP, jadi tiap anggota keluarga bebas memilih bahasanya sendiri untuk buku yang sama.
- **Bot Telegram:** catat cukup dengan chat, mis. *makan bakso 25rb* atau *bensin 30rb pakai gopay*, atau kirim foto struk. Bot juga bisa mengirim pengingat harian dan rekap bulanan. Buka **⚙️ → Bot Telegram → Hubungkan akun Telegram saya**, setujui, lalu ketuk **Buka Telegram & hubungkan**. Untuk itu spreadsheet buku Anda dibagikan ke akun bot; aksesnya dicabut otomatis saat semua akun Telegram diputus. (Menu ini muncul kalau pengelola aplikasi sudah memasang bot.)

## Privasi
Aplikasi ini tidak punya server. Semua catatan ada di spreadsheet di Google Drive Anda, dan hanya Anda serta orang yang Anda undang yang bisa membukanya.
Aplikasi hanya bisa membuka file yang dibuatnya sendiri atau yang Anda pilih. Lihat [kebijakan privasi](web/privasi.html).

Data juga bisa dilihat langsung di Google Sheets lewat **⚙️ → Buka spreadsheet**, atau diunduh sebagai file Excel/CSV lewat **⚙️ → Unduh & cadangan data**. Salah hapus? Google Sheets menyimpan histori versi (**File → Histori versi**). Jangan mengganti nama sheet atau menggeser kolom, karena aplikasi membacanya berdasarkan posisi kolom.
