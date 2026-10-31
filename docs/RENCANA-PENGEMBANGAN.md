# Rencana Pengembangan Dompet Keluarga

Acuan pengembangan langkah demi langkah, hasil riset & analisis pada 31 Oktober 2026.
Centang `[x]` setiap butir yang selesai.

Tujuan utama: aplikasi siap **dibagikan ke teman-teman** (bukan hanya dipakai berdua), lalu ditambah fitur yang paling banyak dipakai di aplikasi sejenis (Money Lover, Spendee, Finsify).

---

## Langkah 1 — Login & berbagi (wajib, penghalang terbesar)

Masalah saat ini:

| Masalah | Penyebab | Dampak |
|---|---|---|
| Setiap email harus ditambah manual sebagai **Test user** (maks. 100) | Aplikasi OAuth berstatus *Testing* | Teman tidak bisa langsung pakai |
| Muncul layar **"Google hasn't verified this app"** | Scope `spreadsheets` termasuk **sensitif** | Orang awam mengira penipuan |
| **Harus login ulang ±tiap 1 jam** | Token ±1 jam tanpa diperpanjang (`web/assets/google.js`) | Isian form hilang saat sesi habis |

- [x] Buang scope `spreadsheets`; pakai `drive.file` + `drive.appdata` saja (keduanya non-sensitif, Sheets API tetap jalan untuk file buatan aplikasi / yang dipilih lewat Picker). *(kode selesai 1 Nov 2026)*
- [x] Ganti alur "gabung lewat link undangan" & "hubungkan spreadsheet" dengan **Google Picker** (bisa diarahkan ke ID file tertentu). *(kode selesai)*
- [x] Sesi habis → jangan lempar ke layar login; tampilkan "Lanjutkan sebagai X" (minta token baru tanpa layar persetujuan), isian form tetap tersimpan. *(kode selesai)*
- [x] Buat halaman **kebijakan privasi** ("data 100% di Google Drive Anda, tidak ada server") → `web/privasi.html`.
- [ ] **(Pemilik, di Google Cloud Console)** Ikuti README bagian *Setup Google Cloud*: aktifkan Google Picker API, buat API key Picker → isi `pickerApiKey` di `web/assets/config.js`, hapus scope `spreadsheets` di Data access, isi homepage + privacy policy + authorized domain di Branding.
- [ ] **(Pemilik)** Klik **Publish app** (Testing → In production), lalu tes dengan akun Google baru. Kalau layar peringatan masih muncul, ajukan verifikasi branding di Verification Center (cek apakah `github.io` diterima atau perlu domain sendiri ±Rp150rb/tahun).
- [ ] **(Pemilik)** Uji di HP: masuk, "Pilih spreadsheet" untuk akun pemilik & pasangan, undang akun baru lewat link, tunggu sesi habis (±1 jam) saat form terbuka.

## Langkah 2 — Onboarding & penyederhanaan

- [x] **Wizard saldo awal**: satu layar setup — pilih dompet (Tunai, BCA, BRI, Mandiri, BNI, BSI, Jago, SeaBank, GoPay, OVO, DANA, ShopeePay, + nama lain) → isi saldo sekarang → (opsional) email anggota keluarga → **Mulai pakai**.
- [x] **Sesuaikan saldo** per dompet/tabungan: form ubah dompet kini berisi "Saldo sekarang"; mengganti angkanya menghitung ulang saldo awal (tidak membuat transaksi, jadi laporan & anggaran tidak tercemar).
- [x] Kartu "Sudah punya spreadsheet?" diperkecil jadi tautan **Pilih dari Google Drive** di bawah layar setup (menu ⚙️ belum ada sebelum setup).
- [x] Kunci Gemini: alur cukup satu kunci; kunci cadangan disembunyikan di bagian lipat. Menu ⚙️ punya bagian **Fitur lanjutan** (baca struk akurat, bot Telegram, buka spreadsheet).
- [x] Hasil baca struk: label teknis diganti "✅ Yakin…" / "⚠️ Cek lagi totalnya…", pilihan nominal tanpa nama lapis.
- [x] Ganti kata "istri/pasangan" dengan "anggota keluarga" (aplikasi & README).
- [x] Pisahkan README: [README.md](../README.md) = panduan pengguna, [PEMILIK.md](PEMILIK.md) = setup pemilik & developer.

## Langkah 3 — Teknis kecil, dampak besar

- [x] Jadikan **PWA** sungguhan (manifest + ikon + service worker jaringan-dulu, update otomatis); kartu panduan diganti tombol **Pasang aplikasi**. *(dikerjakan pemilik)*
- [x] **Mode offline & transaksi tertunda**: data terakhir disimpan di HP; tanpa sinyal aplikasi tetap terbuka dan transaksi baru disimpan sebagai "tertunda", lalu dikirim otomatis saat online (ID dibuat di HP → kiriman ulang tidak dobel). Yang ditolak server ditampilkan dengan tombol **Catat ulang**. Keluar akun menghapus data di HP.
- [x] Hapus `maximum-scale=1` (zoom kembali bisa); isian dibuat 16px di iPhone supaya tidak zoom otomatis saat diketuk.
- [x] Ubah/hapus transaksi mencari baris lewat kolom ID sesaat sebelum menulis; edit hanya menulis kolom yang berubah; ganti nama kategori/dompet hanya menulis baris yang berubah (bukan seluruh tabel). Diuji dengan API tiruan.
- [x] Proteksi "hanya peringatan" di semua sheet (dipasang otomatis sekali); aplikasi, bot, & API tidak terhalang.
- [x] Perbaiki pesan error yang masih menyebut "menu Lainnya" (`web/assets/db.js`, fungsi `bacaIdSheet_`) → sekarang ikon ⚙️. *(ikut Langkah 1)*

