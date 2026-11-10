/**
 * Fitur untuk pengguna muda & pasangan baru. Dimuat SESUDAH app.js (memakai S, AKSI, T, render, dll.).
 *   1. Mikro-animasi: getar halus saat tersimpan, konfeti, angka saldo bergulir, lembar menutup mulus
 *   2. Maskot "Dompi" (kartu kosong) & kalimat insight di atas kartu saldo Beranda
 *   3. Streak mencatat, tantangan (hari tanpa belanja, 52 minggu menabung, seminggu tanpa kategori X), lencana
 *   4. Cek sebelum beli ("Bisa beli nggak?")
 *   5. Rangkuman bulanan format story 9:16 (bisa tanpa nominal, aman dibagikan ke IG/WA)
 *   6. Kartu dompet bergaya kartu fisik di tab Dompet (geser ke samping)
 * Data streak & tantangan: S.data.jejak (jejak harian, dihitung db.js) dan S.data.tantangan (sheet Pengaturan).
 */

// ---------- 1. Mikro-animasi ----------

const kurangiGerak = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Getar sangat singkat sebagai tanda "berhasil" (Android). Getar pola panjang dipakai untuk galat (app.js). */
function getarHalus(pola) {
  try { if (navigator.vibrate && !kurangiGerak()) navigator.vibrate(pola || 12); } catch (e) { /* abaikan */ }
}

