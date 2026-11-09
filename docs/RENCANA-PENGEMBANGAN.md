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
- [x] **(Pemilik, di Google Cloud Console)** Ikuti README bagian *Setup Google Cloud*: aktifkan Google Picker API, buat API key Picker → isi `pickerApiKey` di `web/assets/config.js`, hapus scope `spreadsheets` di Data access, isi homepage + privacy policy + authorized domain di Branding.
- [x] **(Pemilik)** Klik **Publish app** (Testing → In production), lalu tes dengan akun Google baru. Kalau layar peringatan masih muncul, ajukan verifikasi branding di Verification Center (cek apakah `github.io` diterima atau perlu domain sendiri ±Rp150rb/tahun).
- [x] **(Pemilik)** Uji di HP: masuk, "Pilih spreadsheet" untuk akun pemilik & pasangan, undang akun baru lewat link, tunggu sesi habis (±1 jam) saat form terbuka. *(dikonfirmasi pemilik 1 Nov 2026)*

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

- [x] **Tagihan & transaksi rutin** (listrik, internet, cicilan, SPP, BPJS, gaji): sheet **Rutin** (dibuat otomatis); dibuat dari pilihan **🔁 Ulangi** di form transaksi atau ⚙️ → Tagihan & transaksi rutin; kartu **Tagihan mendatang** di Beranda (≤7 hari / terlambat), ketuk → form terisi, simpan → jatuh tempo maju; **Lewati kali ini**. Tidak dicatat otomatis (belum tentu sudah dibayar). Ganti nama kategori/dompet ikut ke rutin. Diuji dengan API tiruan.
- [x] **Utang-piutang**: dompet jenis **Utang**, satu per orang (saldo + = dia berutang, − = kita berutang); dicatat sebagai Transfer jadi tidak masuk pemasukan/pengeluaran. Tab Dompet → bagian **Utang & Piutang** (ringkasan, daftar, "Sudah lunas"), form **Saya meminjamkan / Saya meminjam**, **Terima pembayaran / Bayar utang**, **Ingatkan lewat WhatsApp**, jatuh tempo ikut kartu Tagihan mendatang. Bot ikut disesuaikan (perlu deploy versi baru). Diuji dengan API tiruan.
- [x] **Periode gajian**: ⚙️ → Periode gajian (tanggal 1–28, disimpan sebagai `MULAI_PERIODE` di sheet Pengaturan). Beranda, Riwayat, anggaran, dan Laporan memakai periode itu; label jadi "25 Okt – 24 Nov 2026". Bot ikut (perlu deploy versi baru). Diuji dengan API tiruan.
- [x] **"Sisa aman per hari"** di kartu saldo Beranda (periode berjalan saja): (total anggaran − terpakai di kategori beranggaran − tagihan rutin yang masih jatuh tempo di periode ini) ÷ hari tersisa; tanpa anggaran dasarnya pemasukan periode ini. Ketuk untuk rincian hitungannya.
- [x] **Input cepat** (form transaksi baru): **⚡ Sering dicatat** — tombol satu ketuk otomatis dari transaksi yang terulang ≥2× dalam 120 hari (nominal & dompet yang paling sering); **ketik cepat** `bakso 25rb gopay` → nominal, kategori, dompet, catatan terisi (aturan sederhana, jalan offline & tanpa AI; paham rb/k/jt, 1,5jt, 25.000, goceng/ceban); **saran catatan** dari riwayat, kategorinya ikut terisi. Diuji.
- [x] **Riwayat lintas bulan**: tombol **Filter** di Riwayat — rentang (periode ini / 3 bulan / tahun ini / semua waktu / pilih tanggal), kategori, dompet, anggota; filter aktif tampil sebagai chip ✕. Di luar periode berjalan, transaksi dibaca dari spreadsheet saat dibutuhkan (`SERVER.cariTransaksi`, butuh sinyal). Hasil diberi ringkasan "N transaksi · Keluar · Masuk"; ditampilkan 200 dulu + "Tampilkan lebih banyak". Diuji.

## Langkah 5 — Fitur prioritas 2

