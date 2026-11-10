// Dompet Keluarga · Semua aksi tombol (data-aksi), mode coba, PWA & pembaruan otomatis, log update.
// Bagian dari aplikasi (dimuat berurutan di index.html: app.js → app-*.js → muda.js; semua berbagi lingkup global).

// ---------- Aksi (event delegation) ----------

const AKSI = {
  'tab': el => {
    if (!$('#sheet').hidden) tutupSheet(); // dari tombol di dalam lembar (cari fitur, rincian periode)
    S.tab = el.dataset.tab; render(); window.scrollTo(0, 0);
  },
  'bulan': async el => {
    const d = keTanggal(S.bulan);
    d.setMonth(d.getMonth() + Number(el.dataset.geser));
    S.bulan = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    loading(true);
    await muat();
    loading(false);
  },
  'bulan-ini': async () => {
    S.bulan = ''; // kosong = periode berjalan, ditentukan server dari tanggal gajian
    loading(true);
    await muat();
    loading(false);
  },
  'filter-tipe': el => { S.filterTipe = el.dataset.tipe; render(); },

  'tambah-trx': () => {
    const draf = bacaDrafTrx();
    tulisHp(kunciDrafTrx(), null);
    bukaFormTrx(null, draf || undefined);
    if (draf) toast(T('📝 Isian tadi dipulihkan') + (draf.jumlah ? ' · ' + rp(draf.jumlah) : ''), false, { label: T('Mulai baru'), aksi: 'buang-draf-trx' });
  },
  'buang-draf-trx': () => { $('#toast').hidden = true; tulisHp(kunciDrafTrx(), null); F = null; bukaFormTrx(null); },
  'buang-draf-catatan': () => {
    $('#toast').hidden = true;
    if (!S.formCatatan) return;
    buangDrafCatatan(S.formCatatan.id);
    const c = S.formCatatan.id ? daftarCatatan().find(x => x.id === S.formCatatan.id) : null;
    bukaFormCatatan(c || null, S.formCatatan.tanggal);
  },
  'keluar-catatan': () => { tinggalkanFormCatatan(); bukaKalender(S.formCatatan && S.formCatatan.tanggal); },
  'lanjut-draf-catatan': () => {
    $('#toast').hidden = true;
    const d = S.drafTerakhir || {};
    const c = d.id ? daftarCatatan().find(x => x.id === d.id) : null;
    bukaFormCatatan(c || null, d.tanggal);
  },
  // #1 Sekali ketuk
  'ketuk-catat': el => catatSekaliKetuk(el),
  'urungkan-ketuk': el => {
    const id = trxSekaliKetuk;
    trxSekaliKetuk = null;
    $('#toast').hidden = true;
    if (id) kirim(el, 'hapusTransaksi', [id], T('Dibatalkan ↩️'));
  },
  // #2 Item belanja dicentang → form pengeluaran terisi
  'tugas-jadi-trx': () => {
    $('#toast').hidden = true;
    const teks = tugasUntukTrx;
    if (!teks) return;
    bukaFormTrx(null, { tipe: TIPE.KELUAR, catatan: teks, kategori: tebakKategori(TIPE.KELUAR, teks) }, T('Catat belanja'));
    setTimeout(() => $('#f-jumlah') && $('#f-jumlah').focus(), 250);
  },
  'edit-trx': el => {
    if (S.pilih) {
      const id = el.dataset.id;
      if (S.pilih.has(id)) S.pilih.delete(id); else S.pilih.add(id);
      if (!S.pilih.size) S.pilih = null;
      return render();
    }
    bukaDetailTrx(cariTrxId(el.dataset.id));
  },
  'buka-filter': () => bukaFilter(),
  'pilih-rentang': el => {
    F.rentang = el.dataset.k;
    el.parentNode.querySelectorAll('.chip').forEach(b => b.classList.toggle('aktif', b === el));
    $('#filter-kustom').hidden = F.rentang !== 'kustom';
  },
  'terapkan-filter': () => {
    const nilai = id => ($(id) ? $(id).value : '');
    const f = {
      rentang: F.rentang, dari: nilai('#fl-dari'), sampai: nilai('#fl-sampai'),
      kategori: nilai('#fl-kategori'), dompet: nilai('#fl-dompet'), oleh: nilai('#fl-oleh'), lampiran: S.filter.lampiran,
    };
    if (f.rentang === 'kustom' && !f.dari && !f.sampai) return toast(T('Isi tanggal dari atau sampai.'), true);
    if (f.dari && f.sampai && f.dari > f.sampai) return toast(T('Tanggal "dari" harus sebelum "sampai".'), true);
    S.filter = f;
    S.batasRiwayat = 200;
    tutupSheet();
    render();
  },
  'reset-filter': () => { S.filter = Object.assign({}, FILTER_KOSONG); S.batasRiwayat = 200; tutupSheet(); render(); },
  'hapus-filter': el => {
    S.filter = Object.assign({}, S.filter, el.dataset.k === 'rentang' ? { rentang: 'periode' } : { [el.dataset.k]: '' });
    render();
  },
  'riwayat-lagi': () => { S.batasRiwayat += 200; render(); },
  'tutup-sheet': () => tutupSheet(),
  'f-tipe': el => {
    bacaFieldTrx();
    if (F.tipe !== el.dataset.tipe) { F.tipe = el.dataset.tipe; F.kategori = ''; }
    renderFormTrx();
  },
  'foto-struk': el => {
    // Tanpa kunci Gemini, struk tetap dibaca dengan OCR saja.
    bacaFieldTrx();
    sumberStruk = 'form';
    $(el.dataset.kamera ? '#input-struk-kamera' : '#input-struk').click();
  },
  'tinjau-struk': el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (!job || job.status !== 'siap') return;
    bukaFormTrx(null, null, T('Tinjau Struk'));
    terapkanStruk(job);
    tampilRingkasanStruk();
  },
  'ulangi-struk': el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (job) jalankanStruk(job);
  },
  'buang-struk': async el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (job && job.jenis === 'simpan' && !await tanya(T('Buang transaksi {jumlah} yang gagal disimpan ini?', { jumlah: rp(job.t.jumlah) }), T('Buang'))) return;
    if (job && job.status === 'siap' && !await tanya(T('Buang hasil struk ini tanpa menyimpannya?'), T('Buang'))) return;
    hapusJob(el.dataset.id);
  },
  'buka-simpan': async el => {
    const job = ANTRIAN.find(j => j.id === Number(el.dataset.id));
    if (!job) return;
    if (!$('#sheet').hidden) {
      if (F && !await tanya(T('Tutup form yang sedang dibuka? Isiannya akan hilang.'), T('Tutup'))) return;
      tutupSheet();
    }
    bukaLagiSimpan(job);
  },
  'f-pilih-jumlah': el => { bacaFieldTrx(); F.jumlah = Number(el.dataset.jumlah); renderFormTrx(); },
  'gemini': () => bukaFormGemini(),
  'ajak-ai-lanjut': () => teruskanTanpaAi(),
  'ajak-ai-tolak': () => { tulisHp('dk_ajak_ai', 'tolak'); toast(T('Oke. AI tetap bisa diaktifkan kapan saja di ⚙️ → Fitur AI.')); teruskanTanpaAi(); },
  'telegram': () => bukaFormTelegram(),
  'cari-global': () => bukaCariGlobal(),
  'log-update': () => { $('#toast').hidden = true; bukaLogUpdate(); },
  'aktivitas': () => bukaAktivitas(),
  'saran-rutin': el => {
    const x = (S.data.saranRutin || []).find(s => s.kunci === el.dataset.kunci);
    if (!x) return;
    // Jatuh tempo berikutnya: tanggal yang sama bulan ini kalau belum lewat, selain itu bulan depan.
    const kini = keTanggal(hariIni());
    let d = new Date(kini.getFullYear(), kini.getMonth(), Math.min(x.hari, 28));
    if (d < kini) d = new Date(kini.getFullYear(), kini.getMonth() + 1, Math.min(x.hari, 28));
    bukaFormRutin();
    Object.assign(F, { nama: x.nama, tipe: x.tipe, jumlah: x.jumlah, kategori: x.kategori, dompet: x.dompet, catatan: x.nama,
      tanggal: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') });
    renderFormTrx();
  },
  'tolak-saran': el => {
    let tolak = [];
    try { tolak = JSON.parse(bacaHp(kunciSaranDitolak())) || []; } catch (e) { tolak = []; }
    tolak.push(el.dataset.kunci);
    tulisHp(kunciSaranDitolak(), JSON.stringify(tolak.slice(-50)));
    render();
    toast(T('Oke, tidak disarankan lagi'));
  },
  'rekap-telegram': async el => {
    const nyala = S.data.telegram.rekap === false;
    if (await kirim(el, 'aturRekapTelegram', [nyala], nyala ? T('Rekap bulanan dinyalakan 📊') : T('Rekap bulanan dimatikan'))) bukaFormTelegram();
  },
  'pengingat-telegram': async el => {
    const nyala = S.data.telegram.pengingat === false;
    if (await kirim(el, 'aturPengingatTelegram', [nyala], nyala ? T('Pengingat harian dinyalakan 🔔') : T('Pengingat harian dimatikan'))) bukaFormTelegram();
  },
  'cadangan': () => bukaCadangan(),
  'cadangkan-sekarang': async el => {
    el.disabled = true;
    loading(true);
    try {
      const h = await api('cadangkan', true);
      S.data.cadangan = { tgl: h.tgl, oleh: h.oleh };
      const info = $('#info-cadangan');
      if (info) info.innerHTML = teksCadangan(S.data.cadangan, h.folder);
      toast(T('Cadangan dibuat di Google Drive ✔'));
    } catch (e) {
      if (!(e instanceof GOOGLE.PerluMasuk)) toast(T('Cadangan gagal: {galat}', { galat: pesanError(e) }), true);
    }
    el.disabled = false;
    loading(false);
  },
  'unduh-csv': async el => {
    el.disabled = true;
    loading(true);
    try { await unduhCsv(); } catch (e) { if (!(e instanceof GOOGLE.PerluMasuk)) toast(T('Gagal mengunduh: {galat}', { galat: pesanError(e) }), true); }
    el.disabled = false;
    loading(false);
  },
  'kode-telegram': async el => {
    const t = S.data.telegram;
    // Bot bersama: buku ini akan dibagikan ke akun robot bot → minta persetujuan dulu.
    if (t.bersama && !t.pengguna.length && !await tanya(
      S.data.namaBuku
        ? T('Supaya bisa mencatat lewat Telegram, spreadsheet buku "{buku}" dibagikan (bisa mengubah) ke akun bot Dompet Keluarga. Pengelola bot secara teknis bisa membuka isinya. Akses bot dicabut otomatis saat semua akun Telegram diputus.', { buku: namaT(S.data.namaBuku) })
        : T('Supaya bisa mencatat lewat Telegram, spreadsheet buku "ini" dibagikan (bisa mengubah) ke akun bot Dompet Keluarga. Pengelola bot secara teknis bisa membuka isinya. Akses bot dicabut otomatis saat semua akun Telegram diputus.'),
      T('Setuju & lanjut'), true)) return;
    el.disabled = true;
    loading(true);
    try {
      const r = await api('buatKodeTelegram');
      bukaFormTelegram(r.kode, r.muatan);
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'putus-telegram': async el => {
    if (!await tanya(T('Putuskan akun Telegram ini dari Dompet Keluarga?'), T('Putuskan'))) return;
    if (await kirim(el, 'putuskanTelegram', [el.dataset.id], T('Akun Telegram diputuskan'))) bukaFormTelegram();
  },
  'simpan-gemini': async el => {
    const kunci = $('#g-kunci').value.trim();
    if (!kunci) return toast(T('Tempel kunci API-nya dulu.'), true);
    if (await kirim(el, 'tambahKunciGemini', [kunci], T('Kunci Gemini tersimpan ✔'))) bukaFormGemini();
  },
  'hapus-gemini': async el => {
    if (!await tanya(T('Hapus kunci API {kunci}?', { kunci: el.dataset.kunci }), T('Hapus'))) return;
    if (await kirim(el, 'hapusKunciGemini', [el.dataset.kunci], T('Kunci API dihapus'))) bukaFormGemini();
  },
  'f-kategori': el => {
    bacaFieldTrx();
    F.kategori = el.dataset.nama;
    // Dompet ikut kebiasaan kategori ini (mis. Transportasi → GoPay), kecuali dompet sudah dipilih sendiri.
    if (!F.id && !F.dompetDipilih && F.tipe !== TIPE.TRANSFER) F.dompet = dompetIngatan(F.tipe, F.kategori) || F.dompet;
    renderFormTrx();
  },
  'f-dompet': el => { bacaFieldTrx(); F.dompet = el.dataset.nama; F.dompetDipilih = true; renderFormTrx(); },
  'f-tanggal-cepat': el => {
    bacaFieldTrx();
    if (el.dataset.nilai === 'pilih') {
      F.tanggalPilih = true;
      renderFormTrx();
      const i = $('#f-tanggal');
      if (i) { i.focus(); try { i.showPicker && i.showPicker(); } catch (e) { /* tidak didukung */ } }
      return;
    }
    F.tanggal = el.dataset.nilai;
    F.tanggalPilih = false;
    renderFormTrx();
  },
  'f-opsi-lain': () => { bacaFieldTrx(); F.opsiLain = !F.opsiLain; renderFormTrx(); },
  'f-tujuan': el => { bacaFieldTrx(); F.dompetTujuan = el.dataset.nama; renderFormTrx(); },
  'simpan-trx': el => {
    bacaFieldTrx();
    if (!F.jumlah) return toast(T('Isi jumlahnya dulu.'), true);
    if (F.tipe !== TIPE.TRANSFER && !F.kategori) return toast(T('Pilih kategorinya dulu.'), true);
    if (F.tipe === TIPE.TRANSFER && (!F.dompetTujuan || F.dompetTujuan === F.dompet)) return toast(T('Pilih dompet tujuan yang berbeda.'), true);
    // Baru & mirip transaksi yang sudah ada (mis. dicatat juga oleh pasangan): minta konfirmasi sekali.
    if (!F.id && !F.modeRutin) {
      const m = trxMirip(F);
      if (m && F.miripDicek !== m.id) {
        F.mirip = m;
        F.miripDicek = m.id;
        renderFormTrx();
        getar();
        const p = $('.peringatan-mirip');
        if (p) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
    }
    const t = F;
    t._menyimpan = true; // lembar ditutup karena tersimpan → bukan draf
    catatPemakaian(t);
    tulisHp(kunciDrafTrx(), null);
    const dasar = F.id ? T('Transaksi diperbarui ✔') : T('Transaksi tersimpan ✔');
    const pesan = () => { const a = pesanAnggaran(t); toast(a ? dasar + ' · ' + a.teks : dasar, a && a.lewat); };
    const dariJob = t.dariJob;
    // ID transaksi baru dibuat di HP, supaya kiriman ulang (setelah sinyal putus) tidak membuat data dobel.
    if (!t.id && !t.idBaru) t.idBaru = crypto.randomUUID();
    const tunda = () => { simpanTertunda(t); if (dariJob) hapusJob(dariJob); return true; };
    if (!t.id && (S.offline || !navigator.onLine)) return tunda();
    t.galatSimpan = '';
    // Ada foto baru: unggah ke Drive lama, jadi disimpan di latar belakang dan form langsung ditutup.
    if (t.lampiranData) return simpanDiLatar(t, pesan);
    kirim(el, 'simpanTransaksi', [t], pesan, e => !t.id && e.jaringan && tunda())
      .then(ok => { if (ok && dariJob) hapusJob(dariJob); if (!ok) t._menyimpan = false; });
  },
  'bagikan-laporan': async el => {
    el.disabled = true;
    try { await bagikanLaporan(el.dataset.bulan); } catch (e) { toast(T('Gambar tidak bisa dibuat: {galat}', { galat: pesanError(e) }), true); }
    el.disabled = false;
  },
  'tema': el => { aturTema(el.dataset.t); render(); },
  'samar': () => { aturSamar(!modeSamar()); render(); },
  'atur-kunci': () => bukaFormKunci(),
  'simpan-kunci': async el => {
    const pin = $('#k-pin').value;
    if (!/^\d{4,6}$/.test(pin)) return toast(T('PIN harus 4–6 angka.'), true);
    if (pin !== $('#k-pin2').value) return toast(T('Kedua PIN belum sama.'), true);
    el.disabled = true;
    const k = { garam: keBase64(crypto.getRandomValues(new Uint8Array(16))), panjang: pin.length };
    // Sidik jari didaftarkan lebih dulu, selagi masih dalam ketukan pengguna (syarat browser).
    if ($('#k-bio') && $('#k-bio').checked) {
      try { k.bio = await daftarBio(); } catch (e) { toast(T('Sidik jari/wajah tidak bisa diaktifkan. PIN tetap dipakai.'), true); }
    }
    k.hash = await hashPin(pin, k.garam);
    tulisHp('dk_kunci', JSON.stringify(k));
    el.disabled = false;
    tutupSheet();
    render();
    toast(T('Kunci aplikasi aktif 🔒'));
  },
  'hapus-kunci': async () => {
    const k = kunciTersimpan();
    if (!k || (await hashPin($('#k-pin').value, k.garam)) !== k.hash) return toast(T('PIN salah.'), true);
    tulisHp('dk_kunci', null);
    tutupSheet();
    render();
    toast(T('Kunci aplikasi dimatikan'));
  },
  'pin': async el => {
    const k = kunciTersimpan();
    if (!k || pinDiketik.length >= k.panjang || sisaJedaPin()) return;
    pinDiketik += el.dataset.n;
    renderKunci();
    if (pinDiketik.length < k.panjang) return;
    if ((await hashPin(pinDiketik, k.garam)) === k.hash) {
      tulisHp('dk_pin_salah', null);
      return bukaKunci();
    }
    pinDiketik = '';
    getar();
    if (!catatPinSalah()) renderKunci(true);
  },
  'pin-hapus': () => { pinDiketik = pinDiketik.slice(0, -1); renderKunci(); },
  'buka-bio': async () => {
    try {
      await cekBio(kunciTersimpan().bio);
      tulisHp('dk_pin_salah', null);
      bukaKunci();
    } catch (e) {
      toast(T('Sidik jari/wajah gagal. Pakai PIN.'), true);
    }
  },
  'lupa-pin': async () => {
    if (!await tanya(T('Untuk membuka kunci tanpa PIN, Anda perlu keluar lalu masuk lagi dengan akun Google. Data tetap aman di Google Drive. Lanjutkan?'), T('Keluar & masuk lagi'))) return;
    resetKunci();
  },
  'rincian-aman': () => bukaRincianAman(),
  'atur-periode': () => bukaFormPeriode(),
  'pilih-periode': el => {
    F.mulai = Number(el.dataset.n);
    document.querySelectorAll('.grid-tanggal button').forEach(b => b.classList.toggle('aktif', b === el));
    $('#contoh-periode').textContent = F.contoh(F.mulai);
  },
  'simpan-periode': el => {
    S.bulan = ''; // pindah ke periode berjalan menurut tanggal gajian yang baru
    S.tahun = new Date().getFullYear();
    kirim(el, 'simpanMulaiPeriode', [F.mulai], T('Periode gajian tersimpan ✔'));
  },
  'f-ulang': el => { bacaFieldTrx(); F.ulang = el.dataset.ulang; renderFormTrx(); },
  'f-favorit': el => {
    const f = kebiasaan().favorit[Number(el.dataset.i)];
    if (f) isiFormCepat(f);
  },
  'kelola-rutin': () => bukaDaftarRutin(),
  'tambah-rutin': () => bukaFormRutin(null),
  'edit-rutin': el => bukaFormRutin(daftarRutin().find(r => r.id === el.dataset.id)),
  'bayar-rutin': el => {
    const r = daftarRutin().find(x => x.id === el.dataset.id);
    if (!r) return;
    bukaFormTrx(null, {
      tipe: r.tipe, jumlah: r.jumlah, kategori: r.kategori, dompet: r.dompet, dompetTujuan: r.dompetTujuan,
      catatan: r.catatan || r.nama, dariRutin: r.id, berikutRutin: SERVER.tanggalBerikut(r.berikutnya, r.mulai, r.ulang),
    }, r.nama);
  },
  'lewati-rutin': async el => {
    if (!await tanya(T('Lewati tagihan ini tanpa mencatat transaksi? Jatuh temponya pindah ke {tanggal}.', { tanggal: tanggalPendek(F.berikutRutin) }), T('Lewati'), true)) return;
    kirim(el, 'majukanRutin', [F.dariRutin], T('Dilewati ✔ Berikutnya {tanggal}', { tanggal: tanggalPendek(F.berikutRutin) }));
  },
  'simpan-rutin': async el => {
    bacaFieldTrx();
    const salah = cekIsianTrx() || (!F.tanggal ? T('Isi tanggal jatuh tempo.') : '');
    if (salah) return toast(salah, true);
    const ok = await kirim(el, 'simpanRutin', [{
      id: F.idRutin, nama: F.nama, tipe: F.tipe, jumlah: F.jumlah, kategori: F.kategori, dompet: F.dompet,
      dompetTujuan: F.dompetTujuan, catatan: F.catatan, ulang: F.ulang, berikutnya: F.tanggal,
    }], T('Tagihan rutin tersimpan ✔'));
    if (ok) bukaDaftarRutin();
  },
  'hapus-rutin': async el => {
    if (!await tanya(T('Hapus tagihan rutin "{nama}"? Transaksi yang sudah dicatat tidak ikut terhapus.', { nama: F.nama || '' }), T('Hapus'))) return;
    if (await kirim(el, 'hapusRutin', [F.idRutin], T('Tagihan rutin dihapus'))) bukaDaftarRutin();
  },
  'kirim-tertunda': async () => {
    if (!GOOGLE.sudahMasuk()) return perluMasukLagi();
    loading(true);
    await kirimTertunda();
    loading(false);
    if (tertunda().some(t => !t.gagal)) toast(T('Belum bisa dikirim. Periksa koneksi internet.'), true);
  },
  'ulang-tertunda': el => {
    const t = tertunda().find(x => x.idBaru === el.dataset.id);
    tulisTertunda(tertunda().filter(x => x.idBaru !== el.dataset.id));
    render();
    if (t) {
      bukaFormTrx(null, { tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori, dompet: t.dompet,
        dompetTujuan: t.dompetTujuan, tanggal: t.tanggal, catatan: t.catatan }, T('Catat Ulang'));
    }
  },
  // Tanpa konfirmasi: kesalahan cukup diurungkan dari toast.
  'hapus-trx': el => kirim(el, 'hapusTransaksi', [F.id], baris => {
    trxTerhapus = baris;
    toast(T('Transaksi dihapus'), false, { label: T('Urungkan'), aksi: 'urungkan-hapus' });
  }),
  'urungkan-hapus': el => {
    const baris = trxTerhapus;
    trxTerhapus = null;
    $('#toast').hidden = true;
    if (baris) kirim(el, 'kembalikanTransaksi', [baris], T('Transaksi dikembalikan'));
  },

  'tambah-dompet': () => bukaFormDompet(null, JENIS.DOMPET),
  'tambah-tabungan': () => bukaFormDompet(null, JENIS.TABUNGAN),
  'tambah-aset': () => bukaFormDompet(null, JENIS.ASET),
  'lihat-emas': el => { const w = S.data.dompet.find(x => x.nama === el.dataset.nama); if (w) bukaDetailEmas(w); },
  'ubah-emas': el => bukaFormDompet(S.data.dompet.find(x => x.nama === el.dataset.nama)),
  'mutasi-emas': el => { const w = S.data.dompet.find(x => x.nama === el.dataset.nama); if (w) bukaMutasiEmas(w, el.dataset.arah); },
  'me-dompet': el => {
    if (!ME) return;
    ME.dompet = el.dataset.nama;
    document.querySelectorAll('[data-aksi="me-dompet"]').forEach(b => b.classList.toggle('aktif', b === el));
  },
  'simpan-mutasi-emas': async el => {
    if (!ME) return;
    const gram = angkaGram($('#me-gram').value);
    if (!(gram > 0)) return toast(T('Isi berat emasnya dalam gram (lebih dari 0).'), true);
    const rpTotal = angka($('#me-rp').value);
    if (ME.dompet && !rpTotal) return toast(T('Isi harga totalnya, atau pilih "Tanpa catat uang".'), true);
    const w = S.data.dompet.find(x => x.nama === ME.nama);
    const e = w && infoEmas(w);
    if (!ME.beli && e && gram > e.gram + 1e-9) return toast(T('Emasnya hanya {gram} gram.', { gram: String(e.gram).replace('.', ',') }), true);
    const input = { nama: ME.nama, gram: ME.beli ? gram : -gram, rp: rpTotal, dompet: ME.dompet, tanggal: $('#me-tgl').value || hariIni() };
    const nama = ME.nama;
    if (await kirim(el, 'mutasiEmas', [input], ME.beli ? T('Emas bertambah {gram} ✔', { gram: formatGram(gram) }) : T('Emas berkurang {gram} ✔', { gram: formatGram(gram) }))) {
      ME = null;
      const baru = S.data.dompet.find(x => x.nama === nama);
      if (baru) bukaDetailEmas(baru);
    }
  },
  'perbarui-harga-emas': async el => {
    const w = S.data.dompet.find(x => x.nama === el.dataset.nama);
    const e = w && infoEmas(w);
    if (!e) return;
    el.disabled = true;
    const ok = await muatHargaEmas([e.platform], true);
    if (!ok) toast(T('Harga {platform} belum bisa diambil. Coba lagi nanti.', { platform: namaPlatformEmas(e.platform) }), true);
    bukaDetailEmas(w);
    if (S.tab === 'dompet') render();
  },
  'jenis-aset': el => {
    F.modeEmas = el.dataset.v === 'emas';
    document.querySelectorAll('[data-aksi="jenis-aset"]').forEach(b => b.classList.toggle('aktif', b === el));
    $('#d-emas').hidden = !F.modeEmas;
    $('#d-grup-saldo').hidden = F.modeEmas;
    if (F.modeEmas && F.ikon === '💎') F.ikon = '🪙';
    if (!F.modeEmas && F.ikon === '🪙') F.ikon = '💎';
    if (F.modeEmas) gambarHargaFormEmas(true);
  },
  'emas-platform': el => {
    Object.assign(F.emas, bacaFormEmas(), { platform: el.dataset.v });
    document.querySelectorAll('[data-aksi="emas-platform"]').forEach(b => b.classList.toggle('aktif', b === el));
    gambarHargaFormEmas(true);
  },
  'edit-dompet': el => bukaFormDompet(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'buka-tabungan': el => bukaTabungan(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'simpan-dompet': el => {
    const tab = F.jenis === JENIS.TABUNGAN;
    const emasDipakai = F.jenis === JENIS.ASET && F.modeEmas;
    let emas = null;
    if (emasDipakai) {
      emas = bacaFormEmas();
      if (!(emas.gram > 0)) return toast(T('Isi berat emasnya dalam gram (lebih dari 0).'), true);
      if (!$('#d-nama').value.trim()) $('#d-nama').value = T('Emas {platform}', { platform: namaPlatformEmas(emas.platform) });
    }
    const nama = $('#d-nama').value.trim();
    if (!nama) return toast(tab ? T('Isi nama tabungan dulu.') : T('Isi nama dompet dulu.'), true);
    // Yang diisi adalah saldo sekarang; saldo awal dihitung mundur dari mutasi transaksi,
    // jadi riwayat transaksi tidak berubah. Field yang tidak disentuh → saldo awal tetap.
    // Emas: nilai sekarang = berat × harga jual (buyback) hari ini.
    const nilaiEmasBaru = emas ? nilaiDariEmas(emas) : null;
    const isian = $('#d-saldo') ? $('#d-saldo').value : F.saldoTampil; // form orang utang tidak punya isian saldo
    const saldoAwal = nilaiEmasBaru !== null ? nilaiEmasBaru - F.mutasi : isian === F.saldoTampil ? F.saldoAwal : angka(isian) - F.mutasi;
    kirim(el, 'simpanDompet', [{
      namaLama: F.namaLama, nama, ikon: F.ikon, jenis: F.jenis, emas: F.jenis === JENIS.ASET ? emas : undefined,
      saldoAwal,
      target: tab ? angka($('#d-target').value) : 0,
      tenggat: $('#d-tenggat') ? $('#d-tenggat').value : '',
    }], T('Tersimpan ✔'));
  },
  'lampiran-pilih': () => {
    bacaFieldTrx();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file || !F || !$('#form-trx')) return;
      try {
        const g = await kecilkanGambar(file);
        bacaFieldTrx();
        F.lampiranData = g.lampiran;
        F.lampiranThumb = g.thumb;
        renderFormTrx();
      } catch (e) {
        toast(pesanError(e), true);
      }
    };
    input.click();
  },
  'lampiran-hapus': () => {
    bacaFieldTrx();
    if (F.lampiranData) { F.lampiranData = ''; F.lampiranThumb = ''; } else if (F.lampiran) { F.lampiran = ''; F.hapusLampiran = true; }
    renderFormTrx();
  },
  'buku': () => bukaDaftarBuku(),
  'pindah-buku': el => {
    const b = (S.data.buku || []).find(x => x.id === el.dataset.id);
    gantiBuku('hubungkanDatabase', [el.dataset.id], T('Buku {nama} dibuka ✔', { nama: b ? b.nama : '' }));
  },
  'templat-buku': el => { $('#b-nama').value = TEMPLAT_BUKU[Number(el.dataset.i)]; },
  'buat-buku': () => {
    const nama = $('#b-nama').value.trim();
    if (!nama) return toast(T('Isi nama bukunya dulu.'), true);
    if ((S.data.buku || []).some(b => b.nama.toLowerCase() === nama.toLowerCase())) return toast(T('Buku "{nama}" sudah ada.', { nama }), true);
    gantiBuku('buatBuku', [nama], T('Buku {nama} dibuat ✔ Atur dompetnya di tab Dompet.', { nama }));
  },
  'lupakan-buku': async el => {
    const b = (S.data.buku || []).find(x => x.id === el.dataset.id);
    if (!await tanya(b ? T('Hapus "{nama}" dari daftar Anda? Buku ini milik orang lain, jadi isinya tidak berubah. Anda bisa menambahkannya lagi lewat "Cek undangan" selama masih diberi akses.', { nama: b.nama }) : T('Hapus "buku ini" dari daftar Anda? Buku ini milik orang lain, jadi isinya tidak berubah. Anda bisa menambahkannya lagi lewat "Cek undangan" selama masih diberi akses.'), T('Hapus dari daftar'))) return;
    if (await kirim(el, 'lupakanBuku', [el.dataset.id], T('Dihapus dari daftar'))) bukaDaftarBuku();
  },
  'hapus-buku': async el => {
    const b = (S.data.buku || []).find(x => x.id === el.dataset.id);
    const nama = b ? b.nama : T('buku ini');
    if (!await tanya(T('Hapus buku "{nama}"? Buku hilang dari daftar Anda, dan spreadsheet-nya di Google Drive diberi nama "… - deleted". Datanya tidak hilang dan masih bisa dipulihkan dari Drive. Anggota lain akan melihat buku ini sebagai "dihapus".', { nama }), T('Hapus buku'))) return;
    if (await kirim(el, 'hapusBuku', [el.dataset.id], T('Buku {nama} dihapus', { nama }))) bukaDaftarBuku();
  },
  'cek-undangan': async el => {
    el.disabled = true;
    try {
      const ids = await GOOGLE.pilihSpreadsheet('', { undangan: true, banyak: true });
      if (!ids.length) return;
      loading(true);
      const hasil = await api('tambahBuku', ids);
      loading(false);
      const ok = hasil.filter(h => !h.pesan);
      const lewat = hasil.filter(h => h.pesan);
      if (lewat.length) toast((lewat.length > 1 ? T('{n} file dilewati.', { n: lewat.length }) + ' ' : '') + lewat[0].pesan + '.', true);
      if (ok.length === 1) await gantiBuku('hubungkanDatabase', [ok[0].id], T('Bergabung ke buku {nama} ✔', { nama: ok[0].nama }));
      else if (ok.length > 1) bukaPilihBukuUndangan(ok);
    } catch (e) {
      // Sesi habis sebelum jendela Google terbuka (bukan lewat api): tampilkan kartu "Lanjutkan sebagai …".
      if (e instanceof GOOGLE.PerluMasuk) perluMasukLagi();
      else toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'buka-undangan': el => gantiBuku('hubungkanDatabase', [el.dataset.id], T('Buku {nama} dibuka ✔', { nama: el.dataset.nama })),
  'buka-zakat': () => bukaZakat(),
  'hitung-zakat': () => { tulisHp('dk_harga_emas', String(angka($('#z-emas').value) || '') || null); bukaZakat(); },
  'catat-zakat': el => {
    // Kategori sosial/donasi kalau ada; kalau tidak, biarkan pengguna memilih.
    const k = S.data.kategori.find(x => x.tipe === TIPE.KELUAR && /zakat|sosial|donasi|sedekah/i.test(x.nama));
    bukaFormTrx(null, { tipe: TIPE.KELUAR, jumlah: Number(el.dataset.jumlah), kategori: k ? k.nama : '',
      catatan: el.dataset.jenis === 'maal' ? T('Zakat maal') : T('Zakat penghasilan {bulan}', { bulan: namaBulan(S.bulan) }) }, T('Bayar Zakat'));
  },
  'templat-tabungan': el => {
    const [ikon, nama] = TEMPLAT_TABUNGAN[Number(el.dataset.i)];
    $('#d-nama').value = nama;
    F.ikon = ikon;
    document.querySelectorAll('.grid-ikon button').forEach(b => b.classList.toggle('aktif', b.dataset.ikon === ikon));
    $('#d-target').focus();
  },
  'templat-rutin': el => {
    const [, nama, tipe] = TEMPLAT_RUTIN[Number(el.dataset.i)];
    bacaFieldTrx();
    if (F.tipe !== tipe) { F.tipe = tipe; F.kategori = ''; }
    F.nama = nama;
    F.kategori = tebakKategori(tipe, nama) || F.kategori;
    if (!F.catatan) F.catatan = nama;
    renderFormTrx();
    $('#f-jumlah').focus();
  },
  'buka-patungan': () => {
    bacaFieldTrx();
    bukaFormPatungan({ total: F.jumlah, kategori: F.kategori, dompet: F.dompet, tanggal: F.tanggal, catatan: F.catatan });
  },
  'p-tambah': () => {
    bacaFormPatungan();
    const nama = $('#p-nama').value.trim();
    if (!nama) return toast(T('Ketik nama temannya dulu.'), true);
    if (F.peserta.some(p => p.nama.toLowerCase() === nama.toLowerCase())) return toast(T('{nama} sudah ada.', { nama }), true);
    F.peserta.push({ nama, jumlah: 0 });
    bagiRata();
    renderFormPatungan();
    $('#p-nama').focus();
  },
  'p-hapus': el => { bacaFormPatungan(); F.peserta.splice(Number(el.dataset.i), 1); bagiRata(); renderFormPatungan(); },
  'p-rata': () => { bacaFormPatungan(); bagiRata(); renderFormPatungan(); },
  'p-ikut': () => { bacaFormPatungan(); F.ikut = !F.ikut; bagiRata(); renderFormPatungan(); },
  'simpan-patungan': el => {
    bacaFormPatungan();
    if (!F.total) return toast(T('Isi total tagihannya dulu.'), true);
    if (!F.peserta.length) return toast(T('Tambahkan minimal satu teman.'), true);
    const saya = bagianSaya();
    if (saya < 0 || F.peserta.reduce((a, p) => a + p.jumlah, 0) + saya !== F.total) return toast(T('Jumlah semua bagian belum sama dengan total.'), true);
    const n = F.peserta.length;
    kirim(el, 'catatPatungan', [{
      total: F.total, bagianSaya: saya, kategori: F.kategori, dompet: F.dompet, tanggal: F.tanggal, catatan: F.catatan, peserta: F.peserta,
    }], T('Patungan tercatat ✔ {n} orang berutang ke Anda', { n }));
  },
  'tambah-utang': el => bukaFormUtang(el.dataset.nama, el.dataset.arah),
  'buka-utang': el => bukaUtang(S.data.dompet.find(w => w.nama === el.dataset.nama)),
  'u-arah': el => { bacaFormUtang(); F.arah = el.dataset.arah; renderFormUtang(); },
  'u-dompet': el => { bacaFormUtang(); F.dompet = el.dataset.nama; renderFormUtang(); },
  'simpan-utang': el => {
    bacaFormUtang();
    if (!F.nama) return toast(T('Isi nama orangnya dulu.'), true);
    if (!F.jumlah) return toast(T('Isi jumlahnya dulu.'), true);
    if (!F.dompet) return toast(T('Pilih dompetnya dulu.'), true);
    kirim(el, 'catatUtang', [{ nama: F.nama, arah: F.arah, jumlah: F.jumlah, dompet: F.dompet, tanggal: F.tanggal, tenggat: F.tenggat, catatan: F.catatan }],
      F.arah === 'piutang' ? T('Pinjaman ke {nama} tercatat ✔', { nama: F.nama }) : T('Utang ke {nama} tercatat ✔', { nama: F.nama }));
  },
  'lunasi-utang': el => {
    const w = S.data.dompet.find(x => x.nama === el.dataset.nama);
    const pertama = dompetBiasa()[0];
    if (!w || !pertama) return;
    // Pelunasan = transfer balik: dia membayar → dari orang ke dompet kita; kita membayar → dari dompet ke orang.
    const dia = w.saldo > 0;
    bukaFormTrx(null, {
      tipe: TIPE.TRANSFER, jumlah: Math.abs(w.saldo),
      dompet: dia ? w.nama : pertama.nama, dompetTujuan: dia ? pertama.nama : w.nama,
      catatan: dia ? T('Pelunasan dari {nama}', { nama: w.nama }) : T('Bayar utang ke {nama}', { nama: w.nama }),
    }, dia ? T('Terima dari {nama}', { nama: w.nama }) : T('Bayar ke {nama}', { nama: w.nama }));
  },
  'hapus-dompet': async el => {
    if (await tanya(T('Hapus "{nama}"?', { nama: namaT(F.namaLama) }), T('Hapus'))) kirim(el, 'hapusDompet', [F.namaLama], T('Dihapus'));
  },
  'setor-tabungan': el => {
    const pertama = dompetBiasa()[0];
    if (!pertama) return toast(T('Buat dompet dulu sebagai sumber setoran.'), true);
    bukaFormTrx(null, { tipe: TIPE.TRANSFER, dompet: pertama.nama, dompetTujuan: el.dataset.nama }, T('Setor ke {nama}', { nama: namaT(el.dataset.nama) }));
  },
  'tarik-tabungan': el => {
    const pertama = dompetBiasa()[0];
    if (!pertama) return toast(T('Buat dompet dulu sebagai tujuan penarikan.'), true);
    bukaFormTrx(null, { tipe: TIPE.TRANSFER, dompet: el.dataset.nama, dompetTujuan: pertama.nama }, T('Tarik dari {nama}', { nama: namaT(el.dataset.nama) }));
  },

  'atur-anggaran': () => bukaFormAnggaran(),
  'rincian-anggaran': () => bukaRincianAnggaran(),
  'cepat-struk': () => {
    // Belum ada kunci Gemini: tawarkan AI dulu (struk terbaca jauh lebih lengkap); "Lanjut tanpa AI" → kamera.
    if (ajakAiDulu(AKSI['cepat-struk'])) return;
    // Langsung buka kamera (masih dalam ketukan pengguna supaya tidak diblokir browser);
    // struk dibaca di latar belakang tanpa membuka form. Di komputer, capture diabaikan → pemilih file.
    sumberStruk = 'cepat';
    $('#input-struk-kamera').click();
  },
  'cepat-transfer': () => bukaFormTrx(null, { tipe: TIPE.TRANSFER }, T('Transfer')),
  'cepat-suara': () => {
    if (suaraButuhAi()) return; // fitur suara wajib AI Gemini
    // Buka form lalu langsung nyalakan mic (masih dalam ketukan pengguna, syarat izin mikrofon).
    AKSI['tambah-trx']();
    if (F) F.tanpaFokus = true; // keyboard jangan terbuka selagi mendengarkan
    setTimeout(() => { const t = $('.tombol-suara'); if (t && !suaraAktif) AKSI.suara(t); }, 30);
  },
  'ringkas-periode': () => bukaRingkasPeriode(),
  'atur-pintasan': () => bukaAturPintasan(),
  'pilih-pintasan': el => {
    const p = pintasanDipilih();
    const i = p.indexOf(el.dataset.k);
    if (i >= 0) p.splice(i, 1);
    else if (p.length >= MAKS_PINTASAN) return toast(T('Maksimal {n} pintasan. Lepas salah satu dulu.', { n: MAKS_PINTASAN }), true);
    else p.push(el.dataset.k);
    simpanPintasan(p);
  },
  'pintasan-awal': () => simpanPintasan(null),
  'pakai-saran-anggaran': el => {
    const i = document.querySelector(`.input-anggaran[data-nama="${CSS.escape(el.dataset.nama)}"]`);
    if (i) { i.value = formatAngka(Number(el.dataset.n)); i.classList.add('terisi-otomatis'); hitungTotalAnggaran(); }
  },
  'isi-saran-anggaran': () => {
    let n = 0;
    document.querySelectorAll('[data-aksi="pakai-saran-anggaran"]').forEach(b => {
      const i = document.querySelector(`.input-anggaran[data-nama="${CSS.escape(b.dataset.nama)}"]`);
      if (i && !angka(i.value)) { i.value = formatAngka(Number(b.dataset.n)); i.classList.add('terisi-otomatis'); n++; }
    });
    hitungTotalAnggaran();
    toast(n ? T('{n} kategori diisi. Periksa lalu ketuk Simpan.', { n }) : T('Semua kategori yang disarankan sudah terisi.'));
  },
  'simpan-anggaran': el => {
    const peta = {};
    const amplop = {};
    document.querySelectorAll('.input-anggaran').forEach(i => { peta[i.dataset.nama] = angka(i.value); });
    document.querySelectorAll('.input-amplop').forEach(i => { amplop[i.dataset.nama] = i.checked; });
    kirim(el, 'simpanAnggaran', [peta, amplop], T('Anggaran tersimpan ✔'));
  },

  'tahun': async el => {
    S.tahun += Number(el.dataset.geser);
    S.bulan = S.tahun === new Date().getFullYear() ? periodeSekarang() : S.tahun + '-12';
    render();
    muat(); // muat ulang transaksi bulan terpilih untuk tab lain, di latar belakang
  },
  'jenis-grafik': el => {
    const g = $('#geser-grafik');
    if (g) g.scrollTo({ left: Number(el.dataset.i) * g.clientWidth, behavior: 'smooth' });
  },
  'lap-bulan': el => {
    S.bulan = el.dataset.bulan;
    render();
    muat();
  },
  'lap-kategori': el => { S.lapKategori = el.dataset.mode; render(); },
  'lap-tipe': el => { S.lapTipe = el.dataset.mode; render(); },
  'lap-banding': el => { S.lapBanding = el.dataset.mode; render(); },
  // ‹ › di atas kartu rincian: pindah periode (boleh melewati pergantian tahun), tidak melewati periode berjalan.
  'lap-geser': el => {
    const pilih = S.bulan.slice(0, 4) === String(S.tahun) ? S.bulan : S.tahun + '-12';
    const k = geserPeriode(pilih, Number(el.dataset.geser));
    if (k > periodeSekarang()) return;
    S.bulan = k;
    S.tahun = Number(k.slice(0, 4));
    render();
    muat();
  },
  'tren-kategori': el => bukaTrenKategori(el.dataset.nama, el.dataset.tipe),
  // Dari lembar tren kategori: buka Riwayat dengan filter kategori + periode itu (atau setahun).
  'lap-riwayat': el => {
    const { nama, tipe, rentang, bulan } = el.dataset;
    const mulai = S.data.mulaiPeriode || 1;
    const f = Object.assign({}, FILTER_KOSONG, { kategori: nama });
    if (rentang === 'tahun') {
      Object.assign(f, { rentang: 'kustom', dari: SERVER.rentangPeriode(S.tahun + '-01', mulai).awal, sampai: SERVER.rentangPeriode(S.tahun + '-12', mulai).akhir });
    } else if (S.data.bulan !== bulan) {
      const r = SERVER.rentangPeriode(bulan, mulai);
      Object.assign(f, { rentang: 'kustom', dari: r.awal, sampai: r.akhir });
    }
    S.filter = f;
    S.filterTipe = tipe;
    S.cari = '';
    S.batasRiwayat = 200;
    tutupSheet();
    S.tab = 'riwayat';
    render();
    window.scrollTo(0, 0);
  },
  'ai-laporan': async el => {
    const pilih = el.dataset.bulan;
    const asli = el.textContent;
    el.disabled = true;
    el.textContent = T('✨ Sedang menulis…');
    try {
      const teks = await api('ringkasLaporan', faktaLaporan(pilih), BAHASA);
      if (!teks) { toast(T('Belum ada kunci Gemini. Aktifkan di ⚙️ → Fitur AI (Gemini).'), true); return; }
      S.ringkasAi = Object.assign({}, S.ringkasAi, { [pilih]: teks });
      const kotak = $('#ringkas-ai');
      if (kotak && S.tab === 'laporan') {
        kotak.innerHTML = kotakRingkasAi(teks, pilih);
        const tombol = document.querySelector('#view .tombol-tambah[data-aksi="ai-laporan"]');
        if (tombol) tombol.remove();
      }
    } catch (e) {
      if (!(e instanceof GOOGLE.PerluMasuk)) toast(e.jaringan || !navigator.onLine ? T('Ringkasan AI butuh sinyal.') : pesanError(e), true);
    } finally {
      if (el.isConnected) { el.disabled = false; el.textContent = asli; }
    }
  },
  'bagikan-tahunan': async el => {
    el.disabled = true;
    try { await bagikanTahunan(S.tahun); } catch (e) { toast(T('Gambar tidak bisa dibuat: {galat}', { galat: pesanError(e) }), true); }
    el.disabled = false;
  },
  // Cetak lewat dialog browser (pilih "Simpan sebagai PDF"); tampilan cetak diatur di @media print (styles.css).
  'cetak-laporan': () => {
    document.querySelectorAll('#view details').forEach(d => { d.open = true; });
    window.print();
  },

  'kelola-kategori': () => bukaDaftarKategori(TIPE.KELUAR),
  'daftar-kategori': el => bukaDaftarKategori(el.dataset.tipe),
  'tambah-kategori': el => bukaFormKategori(null, el.dataset.tipe),
  'edit-kategori': el => bukaFormKategori(S.data.kategori.find(k => k.nama === el.dataset.nama && k.tipe === el.dataset.tipe)),
  'simpan-kategori': async el => {
    const nama = $('#k-nama').value.trim();
    if (!nama) return toast(T('Isi nama kategori dulu.'), true);
    const tipe = F.tipe;
    const ok = await kirim(el, 'simpanKategori', [{ namaLama: F.namaLama, tipeLama: F.tipeLama, nama, tipe, ikon: F.ikon }], T('Kategori tersimpan ✔'));
    if (ok) bukaDaftarKategori(tipe);
  },
  'hapus-kategori': async el => {
    if (!await tanya(T('Hapus kategori "{nama}"?', { nama: namaT(F.namaLama) }), T('Hapus'))) return;
    const tipe = F.tipeLama;
    const ok = await kirim(el, 'hapusKategori', [F.namaLama, F.tipeLama], T('Kategori dihapus'));
    if (ok) bukaDaftarKategori(tipe);
  },

  'setup-dompet': el => {
    const p = S.setup.pilih;
    const i = p.indexOf(el.dataset.nama);
    if (i >= 0) p.splice(i, 1);
    else p.push(el.dataset.nama);
    renderSetup();
  },
  'setup-lain': () => {
    const nama = $('#s-lain').value.trim();
    if (!nama) return toast(T('Ketik nama dompetnya dulu.'), true);
    const ada = semuaDompetSetup().find(([n]) => n.toLowerCase() === nama.toLowerCase());
    if (!ada) S.setup.lain.push(nama);
    const n = ada ? ada[0] : nama;
    if (!S.setup.pilih.includes(n)) S.setup.pilih.push(n);
    renderSetup();
  },
  'buat-db': async el => {
    bacaSetup();
    const st = S.setup;
    if (!st.pilih.length) return toast(T('Pilih minimal satu dompet.'), true);
    const dompet = semuaDompetSetup().filter(([n]) => st.pilih.includes(n))
      .map(([nama, ikon]) => ({ nama, ikon, saldoAwal: st.saldo[nama] || 0 }));
    el.disabled = true;
    loading(true);
    try {
      await api('buatDatabase', st.email, dompet);
      tulisHp('dk_tur_tunda', '1');
      await muat();
      toast(T('Siap dipakai ✔ Ketuk ＋ untuk mencatat transaksi pertama.'));
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
      loading(false);
    }
  },
  'pilih-db': async el => {
    el.disabled = true;
    try {
      await pilihDanHubungkan(el.dataset.id);
    } catch (e) {
      if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'lupakan-db': async () => {
    loading(true);
    try {
      await api('lupakanDatabase');
      S.data = null;
      S.gabung = '';
      await muat();
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      loading(false);
    }
  },
  'geser-tanggal': el => {
    const input = document.getElementById(el.dataset.untuk);
    if (!input) return;
    const d = keTanggal(input.value || hariIni());
    d.setDate(d.getDate() + Number(el.dataset.geser));
    input.value = tanggalIso(d);
    perbaruiHari(input);
  },
  'coba-lagi': async () => { loading(true); await muat(); loading(false); },
  'masuk': async el => {
    el.disabled = true;
    try {
      await GOOGLE.masuk(!!el.dataset.akunLain);
      await muatDariAwal();
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'lanjut-sesi': async el => {
    el.disabled = true;
    try {
      await setelahTersambung(await GOOGLE.masuk(), true);
    } catch (e) {
      loading(false);
      toast(pesanError(e), true);
    } finally {
      el.disabled = false;
    }
  },
  'keluar': async () => {
    if (DEMO.aktif()) {
      if (!await tanya(T('Akhiri mode coba? Semua data contoh dihapus dari HP ini.'), T('Akhiri'))) return;
      DEMO.selesai();
      S.data = null;
      keHalamanAwal();
      tampilMasuk();
      return;
    }
    const n = bacaLokal('tertunda', []).length; // semua buku, karena semuanya ikut terhapus
    if (!await tanya(n ? T('{n} transaksi belum terkirim dan akan hilang. Tetap keluar dari {email}?', { n, email: GOOGLE.email() }) : T('Keluar dari {email}?', { email: GOOGLE.email() }), T('Keluar'))) return;
    // Data yang tersimpan di HP ikut dihapus, karena HP bisa dipakai orang lain.
    tulisLokal('data', null);
    tulisLokal('tertunda', null);
    GOOGLE.keluar();
    S.data = null;
    keHalamanAwal();
    tampilMasuk();
  },

  'undang': () => { tandaiTips('undang'); bukaAnggota(); },
  'tutup-tips': () => { tandaiTips('tutup'); render(); },
  'keluarkan-anggota': async el => {
    if (!await tanya(T('Keluarkan {email}? Akun ini tidak bisa lagi membuka buku ini, melihat foto struknya, atau mencatat lewat bot Telegram. Transaksi yang sudah dicatatnya tetap ada.', { email: el.dataset.email }), T('Keluarkan'))) return;
    kirim(el, 'keluarkanAnggota', [el.dataset.id, el.dataset.email, el.dataset.buku || ''], T('Anggota dikeluarkan'));
  },
  'kirim-undangan': el => {
    const email = $('#u-email').value.trim();
    if (!email) return toast(T('Isi emailnya dulu.'), true);
    kirim(el, 'bagikanKe', [email, el.dataset.buku || ''], T('Undangan terkirim ✔ {email} akan menerima email dari Google.', { email }));
  },
  'anggota-buku': el => bukaAnggota(el.dataset.id),
  'salin-link': async () => {
    const input = $('#u-link');
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (e) {
      input.select();
      document.execCommand('copy');
    }
    toast(T('Link disalin ✔'));
  },

  'pasang-aplikasi': async () => {
    if (!ajakanPasang) return;
    ajakanPasang.prompt();
    await ajakanPasang.userChoice.catch(() => null);
    ajakanPasang = null;
    if (S.tab === 'lainnya') render();
  },

  'pilih-ikon': el => {
    F.ikon = el.dataset.ikon;
    F.ikonDipilih = true; // dipilih sendiri: jangan ditimpa tebakan dari nama dompet
    document.querySelectorAll('.grid-ikon button').forEach(b => b.classList.toggle('aktif', b === el));
  },
};

/**
 * Aksi yang tidak memicu perpanjangan sesi: login/kunci sendiri, dan aksi yang butuh "ketukan segar"
 * (kamera, bagikan, salin, sidik jari, pasang) — popup Google bisa memakai izin ketukan itu lebih dulu.
 */
const AKSI_TANPA_SEGARKAN = new Set([
  'masuk', 'lanjut-sesi', 'demo-mulai', 'demo-masuk', 'pilih-db', 'pin', 'pin-hapus', 'buka-bio', 'lupa-pin', 'simpan-kunci',
  'foto-struk', 'cepat-struk', 'lampiran-pilih', 'bagikan-laporan', 'bagikan-tahunan', 'cetak-laporan','salin-link', 'pasang-aplikasi', 'suara', 'cepat-suara', 'contoh-suara', 'ketuk-catat', 'tugas-jadi-trx', 'pakai-saran-anggaran', 'isi-saran-anggaran', 'buang-banyak', 'kilas-maju', 'kilas-mundur', 'kilas-tutup', 'kilas-bagikan', 'kilas-putar', 'ringkas-tanpa-ai', 'suara-catatan', 'ringkas-koreksi', 'ringkas-ulang', 'cek-undangan', 'kompas', 'lokasi-gps',
  'ajak-ai-lanjut', 'ajak-ai-tolak', // meneruskan ke kamera / mikrofon
]);

/**
 * Sesi login tersambung lagi (lewat tombol "Lanjutkan sebagai …" atau diam-diam saat mengetuk layar):
 * tutup kartu sesi lalu baca ulang data, kecuali sedang mengisi form.
 */
async function setelahTersambung(email, dariTombol) {
  if (!S.data || S.data.perluSetup) return muatDariAwal();
  if (email !== S.data.user) return muatDariAwal(); // ternyata akun lain
  const kartuTampil = !$('#sesi').hidden;
  $('#sesi').hidden = true;
  ulangiStrukTertunda('sesi');
  if ($('#sheet').hidden) {
    if (dariTombol) loading(true);
    await muat();
    loading(false);
    if (dariTombol || kartuTampil) toast(T('Tersambung lagi ✔'));
  } else if (dariTombol || kartuTampil) {
    toast(T('Tersambung lagi ✔ Silakan ulangi, isian Anda masih ada.'));
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-aksi]');
  // Sesi habis saat aplikasi dibuka lagi: ketukan apa pun (termasuk di luar tombol) dipakai untuk menyambung ulang.
  const segarkan = $('#kunci').hidden && (!el || !AKSI_TANPA_SEGARKAN.has(el.dataset.aksi))
    && (el || S.sesiHabis);
  if (segarkan) {
    const habis = !GOOGLE.sudahMasuk();
    const p = GOOGLE.segarkanKalauPerlu();
    if (p && habis) p.then(email => { if (email) setelahTersambung(email, false).catch(() => {}); });
  }
  if (!el || !AKSI[el.dataset.aksi]) return;
  e.preventDefault();
  if (DEMO.aktif() && AKSI_BUTUH_AKUN[el.dataset.aksi]) return tahanDemo(AKSI_BUTUH_AKUN[el.dataset.aksi]);
  AKSI[el.dataset.aksi](el, e);
});

// ---------- Mode coba (lihat demo.js) ----------

/** Aksi yang butuh akun Google sungguhan → pesan yang ditampilkan di mode coba. */
const PESAN_BUTUH_AKUN = T('Fitur ini memakai akun Google Anda, jadi baru bisa dipakai setelah masuk. Data contoh di mode coba tidak ikut dipindahkan.');
const PESAN_STRUK_DEMO = T('Baca foto struk memakai Google Drive akun Anda, jadi baru bisa dipakai setelah masuk. Di mode coba, coba catat lewat suara atau ketik cepat, mis. "bakso 25rb gopay".');
const AKSI_BUTUH_AKUN = {
  'foto-struk': PESAN_STRUK_DEMO, 'cepat-struk': PESAN_STRUK_DEMO,
  'kirim-undangan': PESAN_BUTUH_AKUN, 'keluarkan-anggota': PESAN_BUTUH_AKUN, 'salin-link': PESAN_BUTUH_AKUN,
  'telegram': PESAN_BUTUH_AKUN, 'kode-telegram': PESAN_BUTUH_AKUN,
  'cek-undangan': PESAN_BUTUH_AKUN, 'buka-undangan': PESAN_BUTUH_AKUN, 'pilih-db': PESAN_BUTUH_AKUN, 'setup-lain': PESAN_BUTUH_AKUN,
  'atur-kunci': PESAN_BUTUH_AKUN,
};

function mulaiDemo() {
  DEMO.mulai();
  tulisHp('dk_tur_tunda', '1'); // tur singkat setelah data contoh tampil
}

async function tahanDemo(pesan) {
  if (await tanya(pesan, T('Masuk dengan Google'))) masukDariDemo();
}

/** Keluar dari mode coba lalu langsung login Google (masih dalam ketukan yang sama, jadi popup tidak diblokir). */
async function masukDariDemo() {
  DEMO.selesai();
  S.data = null;
  try {
    await GOOGLE.masuk();
    await muatDariAwal();
  } catch (e) {
    tampilMasuk();
    toast(pesanError(e), true);
  }
}

Object.assign(AKSI, {
  'demo-mulai': async () => {
    mulaiDemo();
    await muatDariAwal();
    toast(T('Selamat mencoba! Semua angka di sini contoh, bebas diubah atau dihapus.'));
  },
  'demo-masuk': async () => {
    if (await tanya(T('Data contoh akan dihapus dan tidak ikut dipindahkan. Masuk dengan Google sekarang?'), T('Masuk dengan Google'))) masukDariDemo();
  },
});

['#input-struk', '#input-struk-kamera'].forEach(sel => $(sel).addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) mulaiStruk(file, sumberStruk === 'form', sumberStruk === 'cepat');
  sumberStruk = 'cepat';
}));

// Format ribuan saat mengetik nominal.
document.addEventListener('input', e => {
  if (e.target.type === 'date') perbaruiHari(e.target);
  if (['f-jumlah', 'd-saldo', 'd-target'].includes(e.target.id) || e.target.classList.contains('input-rp')) {
    e.target.value = formatAngka(angka(e.target.value));
    if (e.target.classList.contains('input-anggaran')) hitungTotalAnggaran();
  }
  if (e.target.id === 'cari') {
    S.cari = e.target.value;
    const tmp = document.createElement('div');
    tmp.innerHTML = viewRiwayat();
    $('#hasil-riwayat').innerHTML = tmp.querySelector('#hasil-riwayat').innerHTML;
  }
});

// Input cepat: "change" = Enter/selesai mengetik, atau memilih saran dari daftar.
document.addEventListener('change', e => {
  if (e.target.type === 'date') perbaruiHari(e.target); // sebagian pemilih tanggal hanya memicu "change"
  if (!F) return;
  if (F.patungan && e.target.id === 'p-total') { bacaFormPatungan(); renderFormPatungan(); return; }
  if (e.target.id === 'f-cepat' && e.target.value.trim()) {
    const h = bacaKetikCepat(e.target.value.trim());
    isiFormCepat(h);
    if (!h.jumlah) toast(T('Nominalnya belum terbaca. Contoh: bakso 25rb'), true);
  }
  // Catatan yang pernah dipakai → kategori terisi sendiri (tanpa render ulang, supaya ketukan berikutnya tidak hilang).
  if (e.target.id === 'f-catatan' && !F.kategori && F.tipe !== TIPE.TRANSFER) {
    const k = tebakKategori(F.tipe, e.target.value);
    const tombol = k && document.querySelector(`.pilihan[data-aksi="f-kategori"][data-nama="${CSS.escape(k)}"]`);
    if (tombol) {
      F.kategori = k;
      tombol.classList.add('aktif');
    }
  }
});

// ---------- Aplikasi terpasang (PWA) & pembaruan otomatis ----------
// Isi aplikasi dibuka dari cache service worker supaya langsung tampil (lihat sw.js). Versi isi cache
// dibandingkan dengan versi.txt di server (dibuat saat deploy); kalau server lebih baru, service worker
// diminta mengunduh versi baru dulu, lalu aplikasi dimuat ulang sendiri saat pengguna tidak mengisi apa pun.

const MODE_APLIKASI = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let ajakanPasang = null;
let versiAwal = null;      // versi isi aplikasi yang sedang berjalan
let pembaruanDitunda = false;
let pembaruanSiap = '';    // versi baru yang sudah diunduh ke cache, tinggal dimuat ulang
let sedangCekVersi = false;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/**
 * Versi isi yang sedang berjalan, dibaca SEKARANG (saat app.js dimuat) sebelum ada pembaruan cache.
 * null = halaman tidak dibuka dari cache service worker (mis. pertama kali), berarti sama dengan versi server.
 */
const versiDimuat = (async () => {
  try {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return null;
    const r = await caches.match('versi.txt');
    return r ? (await r.text()).trim() : null;
  } catch (e) {
    return null;
  }
})();

/** Minta service worker mengunduh versi `v` ke cache. true kalau cache sudah berisi versi itu. */
function siapkanVersi(v) {
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!sw) return Promise.resolve(true); // tanpa service worker: muat ulang langsung mengambil dari server
  return new Promise(ok => {
    const ch = new MessageChannel();
    const batas = setTimeout(() => ok(false), 60000);
    ch.port1.onmessage = e => {
      clearTimeout(batas);
      if (e.data && e.data.galat) console.warn('Pembaruan belum bisa diunduh:', e.data.galat);
      ok(!!(e.data && e.data.v === v));
    };
    sw.postMessage({ perbarui: true }, [ch.port2]);
  });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  ajakanPasang = e;
  if (S.data && S.tab === 'lainnya') render();
});
window.addEventListener('appinstalled', () => {
  ajakanPasang = null;
  toast(T('Aplikasi terpasang ✔ Buka dari layar utama HP'));
});

async function versiServer() {
  try {
    const r = await fetch('versi.txt', { cache: 'no-store' });
    return r.ok ? (await r.text()).trim() : null;
  } catch (e) {
    return null;
  }
}
const sedangSibuk = () => !$('#sheet').hidden || ANTRIAN.length > 0 || !$('#loading').hidden || ($('#sesi') && !$('#sesi').hidden);

// ---------- Log update (Apa yang baru) ----------
// web/changelog.json dibuat saat deploy dari judul pesan commit (.github/changelog.js).

/** Setelah aplikasi diperbarui: sekali tampilkan toast "Diperbarui ke v1.xx" dengan tombol ke log update. */
function umumkanVersi(v) {
  if (!/^\d+\.\d+$/.test(v)) return;
  const lama = bacaHp('dk_versi_lihat');
  tulisHp('dk_versi_lihat', v);
  if (!lama || lama === v) return; // pertama kali dipakai: tidak perlu diumumkan
  setTimeout(() => toast(T('✨ Diperbarui ke v{v}', { v }), false, { label: T('Lihat yang baru'), aksi: 'log-update' }), 2500);
}

/** Judul commit → poin-poin: dipecah di "; " dan huruf pertama dibesarkan. */
function poinLog(judul) {
  return String(judul).split(/;\s+/).map(x => x.trim()).filter(Boolean).map(x => x.charAt(0).toUpperCase() + x.slice(1));
}

async function bukaLogUpdate() {
  bukaSheet(T('Apa yang baru'), '<div class="kerangka k-daftar" style="margin-top:8px">' + '<div><i class="k-bulat kecil"></i><i class="k-garis"></i></div>'.repeat(5) + '</div>');
  let log = [];
  try {
    const r = await fetch('changelog.json', { cache: 'no-store' });
    if (r.ok) log = await r.json();
  } catch (e) { /* offline */ }
  if ($('#sheet-judul').textContent !== T('Apa yang baru')) return; // sudah ditutup / ganti lembar
  if (!log.length) {
    $('#sheet-isi').innerHTML = kosong('🆕', navigator.onLine ? T('Log update belum tersedia. Muncul setelah versi berikutnya ter-deploy.') : T('Butuh internet untuk memuat log update.'));
    return;
  }
  const sekarang = versiAwal || log[0].v;
  const tgl = t => keTanggal(t).toLocaleDateString(LOKAL, { day: 'numeric', month: 'long', year: 'numeric' });
  let tanggalSebelum = '';
  $('#sheet-isi').innerHTML = `
    <p class="info-kecil" style="text-align:left;margin-top:0">${T('Aplikasi diperbarui otomatis. Versi Anda: <b>{versi}</b>', { versi: esc(labelVersi() || 'v' + sekarang) })}</p>
    <div class="daftar-log">${log.slice(0, 60).map(x => {
      const kepala = x.tanggal !== tanggalSebelum ? `<h4 class="tanggal-log">${esc(tgl(x.tanggal))}</h4>` : '';
      tanggalSebelum = x.tanggal;
      return kepala + `<div class="item-log ${x.v === sekarang ? 'ini' : ''}">
        <span class="versi-log">v${esc(x.v)}</span>
        <ul>${poinLog(x.judul).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        ${x.v === sekarang ? `<span class="lencana-log">${T('Versi Anda')}</span>` : ''}
      </div>`;
    }).join('')}</div>`;
}

async function cekPembaruan() {
  if (sedangCekVersi) return;
  sedangCekVersi = true;
  try {
    const v = await versiServer();
    if (!v) return;
    if (!versiAwal) { versiAwal = (await versiDimuat) || v; umumkanVersi(versiAwal); }
    if (v === versiAwal) return;
    // Versi baru diunduh utuh ke cache dulu; gagal (mis. sinyal putus) → dicoba lagi di pengecekan berikutnya.
    if (pembaruanSiap !== v) {
      if (!await siapkanVersi(v)) return;
      pembaruanSiap = v;
    }
    if (!sedangSibuk()) return location.reload();
    if (!pembaruanDitunda) toast(T('Versi baru tersedia, dipasang setelah Anda selesai'));
    pembaruanDitunda = true;
  } finally {
    sedangCekVersi = false;
  }
}

// Mode samar & kunci aplikasi: dipasang saat dibuka, dan kunci lagi setelah ditinggal > 1 menit.
document.body.classList.toggle('samar', modeSamar());
kunciLayar();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    waktuDisembunyikan = Date.now();
    if (S.data && !S.data.perluSetup) simpanPosisi(); // waktu posisi dihitung dari saat ditinggal
  }
  else if (waktuDisembunyikan && Date.now() - waktuDisembunyikan > KUNCI_SETELAH_MS && $('#kunci').hidden) kunciLayar();
});

// Sinyal kembali → keluar dari mode offline & kirim transaksi tertunda (kalau sesi habis, minta lanjutkan dulu).
window.addEventListener('online', () => {
  if (!S.data || S.data.perluSetup) return;
  if (!GOOGLE.sudahMasuk()) return perluMasukLagi();
  ulangiStrukTertunda('sinyal');
  muat();
});
window.addEventListener('offline', () => {
  if (!S.data || S.data.perluSetup) return;
  S.offline = true;
  if ($('#sheet').hidden) render();
});

cekPembaruan();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') cekPembaruan(); });
setInterval(() => { if (document.visibilityState === 'visible') cekPembaruan(); }, 5 * 60 * 1000);
// Pembaruan yang tertunda langsung dipasang begitu form ditutup & antrian struk kosong.
setInterval(() => { if (pembaruanDitunda && !sedangSibuk()) location.reload(); }, 3000);