function konfeti(emoji) {
  const daftar = emoji || ['🎉', '✨', '💰', '🎊', '⭐'];
  const el = document.createElement('div');
  el.className = 'konfeti';
  el.innerHTML = Array.from({ length: 28 }, (_, i) => `<i style="--x:${Math.round(Math.random() * 100)}%;--t:${(Math.random() * .6).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg">${daftar[i % daftar.length]}</i>`).join('');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// Perayaan target tabungan memakai konfeti bersama (isi fungsinya sama, hanya dipindah ke sini).
rayakanTabungan = function (w) { // eslint-disable-line no-func-assign
  if (!w.target || w.saldo < w.target) return;
  const kunci = 'dk_tercapai_' + (S.data.spreadsheetId || '') + '_' + w.nama;
  if (bacaHp(kunci)) return;
  tulisHp(kunci, '1');
  konfeti();
  getar();
  toast(T('🎉 Selamat! Target {nama} tercapai!', { nama: namaT(w.nama) }));
};

/** Angka besar ([data-gulir="kunci"][data-nilai]) bergulir dari nilai sebelumnya saat berubah, mis. setelah mencatat. */
const ANGKA_LALU = {};
function gulirkanAngka() {
  document.querySelectorAll('[data-gulir]').forEach(el => {
    const k = el.dataset.gulir, akhir = Number(el.dataset.nilai) || 0;
    const awal = ANGKA_LALU[k];
    ANGKA_LALU[k] = akhir;
    if (awal == null || awal === akhir || kurangiGerak() || document.body.classList.contains('samar')) return;
    const mulai = performance.now(), lama = 750;
    el.classList.add('bergulir');
    const langkah = kini => {
      if (!el.isConnected) return;
      const p = Math.min(1, (kini - mulai) / lama), e = 1 - Math.pow(1 - p, 3);
      el.innerHTML = rpBesar(Math.round(awal + (akhir - awal) * e));
      if (p < 1) requestAnimationFrame(langkah);
      else el.classList.remove('bergulir');
    };
    requestAnimationFrame(langkah);
  });
}

// Tersimpan → getar halus (kirim dipakai hampir semua tombol simpan; simpanTertunda = tersimpan di HP saat offline).
const kirimAsli = kirim;
kirim = async function (...args) { // eslint-disable-line no-func-assign
  const ok = await kirimAsli.apply(this, args);
  if (ok) getarHalus();
  return ok;
};
const simpanTertundaAsli = simpanTertunda;
simpanTertunda = function (...args) { // eslint-disable-line no-func-assign
  getarHalus();
  return simpanTertundaAsli.apply(this, args);
};

// Lembar bawah menutup dengan meluncur turun (sebelumnya langsung hilang). Lembar asli langsung disembunyikan seperti
// biasa (semua pengecekan `#sheet.hidden` tetap benar); yang meluncur turun hanyalah salinan tampilannya.
let hantuSheet = null;
function hapusHantuSheet() {
  if (hantuSheet) { hantuSheet.remove(); hantuSheet = null; }
}
const tutupSheetAsli = tutupSheet;
tutupSheet = function (...args) { // eslint-disable-line no-func-assign
  const sheet = $('#sheet');
  const panel = sheet && sheet.querySelector('.sheet-panel');
  let klon = null;
  // Sudah digeser ke bawah (gestur) → animasinya sudah jalan, tidak perlu salinan.
  if (sheet && !sheet.hidden && panel && !panel.style.transform && !kurangiGerak()) {
    klon = sheet.cloneNode(true);
    const asli = sheet.querySelectorAll('input, textarea, select');
    klon.querySelectorAll('input, textarea, select').forEach((x, i) => { if (asli[i] && x.type !== 'file') x.value = asli[i].value; });
    klon.removeAttribute('id');
    klon.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    klon.classList.add('sheet-hantu');
    klon.setAttribute('aria-hidden', 'true');
    klon.inert = true;
  }
  const hasil = tutupSheetAsli.apply(this, args);
  if (klon) {
    hapusHantuSheet();
    const gulir = panel.scrollTop;
    document.body.appendChild(klon);
    klon.querySelector('.sheet-panel').scrollTop = gulir;
    hantuSheet = klon;
    setTimeout(() => { if (hantuSheet === klon) hapusHantuSheet(); }, 260);
  }
  return hasil;
};
const bukaSheetAsli = bukaSheet;
bukaSheet = function (...args) { // eslint-disable-line no-func-assign
  hapusHantuSheet(); // lembar baru langsung dibuka: salinan lama tidak boleh menutupinya
  return bukaSheetAsli.apply(this, args);
};

// ---------- 2. Maskot & insight Beranda ----------

const maskot = mood => (typeof ILUSTRASI !== 'undefined' && ILUSTRASI.maskot ? ILUSTRASI.maskot(mood) : '');

// Kartu kosong: maskot yang sedang tidur + ikon kecil keterangannya.
kosong = function (ikon, teks) { // eslint-disable-line no-func-assign
  return `<div class="kosong"><span class="kosong-maskot">${maskot('tidur')}<i aria-hidden="true">${ikon}</i></span>${teks}</div>`;
};

// geserHari(iso, n) sudah ada di app.js.
const selisihTanggal = (a, b) => Math.round((keTanggal(b) - keTanggal(a)) / 864e5); // b − a, dalam hari

/** Pengeluaran minggu ini (Senin s.d. hari ini) dibanding rata-rata rentang hari yang sama 4 minggu sebelumnya. */
function bandingMingguan() {
  const j = S.data && S.data.jejak;
  if (!j) return null;
  const hariKe = (keTanggal(hariIni()).getDay() + 6) % 7; // 0 = Senin
  if (hariKe < 1) return null; // Senin pagi belum bisa dibandingkan
  const senin = geserHari(hariIni(), -hariKe);
  const jumlah = awal => { let t = 0; for (let i = 0; i <= hariKe; i++) t += (j[geserHari(awal, i)] || {}).k || 0; return t; };
  const lalu = [1, 2, 3, 4].map(w => jumlah(geserHari(senin, -7 * w))).filter(x => x > 0);
  if (lalu.length < 2) return null;
  const rata = lalu.reduce((a, b) => a + b, 0) / lalu.length;
  if (rata < 20000) return null;
  return { persen: Math.round((jumlah(senin) - rata) / rata * 100) };
}

/** Satu kalimat paling relevan untuk Beranda: { mood, teks (sudah aman HTML), aksi, tab? }. */
function insightBeranda() {
  const d = S.data;
  if (!d || d.perluSetup || S.bulan !== periodeSekarang()) return null;
  const a = hitungSisaAman();
  const per = pengeluaranPerKategori();
  if (a && a.pakaiAnggaran && a.sisa <= 0) {
    return { mood: 'sedih', teks: T('Anggaran periode ini sudah terlewati. Tahan dulu belanja yang tidak penting.'), aksi: 'rincian-anggaran' };
  }
  const lewat = kategoriBeranggaran().filter(k => (per[k.nama] || 0) > k.batas)
    .sort((x, y) => (per[y.nama] - y.batas) - (per[x.nama] - x.batas))[0];
  if (lewat) {
    return { mood: 'cemas', teks: T('{kategori} sudah lewat batas {jumlah}. Coba rem dulu, ya.', { kategori: esc(namaT(lewat.nama)), jumlah: rp(per[lewat.nama] - lewat.batas) }), aksi: 'rincian-anggaran' };
  }
  const s = hitungStreak();
  if (s.n >= 3 && !s.hariIni && new Date().getHours() >= 12) {
    return { mood: 'cemas', teks: T('Streak {n} hari bisa putus! Catat hari ini, ya 🔥', { n: s.n }), aksi: 'buka-kebiasaan' };
  }
  const m = bandingMingguan();
  if (m && m.persen <= -10) return { mood: 'bangga', teks: T('Minggu ini Anda {persen}% lebih hemat dari biasanya 👏', { persen: -m.persen }), aksi: 'tab', tab: 'laporan' };
  if (m && m.persen >= 25) return { mood: 'cemas', teks: T('Minggu ini belanja {persen}% lebih banyak dari biasanya. Rem sedikit, ya.', { persen: m.persen }), aksi: 'tab', tab: 'laporan' };
  const p = d.pembanding;
  if (p && p.lalu) {
    const persen = Math.round((p.ini - p.lalu) / p.lalu * 100);
    if (persen <= -10) return { mood: 'senang', teks: T('Sampai hari ini pengeluaran Anda {persen}% lebih hemat dari periode lalu 👏', { persen: -persen }), aksi: 'ringkas-periode' };
  }
  if (s.n >= 3) return { mood: 'senang', teks: T('{n} hari beruntun mencatat. Pertahankan! 🔥', { n: s.n }), aksi: 'buka-kebiasaan' };
  if (!s.hariIni && new Date().getHours() >= 12 && d.transaksi.length) {
    return { mood: 'biasa', teks: T('Belum ada catatan hari ini. Catat sebelum lupa ✍️'), aksi: 'tambah-trx' };
  }
  const top = Object.keys(per).sort((x, y) => per[y] - per[x])[0];
  const keluar = total(d.transaksi, TIPE.KELUAR);
  if (top && per[top] >= keluar * 0.3 && per[top] >= 50000) {
    return { mood: 'biasa', teks: T('Pengeluaran {kategori} sudah {jumlah} periode ini.', { kategori: esc(namaT(top)), jumlah: rp(per[top]), emoji: emojiIkon(ikonKategori(top, TIPE.KELUAR)) }), aksi: 'tab', tab: 'laporan' };
  }
  if (a && a.sisa > 0 && a.perHari > 0) return { mood: 'senang', teks: T('Hari ini masih aman belanja {jumlah}. Santai saja 😌', { jumlah: rp(a.perHari) }), aksi: 'rincian-aman' };
  return null;
}

function barisInsight() {
  let x = null;
  try { x = insightBeranda(); } catch (e) { return ''; } // data lama di HP yang belum lengkap: lewati saja
  if (!x) return '';
  return `<button type="button" class="insight insight-${x.mood}" data-aksi="${x.aksi}"${x.tab ? ` data-tab="${x.tab}"` : ''}>
    <span class="insight-maskot">${maskot(x.mood)}</span>
    <span class="insight-teks">${x.teks}</span>
    <span class="panah">${svg('maju')}</span>
  </button>`;
}

// ---------- 3. Streak, tantangan & lencana ----------

const tantanganData = () => (S.data && S.data.tantangan) || {};
const hariKosong = () => new Set(tantanganData().hariKosong || []);
const MILESTONE_STREAK = [3, 7, 14, 30, 60, 100, 200, 365];
const MAKS_TANTANGAN = 3;

let cacheStreak = null;
/**
 * Hari "tercatat" = ada transaksi bertanggal / dicatat hari itu (oleh siapa pun di buku ini), atau ditandai
 * "tanpa belanja". Streak tidak putus selama hari ini belum berakhir (dihitung sampai kemarin).
 */
function hitungStreak() {
  const j = S.data && S.data.jejak;
  if (!j) return { n: 0, hariIni: false, terbaik: 0, ada: false };
  const kosong = hariKosong();
  const kunci = hariIni() + '|' + kosong.size;
  if (cacheStreak && cacheStreak.j === j && cacheStreak.kunci === kunci) return cacheStreak.hasil;
  const ada = t => (j[t] && j[t].n > 0) || kosong.has(t);
  const kini = hariIni();
  const hariIniAda = ada(kini);
  let t = hariIniAda ? kini : geserHari(kini, -1), n = 0;
  while (ada(t) && n < 400) { n++; t = geserHari(t, -1); }
  let terbaik = 0, jalan = 0;
  for (let i = 399; i >= 0; i--) {
    if (ada(geserHari(kini, -i))) { jalan++; terbaik = Math.max(terbaik, jalan); } else jalan = 0;
  }
  const simpan = Number(bacaHp('dk_streak_terbaik_' + (S.data.spreadsheetId || ''))) || 0; // lebih dari 400 hari lalu
  const hasil = { n, hariIni: hariIniAda, terbaik: Math.max(terbaik, n, simpan), ada: true };
  if (hasil.terbaik > simpan) tulisHp('dk_streak_terbaik_' + (S.data.spreadsheetId || ''), String(hasil.terbaik));
  cacheStreak = { j, kunci, hasil };
  return hasil;
}
const hariTercatat = t => ((S.data.jejak || {})[t] && S.data.jejak[t].n > 0) || hariKosong().has(t);

function chipStreak() {
  const s = hitungStreak();
  if (!s.ada) return '';
  return `<button type="button" class="chip-streak ${s.hariIni ? '' : 'redup'}" data-aksi="buka-kebiasaan"
    aria-label="${T('{n} hari beruntun mencatat. Ketuk untuk tantangan & lencana', { n: s.n })}"><span aria-hidden="true">🔥</span>${s.n}</button>`;
}

const JENIS_TANTANGAN = {
  hemat: { ikon: '🌱', judul: T('Hari tanpa belanja'), ket: T('Kumpulkan beberapa hari tanpa pengeluaran dalam jangka waktu tertentu.') },
  52: { ikon: '🐷', judul: T('52 minggu menabung'), ket: T('Setor tiap minggu selama setahun: naik bertahap (1×, 2×, 3×, …) atau sama setiap minggu.') },
  tanpa: { ikon: '🙅', judul: T('Tanpa satu kategori…'), ket: T('Beberapa hari tanpa satu kategori pengeluaran, mis. jajan kopi atau ojek online.') },
  batas: { ikon: '🧾', judul: T('Batas jajan mingguan'), ket: T('Pengeluaran satu kategori tidak lewat batas setiap minggu, mis. jajan paling banyak Rp100.000/minggu.') },
  persen: { ikon: '💸', judul: T('Sisihkan % pemasukan'), ket: T('Setiap ada pemasukan, sisihkan sekian persen ke tabungan.') },
};
/** Lama tantangan dalam hari (hemat & persen bawaan 30, tanpa bawaan 7) dan dalam minggu (batas, bawaan 4). */
const hariTantangan = t => Number(t.hari) || (t.jenis === 'tanpa' ? 7 : 30);
const mingguBatas = t => Number(t.minggu) || 4;
const DURASI = { hemat: [14, 30, 60], tanpa: [3, 7, 14, 30], persen: [30, 60, 90] };
const TARGET_HEMAT = { 14: [2, 3, 5, 7], 30: [3, 5, 8, 12], 60: [5, 10, 15, 25] };
const PILIHAN_BATAS = [50000, 100000, 200000, 300000];
const PILIHAN_PERSEN = [5, 10, 20, 30];
const MINGGU_BATAS = [2, 4, 8];

function judulTantangan(t) {
  if (t.jenis === 'tanpa') {
    return hariTantangan(t) === 7 ? T('Seminggu tanpa {kategori}', { kategori: namaT(t.kategori) })
      : T('{n} hari tanpa {kategori}', { n: hariTantangan(t), kategori: namaT(t.kategori) });
  }
  if (t.jenis === 'hemat') return T('{n} hari tanpa belanja', { n: t.target });
  if (t.jenis === 'batas') return T('{kategori} maks {jumlah}/minggu', { kategori: namaT(t.kategori), jumlah: rp(t.batas) });
  if (t.jenis === 'persen') return T('Sisihkan {persen}% pemasukan', { persen: t.persen });
  return t.pola === 'tetap' ? T('52 minggu menabung · {jumlah}/minggu', { jumlah: rp(t.unit) }) : T('52 minggu menabung');
}

/**
 * Pola 52 minggu menabung: 'naik' (bawaan, minggu ke-n setor n × unit, total 1.378 × unit)
 * atau 'tetap' (setiap minggu setor unit yang sama, total 52 × unit). Tantangan lama tanpa pola = 'naik'.
 */
const pola52Tetap = t => t.pola === 'tetap';
const setoran52 = (t, minggu) => (pola52Tetap(t) ? t.unit : t.unit * minggu);
const jadwal52 = (t, minggu) => (pola52Tetap(t) ? t.unit * minggu : t.unit * minggu * (minggu + 1) / 2);
const total52 = t => jadwal52(t, 52);
const PILIHAN_UNIT_52 = { naik: [5000, 10000, 20000, 50000], tetap: [10000, 25000, 50000, 100000] };

/** Jumlah ambil(hari) untuk setiap hari di jejak antara dari..sampai (inklusif). */
function jumlahJejak(dari, sampai, ambil) {
  const j = S.data.jejak || {};
  let n = 0;
  Object.keys(j).forEach(x => { if (x >= dari && x <= sampai) n += ambil(j[x]) || 0; });
  return n;
}
/** Setoran ke satu tabungan per anggota (email → jumlah) antara dari..sampai. */
function setoranPerOrang(tabungan, dari, sampai) {
  const j = S.data.jejak || {};
  const o = {};
  Object.keys(j).forEach(x => {
    const p = x >= dari && x <= sampai && (j[x].tabO || {})[tabungan];
    if (p) Object.keys(p).forEach(e => { o[e] = (o[e] || 0) + p[e]; });
  });
  return o;
}
/** "Galang Rp150.000 · Ani Rp100.000" — hanya kalau lebih dari satu orang yang setor. */
function teksPerOrang(o) {
  const k = Object.keys(o).filter(e => o[e] > 0);
  if (k.length < 2) return '';
  return k.sort((a, b) => o[b] - o[a]).map(e => (namaPendek(e) || T('Tanpa nama')) + ' ' + rp(o[e])).join(' · ');
}
/** Rata-rata pengeluaran satu kategori per minggu, 8 minggu sebelum hari ini. */
function rataMingguanKategori(kategori) {
  if (!kategori) return 0;
  const n = jumlahJejak(geserHari(hariIni(), -56), geserHari(hariIni(), -1), h => (h.kat || {})[kategori]);
  return Math.round(n / 8 / 1000) * 1000;
}

/**
 * Kemajuan satu tantangan: { persen, teks, selesai?: 'berhasil' | 'gagal' }.
 * Tantangan menabung juga memberi: kurang (setoran yang perlu dikejar), setorMingguIni, mingguDepan, orang (per anggota).
 */
function statusTantangan(t) {
  const j = S.data.jejak || {};
  const kini = hariIni();
  if (t.jenis === 'hemat') {
    const lama = hariTantangan(t);
    const akhir = geserHari(t.mulai, lama - 1);
    const kosong = hariKosong();
    let n = 0;
    for (let x = t.mulai; x <= kini && x <= akhir; x = geserHari(x, 1)) {
      // Hari ini baru dihitung kalau ditandai; hari yang lewat dihitung kalau tercatat & tanpa pengeluaran.
      if (!((j[x] || {}).k > 0) && hariTercatat(x) && (x < kini || kosong.has(x))) n++;
    }
    if (n >= t.target) return { persen: 100, selesai: 'berhasil', teks: T('{n} hari tanpa belanja terkumpul 🎉', { n }) };
    if (kini > akhir) return { persen: n / t.target * 100, selesai: 'gagal', teks: T('Terkumpul {n} dari {target} hari', { n, target: t.target }) };
    return { persen: n / t.target * 100, teks: T('{n} dari {target} hari · sisa {sisa} hari', { n, target: t.target, sisa: selisihTanggal(kini, akhir) + 1 }) };
  }
  if (t.jenis === 'tanpa') {
    const lama = hariTantangan(t);
    const akhir = geserHari(t.mulai, lama - 1);
    for (let x = t.mulai; x <= kini && x <= akhir; x = geserHari(x, 1)) {
      if (((j[x] || {}).kat || {})[t.kategori] > 0) {
        return { persen: (selisihTanggal(t.mulai, x)) / lama * 100, selesai: 'gagal', teks: T('Bocor di hari ke-{n}', { n: selisihTanggal(t.mulai, x) + 1 }) };
      }
    }
    if (kini > akhir) {
      return { persen: 100, selesai: 'berhasil', teks: lama === 7 ? T('Tujuh hari tanpa {kategori} 🎉', { kategori: namaT(t.kategori) })
        : T('{n} hari tanpa {kategori} 🎉', { n: lama, kategori: namaT(t.kategori) }) };
    }
    const hari = selisihTanggal(t.mulai, kini) + 1;
    return { persen: (hari - 1) / lama * 100, teks: T('Hari ke-{n} dari {total} · belum ada {kategori} 💪', { n: hari, total: lama, kategori: namaT(t.kategori) }) };
  }
  if (t.jenis === 'batas') {
    const mg = mingguBatas(t), lamaHari = mg * 7;
    const akhir = geserHari(t.mulai, lamaHari - 1);
    const kat = h => (h.kat || {})[t.kategori];
    for (let w = 0; w < mg; w++) {
      const a = geserHari(t.mulai, w * 7);
      if (a > kini) break;
      const pakai = jumlahJejak(a, geserHari(a, 6), kat);
      if (pakai > t.batas) {
        return { persen: w / mg * 100, selesai: 'gagal', teks: T('Lewat batas di minggu ke-{n}: {jumlah} dari {batas}', { n: w + 1, jumlah: rp(pakai), batas: rp(t.batas) }) };
      }
    }
    if (kini > akhir) return { persen: 100, selesai: 'berhasil', teks: T('{n} minggu {kategori} tidak lewat batas 🎉', { n: mg, kategori: namaT(t.kategori) }) };
    const lewat = Math.max(0, selisihTanggal(t.mulai, kini));
    const w = Math.floor(lewat / 7);
    const pakai = jumlahJejak(geserHari(t.mulai, w * 7), kini, kat);
    return {
      persen: lewat / lamaHari * 100,
      teks: T('Minggu ke-{n} dari {total} · terpakai {jumlah} dari {batas}', { n: w + 1, total: mg, jumlah: rp(pakai), batas: rp(t.batas) }) + (pakai >= t.batas * 0.8 ? ' ⚠️' : ''),
    };
  }
  if (t.jenis === 'persen') {
    const lama = hariTantangan(t);
    const akhir = geserHari(t.mulai, lama - 1);
    const sampai = kini < akhir ? kini : akhir;
    const masuk = jumlahJejak(t.mulai, sampai, h => h.m);
    const target = Math.round(masuk * t.persen / 100);
    const setor = jumlahJejak(t.mulai, sampai, h => (h.tab || {})[t.tabungan]);
    const persen = target ? Math.max(0, Math.min(100, setor / target * 100)) : 0;
    if (kini > akhir) {
      return target && setor >= target ? { persen: 100, selesai: 'berhasil', teks: T('{jumlah} tersisih dari pemasukan 🎉', { jumlah: rp(setor) }) }
        : { persen, selesai: 'gagal', teks: T('Tersisih {jumlah} dari {target}', { jumlah: rp(Math.max(0, setor)), target: rp(target) }) };
    }
    return {
      persen, kurang: Math.max(0, target - setor), orang: teksPerOrang(setoranPerOrang(t.tabungan, t.mulai, sampai)),
      teks: (target ? T('Pemasukan {masuk} → sisihkan {target} · sudah {setor}', { masuk: rp(masuk), target: rp(target), setor: rp(Math.max(0, setor)) })
        : T('Belum ada pemasukan sejak tantangan dimulai')) + ' · ' + T('sisa {n} hari', { n: selisihTanggal(kini, akhir) + 1 }),
    };
  }
  // 52 minggu menabung
  const lewat = selisihTanggal(t.mulai, kini);
  const minggu = Math.min(52, Math.floor(Math.max(0, lewat) / 7) + 1);
  const setor = jumlahJejak(t.mulai, '9999-12-31', h => (h.tab || {})[t.tabungan]);
  const totalTarget = total52(t);
  const jadwal = jadwal52(t, minggu);
  const persen = Math.max(0, Math.min(100, setor / totalTarget * 100));
  if (setor >= totalTarget) return { persen: 100, selesai: 'berhasil', teks: T('{jumlah} terkumpul dalam 52 minggu 🎉', { jumlah: rp(setor) }) };
  if (lewat > 52 * 7 + 6) return { persen, selesai: 'gagal', teks: T('Terkumpul {jumlah} dari {target}', { jumlah: rp(setor), target: rp(totalTarget) }) };
  return {
    persen, setorMingguIni: setoran52(t, minggu), mingguDepan: minggu < 52 ? setoran52(t, minggu + 1) : 0,
    kurang: Math.max(0, jadwal - setor), orang: teksPerOrang(setoranPerOrang(t.tabungan, t.mulai, '9999-12-31')),
    teks: T('Minggu ke-{minggu} · setor {jumlah}', { minggu, jumlah: rp(setoran52(t, minggu)) }) + ' · '
      + (setor >= jadwal ? T('✅ sesuai jadwal') : T('kurang {jumlah} dari jadwal', { jumlah: rp(jadwal - setor) })),
  };
}

/** Lencana: diraih dari streak terbaik dan tantangan yang berhasil. [ikon, nama, diraih, syarat] */
function daftarLencana() {
  const s = hitungStreak();
  const berhasil = (tantanganData().selesai || []).filter(x => x.hasil === 'berhasil');
  const punya = jenis => berhasil.some(x => x.jenis === jenis);
  return [
    ['🔥', T('3 hari'), s.terbaik >= 3, T('Mencatat 3 hari beruntun')],
    ['⚡', T('Seminggu'), s.terbaik >= 7, T('Mencatat 7 hari beruntun')],
    ['🌟', T('Sebulan'), s.terbaik >= 30, T('Mencatat 30 hari beruntun')],
    ['💯', T('100 hari'), s.terbaik >= 100, T('Mencatat 100 hari beruntun')],
    ['👑', T('Setahun'), s.terbaik >= 365, T('Mencatat 365 hari beruntun')],
    ['🌱', T('Si Hemat'), punya('hemat'), T('Menyelesaikan tantangan hari tanpa belanja')],
    ['🙅', T('Kuat Iman'), punya('tanpa'), T('Menyelesaikan tantangan tanpa satu kategori')],
    ['🐷', T('Jago Nabung'), punya('52'), T('Menyelesaikan 52 minggu menabung')],
    ['🧾', T('Rem Jajan'), punya('batas'), T('Menyelesaikan batas jajan mingguan')],
    ['💸', T('Rajin Sisih'), punya('persen'), T('Menyelesaikan tantangan sisihkan % pemasukan')],
  ];
}

/** Tombol setor di kartu tantangan menabung: kejar ketinggalan, minggu ini saja, atau cicil minggu depan. */
function tombolSetorTantangan(t, st) {
  if (st.selesai || !('kurang' in st)) return '';
  const b = (kelas, jumlah, label) => `<button type="button" class="btn ${kelas} kecil" data-aksi="setor-tantangan" data-id="${esc(t.id)}" data-jumlah="${jumlah}">${label}</button>`;
  let isi = '';
  if (t.jenis === 'persen') isi = st.kurang > 0 ? b('btn-utama', st.kurang, T('💸 Setor {jumlah}', { jumlah: rp(st.kurang) })) : '';
  else if (st.kurang > st.setorMingguIni) {
    isi = b('btn-utama', st.kurang, T('🐷 Setor + kejar ketinggalan {jumlah}', { jumlah: rp(st.kurang) }))
      + b('btn-kedua', st.setorMingguIni, T('Minggu ini saja {jumlah}', { jumlah: rp(st.setorMingguIni) }));
  } else if (st.kurang > 0) isi = b('btn-utama', st.kurang, T('🐷 Setor {jumlah}', { jumlah: rp(st.kurang) }));
  else if (st.mingguDepan) isi = b('btn-kedua', st.mingguDepan, T('Cicil minggu depan {jumlah}', { jumlah: rp(st.mingguDepan) }));
  return isi ? `<div class="kt-setor">${isi}</div>` : '';
}

function kartuTantanganAktif(t) {
  const st = statusTantangan(t);
  return `<div class="kartu-tantangan">
    <div class="kt-atas"><span class="kt-ikon" aria-hidden="true">${JENIS_TANTANGAN[t.jenis] ? JENIS_TANTANGAN[t.jenis].ikon : '🏁'}</span>
      <b>${esc(judulTantangan(t))}</b>
      <button type="button" class="tombol-teks" data-aksi="ubah-tantangan" data-id="${esc(t.id)}">${T('Ubah')}</button>
      <button type="button" class="tombol-teks" data-aksi="lepas-tantangan" data-id="${esc(t.id)}">${T('Lepas')}</button></div>
    <span class="meter" role="meter" aria-label="${esc(judulTantangan(t))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(st.persen)}"><i style="width:${Math.max(2, Math.round(st.persen))}%"></i></span>
    <small>${esc(st.teks)}</small>
    ${st.orang ? `<small>👥 ${esc(st.orang)}</small>` : ''}
    ${tombolSetorTantangan(t, st)}
  </div>`;
}

function htmlTujuhHari() {
  const kini = hariIni();
  return `<div class="tujuh-hari">${Array.from({ length: 7 }, (_, i) => geserHari(kini, i - 6)).map(t => {
    const ada = hariTercatat(t);
    const label = keTanggal(t).toLocaleDateString(LOKAL, { weekday: 'short' });
    const ditandai = hariKosong().has(t);
    // Belum tercatat → ketuk untuk menandai tanpa belanja; sudah ditandai ✋ → ketuk untuk membatalkan; ada transaksi (🔥) → tetap.
    const aksi = !ada ? `data-aksi="tandai-kosong" data-tgl="${t}"` : ditandai ? `data-aksi="batal-kosong" data-tgl="${t}"` : 'disabled';
    return `<button type="button" class="hari-streak ${ada ? 'ada' : ''} ${t === kini ? 'kini' : ''}" ${aksi}
      aria-label="${esc(labelTanggal(t))}: ${!ada ? T('belum tercatat, ketuk untuk menandai tanpa belanja') : ditandai ? T('ditandai tanpa belanja, ketuk untuk membatalkan') : T('tercatat')}">
      <i aria-hidden="true">${ada ? (ditandai ? '✋' : '🔥') : ''}</i><small>${esc(label)}</small></button>`;
  }).join('')}</div>`;
}

function htmlKebiasaan() {
  const s = hitungStreak();
  const td = tantanganData();
  const aktif = td.aktif || [];
  const lencana = daftarLencana();
  const selesai = (td.selesai || []).slice(-5).reverse();
  return `
    <div class="streak-besar">
      <span class="api ${s.hariIni ? 'nyala' : ''}" aria-hidden="true">🔥</span>
      <div><b>${T('{n} hari beruntun', { n: s.n })}</b><small>${T('Terbaik: {n} hari', { n: s.terbaik })}</small></div>
    </div>
    ${htmlTujuhHari()}
    ${s.hariIni ? `<p class="info-kecil" style="margin-top:6px">${T('Hari ini sudah tercatat ✔ Sampai jumpa besok!')}</p>` : `
      <div class="aksi-form" style="margin-top:12px">
        <button type="button" class="btn btn-kedua" data-aksi="tandai-kosong" data-tgl="${hariIni()}">${T('Tandai hari ini tanpa belanja')}</button>
        <button type="button" class="btn btn-utama" data-aksi="tambah-trx">${T('＋ Catat')}</button>
      </div>`}
    <p class="info-kecil" style="text-align:left">${T('Satu hari dihitung kalau ada transaksi yang dicatat (oleh siapa pun di buku ini), atau ditandai tanpa belanja. Hari tanpa catatan di 7 hari terakhir bisa diketuk untuk ditandai; ketuk ✋ lagi untuk membatalkan.')}</p>

    <h4 class="sub-laporan">${T('🏁 Tantangan')}</h4>
    ${aktif.length ? aktif.map(kartuTantanganAktif).join('') : `<p class="info-kecil" style="text-align:left;margin-top:0">${T('Belum ada tantangan. Pilih satu untuk mulai, bisa dikerjakan bareng pasangan.')}</p>`}
    ${aktif.length < MAKS_TANTANGAN ? `<div class="pilih-tantangan">${Object.keys(JENIS_TANTANGAN).map(k => `
      <button type="button" class="baris" data-aksi="mulai-tantangan" data-jenis="${k}">
        <span class="ikon-bulat">${JENIS_TANTANGAN[k].ikon}</span>
        <span class="isi"><b>${JENIS_TANTANGAN[k].judul}</b><small>${JENIS_TANTANGAN[k].ket}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>`).join('')}</div>` : ''}

    <h4 class="sub-laporan">${T('🏅 Lencana · {n}/{total}', { n: lencana.filter(x => x[2]).length, total: lencana.length })}</h4>
    <div class="grid-lencana">${lencana.map(([ikon, nama, dapat, ket], i) => `
      <button type="button" class="lencana ${dapat ? 'dapat' : ''}" data-aksi="info-lencana" data-i="${i}"
        aria-label="${esc(nama)}: ${esc(ket)}${dapat ? '' : ' · ' + T('belum diraih')}"><span aria-hidden="true">${dapat ? ikon : '🔒'}</span><b>${esc(nama)}</b></button>`).join('')}</div>
    <p class="info-kecil">${T('Ketuk lencana untuk melihat syaratnya.')}</p>
    ${selesai.length ? `<h4 class="sub-laporan">${T('Riwayat tantangan')}</h4>${selesai.map(x => `
      <div class="baris-rincian riwayat-tantangan"><span>${x.hasil === 'berhasil' ? '🏆' : '💪'} ${esc(x.judul)}<small>${esc(tanggalPendek(x.selesai))}</small></span>
        ${JENIS_TANTANGAN[x.jenis] && aktif.length < MAKS_TANTANGAN ? `<button type="button" class="tombol-teks" data-aksi="ulang-tantangan" data-id="${esc(x.id)}">${x.hasil === 'berhasil' ? T('Ulangi') : T('Coba lagi')}</button>` : ''}</div>`).join('')}` : ''}`;
}

function bukaKebiasaan() {
  bukaSheet(T('Kebiasaan & Tantangan'), `<div id="isi-kebiasaan">${htmlKebiasaan()}</div>`);
}
function segarkanKebiasaan() {
  if ($('#isi-kebiasaan')) $('#isi-kebiasaan').innerHTML = htmlKebiasaan();
  if (S.tab === 'beranda') render();
}

let TG = null; // isian form mulai / ubah tantangan
/** Dompet sumber setoran bawaan: yang terakhir dipakai untuk tantangan, atau dompet pertama. */
function sumberSetorAwal() {
  const biasa = dompetBiasa();
  return (biasa.find(w => w.nama === bacaHp('dk_sumber_setor')) || biasa[0] || {}).nama || '';
}
/** Isian tantangan yang disimpan (tanpa id/mulai/oleh), dipakai juga untuk "Coba lagi". */
function configTantangan(g) {
  switch (g.jenis) {
    case 'hemat': return { target: g.target, hari: g.hari };
    case 'tanpa': return { kategori: g.kategori, hari: g.hari };
    case 'batas': return { kategori: g.kategori, batas: g.batas, minggu: g.minggu };
    case 'persen': return { persen: g.persen, hari: g.hari, tabungan: g.tabungan, sumber: g.sumber };
    default: return { unit: g.unit, ...(g.pola === 'tetap' ? { pola: 'tetap' } : {}), tabungan: g.tabungan, sumber: g.sumber };
  }
}
/** dari: isian awal (tantangan yang diubah / diulang); ubahId: id tantangan aktif yang sedang diubah. */
function bukaFormTantangan(jenis, dari, ubahId) {
  if (!JENIS_TANTANGAN[jenis]) return;
  TG = { jenis, target: 5, hari: { hemat: 30, tanpa: 7, persen: 30 }[jenis] || 0, unit: 10000, pola: 'naik', kategori: '', tabungan: '',
    sumber: '', batas: 100000, minggu: 4, persen: 10, lain: '', ubahId: ubahId || '' };
  if (dari) Object.keys(TG).forEach(k => { if (!['jenis', 'lain', 'ubahId'].includes(k) && dari[k] != null && dari[k] !== '') TG[k] = dari[k]; });
  if (jenis === 'tanpa' || jenis === 'batas') {
    const per = {};
    Object.values(S.data.jejak || {}).forEach(h => Object.keys(h.kat || {}).forEach(k => { per[k] = (per[k] || 0) + 1; }));
    TG.urutKategori = S.data.kategori.filter(k => k.tipe === TIPE.KELUAR).sort((a, b) => (per[b.nama] || 0) - (per[a.nama] || 0));
    if (!TG.urutKategori.some(k => k.nama === TG.kategori)) TG.kategori = (TG.urutKategori[0] || {}).nama || '';
  }
  if (jenis === '52' || jenis === 'persen') {
    const tab = daftarTabungan();
    if (!tab.some(w => w.nama === TG.tabungan)) TG.tabungan = jenis === '52' && !dari ? (tab[0] || {}).nama || '' : '';
    if (!dompetBiasa().some(w => w.nama === TG.sumber)) TG.sumber = sumberSetorAwal();
  }
  const j = JENIS_TANTANGAN[jenis];
  bukaSheet(ubahId ? T('Ubah tantangan') : j.ikon + ' ' + j.judul, '<div id="form-tantangan"></div>');
  renderFormTantangan();
}
/** Keterangan total setoran 52 minggu (diperbarui saat nominal diketik, tanpa menggambar ulang form). */
function infoTantangan52() {
  if (!TG || TG.jenis !== '52') return '';
  const tetap = TG.pola === 'tetap';
  let s = tetap ? T('Setor {jumlah} setiap minggu. Total setahun: <b>{total}</b>.', { jumlah: rp(TG.unit), total: rp(total52(TG)) })
    : T('Minggu ke-52 setor {akhir}. Total setahun: <b>{total}</b>.', { akhir: rp(TG.unit * 52), total: rp(total52(TG)) });
  if (TG.tabungan === '') s += ' ' + T('Dibuat tabungan baru "{nama}" dengan target {total}.', { nama: esc(T('52 Minggu Menabung')), total: rp(total52(TG)) });
  return s;
}
function renderFormTantangan(fokusNominal) {
  const el = $('#form-tantangan');
  if (!el || !TG) return;
  const chip = (k, nilai, label) => `<button type="button" class="chip ${TG[k] === nilai ? 'aktif' : ''}" data-aksi="tg-set" data-k="${k}" data-v="${esc(nilai)}"${typeof nilai === 'number' ? ' data-num="1"' : ''}>${label}</button>`;
  const chips = (k, daftar, label) => `<div class="chips">${daftar.map(n => chip(k, n, label(n))).join('')}</div>`;
  const nominal = (k, daftar) => {
    const lain = TG.lain === k || !daftar.includes(TG[k]);
    return `<div class="chips">${daftar.map(n => chip(k, n, rp(n))).join('')}
      <button type="button" class="chip ${lain ? 'aktif' : ''}" data-aksi="tg-lain" data-k="${k}">${T('Lainnya||nominal')}</button></div>
      ${lain ? `<label class="input-jumlah" style="margin-top:8px"><span>Rp</span><input id="tg-nominal" class="input-rp" data-k="${k}" inputmode="numeric" autocomplete="off" placeholder="0" value="${TG[k] ? formatAngka(TG[k]) : ''}"></label>` : ''}`;
  };
  const grid = (k, daftar, tambahBaru) => `<div class="grid-pilih">${daftar.map(w => `<button type="button" class="pilihan ${TG[k] === w.nama ? 'aktif' : ''}" data-aksi="tg-set" data-k="${k}" data-v="${esc(w.nama)}"><span>${ilus(w.ikon)}</span>${esc(namaT(w.nama))}</button>`).join('')}
    ${tambahBaru ? `<button type="button" class="pilihan ${TG[k] === '' ? 'aktif' : ''}" data-aksi="tg-set" data-k="${k}" data-v=""><span>＋</span>${T('Tabungan baru')}</button>` : ''}</div>`;
  const label = (teks, pertama) => `<label class="label"${pertama ? '' : ' style="margin-top:14px"'}>${teks}</label>`;
  const info = (teks, id) => `<p class="info-kecil" style="text-align:left"${id ? ` id="${id}"` : ''}>${teks}</p>`;
  const jenis = TG.jenis;
  let isi = `<p style="margin-top:0">${JENIS_TANTANGAN[jenis].ket}</p>`;
  if (jenis === 'hemat') {
    isi += label(T('Jangka waktu'), true) + chips('hari', DURASI.hemat, n => T('{n} hari', { n }))
      + label(T('Target hari tanpa belanja')) + chips('target', TARGET_HEMAT[TG.hari] || TARGET_HEMAT[30], n => T('{n} hari', { n }))
      + info(T('Hari dihitung kalau tidak ada pengeluaran. Tandai "tanpa belanja" di hari itu supaya ikut terhitung.'));
  } else if (jenis === 'tanpa') {
    isi += label(T('Kategori yang mau ditahan'), true) + grid('kategori', TG.urutKategori || [])
      + label(T('Berapa lama')) + chips('hari', DURASI.tanpa, n => (n === 7 ? T('Seminggu') : T('{n} hari', { n })));
  } else if (jenis === 'batas') {
    const rata = rataMingguanKategori(TG.kategori);
    isi += label(T('Kategori'), true) + grid('kategori', TG.urutKategori || [])
      + label(T('Batas per minggu')) + nominal('batas', PILIHAN_BATAS)
      + (rata ? info(T('Rata-rata {kategori} Anda {jumlah}/minggu (8 minggu terakhir).', { kategori: esc(namaT(TG.kategori)), jumlah: rp(rata) })) : '')
      + label(T('Berapa lama')) + chips('minggu', MINGGU_BATAS, n => T('{n} minggu', { n }));
  } else if (jenis === 'persen') {
    const rata = rataPeriodeSelesai().masuk;
    isi += label(T('Persen yang disisihkan'), true) + chips('persen', PILIHAN_PERSEN, n => n + '%')
      + (rata ? info(T('Dengan pemasukan rata-rata {masuk}/bulan, kira-kira <b>{jumlah}</b> tersisih per bulan.', { masuk: rp(rata), jumlah: rp(Math.round(rata * TG.persen / 100)) })) : '')
      + label(T('Jangka waktu')) + chips('hari', DURASI.persen, n => T('{n} hari', { n }))
      + label(T('Ditabung ke')) + grid('tabungan', daftarTabungan(), true)
      + (TG.tabungan === '' ? info(T('Dibuat tabungan baru "{nama}".', { nama: esc(T('Sisihan Pemasukan')) })) : '');
  } else {
    const tetap = TG.pola === 'tetap';
    isi += label(T('Pola setoran'), true) + `<div class="chips">${chip('pola', 'naik', T('📈 Naik tiap minggu'))}${chip('pola', 'tetap', T('➖ Sama tiap minggu'))}</div>`
      + label(tetap ? T('Setoran per minggu') : T('Setoran minggu pertama')) + nominal('unit', PILIHAN_UNIT_52[TG.pola])
      + info(infoTantangan52(), 'tg-info')
      + label(T('Ditabung ke')) + grid('tabungan', daftarTabungan(), true);
  }
  if (jenis === '52' || jenis === 'persen') isi += label(T('Disetor dari')) + grid('sumber', dompetBiasa());
  if (TG.ubahId) isi += info(T('Tanggal mulai tetap; kemajuan dihitung ulang dengan isian baru.'));
  isi += `<div class="aksi-form"><button type="button" class="btn btn-hapus" data-aksi="buka-kebiasaan">${T('Kembali')}</button>
    <button type="button" class="btn btn-utama" data-aksi="simpan-tantangan">${TG.ubahId ? T('Simpan perubahan') : T('Mulai tantangan')}</button></div>`;
  el.innerHTML = isi;
  const input = fokusNominal && $('#tg-nominal');
  if (input) input.focus();
}

// Nominal "Lainnya" diketik: simpan ke isian & perbarui keterangan tanpa menggambar ulang (supaya keyboard tidak tertutup).
document.addEventListener('input', e => {
  if (!TG || e.target.id !== 'tg-nominal') return;
  TG[e.target.dataset.k] = angka(e.target.value);
  if ($('#tg-info')) $('#tg-info').innerHTML = infoTantangan52();
});

/** Ubah data tantangan di spreadsheet, lalu langsung pakai hasilnya tanpa memuat ulang semua data. */
async function ubahTantanganLalu(ubah) {
  if (S.offline || !navigator.onLine) { toast(T('Butuh sinyal untuk menyimpan tantangan.'), true); return null; }
  loading(true);
  try {
    const baru = await api('ubahTantangan', ubah);
    S.data.tantangan = baru;
    tulisLokal('data', S.data);
    return baru;
  } catch (e) {
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
    return null;
  } finally {
    loading(false);
  }
}

/** Tantangan yang baru saja selesai dipindah ke riwayat (sekali), dengan perayaan kalau berhasil. */
let cekTantanganJalan = false;
async function cekTantanganSelesai() {
  if (cekTantanganJalan || !S.data || S.offline || S.sesiHabis || !navigator.onLine) return;
  const beres = (tantanganData().aktif || []).map(t => ({ t, st: statusTantangan(t) })).filter(x => x.st.selesai);
  if (!beres.length) return;
  cekTantanganJalan = true;
  try {
    const id = new Set(beres.map(x => x.t.id));
    const baru = await api('ubahTantangan', isi => {
      isi.aktif = (isi.aktif || []).filter(t => !id.has(t.id));
      isi.selesai = (isi.selesai || []).concat(beres.map(x => ({ id: x.t.id, jenis: x.t.jenis, judul: judulTantangan(x.t), mulai: x.t.mulai, selesai: hariIni(), hasil: x.st.selesai, cfg: configTantangan(x.t) }))).slice(-30);
      return isi;
    });
    S.data.tantangan = baru;
    tulisLokal('data', S.data);
    const menang = beres.find(x => x.st.selesai === 'berhasil');
    if (menang) {
      konfeti(['🏆', '🎉', '✨', '🔥', '⭐']);
      getar();
      toast(T('🏆 Tantangan "{judul}" berhasil!', { judul: judulTantangan(menang.t) }));
    } else {
      toast(T('Tantangan "{judul}" belum berhasil. Coba lagi, ya 💪', { judul: judulTantangan(beres[0].t) }));
    }
    if (S.tab === 'beranda') render();
  } catch (e) { /* dicoba lagi saat Beranda dibuka berikutnya */ } finally {
    cekTantanganJalan = false;
  }
}

/** Sekali per pencapaian: konfeti saat streak mencapai 3, 7, 14, 30, … hari. */
function cekPencapaianStreak() {
  const s = hitungStreak();
  if (!s.hariIni) return;
  const capai = MILESTONE_STREAK.filter(m => s.n >= m).pop();
  if (!capai) return;
  // Disimpan "tanggal mulai streak|milestone": streak baru (tanggal mulai beda) boleh dirayakan lagi dari awal.
  const kunci = 'dk_streak_rayakan_' + (S.data.spreadsheetId || '');
  const [mulaiLalu, capaiLalu] = (bacaHp(kunci) || '').split('|');
  const mulaiStreak = geserHari(hariIni(), -(s.n - 1));
  if (mulaiLalu === mulaiStreak && Number(capaiLalu) >= capai) return;
  tulisHp(kunci, mulaiStreak + '|' + capai);
  setTimeout(() => {
    konfeti(['🔥', '✨', '⭐', '🎉']);
    getarHalus([15, 60, 15]);
    toast(T('🔥 {n} hari beruntun mencatat! Keren!', { n: capai }));
  }, 600);
}

function kartuTantangan() {
  const aktif = tantanganData().aktif || [];
  if (!aktif.length || !S.data.jejak) return '';
  // Utamakan tantangan menabung yang masih kurang setor, supaya jadi pengingat di Beranda.
  const t = aktif.find(x => statusTantangan(x).kurang > 0) || aktif[0], st = statusTantangan(t);
  return `<button type="button" class="kartu kartu-tantangan-beranda" data-aksi="buka-kebiasaan">
    <span class="kt-ikon" aria-hidden="true">${JENIS_TANTANGAN[t.jenis] ? JENIS_TANTANGAN[t.jenis].ikon : '🏁'}</span>
    <span class="isi"><small>${T('Tantangan')}${aktif.length > 1 ? ' · ' + T('{n} aktif', { n: aktif.length }) : ''}</small><b>${esc(judulTantangan(t))}</b>
      <span class="meter"><i style="width:${Math.max(2, Math.round(st.persen))}%"></i></span><small>${esc(st.teks)}</small></span>
    <span class="panah">${svg('maju')}</span>
  </button>`;
}

/** Sekali saja: tawarkan gaya bahasa santai kepada pengguna berbahasa Indonesia yang belum memilih. */
function kartuGaya() {
  if (BAHASA !== 'id' || GAYA === 'santai' || bacaHp('dk_gaya_ditawarkan') || !S.data.transaksi.length) return '';
  return `<section class="kartu kartu-gaya">
    <span class="insight-maskot">${maskot('senang')}</span>
    <div><b>${T('Mau ngobrol lebih santai?')}</b><small>${T('Aplikasi bisa menyapa dengan "kamu" dan bahasa sehari-hari. Bisa diganti kapan saja di ⚙️.')}</small>
      <div class="aksi-gaya"><button type="button" class="btn btn-utama kecil" data-aksi="gaya-santai">${T('Coba gaya santai')}</button>
      <button type="button" class="tombol-teks" data-aksi="gaya-tolak">${T('Tetap formal')}</button></div></div>
  </section>`;
}

// ---------- 4. Cek sebelum beli ----------

const IKON_TAS = '<path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z"/><path d="M9 11V7a3 3 0 0 1 6 0v4"/>';
IKON.tas = IKON_TAS;
const IKON_API = '<path d="M12 22c4 0 7-2.7 7-6.7 0-3.3-2.3-5.6-3.6-7.3-.4 1.8-1.4 3-2.6 3.6.2-3.4-1.4-6.6-4.3-8.6.2 3-1.4 5-3 6.8C4.3 11.2 5 13.6 5 15.3 5 19.3 8 22 12 22z"/>';
IKON.api = IKON_API;
PINTASAN.cekbeli = ['tas', T('Cek beli'), 'cek-beli'];
PINTASAN.kebiasaan = ['api', T('Tantangan'), 'buka-kebiasaan'];
FITUR.push(
  ['🤔', T('Cek sebelum beli'), 'bisa beli nggak cek beli mampu belanja barang impulsif afford buy check', 'cek-beli'],
  ['🔥', T('Kebiasaan & Tantangan'), 'streak beruntun tantangan challenge lencana badge hemat no spend 52 minggu menabung', 'buka-kebiasaan'],
  ['💬', T('Gaya bahasa'), 'gaya bahasa santai formal kamu anda casual', 'tab', 'lainnya'],
);

let CB = null; // state "Cek sebelum beli": { id, manual } — manual = harga diketik sendiri (jangan ditimpa hasil ketik cepat)

/**
 * Riwayat "Cek sebelum beli" per HP & per buku: tiap cek yang sudah ada harganya disimpan otomatis (15 terakhir),
 * termasuk pendapat AI. Lembar boleh ditutup saat AI masih menimbang: jawabannya tetap masuk riwayat.
 */
const MAKS_RIWAYAT_CB = 15;
const kunciRiwayatCB = () => 'dk_cekbeli_' + ((S.data && S.data.spreadsheetId) || '');
const AI_CB_JALAN = new Set(); // id cek yang pendapat AI-nya sedang diminta
let timerRiwayatCB = null, tundaRiwayatCB = null;
function riwayatCB() {
  try { const r = JSON.parse(bacaHp(kunciRiwayatCB())); return Array.isArray(r) ? r : []; } catch (e) { return []; }
}
function tulisRiwayatCB(r) { tulisHp(kunciRiwayatCB(), r.length ? JSON.stringify(r.slice(0, MAKS_RIWAYAT_CB)) : null); }
/** Simpan / perbarui satu cek (paling atas = terbaru). Pendapat AI lama dibuang kalau barang/harganya berubah. */
function catatRiwayatCB(c) {
  const r = riwayatCB();
  const lama = r.find(x => x.id === c.id);
  const ai = lama && lama.ai && lama.harga === c.harga && lama.teks === c.teks ? lama.ai : null;
  tulisRiwayatCB([{ ...c, ai, tgl: hariIni(), jam: Date.now() }].concat(r.filter(x => x.id !== c.id)));
}
function simpanRiwayatCBSekarang() {
  clearTimeout(timerRiwayatCB);
  if (tundaRiwayatCB) catatRiwayatCB(tundaRiwayatCB);
  tundaRiwayatCB = null;
}
function ubahRiwayatCB(id, ubah) {
  const r = riwayatCB();
  const x = r.find(y => y.id === id);
  if (!x) return;
  Object.assign(x, ubah);
  tulisRiwayatCB(r);
}
const IKON_VONIS = { aman: '✅', irit: '⚠️', jangan: '⛔' };
function htmlRiwayatCB() {
  const r = riwayatCB();
  if (!r.length) return '';
  return `<h4 class="sub-laporan">${T('🕘 Riwayat cek')}</h4>
    <div class="riwayat-cb">${r.map(x => `
      <button type="button" class="baris" data-aksi="cb-riwayat" data-id="${esc(x.id)}">
        <span class="ikon-vonis" aria-hidden="true">${IKON_VONIS[x.vonis] || '🤔'}</span>
        <span class="isi"><b>${esc(namaBarang(x.teks) || T('Barang ini'))}</b>
          <small>${esc(labelTanggal(x.tgl))} · ${new Date(x.jam).toLocaleTimeString(LOKAL, { hour: '2-digit', minute: '2-digit' })}${x.ai ? ' · ' + T('✨ ada pendapat AI') : AI_CB_JALAN.has(x.id) ? ' · ' + T('✨ AI sedang menimbang…') : ''}</small></span>
        <b class="nominal">${rp(x.harga)}</b>
      </button>`).join('')}</div>
    <button type="button" class="tombol-teks" data-aksi="cb-hapus-riwayat">${T('Hapus riwayat')}</button>`;
}

async function bukaCekBeli() {
  if (S.bulan !== periodeSekarang()) { // dihitung dari periode berjalan
    S.bulan = periodeSekarang();
    loading(true);
    try { await muat(); } finally { loading(false); }
  }
  CB = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), manual: false };
  bukaSheet(T('Cek sebelum beli 🤔'), `
    <p style="margin-top:0">${T('Tulis barang & harganya, mis. <b>sepatu 1,2jt</b>. Dihitung dari sisa anggaran, tagihan yang belum dibayar, dan kebiasaan belanja Anda.')}</p>
    <div class="grup-form">
      <label class="label" for="cb-teks">${T('Mau beli apa?')}</label>
      <input class="field" id="cb-teks" maxlength="80" autocomplete="off" placeholder="${T('mis. sepatu lari 1,2jt')}">
    </div>
    <label class="label" for="cb-harga">${T('Harga')}</label>
    <label class="input-jumlah"><span>Rp</span><input id="cb-harga" class="input-rp" inputmode="numeric" autocomplete="off" placeholder="0"></label>
    <div id="cb-hasil" aria-live="polite"></div>`);
  setTimeout(() => $('#cb-teks') && $('#cb-teks').focus(), 250);
  gambarCekBeli();
}