- [x] Bagikan ringkasan periode sebagai **gambar** (1080×1350) lewat menu berbagi HP → WhatsApp; diunduh kalau browser tidak mendukung. (PDF tidak dibuat: gambar lebih praktis di WhatsApp.)
- [x] **Lampiran foto struk / bukti transfer**: foto dari baca struk ikut disimpan, atau 📎 manual; folder Drive "Dompet Keluarga - Struk", dibagikan lihat-saja ke akun yang punya akses spreadsheet; kolom Transaksi baru "Lampiran". Diuji.
- [x] **Sembunyikan nominal** (👁 di Beranda & ⚙️) dan **kunci aplikasi**: PIN 4–6 angka (hash bergaram) + opsional sidik jari/wajah (WebAuthn), terkunci saat dibuka & setelah ditinggal > 1 menit.
- [x] **Anggaran amplop**: centang 📨 per kategori → sisa/kelebihan periode lalu ditambahkan ke anggaran periode ini (satu periode ke belakang). Kolom Kategori baru "Bawa Sisa". Diuji.
- [x] **Beberapa buku keuangan**: satu buku = satu spreadsheet; ⚙️ → Buku keuangan (buat, pindah, hapus dari daftar, pilih dari Drive); chip buku di Beranda; transaksi tertunda terikat ke bukunya. Sekalian memperbaiki bug: ganti akun tanpa muat ulang membuka spreadsheet akun lama. Diuji.
- [x] **Patungan**: dari form catat pengeluaran; bagian sendiri = pengeluaran, bagian teman = piutang; diperiksa dulu supaya tidak tercatat setengah. Diuji.

## Langkah 6 — Pelengkap (prioritas 3)

- [x] **Kalkulator zakat** (Dompet → Hitung zakat): maal & penghasilan, nisab 85 g emas (harga emas diisi sendiri). **Templat** tabungan (Lebaran & THR, Dana Darurat, Umroh, …) dan tagihan rutin (Arisan, Listrik, Cicilan, SPP, BPJS, Gaji, …).
- [x] **Kekayaan bersih**: dompet jenis **Aset** (nilai diperbarui manual, beli = transfer); kartu Kekayaan bersih di tab Dompet; bot ikut (perlu deploy versi baru). Diuji.
- [x] **Mode gelap manual**: ⚙️ → Tema Otomatis / Terang / Gelap, dipasang sebelum CSS supaya tidak berkedip.

## Catatan setelah Langkah 6

- Bot Telegram belum tahu: anggaran amplop (peringatan anggaran bot memakai anggaran dasar), lampiran foto, dan buku selain yang diatur di `SPREADSHEET_ID`.
- Belum diuji di HP sungguhan: kunci sidik jari/wajah (tergantung HP & browser), berbagi gambar, unggah lampiran.

## Langkah 7 — Hasil audit (keamanan, kenyamanan, kemudahan)

Audit kode 1 Nov 2026. Sudah aman: semua isian di-escape, tulis Sheets mode `RAW` (tidak ada injeksi rumus), scope sempit, webhook bot berkode rahasia, Keluar membersihkan data di HP.

**7a — Cepat, dampak besar**
- [x] **K1** PIN dibatasi: 5× salah → tunggu 30 detik; 10× salah → wajib masuk ulang dengan Google.
- [x] **M1** Menu Bot Telegram hanya tampil kalau bot sudah terpasang di buku ini (teman tidak melihat instruksi @BotFather).
- [x] **N2** "Dihapus · Urungkan" (6 detik) setelah menghapus transaksi; konfirmasi hapus dihilangkan. Diuji.
- [x] **K4** Foto lampiran ikut dipindah ke Sampah Drive saat transaksinya dihapus atau fotonya diganti/dihapus (diambil kembali saat diurungkan). Diuji.

**7b — Menengah**
- [x] **N1** Sesi Google diperpanjang otomatis: token tinggal < 10 menit → ketukan berikutnya minta token baru diam-diam (aksi kamera/bagikan/salin/sidik jari dikecualikan).
- [x] **N3** ⚙️ → Unduh & cadangan data: semua transaksi sebagai CSV (titik koma + BOM untuk Excel Indonesia, aman dari injeksi rumus) + info histori versi Google Sheets.
- [x] **K3** ⚙️ → Anggota keluarga: daftar akun + tombol Keluarkan (cabut izin spreadsheet, izin lihat foto struk buku ini, dan akun Telegram-nya). Diuji.

