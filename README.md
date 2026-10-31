# Dompet Keluarga

Catat keuangan keluarga bersama dari HP. Gratis, tanpa iklan, dan **semua data tersimpan di Google Drive Anda sendiri**.

**Buka aplikasi:** https://shiroesyn202601-ship-it.github.io/dompet-keluarga/

> Pemilik deployment atau developer? Lihat [docs/PEMILIK.md](docs/PEMILIK.md) (setup Google Cloud, bot Telegram, struktur data).

## Mulai (±2 menit)
1. Buka alamat di atas, ketuk **Masuk dengan Google**, lalu centang semua akses yang diminta.
2. Pilih dompet yang Anda pakai (Tunai, BCA, GoPay, dan lain-lain), lalu isi **saldonya sekarang**. Boleh dikira-kira dulu.
3. Ketuk **Mulai pakai**. Aplikasi membuat spreadsheet **Dompet Keluarga** di Google Drive Anda.
4. Supaya terasa seperti aplikasi biasa, pasang ke layar utama HP: buka **⚙️**, lalu ikuti kartu **Pasang sebagai aplikasi**.

Sekitar tiap 1 jam Google meminta konfirmasi ulang. Cukup ketuk **Lanjutkan sebagai …**, isian Anda tidak hilang.

## Mencatat bersama keluarga
- **Mengundang:** buka **⚙️ → Undang anggota keluarga**, isi email Google-nya, lalu ketuk **Undang**. Bisa juga salin link undangan dan kirim lewat WhatsApp.
- **Diundang:** buka link undangan, masuk dengan akun Google yang diundang, ketuk **Pilih spreadsheet**, lalu pilih file **Dompet Keluarga**. Cukup sekali.

## Fitur
- **Catat** pemasukan, pengeluaran, dan transfer antardompet lewat tombol **＋**.
- **Foto struk:** ketuk **Foto struk**, nominal, tanggal, dan kategori terisi otomatis. Tetap periksa totalnya sebelum menyimpan.
  Untuk hasil yang lebih akurat, isi kunci Gemini gratis di **⚙️ → Baca struk lebih akurat** (opsional).
- **Saldo tidak cocok?** Buka tab **Dompet**, ketuk dompetnya, lalu ganti angka **Saldo sekarang** dengan saldo sebenarnya. Riwayat transaksi tidak berubah.
- **Tabungan:** tab **Dompet → ＋ Tambah tabungan**. Boleh dengan target (mis. Dana Darurat Rp10 juta) atau tanpa batas. Ketuk tabungannya untuk **Setor** atau **Tarik**. Aplikasi menghitung berapa yang perlu disetor per bulan supaya target tercapai.
- **Anggaran:** ketuk **Atur** di kartu Anggaran (Beranda), lalu isi batas belanja per kategori. Muncul **⚠️ Hampir habis** di 80% dan **⛔ Lewat** saat melebihi batas.
- **Laporan:** pemasukan dan pengeluaran per bulan, pengeluaran per kategori, perbandingan dengan bulan lalu, dan siapa yang belanja.
- **Bot Telegram** (kalau pemilik sudah memasangnya): catat cukup dengan chat, mis. *makan bakso 25rb* atau *bensin 30rb pakai gopay*, atau kirim foto struk. Tautkan akun di **⚙️ → Bot Telegram**.

## Privasi
Aplikasi ini tidak punya server. Semua catatan ada di spreadsheet di Google Drive Anda, dan hanya Anda serta orang yang Anda undang yang bisa membukanya.
Aplikasi hanya bisa membuka file yang dibuatnya sendiri atau yang Anda pilih. Lihat [kebijakan privasi](web/privasi.html).

Data juga bisa dilihat langsung di Google Sheets lewat **⚙️ → Buka spreadsheet**. Jangan mengganti nama sheet atau menggeser kolom, karena aplikasi membacanya berdasarkan posisi kolom.