/** Rata-rata pengeluaran per hari, 30 hari sebelum hari ini. */
function rataHarian() {
  const j = S.data.jejak || {};
  let t = 0;
  for (let i = 1; i <= 30; i++) t += (j[geserHari(hariIni(), -i)] || {}).k || 0;
  return Math.round(t / 30);
}
/** Rata-rata pemasukan & sisa (pemasukan − pengeluaran) per periode, dari ≤ 3 periode selesai terakhir. */
function rataPeriodeSelesai() {
  const kini = periodeSekarang();
  const daftar = Object.keys(S.data.bulanan || {}).filter(k => k < kini).sort().slice(-3).map(ringkasBulan).filter(adaIsi);
  if (!daftar.length) return { masuk: 0, sisa: 0 };
  return {
    masuk: Math.round(daftar.reduce((a, x) => a + x.masuk, 0) / daftar.length),
    sisa: Math.round(daftar.reduce((a, x) => a + x.masuk - x.keluar, 0) / daftar.length),
  };
}

/** Penilaian: { vonis: 'aman'|'irit'|'jangan', alasan: [html], fakta } untuk harga & nama barang. */
function nilaiBeli(harga, nama) {
  const a = hitungSisaAman();
  const harian = rataHarian();
  const saldo = dompetBiasa().reduce((x, w) => x + w.saldo, 0);
  const rata = rataPeriodeSelesai();
  const kategori = nama ? tebakKategori(TIPE.KELUAR, nama) : '';
  const per = pengeluaranPerKategori();
  const kb = kategori && kategoriBeranggaran().find(k => k.nama === kategori);
  const alasan = [];
  let vonis = 'aman', perHariSetelah = null;
  if (a) {
    const setelah = a.sisa - harga;
    perHariSetelah = setelah > 0 ? Math.floor(setelah / a.hari / 500) * 500 : 0;
    alasan.push(T('💰 Sisa aman periode ini {sisa} → setelah beli <b>{setelah}</b>', { sisa: rp(a.sisa), setelah: rp(setelah) }));
    if (setelah >= 0) alasan.push(T('📅 Jatah harian {lama} → <b>{baru}/hari</b> sampai {tanggal}', { lama: rp(a.perHari), baru: rp(perHariSetelah), tanggal: esc(tanggalPendek(a.akhir)) }));
    if (a.tagihan) alasan.push(T('🧾 Sudah disisihkan {jumlah} untuk tagihan rutin yang belum dibayar', { jumlah: rp(a.tagihan) }));
    if (setelah < 0) vonis = 'jangan';
    else if (harian && perHariSetelah < harian * 0.7) vonis = 'irit';
    else if (perHariSetelah < a.perHari * 0.5) vonis = 'irit';
  } else {
    const setelah = saldo - harga;
    alasan.push(T('👛 Saldo semua dompet {saldo} → setelah beli <b>{setelah}</b>', { saldo: rp(saldo), setelah: rp(setelah) }));
    if (setelah < 0) vonis = 'jangan';
    else if (harian && setelah < harian * 14) vonis = 'irit';
    alasan.push(T('ℹ️ Belum ada anggaran atau pemasukan di periode ini, jadi dihitung dari saldo dompet. Atur anggaran supaya lebih tepat.'));
  }
  if (harga > saldo && vonis !== 'jangan') {
    vonis = 'jangan';
    alasan.push(T('👛 Saldo semua dompet hanya {saldo}', { saldo: rp(saldo) }));
  }
  if (harian) alasan.push(T('🍜 Biasanya Anda belanja {jumlah}/hari (30 hari terakhir)', { jumlah: rp(harian) }));
  if (kb) {
    const sisaKat = kb.batas - (per[kategori] || 0);
    alasan.push(T('🎯 Anggaran {kategori}: sisa {sisa} → <b>{setelah}</b>', { kategori: esc(namaT(kategori)), sisa: rp(sisaKat), setelah: rp(sisaKat - harga) }));
    if (sisaKat - harga < 0 && vonis === 'aman') vonis = 'irit';
  }
  if (rata.masuk && harga >= rata.masuk * 0.3) {
    alasan.push(T('⚖️ Harganya {persen}% dari pemasukan sebulan. Barang sebesar ini lebih aman ditabung dulu daripada dicicil paylater.', { persen: Math.round(harga / rata.masuk * 100) }));
    if (vonis === 'aman' && harga >= rata.masuk * 0.5) vonis = 'irit';
  }
  if (vonis !== 'aman' && rata.sisa > 0) {
    const bulan = Math.max(1, Math.ceil(harga / rata.sisa));
    alasan.push(T('🐷 Dengan sisa rata-rata {jumlah}/bulan, bisa terkumpul dalam ±{n} bulan.', { jumlah: rp(rata.sisa), n: bulan }));
  }
  const fakta = {
    barang: nama || null, harga, kategoriTebakan: kategori || null,
    sisaAmanPeriode: a ? a.sisa : null, hariSampaiAkhirPeriode: a ? a.hari : null, jatahHarianSekarang: a ? a.perHari : null,
    jatahHarianSetelahBeli: perHariSetelah, tagihanBelumDibayar: a ? a.tagihan : null, saldoSemuaDompet: saldo,
    rataBelanjaHarian30Hari: harian, rataPemasukanPerBulan: rata.masuk, rataSisaPerBulan: rata.sisa,
    sisaAnggaranKategori: kb ? kb.batas - (per[kategori] || 0) : null, penilaianAplikasi: vonis,
  };
  return { vonis, alasan, fakta, kategori };
}