**7c — Sentuhan akhir**
- [x] **N4** Dialog konfirmasi bergaya aplikasi (`tanya()`) menggantikan 11 `confirm()`.
- [x] **M2** Kartu "Mulai di sini" di Beranda: catat pertama, anggaran, undang keluarga, pasang di layar utama; bisa ditutup, tidak muncul kalau periode ini sudah ≥ 15 transaksi.
- [x] **K5** Content-Security-Policy (`<meta>`) di index.html. Diuji di Chrome headless: login Google & Picker termuat tanpa pelanggaran.
- [x] **M4** Pesan kesalahan Google yang umum diterjemahkan (izin, tidak ditemukan, kuota, gangguan, Drive penuh, batas sel, nama sheet berubah).
- [x] **K6** Peringatan di form kunci Gemini: terlihat semua anggota, jangan pakai kunci yang terhubung ke billing.
- [x] **K2** Jelaskan batas Kunci aplikasi (melindungi dari orang yang meminjam HP, bukan dari pencurian HP).

**Belum diuji di HP sungguhan (Langkah 7):** perpanjangan sesi otomatis (popup berkedip), unduh CSV di iPhone (mode aplikasi terpasang), tampilan dialog konfirmasi & kartu Mulai di sini.

## Langkah 8 — Satu bot Telegram untuk semua pengguna

**Masalah:** sekarang satu bot = satu spreadsheet (`SPREADSHEET_ID` diisi manual di Apps Script). Teman yang memakai aplikasi tidak bisa memakai bot tanpa memasang Apps Script sendiri.

**Tujuan:** teman cukup mengetuk **⚙️ → Bot Telegram → Hubungkan**, lalu **Buka Telegram**. Tidak ada Apps Script, BotFather, atau ID yang perlu diisi.

### Cara kerja

```
Aplikasi (HP teman)                         Bot (Apps Script milik pemilik)
1. Bagikan spreadsheet ke akun robot   ─┐
2. Tulis kode 6 huruf di sheet          │
   Pengaturan (TELEGRAM_KODE, 15 mnt)   │
3. Buka t.me/<bot>?start=<idSheet>_<kode>┴→ 4. Buka spreadsheet itu sebagai akun robot,
                                               cocokkan kode di sheet Pengaturan-nya
                                            5. Catat Telegram ID → spreadsheet:
                                               - TELEGRAM_PENGGUNA di sheet itu (seperti sekarang)
                                               - indeks di Script Properties bot
                                            6. Pesan berikutnya: cari spreadsheet lewat indeks,
                                               cek ID masih ada di TELEGRAM_PENGGUNA, lalu proses
```

- **Akun robot = service account Google** (mis. `dompet-bot@<project>.iam.gserviceaccount.com`). Bot membuka spreadsheet lewat Sheets REST API dengan token akun robot. Sekarang bot sudah memakai Sheets REST API; hanya sumber tokennya yang diganti, dari `ScriptApp.getOAuthToken()` ke token JWT akun robot (di-cache sekitar 55 menit).
- **Membagikan otomatis:** aplikasi sudah punya izin `drive.file` atas spreadsheet-nya, jadi bisa menambah izin Editor untuk email robot tanpa email notifikasi dan **tanpa scope baru**. Verifikasi OAuth aplikasi tidak terpengaruh.
- **Kenapa aman dari "mengambil alih" spreadsheet orang:** ID spreadsheet saja tidak cukup. Kode penautan harus ada di sheet Pengaturan milik spreadsheet itu, dan yang bisa menulisnya hanya akun yang punya akses ke spreadsheet tersebut.
- **Spreadsheet adalah sumber kebenaran.** Indeks di bot hanya jalan pintas. Kalau Telegram ID sudah tidak ada di `TELEGRAM_PENGGUNA`, atau akses robot sudah dicabut (403), indeks dihapus dan bot membalas "belum terhubung". Akibatnya, **Putuskan** dan **Keluarkan anggota** (K3) otomatis memutus akses bot juga.
- **Panjang link:** parameter `start` Telegram maksimal 64 karakter dan hanya boleh `A–Z a–z 0–9 _ -`. ID spreadsheet ±44 karakter + `_` + kode 6 huruf masih muat.
- **Nama bot di `config.js`** (`botTelegram: 'namabot'`, `emailBot: '…iam.gserviceaccount.com'`). Menu Bot Telegram tampil untuk semua pengguna, tidak bergantung pada `TELEGRAM_BOT` di sheet.

