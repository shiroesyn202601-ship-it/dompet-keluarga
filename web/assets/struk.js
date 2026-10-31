/**
 * Membaca foto struk secara berlapis, lalu hasilnya dicocokkan:
 *   1. "AI foto"  : Gemini membaca gambar langsung.
 *   2. "OCR + AI" : gambar → teks (OCR Google Drive) → teks disimpulkan Gemini.
 *   3. "OCR"      : teks OCR yang sama dibaca dengan aturan biasa (tanpa AI).
 * Lapis 1 berjalan bersamaan dengan OCR; lapis 2 dan 3 menunggu teks OCR.
 */
const STRUK = (() => {
  const MODEL = 'gemini-3.8-flash';
  const DRIVE = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const URUTAN = ['AI foto', 'OCR + AI', 'OCR'];

  /** opsi: { kategori: [nama kategori pengeluaran], kunci: [kunci API Gemini], model } */
  async function baca(base64, mime, opsi) {
    if (!/^image\/(jpeg|png|webp)$/.test(String(mime))) throw new Error('Format gambar tidak didukung.');
    const { kategori, kunci } = opsi;
    const model = opsi.model || MODEL;
    const hariIni = tanggalHariIni();
    const skema = skemaStruk(kategori);
    const mulai = giliranBerikut(kunci.length);
    console.log('bacaStruk: model ' + model + ', ' + kunci.length + ' kunci, gambar ' + Math.round(base64.length * 0.75 / 1024) + ' KB');

    const hasil = []; // { sumber, jumlah, tanggal, kategori, catatan }
    const gagal = []; // pesan error per lapis, untuk pesan akhir

    const dariAi = sumber => h => {
      console.log('bacaStruk: ' + sumber + ' →', h);
      const jumlah = Math.round(Number(h.jumlah) || 0);
      if (jumlah > 0) {
        hasil.push({
          sumber,
          jumlah,
          tanggal: tanggalWajar(h.tanggal, hariIni),
          kategori: kategori.indexOf(h.kategori) >= 0 ? h.kategori : '',
          catatan: String(h.catatan || '').trim().slice(0, 120),
        });
      }
    };
    const catatGagal = sumber => e => {
      console.error('bacaStruk: ' + sumber + ' gagal:', e);
      gagal.push(e.message);
    };

    const tugasFoto = kunci.length
      ? jalankanGemini(kunci, mulai, model, [{ inlineData: { mimeType: mime, data: base64 } }, { text: petunjukStruk('gambar', hariIni) }], skema)
        .then(dariAi('AI foto'), catatGagal('AI foto'))
      : null;

    const tugasOcr = ocrDrive(base64, mime).then(async teks => {
      console.log('bacaStruk: teks OCR\n' + teks.slice(0, 3000));
      const aturan = tebakDariTeks(teks, hariIni);
      if (aturan.jumlah) hasil.push(Object.assign({ sumber: 'OCR' }, aturan));
      if (kunci.length && teks.trim()) {
        const parts = [{ text: petunjukStruk('teks', hariIni) + '\n\nTeks OCR:\n"""\n' + teks.slice(0, 8000) + '\n"""' }];
        await jalankanGemini(kunci, mulai, model, parts, skema).then(dariAi('OCR + AI'), catatGagal('OCR + AI'));
      }
    }, catatGagal('OCR'));

    await Promise.all([tugasFoto, tugasOcr]);

    if (!hasil.length) {
      const alasan = gagal.filter(g => /Kunci API|Kuota|login/i.test(g))[0];
      throw new Error(alasan || 'Total belanja tidak ditemukan di gambar. Coba foto ulang dengan lebih terang dan lurus.');
    }
    return gabungHasil(hasil);
  }

  /** Total yang paling banyak disepakati menang. */
  function gabungHasil(hasil) {
    hasil.sort((a, b) => URUTAN.indexOf(a.sumber) - URUTAN.indexOf(b.sumber));

    const grup = [];
    hasil.forEach(h => {
      const g = grup.find(x => x.jumlah === h.jumlah);
      if (g) g.sumber.push(h.sumber);
      else grup.push({ jumlah: h.jumlah, sumber: [h.sumber] });
    });
    // Paling banyak suara dulu; kalau seri, urutan prioritas lapis (sudah terurut) dipertahankan.
    grup.sort((a, b) => b.sumber.length - a.sumber.length);

    // Field lain diambil dari lapis yang totalnya menang dulu, baru dari lapis lain.
    const menang = grup[0].sumber;
    const urut = hasil.filter(x => menang.includes(x.sumber)).concat(hasil.filter(x => !menang.includes(x.sumber)));
    const ambil = field => (urut.find(x => x[field]) || {})[field] || '';
    return {
      jumlah: grup[0].jumlah,
      tanggal: ambil('tanggal'),
      kategori: ambil('kategori'),
      catatan: ambil('catatan'),
      yakin: grup[0].sumber.length >= 2,
      pilihanJumlah: grup,
      lapis: hasil.map(h => h.sumber),
    };
  }

  // ---------- Gemini ----------

  function petunjukStruk(bentuk, hariIni) {
    return [
      bentuk === 'gambar'
        ? 'Ini gambar bukti belanja dari Indonesia: bisa struk cetak yang difoto (mungkin miring, buram, atau ada bayangan), nota tulisan tangan, atau screenshot pembelian online.'
        : 'Ini teks hasil OCR dari bukti belanja di Indonesia. Teksnya bisa berantakan dan ada salah baca, misalnya O/0, l/1, S/5, B/8.',
      'Isi:',
      '- jumlah: total akhir yang dibayar dalam rupiah, bilangan bulat tanpa titik/koma (setelah diskon dan pajak, bukan uang tunai yang diberikan atau kembalian).',
      '  Jika tidak ada tulisan total, jumlahkan harga semua barang. Isi 0 hanya jika ini sama sekali bukan bukti belanja.',
      '  Di Indonesia titik adalah pemisah ribuan, jadi "25.000" = 25000. Tulisan tangan "25" atau "25rb" pada nota biasanya berarti 25000.',
      '- tanggal: tanggal transaksi format yyyy-mm-dd. Kosongkan jika tidak ada. Hari ini ' + hariIni + '.',
      '- kategori: pilih satu yang paling cocok dari daftar.',
      '- catatan: nama toko lalu ringkasan barang, maksimal 80 karakter. Contoh: "Indomaret - susu, roti, sabun".',
    ].join('\n');
  }

  function skemaStruk(kategori) {
    return {
      type: 'OBJECT',
      properties: {
        jumlah: { type: 'INTEGER' },
        tanggal: { type: 'STRING' },
        kategori: kategori.length ? { type: 'STRING', enum: kategori } : { type: 'STRING' },
        catatan: { type: 'STRING' },
      },
      required: ['jumlah', 'tanggal', 'kategori', 'catatan'],
    };
  }

  /** Kunci dipakai bergiliran antar-struk; giliran disimpan di perangkat ini. */
  function giliranBerikut(n) {
    if (!n) return 0;
    let g = 0;
    try { g = Number(localStorage.getItem('dk_gemini_giliran')) || 0; } catch (e) { /* abaikan */ }
    try { localStorage.setItem('dk_gemini_giliran', String((g + 1) % n)); } catch (e) { /* abaikan */ }
    return g % n;
  }

  /** Coba kunci mulai dari giliran; pindah ke kunci berikutnya kalau kena kuota/ditolak. */
  async function jalankanGemini(daftar, mulai, model, parts, skema) {
    let terakhir;
    for (let n = 0; n < daftar.length; n++) {
      const kunci = daftar[(mulai + n) % daftar.length];
      try {
        return await mintaGemini(kunci, model, parts, skema);
      } catch (e) {
        if (!e.gantiKunci) throw e;
        console.warn('Kunci ' + kunci.slice(0, 6) + '… gagal (' + e.message + '), coba kunci lain');
        terakhir = e;
      }
    }
    throw terakhir;
  }

  async function mintaGemini(kunci, model, parts, skema) {
    let res;
    try {
      res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': kunci },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: skema },
        }),
      });
    } catch (e) {
      throw new Error('Gemini tidak bisa dihubungi. Periksa koneksi internet.');
    }
    const teks = await res.text();
    if (!res.ok) {
      console.error('Gemini HTTP ' + res.status + ' ' + teks.slice(0, 1000));
      let pesan = '';
      try { pesan = JSON.parse(teks).error.message; } catch (e) { pesan = teks.slice(0, 200); }
      const kunciSalah = res.status === 400 && /API key/i.test(pesan);
      let err;
      if (kunciSalah) err = new Error('Kunci API Gemini tidak valid. Periksa lagi di menu Lainnya.');
      else if (res.status === 429) err = new Error('Kuota semua kunci Gemini sedang habis. Coba lagi nanti, atau tambah kunci lain di menu Lainnya.');
      else if (res.status === 403) err = new Error('Kunci API Gemini ditolak (403). Periksa lagi di menu Lainnya.');
      else err = new Error('Gemini error ' + res.status + ': ' + pesan);
      err.gantiKunci = kunciSalah || res.status === 429 || res.status === 403;
      throw err;
    }
    try {
      return JSON.parse(JSON.parse(teks).candidates[0].content.parts.map(p => p.text || '').join(''));
    } catch (e) {
      console.error('Jawaban Gemini tidak bisa dibaca: ' + teks.slice(0, 2000));
      throw new Error('Jawaban Gemini tidak bisa dibaca.');
    }
  }

  // ---------- OCR ----------

  /** Gambar → teks memakai OCR bawaan Google Drive. File sementara langsung dihapus. */
  async function ocrDrive(base64, mime) {
    const biner = atob(base64);
    const isi = new Uint8Array(biner.length);
    for (let i = 0; i < biner.length; i++) isi[i] = biner.charCodeAt(i);
    const file = await GOOGLE.api(UPLOAD + '/files?uploadType=multipart&ocrLanguage=id&fields=id', Object.assign(
      { method: 'POST' },
      GOOGLE.multipart({ name: 'Dompet Keluarga - OCR sementara', mimeType: 'application/vnd.google-apps.document' }, new Blob([isi], { type: mime })),
    ));
    try {
      const teks = await GOOGLE.api(DRIVE + '/files/' + file.id + '/export?mimeType=text%2Fplain', { teks: true });
      return teks.replace(/^﻿/, '');
    } finally {
      GOOGLE.api(DRIVE + '/files/' + file.id, { method: 'DELETE' })
        .catch(e => console.warn('Gagal menghapus file OCR sementara:', e));
    }
  }

  /** Membaca total & tanggal dari teks OCR dengan aturan biasa (tanpa AI). */
  function tebakDariTeks(teks, hariIni) {
    const baris = teks.split(/\r?\n/).map(b => b.trim()).filter(Boolean);
    const TOTAL = /(grand\s*total|total|jumlah|tagihan|harus\s*dibayar|amount\s*due)/i;
    const BUKAN = /(sub\s*-?\s*total|total\s*(item|qty|diskon|hemat|potongan)|kembali|change|tunai|cash|ppn|pajak|tax|disc)/i;

    let jumlah = 0;
    baris.forEach((b, i) => {
      if (!TOTAL.test(b) || BUKAN.test(b)) return;
      // Nominal bisa di baris yang sama, atau di baris berikutnya kalau OCR memisahkannya.
      const n = nominalTerbesar(b) || nominalTerbesar(baris[i + 1] || '');
      if (n > jumlah) jumlah = n;
    });

    let tanggal = '';
    baris.some(b => {
      tanggal = tanggalWajar(cariTanggal(b), hariIni);
      return !!tanggal;
    });
    return { jumlah, tanggal, kategori: '', catatan: '' };
  }

  function nominalTerbesar(s) {
    const cocok = String(s).match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?/g) || [];
    return cocok.reduce((maks, angka) => {
      const n = Number(angka.replace(/[.,]\d{2}$/, '').replace(/\D/g, '')) || 0;
      return n >= 100 && n < 1e10 && n > maks ? n : maks;
    }, 0);
  }

  function cariTanggal(s) {
    const BULAN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, ags: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
    const dua = n => String(n).padStart(2, '0');
    const tahun = y => (y.length === 2 ? '20' + y : y);
    let m = s.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
    if (m) return m[1] + '-' + dua(m[2]) + '-' + dua(m[3]);
    m = s.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/);
    if (m) return tahun(m[3]) + '-' + dua(m[2]) + '-' + dua(m[1]);
    m = s.match(/\b(\d{1,2})\s*[-\s]\s*([a-z]{3})[a-z]*\.?\s*[-\s]\s*(\d{4}|\d{2})\b/i);
    if (m && BULAN[m[2].toLowerCase()]) return tahun(m[3]) + '-' + dua(BULAN[m[2].toLowerCase()]) + '-' + dua(m[1]);
    return '';
  }

  /** Tanggal dianggap wajar jika formatnya benar, ada di kalender, dan tidak lebih dari hari ini. */
  function tanggalWajar(s, hariIni) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return '';
    return s <= hariIni && s >= '2000-01-01' ? s : '';
  }

  function tanggalHariIni() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  return { baca, MODEL, uji: { tebakDariTeks, gabungHasil, cariTanggal, nominalTerbesar, tanggalWajar } };
})();