const VONIS = {
  aman: ['senang', () => T('✅ Aman dibeli')],
  irit: ['cemas', () => T('⚠️ Bisa, tapi harus berhemat')],
  jangan: ['sedih', () => T('⛔ Sebaiknya jangan dulu')],
};

function gambarCekBeli() {
  const el = $('#cb-hasil');
  if (!el || !CB) return;
  const harga = angka($('#cb-harga').value);
  const nama = $('#cb-teks').value.trim();
  if (!harga) {
    el.innerHTML = `<div class="cb-tunggu">${maskot('biasa')}<span>${T('Isi harganya untuk melihat hasilnya.')}</span></div>${htmlRiwayatCB()}`;
    return;
  }
  const n = nilaiBeli(harga, nama);
  CB.hasil = n;
  CB.harga = harga;
  CB.nama = nama;
  // Simpan ke riwayat setelah berhenti mengetik sebentar.
  clearTimeout(timerRiwayatCB);
  tundaRiwayatCB = { id: CB.id, teks: nama, harga, vonis: n.vonis };
  timerRiwayatCB = setTimeout(simpanRiwayatCBSekarang, 1200);
  const tersimpan = riwayatCB().find(x => x.id === CB.id);
  const aiLama = tersimpan && tersimpan.ai && tersimpan.harga === harga && tersimpan.teks === nama ? tersimpan.ai : '';
  const aiJalan = AI_CB_JALAN.has(CB.id);
  const [mood, judul] = VONIS[n.vonis];
  el.innerHTML = `
    <div class="cb-vonis cb-${n.vonis}">
      <span class="cb-maskot">${maskot(mood)}</span>
      <div><b>${judul()}</b><small>${esc(nama || T('Barang ini'))} · ${rp(harga)}</small></div>
    </div>
    <ul class="cb-alasan">${n.alasan.map(x => `<li>${x}</li>`).join('')}</ul>
    <div id="cb-ai">${aiLama ? htmlAiCB(aiLama) : aiJalan ? htmlAiCBMenimbang() : ''}</div>
    ${!aiLama && !aiJalan && S.data.kunciGemini && S.data.kunciGemini.length ? `<button type="button" class="tombol-tambah" style="margin:4px 0 0" data-aksi="cb-ai">${T('✨ Minta pendapat AI')}</button>` : ''}
    <div class="aksi-form">
      <button type="button" class="btn btn-kedua" data-aksi="cb-tabung">${T('🎯 Jadikan target')}</button>
      <button type="button" class="btn btn-utama" data-aksi="cb-catat">${n.vonis === 'jangan' ? T('Tetap catat') : T('Catat pembelian')}</button>
    </div>`;
}