### Bagian yang ikut berubah
| Bagian | Sekarang | Langkah 8 |
|---|---|---|
| Spreadsheet tujuan | `SPREADSHEET_ID` tetap | Dicari per Telegram ID dari indeks |
| Akses spreadsheet | Akun pemilik (`USER_DEPLOYING`) | Akun robot (service account) |
| Kode penautan | `/hubungkan KODE` | Link `start=<idSheet>_<kode>`, plus `/hubungkan <idSheet>_<kode>` untuk disalin manual |
| Kunci Gemini | Dari sheet keluarga | Tetap dari sheet keluarga. Tanpa kunci: hanya jalur cepat tanpa AI ("bakso 25rb") |
| OCR foto struk | Drive pemilik (file sementara) | Tetap Drive pemilik, karena akun robot tidak punya kuota penyimpanan. File langsung dihapus |
| Kunci antrean (LockService) | Satu kunci untuk semua | Kunci per Telegram ID (CacheService), supaya pengguna tidak saling menunggu |
| Mode lama | — | Tetap jalan: kalau indeks kosong tapi `SPREADSHEET_ID` diisi, pakai cara lama, lalu daftarkan otomatis ke indeks (migrasi keluarga pemilik) |

### Privasi (wajib jujur ke pengguna)
- Spreadsheet yang disambungkan ke bot **bisa dibuka oleh akun robot milik pengelola bot**. Secara teknis pengelola bisa melihat isinya. Pengguna yang tidak memakai bot tetap 100% privat.
- Layar persetujuan sebelum menghubungkan, kurang lebih: *"Untuk memakai bot, spreadsheet ini dibagikan ke akun bot Dompet Keluarga yang dikelola <pengelola>. Bisa diputus kapan saja."*
- **Putuskan semua akun Telegram** di buku itu → aplikasi juga mencabut izin akun robot dari spreadsheet.
- Kunci akun robot (JSON) hanya disimpan di Script Properties bot, tidak pernah di repo atau aplikasi. Kalau bocor: hapus kunci di Google Cloud, lalu buat yang baru.
- Perbarui `web/privasi.html` (bagian bot) dan README.

### Batas gratis Apps Script (akun Gmail biasa)
- UrlFetch ±20.000 per hari. Satu pesan butuh ±3–5 panggilan (Telegram, Sheets, Gemini), jadi cukup untuk ±4.000 pesan per hari.
- Script Properties total 500 KB. Satu entri indeks ±80 byte, jadi muat ±5.000 akun Telegram.
- Pengingat harian (nanti) memakai trigger berwaktu dengan batas total ±90 menit per hari, jadi perlu dibatasi per keluarga.
- Kalau sudah melewati batas ini: pindahkan bot ke server kecil (mis. Cloud Run). Cara kerjanya tetap sama.

### Setup sekali oleh pemilik
1. Google Cloud (project yang sama) → **IAM & Admin → Service Accounts → Create**, beri nama `dompet-bot`, **tanpa role**.
2. Buka akun itu → **Keys → Add key → JSON**. Isi file JSON-nya ditempel ke Script Properties `SA_KEY`.
3. Pastikan **Google Sheets API** aktif di project (sudah aktif untuk aplikasi).
4. Isi `botTelegram` dan `emailBot` di `web/assets/config.js`, lalu push.
5. Tempel `Kode.gs` baru, lalu **Deploy → New version**. `SPREADSHEET_ID` boleh tetap ada untuk mode lama.