## Langkah 4 — Fitur prioritas 1 (paling sering dipakai)

- [ ] **Tagihan & transaksi rutin** (listrik, internet, cicilan, SPP, BPJS, gaji): kartu "N tagihan jatuh tempo minggu ini" di Beranda, satu ketuk untuk mencatat.
- [ ] **Utang-piutang**: tiru pola Tabungan (dompet jenis khusus + transaksi transfer) + tombol "Ingatkan via WhatsApp" (`wa.me`).
- [ ] **Periode gajian**: pengaturan tanggal mulai periode (mis. 25 → periode 25–24), dipakai di anggaran & ringkasan.
- [ ] **"Sisa aman per hari"** = sisa anggaran ÷ hari tersisa sampai gajian, di Beranda.
- [ ] **Input cepat**: favorit/template satu ketuk, ketik bebas (`bakso 25rb gopay`), saran otomatis catatan & kategori dari riwayat.
- [ ] **Riwayat lintas bulan**: filter rentang tanggal, kategori, dompet, anggota; pencarian semua waktu.

## Langkah 5 — Fitur prioritas 2

- [ ] Bagikan laporan bulanan sebagai gambar/PDF ke WhatsApp.
- [ ] Simpan foto struk sebagai lampiran transaksi (sudah diunggah ke Drive untuk OCR).
- [ ] Mode sembunyikan nominal 👁 & kunci PIN/sidik jari (WebAuthn).
- [ ] Anggaran rollover & pola "amplop" per pos.
- [ ] Beberapa buku keuangan (Pribadi / Keluarga / Usaha).
- [ ] Patungan / split bill.

## Langkah 6 — Pelengkap (prioritas 3)

- [ ] Kalkulator zakat, pos THR/Lebaran, arisan.
- [ ] Kekayaan bersih (aset emas/reksadana − utang).
- [ ] Mode gelap manual (sekarang hanya ikut sistem).

## Tidak disarankan

- Sinkron otomatis bank — belum ada open banking untuk aplikasi perorangan di Indonesia.
- Multi-mata uang — jarang dibutuhkan keuangan keluarga.
- Notifikasi push harian — butuh server (bisa lewat bot Telegram nanti).

## Catatan soal bot Telegram (Tahap 5, folder `bot/`)

Bot butuh sesuatu yang selalu menyala. Sekarang bot berupa Google Apps Script (`bot/Kode.gs`, `bot/appsscript.json`) dengan:

- `executeAs: USER_DEPLOYING` → bot **berjalan sebagai akun pemilik**, bukan sebagai akun pengguna yang chat.
- Scope `spreadsheets` (sensitif) — tapi ini milik project Apps Script sendiri, **tidak** memengaruhi verifikasi aplikasi web di Langkah 1.
- Satu `SPREADSHEET_ID` dan satu `TELEGRAM_TOKEN` di Script Properties → **satu bot = satu spreadsheet keluarga**.
- Akun Telegram ditautkan lewat kode 6 karakter dari web (⚙️ → Bot Telegram), disimpan di sheet Pengaturan (`TELEGRAM_KODE`, `TELEGRAM_PENGGUNA`).

Akibatnya bot hanya cocok untuk spreadsheet pemilik. Supaya teman bisa pakai, pilihannya:
1. **Tiap keluarga deploy bot sendiri** (salin Apps Script + token @BotFather sendiri) — tanpa ubah kode, tapi terlalu teknis untuk orang awam.
2. **Satu bot untuk semua** — perlu desain ulang: peta `chat_id → spreadsheet`, dan bot harus bisa membuka spreadsheet tiap keluarga (mis. pemilik spreadsheet membagikan ke akun bot) → menyangkut privasi & kuota Apps Script.

Kerjakan Langkah 1–4 dulu; bot menyusul sebagai fitur opsional (sekalian untuk pengingat harian). Untuk sekarang, bot cukup ditandai "fitur khusus pemilik" saat aplikasi dibagikan.

## Sumber riset

- [Google: memilih scope Drive API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google: memilih scope Sheets API](https://developers.google.com/workspace/sheets/api/scopes)
- [Jurnal.id: aplikasi keuangan pribadi](https://www.jurnal.id/id/blog/aplikasi-keuangan-pribadi-android-user-friendly)
- [Fanruan: rekomendasi aplikasi budgeting](https://fanruan.com/id/blog/rekomendasi-10-aplikasi-budgeting-terbaik-keuangan-pribadi)
- [Investasiku: aplikasi keuangan terbaik](https://www.investasiku.id/eduvest/rencana/aplikasi-keuangan-terbaik)
- [Ramsey Solutions: perbandingan aplikasi budgeting](https://ramseysolutions.com/budgeting/budgeting-apps-comparison)