const htmlAiCB = s => `<div class="ringkas-ai"><p>${esc(s)}</p><small>${T('✨ Ditulis AI Gemini dari angka di atas, bisa keliru.')}</small></div>`;
const htmlAiCBMenimbang = () => `<p class="info-kecil" style="text-align:left">${T('✨ Sedang menimbang… Boleh ditutup dulu, jawabannya tersimpan di riwayat.')}</p>`;

document.addEventListener('input', e => {
  if (!CB || !e.target.id || !e.target.id.startsWith('cb-')) return;
  if (e.target.id === 'cb-harga') CB.manual = !!e.target.value;
  if (e.target.id === 'cb-teks' && !CB.manual) {
    const h = bacaKetikCepat(e.target.value);
    $('#cb-harga').value = h.jumlah ? formatAngka(h.jumlah) : '';
  }
  gambarCekBeli();
});

/** Nama barang tanpa harganya: "sepatu lari 1,2jt" → "Sepatu lari". */
const namaBarang = teks => (teks ? bacaKetikCepat(teks).catatan || teks : '');

// ---------- 5. Rangkuman bulanan format story (9:16) ----------

const PERSONA = [
  [/makan|minum|kuliner|jajan|kopi|food|drink/i, '🍜', T('Si Pecinta Kuliner')],
  [/belanja harian|grocer|dapur|pasar|sayur/i, '🛒', T('Si Rajin Belanja')],
  [/transport|bensin|ojek|parkir|tol|kendaraan/i, '🛵', T('Si Anak Jalan')],
  [/hiburan|nonton|game|liburan|healing|entertain|langganan/i, '🎬', T('Si Paling Healing')],
  [/pakaian|fashion|baju|skincare|kecantikan|cloth/i, '👕', T('Si Fashionable')],
  [/tagihan|utilitas|listrik|internet|cicilan|bill/i, '💡', T('Si Taat Tagihan')],
  [/anak|bayi|sekolah|kid|baby/i, '👶', T('Orang Tua Juara')],
  [/kesehatan|obat|dokter|health|gym/i, '💊', T('Si Jaga Kesehatan')],
  [/pendidikan|kursus|buku|education|kuliah/i, '📚', T('Si Rajin Belajar')],
  [/sosial|donasi|sedekah|zakat|kado|giving|donation/i, '🤲', T('Si Dermawan')],
  [/rumah|household|perabot|kos|kontrakan/i, '🏠', T('Si Anak Rumahan')],
];
/** Julukan bulan itu: { emoji, nama, ket }. Sisa ≥ 30% pemasukan → "Si Jago Nabung"; selain itu dari kategori terbesar. */
// berjalan: periode belum selesai → "Si Jago Nabung" belum bisa dinilai (pengeluaran masih akan bertambah).
function personaBulan(r, berjalan) {
  const rasio = r.masuk ? Math.round((r.masuk - r.keluar) / r.masuk * 100) : null;
  const top = Object.keys(r.kategori).sort((a, b) => r.kategori[b] - r.kategori[a])[0];
  const persen = top && r.keluar ? Math.round(r.kategori[top] / r.keluar * 100) : 0;
  if (!berjalan && rasio !== null && rasio >= 30) return { emoji: '🏆', nama: T('Si Jago Nabung'), ket: T('{persen}% pemasukan berhasil disisihkan', { persen: rasio }) };
  if (top) {
    const p = PERSONA.find(([pola]) => pola.test(top) || pola.test(namaT(top)));
    return { emoji: p ? p[1] : emojiIkon(ikonKategori(top, TIPE.KELUAR)), nama: p ? p[2] : T('Si Penggemar {kategori}', { kategori: namaT(top) }), ket: T('Paling banyak untuk {kategori} · {persen}%', { kategori: namaT(top), persen }) };
  }
  return { emoji: '📒', nama: T('Si Rajin Mencatat'), ket: T('Terus mencatat supaya rangkumannya makin lengkap') };
}