### Urutan kerja
- [x] **8a** Bot: token akun robot (JWT RS256 lewat `Utilities.computeRsaSha256Signature`, di-cache ±55 menit); semua baca/tulis Sheets lewat REST (SpreadsheetApp tidak dipakai lagi); spreadsheet dipilih per pesan. Diuji dengan Apps Script/Sheets/Telegram tiruan.
- [x] **8b** Bot: penautan `/start <idSheet>_<kode>`, indeks `tg_<id>` di Script Properties, cek ulang ke `TELEGRAM_PENGGUNA` tiap pesan, mode lama `SPREADSHEET_ID` tetap jalan dengan token pemilik. Diuji (termasuk serangan: kode salah/kedaluwarsa, spreadsheet tidak dibagikan).
- [x] **8c** Aplikasi: `config.js` (`botTelegram`, `emailBot`), layar persetujuan, bagikan ke akun robot (sekali) lalu buka link, dan akses robot dicabut saat akun Telegram terakhir diputus / anggota dikeluarkan. Diuji.
- [~] **8d** Batas 300 pesan per buku per hari: selesai. Kunci antrean masih satu untuk semua (hanya dipakai sebentar saat ubah/hapus); dipecah per pengguna kalau nanti terasa lambat.
- [x] **8e** Privasi & dokumentasi: `privasi.html`, README, PEMILIK.md (setup service account, keamanan, troubleshooting).
- [ ] **8f** Uji sungguhan setelah pemilik memasang akun robot: dua keluarga di satu bot; putuskan / keluarkan anggota langsung memutus bot; spreadsheet yang aksesnya dicabut tidak bisa dipakai lagi.

**Diputuskan:** pengingat tagihan harian lewat bot dikerjakan nanti, setelah 8a–8f stabil.

## Langkah 9 — Menarik pengguna baru

Hasil diskusi 9 Nov 2026: yang paling menambah nilai jual adalah membuat orang mudah mencoba, lalu memberi alasan untuk mendaftar.

- [x] **Mode coba tanpa akun** (`web/assets/demo.js`): tombol *Coba dulu tanpa akun* di layar masuk, atau buka `?coba`. GOOGLE.api diganti Google tiruan di HP (spreadsheet & Drive di memori + localStorage), berisi data contoh 3 bulan satu keluarga (dua anggota, tagihan rutin, tabungan, piutang, aset, catatan). Fitur yang butuh Google ditahan dengan ajakan masuk. *Pakai sungguhan* / *Akhiri mode coba* menghapus data contoh. Diuji di Chrome headless (catat, ubah, hapus/urungkan, buku baru, anggota, hapus banyak, keluar).
- [x] **Halaman pengenalan** `web/tentang.html`: pembuka + tiruan layar HP, tiga pembeda (data di Drive sendiri, dicatat bersama, gratis), fitur, cara mulai, tanya-jawab, pratinjau tautan WhatsApp (og:*). Ditautkan dari layar masuk.
- [ ] Masuk Play Store (TWA) + domain sendiri + verifikasi branding Google.
- [ ] Impor mutasi rekening (PDF/CSV e-statement) dengan AI + rekonsiliasi saldo.

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
2. **Satu bot untuk semua** — perlu desain ulang: peta `chat_id → spreadsheet`, dan bot harus bisa membuka spreadsheet tiap keluarga (mis. pemilik spreadsheet membagikan ke akun bot) → menyangkut privasi & kuota Apps Script. **Dirancang di Langkah 8.**

Kerjakan Langkah 1–4 dulu; bot menyusul sebagai fitur opsional (sekalian untuk pengingat harian). Untuk sekarang, bot cukup ditandai "fitur khusus pemilik" saat aplikasi dibagikan.

## Sumber riset

- [Google: memilih scope Drive API](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google: memilih scope Sheets API](https://developers.google.com/workspace/sheets/api/scopes)
- [Jurnal.id: aplikasi keuangan pribadi](https://www.jurnal.id/id/blog/aplikasi-keuangan-pribadi-android-user-friendly)
- [Fanruan: rekomendasi aplikasi budgeting](https://fanruan.com/id/blog/rekomendasi-10-aplikasi-budgeting-terbaik-keuangan-pribadi)
- [Investasiku: aplikasi keuangan terbaik](https://www.investasiku.id/eduvest/rencana/aplikasi-keuangan-terbaik)
- [Ramsey Solutions: perbandingan aplikasi budgeting](https://ramseysolutions.com/budgeting/budgeting-apps-comparison)