/** Hari tanpa pengeluaran (yang tercatat) dalam periode k, sampai kemarin. */
function hariTanpaBelanja(k) {
  const j = S.data.jejak || {};
  const r = SERVER.rentangPeriode(k, S.data.mulaiPeriode || 1);
  let n = 0;
  for (let x = r.awal; x <= r.akhir && x < hariIni(); x = geserHari(x, 1)) if (hariTercatat(x) && !((j[x] || {}).k > 0)) n++;
  return n;
}

/** Gambar story 1080×1920. aman: tanpa nominal rupiah sama sekali (hanya persen & emoji). */
async function gambarStory(k, aman) {
  const r = ringkasBulan(k);
  const top = Object.keys(r.kategori).map(n => ({ n, v: r.kategori[n] })).sort((a, b) => b.v - a.v).slice(0, 3);
  const berjalan = k === periodeSekarang();
  const ps = personaBulan(r, berjalan);
  const rasio = r.masuk ? Math.round((r.masuk - r.keluar) / r.masuk * 100) : null;
  // Periode berjalan dibanding periode lalu sampai hari ke-N yang sama (bukan dengan periode lalu yang sudah penuh).
  const b = bandingPeriode(k, 'lalu');
  const adil = b.sebagian || k < periodeSekarang();
  const banding = adil && b.lalu.keluar && b.kini.keluar ? Math.round((b.kini.keluar - b.lalu.keluar) / b.lalu.keluar * 100) : null;
  const tanpa = hariTanpaBelanja(k);
  const streak = k >= bulanSebelum(periodeSekarang()) ? hitungStreak().n : 0;

  const W = 1080, H = 1920, P = 84;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  try { await document.fonts.ready; } catch (e) { /* font cadangan */ }
  const teks = (s, x, y, ukuran, warna, tebal, rata, lebarMaks) => {
    g.font = `${tebal || 700} ${ukuran}px "Plus Jakarta Sans", system-ui, sans-serif`;
    g.fillStyle = warna; g.textAlign = rata || 'left';
    let t = String(s);
    if (lebarMaks && g.measureText(t).width > lebarMaks) {
      while (t.length > 1 && g.measureText(t + '…').width > lebarMaks) t = t.slice(0, -1);
      t = t.trimEnd() + '…';
    }
    g.fillText(t, x, y);
  };
  const kotak = (x, y, w, h, isi, rad) => { g.fillStyle = isi; g.beginPath(); g.roundRect(x, y, w, h, rad || 36); g.fill(); };

  // Latar: gradien teal tua → teal → amber (warna merek) dengan lingkaran cahaya.
  const latar = g.createLinearGradient(0, 0, W, H);
  latar.addColorStop(0, '#062a2e'); latar.addColorStop(.45, '#0e7c86'); latar.addColorStop(.8, '#14b8a6'); latar.addColorStop(1, '#f5a524');
  g.fillStyle = latar; g.fillRect(0, 0, W, H);
  [[900, 260, 340, 'rgba(255,255,255,.10)'], [120, 1500, 420, 'rgba(255,255,255,.07)'], [1000, 1700, 260, 'rgba(255,255,255,.08)']].forEach(([x, y, rad, w]) => {
    g.fillStyle = w; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  });

  kopMerek(g, P, 150, 36, 'rgba(255,255,255,.95)');
  teks(T('RANGKUMAN BULAN'), P, 250, 34, 'rgba(255,255,255,.7)', 800);
  teks(namaBulan(k), P, 340, 78, '#ffffff', 800, 'left', W - P * 2);

  // Julukan
  kotak(P, 410, W - P * 2, 380, 'rgba(255,255,255,.14)', 48);
  teks(ps.emoji, W / 2, 590, 150, '#ffffff', 400, 'center');
  teks(T('Julukan bulan ini'), W / 2, 660, 30, 'rgba(255,255,255,.75)', 700, 'center');
  teks(ps.nama, W / 2, 730, 62, '#ffffff', 800, 'center', W - P * 2 - 60);

  // Dua angka utama
  const lebar = (W - P * 2 - 28) / 2;
  const stat = (x, label, nilai, ket) => {
    kotak(x, 830, lebar, 250, 'rgba(255,255,255,.14)');
    teks(label, x + 36, 900, 30, 'rgba(255,255,255,.75)', 700, 'left', lebar - 60);
    teks(nilai, x + 36, 990, 72, '#ffffff', 800, 'left', lebar - 60);
    if (ket) teks(ket, x + 36, 1045, 28, 'rgba(255,255,255,.75)', 600, 'left', lebar - 60);
  };
  stat(P, T('Disisihkan'), rasio === null ? '—' : rasio + '%', berjalan ? T('sejauh ini') : aman ? T('dari pemasukan') : (r.masuk ? rp(r.masuk - r.keluar) : ''));
  stat(P + lebar + 28, T('vs bulan lalu'), banding === null ? '—' : (banding > 0 ? '▲' : banding < 0 ? '▼' : '') + Math.abs(banding) + '%',
    banding === null ? '' : banding <= 0 ? T('lebih hemat 🎉') : T('lebih boros'));

  // Kategori terbesar
  teks(T('Uangnya ke mana?'), P, 1170, 40, '#ffffff', 800);
  const maks = Math.max(1, ...top.map(x => x.v));
  top.forEach((x, i) => {
    const y = 1230 + i * 120;
    const persen = r.keluar ? Math.round(x.v / r.keluar * 100) : 0;
    teks(emojiIkon(ikonKategori(x.n, TIPE.KELUAR)) + '  ' + namaT(x.n), P, y + 36, 38, '#ffffff', 700, 'left', W - P * 2 - 260);
    teks(aman ? persen + '%' : 'Rp' + rpPendek(x.v) + ' · ' + persen + '%', W - P, y + 36, 36, 'rgba(255,255,255,.9)', 800, 'right');
    kotak(P, y + 62, W - P * 2, 18, 'rgba(255,255,255,.18)', 9);
    kotak(P, y + 62, Math.max(18, (W - P * 2) * x.v / maks), 18, '#ffffff', 9);
  });
  if (!top.length) teks(T('Belum ada pengeluaran.'), P, 1260, 34, 'rgba(255,255,255,.8)', 600);

  // Lencana kecil
  const lencana = [];
  if (tanpa) lencana.push(T('🌱 {n} hari tanpa belanja', { n: tanpa }));
  if (streak >= 3) lencana.push(T('🔥 {n} hari beruntun mencatat', { n: streak }));
  if (!aman) lencana.push(T('💸 Keluar {jumlah}', { jumlah: 'Rp' + rpPendek(r.keluar) }));
  let ly = 1640;
  lencana.slice(0, 2).forEach(s => { // paling banyak 2, supaya ajakan + alamat di bawah tetap lega
    g.font = `700 34px "Plus Jakarta Sans", system-ui, sans-serif`;
    const w = Math.min(W - P * 2, g.measureText(s).width + 64);
    kotak(P, ly - 52, w, 76, 'rgba(255,255,255,.18)', 38);
    teks(s, P + 32, ly, 34, '#ffffff', 700, 'left', W - P * 2 - 64);
    ly += 96;
  });
  kakiMerek(g, W, H - 50, 30, 'rgba(255,255,255,.8)');
  return c;
}

let STORY = null; // { k, aman, c }
async function bukaBagikanStory(k) {
  STORY = { k, aman: true, c: null };
  bukaSheet(T('Bagikan ke Story'), `
    <div class="chips">
      <button type="button" class="chip aktif" data-aksi="story-mode" data-aman="1">${T('🔒 Tanpa nominal')}</button>
      <button type="button" class="chip" data-aksi="story-mode" data-aman="0">${T('Dengan nominal')}</button>
    </div>
    <div class="pratinjau-story" id="pratinjau-story" aria-busy="true"></div>
    <p class="info-kecil" id="ket-story">${T('Aman dibagikan: hanya persen & emoji, tanpa angka rupiah.')}</p>
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="story-bagikan">${T('📤 Bagikan')}</button></div>`);
  await gambarPratinjauStory();
}
async function gambarPratinjauStory() {
  if (!STORY) return;
  const s = STORY;
  try {
    s.c = await gambarStory(s.k, s.aman);
  } catch (e) {
    toast(T('Gambar tidak bisa dibuat: {pesan}', { pesan: pesanError(e) }), true);
    return;
  }
  const el = $('#pratinjau-story');
  if (!el || STORY !== s) return;
  el.removeAttribute('aria-busy');
  el.innerHTML = `<img src="${s.c.toDataURL('image/png')}" alt="${esc(T('Pratinjau rangkuman {bulan}', { bulan: namaBulan(s.k) }))}">`;
}

// ---------- 6. Kartu dompet bergaya kartu fisik ----------

function warnaKartu(w) {
  const c = typeof ILUSTRASI !== 'undefined' && ILUSTRASI.warna ? ILUSTRASI.warna(w.ikon) : null;
  return c || { bg: '#4F46E5', fg: '#FFFFFF', label: '' };
}

/**
 * Dompet bertumpuk: semua dompet tampil sebagai strip ringkas (nama + saldo) supaya semua saldo terlihat sekaligus.
 * Ketuk strip → kartu penuh muncul (satu kartu terbuka); ketuk kartu → ubah dompet; ⌃ di pojok kartu → kembali jadi strip.
 */
let KARTU_DOMPET_BUKA = '';
function deretKartuDompet(dompet) {
  if (!dompet.length) return `<section class="kartu" style="padding:4px 16px">${kosong('👛', T('Belum ada dompet.'))}</section>`;
  return `<div class="tumpuk-dompet" role="list" aria-label="${T('Dompet||jamak')}">
    ${dompet.map(w => {
      const c = warnaKartu(w);
      const nama = esc(namaT(w.nama));
      const logo = c.label ? `<b class="kd-merek">${esc(c.label)}</b>` : `<span class="kd-ilus">${ilus(w.ikon)}</span>`;
      return `<div class="kd-item ${KARTU_DOMPET_BUKA === w.nama ? 'buka' : ''}" role="listitem" data-nama="${esc(w.nama)}" style="--c:${c.bg};--fg:${c.fg}">
        <button type="button" class="kd-strip" data-aksi="buka-kartu-dompet" data-nama="${esc(w.nama)}" aria-expanded="${KARTU_DOMPET_BUKA === w.nama}"
          aria-label="${nama}: ${rp(w.saldo)}">
          <span class="kd-logo"><span class="kd-ilus">${ilus(w.ikon)}</span></span>
          <span class="kd-nama">${nama}</span>
          <b class="kd-saldo-strip nominal ${w.saldo < 0 ? 'minus' : ''}">${rp(w.saldo)}</b>
        </button>
        <div class="kd-penuh">
          <button type="button" class="kartu-dompet" data-aksi="edit-dompet" data-nama="${esc(w.nama)}" aria-label="${T('Ubah {nama}', { nama })}">
            <span class="kd-atas">${logo}<span class="kd-nirkontak" aria-hidden="true"><i></i><i></i><i></i></span></span>
            <span class="kd-chip" aria-hidden="true"></span>
            <span class="kd-bawah"><small class="kd-nama">${nama}</small>
              <b class="kd-saldo nominal ${w.saldo < 0 ? 'minus' : ''}">${rpBesar(w.saldo)}</b></span>
          </button>
          <button type="button" class="kd-tutup" data-aksi="buka-kartu-dompet" data-nama="" aria-label="${T('Tutup kartu')}">${svg('maju')}</button>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/** Buka satu kartu (yang lain kembali jadi strip) tanpa render ulang, supaya animasinya halus. */
function bukaKartuDompet(nama) {
  KARTU_DOMPET_BUKA = KARTU_DOMPET_BUKA === nama ? '' : nama;
  document.querySelectorAll('.tumpuk-dompet .kd-item').forEach(el => {
    const buka = el.dataset.nama === KARTU_DOMPET_BUKA;
    el.classList.toggle('buka', buka);
    const s = el.querySelector('.kd-strip');
    if (s) s.setAttribute('aria-expanded', buka);
  });
}

// ---------- Sambungan ke app.js ----------

const renderAsli = render;
render = function (...args) { // eslint-disable-line no-func-assign
  const hasil = renderAsli.apply(this, args);
  gulirkanAngka();
  if (S.tab === 'beranda' && S.data && !S.data.perluSetup && S.data.jejak) {
    setTimeout(() => { cekPencapaianStreak(); cekTantanganSelesai(); }, 1200);
  }
  return hasil;
};

// Kilas balik: slide julukan setelah slide kategori terbesar.
const slideKilasAsli = slideKilas;
slideKilas = function (k) { // eslint-disable-line no-func-assign
  const slide = slideKilasAsli(k);
  const r = ringkasBulan(k);
  if (r.keluar || r.masuk) {
    const ps = personaBulan(r);
    const tanpa = S.data.jejak ? hariTanpaBelanja(k) : 0;
    slide.splice(Math.max(1, slide.length - 1), 0, `<div class="kilas-isi tengah"><span class="kilas-emoji">${ps.emoji}</span>
      <small>${T('Julukan Anda bulan itu')}</small><h2>${esc(ps.nama)}</h2><p>${esc(ps.ket)}</p>
      ${tanpa ? `<div class="kilas-baris"><span>${T('🌱 Hari tanpa belanja')}</span><b>${tanpa}</b></div>` : ''}</div>`);
  }
  return slide;
};

Object.assign(AKSI, {
  'buka-kartu-dompet': el => bukaKartuDompet(el.dataset.nama || ''),
  'buka-kebiasaan': () => bukaKebiasaan(),
  'tandai-kosong': async el => {
    const tgl = el.dataset.tgl;
    if (!tgl || hariTercatat(tgl)) return;
    if (tgl !== hariIni() && !(await tanya(T('Tandai {hari} sebagai hari tanpa belanja?', { hari: labelTanggal(tgl) }), T('Tandai'), true))) return;
    const baru = await ubahTantanganLalu(isi => {
      isi.hariKosong = Array.from(new Set((isi.hariKosong || []).concat(tgl))).sort().slice(-120);
      return isi;
    });
    if (!baru) return;
    getarHalus([12, 50, 12]);
    toast(T('✋ {hari} ditandai tanpa belanja. Streak aman 🔥', { hari: labelTanggal(tgl) }));
    segarkanKebiasaan();
  },
  'batal-kosong': async el => {
    const tgl = el.dataset.tgl;
    if (!tgl || !hariKosong().has(tgl)) return;
    if (!(await tanya(T('Batalkan tanda tanpa belanja di {hari}?', { hari: labelTanggal(tgl) }), T('Batalkan tanda')))) return;
    const baru = await ubahTantanganLalu(isi => {
      isi.hariKosong = (isi.hariKosong || []).filter(x => x !== tgl);
      return isi;
    });
    if (!baru) return;
    toast(T('Tanda tanpa belanja di {hari} dibatalkan.', { hari: labelTanggal(tgl) }));
    segarkanKebiasaan();
  },
  'mulai-tantangan': el => bukaFormTantangan(el.dataset.jenis),
  'ubah-tantangan': el => {
    const t = (tantanganData().aktif || []).find(x => x.id === el.dataset.id);
    if (t) bukaFormTantangan(t.jenis, t, t.id);
  },
  'ulang-tantangan': el => {
    const x = (tantanganData().selesai || []).find(y => y.id === el.dataset.id);
    if (x && JENIS_TANTANGAN[x.jenis]) bukaFormTantangan(x.jenis, x.cfg || null);
  },
  'tg-set': el => {
    if (!TG) return;
    const k = el.dataset.k;
    TG[k] = el.dataset.num ? Number(el.dataset.v) : el.dataset.v;
    if (k === 'unit' || k === 'batas') TG.lain = '';
    if (k === 'pola') {
      const lain = PILIHAN_UNIT_52[TG.pola === 'tetap' ? 'naik' : 'tetap'];
      if (TG.lain !== 'unit' && !PILIHAN_UNIT_52[TG.pola].includes(TG.unit) && lain.includes(TG.unit)) TG.unit = PILIHAN_UNIT_52[TG.pola][TG.pola === 'tetap' ? 2 : 1];
    }
    if (k === 'hari' && TG.jenis === 'hemat' && !TARGET_HEMAT[TG.hari].includes(TG.target)) TG.target = TARGET_HEMAT[TG.hari][1];
    renderFormTantangan();
  },
  'tg-lain': el => {
    if (!TG) return;
    TG.lain = el.dataset.k;
    TG[el.dataset.k] = 0;
    renderFormTantangan(true);
  },
  'simpan-tantangan': async el => {
    if (!TG) return;
    const g = TG, jenis = g.jenis;
    if ((jenis === 'tanpa' || jenis === 'batas') && !g.kategori) return toast(T('Pilih kategorinya dulu.'), true);
    if (jenis === '52' && !(g.unit > 0)) return toast(T('Isi nominal setorannya dulu.'), true);
    if (jenis === 'batas' && !(g.batas > 0)) return toast(T('Isi batas per minggunya dulu.'), true);
    const aktif = tantanganData().aktif || [];
    const lama = g.ubahId ? aktif.find(x => x.id === g.ubahId) : null;
    if (g.ubahId && !lama) { toast(T('Tantangan ini sudah tidak aktif.'), true); return bukaKebiasaan(); }
    if (!lama && aktif.length >= MAKS_TANTANGAN) return toast(T('Maksimal {n} tantangan sekaligus.', { n: MAKS_TANTANGAN }), true);
    el.disabled = true;
    const cfg = configTantangan(g);
    const mulai = lama ? lama.mulai : hariIni();
    let tabunganBaru = false;
    if ((jenis === '52' || jenis === 'persen') && !cfg.tabungan) { // tabungan baru khusus tantangan ini
      let nama = jenis === '52' ? T('52 Minggu Menabung') : T('Sisihan Pemasukan');
      while (S.data.dompet.some(w => w.nama === nama)) nama += ' ' + (new Date().getFullYear());
      loading(true);
      try {
        await api('simpanDompet', { namaLama: '', nama, ikon: jenis === '52' ? '🐷' : '💸', jenis: JENIS.TABUNGAN, saldoAwal: 0,
          target: jenis === '52' ? total52(g) : 0, tenggat: geserHari(mulai, jenis === '52' ? 364 : g.hari - 1) });
        cfg.tabungan = nama;
        tabunganBaru = true;
      } catch (e) {
        el.disabled = false;
        return toast(pesanError(e), true);
      } finally {
        loading(false);
      }
    }
    if (cfg.sumber) tulisHp('dk_sumber_setor', cfg.sumber);
    const t = lama ? { id: lama.id, jenis, mulai, oleh: lama.oleh, ...cfg }
      : { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), jenis, mulai, oleh: S.data.user, ...cfg };
    const baru = await ubahTantanganLalu(isi => {
      const a = isi.aktif || [];
      isi.aktif = lama ? a.map(x => (x.id === t.id ? t : x)) : a.concat(t);
      return isi;
    });
    el.disabled = false;
    if (!baru) return;
    if (tabunganBaru) await muat(); // tabungan baru ikut tampil
    TG = null;
    getarHalus([12, 50, 12]);
    toast(lama ? T('Tantangan diperbarui.') : T('🏁 Tantangan dimulai. Semangat!'));
    bukaKebiasaan();
    if (S.tab === 'beranda') render();
  },
  'lepas-tantangan': async el => {
    const t = (tantanganData().aktif || []).find(x => x.id === el.dataset.id);
    if (!t || !(await tanya(T('Lepas tantangan "{judul}"?', { judul: judulTantangan(t) }), T('Lepas')))) return;
    const baru = await ubahTantanganLalu(isi => { isi.aktif = (isi.aktif || []).filter(x => x.id !== t.id); return isi; });
    if (baru) { toast(T('Tantangan dilepas')); segarkanKebiasaan(); }
  },
  'setor-tantangan': el => {
    const t = (tantanganData().aktif || []).find(x => x.id === el.dataset.id);
    if (!t) return;
    const biasa = dompetBiasa();
    const sumber = biasa.find(w => w.nama === t.sumber) || biasa.find(w => w.nama === bacaHp('dk_sumber_setor')) || biasa[0];
    if (!sumber) return toast(T('Buat dompet dulu sebagai sumber setoran.'), true);
    bukaFormTrx(null, { tipe: TIPE.TRANSFER, dompet: sumber.nama, dompetTujuan: t.tabungan, jumlah: Number(el.dataset.jumlah) || t.unit || 0, catatan: judulTantangan(t) },
      T('Setor ke {nama}', { nama: namaT(t.tabungan) }));
  },
  'info-lencana': el => {
    const l = daftarLencana()[Number(el.dataset.i)];
    if (!l) return;
    const [ikon, nama, dapat, ket] = l;
    toast(`${dapat ? ikon : '🔒'} ${nama} — ${ket}${dapat ? ' ✓' : ' · ' + T('belum diraih')}`);
  },
  'gaya-santai': () => { tulisHp('dk_gaya_ditawarkan', '1'); gantiGaya('santai'); },
  'gaya-tolak': () => { tulisHp('dk_gaya_ditawarkan', '1'); render(); },

  'cek-beli': () => bukaCekBeli(),
  'cb-catat': () => {
    if (!CB || !CB.harga) return;
    simpanRiwayatCBSekarang();
    const { harga, nama, hasil } = CB;
    CB = null;
    bukaFormTrx(null, { tipe: TIPE.KELUAR, jumlah: harga, catatan: namaBarang(nama), kategori: hasil ? hasil.kategori : '' });
  },
  'cb-tabung': () => {
    if (!CB || !CB.harga) return;
    simpanRiwayatCBSekarang();
    const { harga, nama } = CB;
    CB = null;
    bukaFormDompet(null, JENIS.TABUNGAN);
    if ($('#d-nama')) $('#d-nama').value = namaBarang(nama) || T('Barang impian');
    if ($('#d-target')) $('#d-target').value = formatAngka(harga);
  },
  'cb-ai': async el => {
    if (!CB || !CB.hasil) return;
    if (!navigator.onLine) return toast(T('Pendapat AI butuh sinyal.'), true);
    simpanRiwayatCBSekarang(); // cek ini harus sudah ada di riwayat sebelum jawabannya datang
    const { id, harga, nama } = CB;
    const fakta = CB.hasil.fakta;
    const lembarCB = () => !$('#sheet').hidden && $('#cb-hasil');
    const masihDibuka = () => lembarCB() && CB && CB.id === id && CB.harga === harga && CB.nama === nama;
    AI_CB_JALAN.add(id);
    el.remove();
    $('#cb-ai').innerHTML = htmlAiCBMenimbang();
    let s = '';
    try {
      s = await api('saranBeli', fakta, BAHASA, GAYA === 'santai');
      if (s) ubahRiwayatCB(id, { ai: s });
      if (!masihDibuka() && s) toast(T('✨ Pendapat AI untuk {nama} sudah siap. Lihat di Cek beli → Riwayat cek.', { nama: namaBarang(nama) || rp(harga) }));
    } catch (e) {
      toast(pesanError(e), true);
    } finally {
      AI_CB_JALAN.delete(id);
      // Tampilkan jawabannya (atau tombolnya lagi kalau gagal); daftar riwayat ikut diperbarui kalau sedang terlihat.
      if (lembarCB() && CB && (CB.id === id || !CB.harga)) gambarCekBeli();
    }
  },
  'cb-riwayat': el => {
    const x = riwayatCB().find(y => y.id === el.dataset.id);
    if (!x || !CB) return;
    CB = { id: x.id, manual: true };
    $('#cb-teks').value = x.teks || '';
    $('#cb-harga').value = formatAngka(x.harga);
    gambarCekBeli(); // dihitung ulang dengan angka terbaru; pendapat AI yang tersimpan ikut tampil
  },
  'cb-hapus-riwayat': async () => {
    if (!(await tanya(T('Hapus semua riwayat cek sebelum beli di HP ini?'), T('Hapus')))) return;
    tulisRiwayatCB([]);
    gambarCekBeli();
  },

  'bagikan-story': el => bukaBagikanStory(el.dataset.bulan),
  'story-mode': async el => {
    if (!STORY) return;
    STORY.aman = el.dataset.aman === '1';
    document.querySelectorAll('[data-aksi="story-mode"]').forEach(b => b.classList.toggle('aktif', b === el));
    $('#ket-story').textContent = STORY.aman ? T('Aman dibagikan: hanya persen & emoji, tanpa angka rupiah.') : T('Nominal rupiah ikut tampil. Bagikan hanya ke orang yang Anda percaya.');
    $('#pratinjau-story').setAttribute('aria-busy', 'true');
    await gambarPratinjauStory();
  },
  'story-bagikan': async el => {
    if (!STORY || !STORY.c) return;
    el.disabled = true;
    const { k, aman, c } = STORY;
    const r = ringkasBulan(k);
    const ket = aman ? T('Rangkuman {bulan} saya: {persona} {emoji}', { bulan: namaBulan(k), persona: personaBulan(r, k === periodeSekarang()).nama, emoji: personaBulan(r, k === periodeSekarang()).emoji })
      : T('Ringkasan keuangan {bulan}: pemasukan {masuk}, pengeluaran {keluar}, selisih {selisih}.', { bulan: namaBulan(k), masuk: rp(r.masuk), keluar: rp(r.keluar), selisih: rp(r.masuk - r.keluar) });
    try { await bagikanKanvas(c, 'story-' + k + '.png', T('Rangkuman {bulan}', { bulan: namaBulan(k) }), ket); } catch (e) { toast(pesanError(e), true); }
    el.disabled = false;
  },
  // Dari kilas balik: tutup story lalu buka pilihan bagikan (story tanpa nominal / dengan nominal).
  'kilas-bagikan': () => {
    const k = kilas && kilas.k;
    if (!k) return;
    tutupKilasBalik();
    bukaBagikanStory(k);
  },
});
