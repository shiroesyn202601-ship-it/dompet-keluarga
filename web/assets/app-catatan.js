// Dompet Keluarga · Catatan & pengingat: kalender, daftar tugas, catatan offline, draf, dikte, overlay pengingat.
// Bagian dari aplikasi (dimuat berurutan di index.html: app.js → app-*.js → muda.js; semua berbagi lingkup global).

// ---------- Catatan & pengingat (kalender) ----------
// Catatan disimpan di sheet "Catatan" buku ini, jadi seluruh anggota keluarga melihat kalender yang sama.
// Catatan berpengingat muncul sebagai overlay saat aplikasi dibuka di tanggalnya (atau sampai 7 hari sesudahnya
// kalau terlewat), sampai ditutup "Oke" di HP itu. "Ingatkan besok" menunda sehari.

const WARNA_CATATAN = [['biru', '#3b82f6'], ['hijau', '#10b981'], ['kuning', '#f59e0b'], ['merah', '#ef4444'], ['ungu', '#8b5cf6']];
const warnaCatatan = k => (WARNA_CATATAN.find(w => w[0] === k) || WARNA_CATATAN[0])[1];
const NAMA_WARNA = { biru: T('biru'), hijau: T('hijau'), kuning: T('kuning'), merah: T('merah'), ungu: T('ungu') };
const NAMA_HARI_PENDEK = [T('Sen'), T('Sel'), T('Rab'), T('Kam'), T('Jum'), T('Sab'), T('Min||hari')];
const daftarCatatan = () => (S.data && S.data.catatan) || []; // data offline versi lama belum punya catatan

const isoDari = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const geserHari = (iso, n) => { const d = keTanggal(iso); d.setDate(d.getDate() + n); return isoDari(d); };
const hariDalamBulan = (y, m) => new Date(y, m, 0).getDate(); // m: 1–12

/** Apakah catatan ini terjadi di tanggal iso (memperhitungkan pengulangan)? */
function terjadiPada(c, iso) {
  if (!c.tanggal || iso < c.tanggal) return false; // catatan tanpa tanggal tidak tampil di kotak kalender
  if (!c.ulang) return iso === c.tanggal;
  const [y, m, d] = iso.split('-').map(Number);
  const [, m0, d0] = c.tanggal.split('-').map(Number);
  if (c.ulang === 'Mingguan') return Math.round((keTanggal(iso) - keTanggal(c.tanggal)) / 864e5) % 7 === 0;
  const hariPatokan = Math.min(d0, hariDalamBulan(y, m)); // tanggal 31 → 30/28 di bulan yang lebih pendek
  if (c.ulang === 'Bulanan') return d === hariPatokan;
  if (c.ulang === 'Tahunan') return m === m0 && d === hariPatokan;
  return false;
}

const catatanPada = iso => daftarCatatan().filter(c => terjadiPada(c, iso));
const tagihanPada = iso => daftarRutin().filter(r => r.berikutnya === iso);

/** "Hari ini" / "Besok" / "Kemarin" / "Kamis, 5 Nov". */
function labelHariPendek(iso) {
  const n = Math.round((keTanggal(iso) - keTanggal(hariIni())) / 864e5);
  if (n === 0) return T('Hari ini');
  if (n === 1) return T('Besok');
  if (n === -1) return T('Kemarin');
  return keTanggal(iso).toLocaleDateString(LOKAL, { weekday: 'long', day: 'numeric', month: 'short' });
}

/** Pindah ke halaman penuh (Catatan / Sholat), menutup lembar bawah yang mungkin masih terbuka. */
function bukaHalaman(tab) {
  if (!$('#sheet').hidden) tutupSheet();
  const pindah = S.tab !== tab;
  S.tab = tab;
  render();
  if (pindah) window.scrollTo(0, 0);
}

/** Halaman kalender bulanan (mulai Senin). S.kal = { bulan: 'yyyy-mm', pilih: 'yyyy-mm-dd' }. */
function bukaKalender(pilih) {
  const tgl = pilih || (S.kal && S.kal.pilih) || hariIni();
  S.kal = { bulan: tgl.slice(0, 7), pilih: tgl };
  bukaHalaman('catatan');
}

function viewCatatan() {
  if (!S.kal) S.kal = { bulan: hariIni().slice(0, 7), pilih: hariIni() };
  return `
    <div class="kepala kepala-kembali">
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${T('Catatan & Pengingat')}</h1>
    </div>
    <section class="kartu halaman-kalender"><div id="kalender">${htmlKalender()}</div></section>`;
}

function renderKalender() {
  const kotak = $('#kalender');
  if (!kotak) return;
  kotak.innerHTML = htmlKalender();
  pasangGeserKalender();
}

function htmlKalender() {
  const [y, m] = S.kal.bulan.split('-').map(Number);
  const awal = new Date(y, m - 1, 1);
  const geserAwal = (awal.getDay() + 6) % 7; // Senin = 0
  const mulai = new Date(y, m - 1, 1 - geserAwal);
  const hari = hariIni();
  const sel = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(mulai.getFullYear(), mulai.getMonth(), mulai.getDate() + i);
    const iso = isoDari(d);
    if (i >= 35 && d.getMonth() !== m - 1) break; // baris ke-6 hanya kalau perlu
    const ada = catatanPada(iso);
    const tagihan = tagihanPada(iso);
    // Kotak hampir persegi (sama dengan kalender Riwayat): satu label (abu-abu = tagihan), sisanya "+n".
    const label = ada.length ? `<i style="--w:${warnaCatatan(ada[0].warna)}">${esc(ada[0].judul)}</i>`
      : tagihan.length ? `<i class="tagihan">${esc(tagihan[0].nama)}</i>` : '';
    const sisa = ada.length + tagihan.length - (label ? 1 : 0);
    sel.push(`<button type="button" class="kal-sel ${d.getMonth() !== m - 1 ? 'luar' : ''} ${iso === hari ? 'hari-ini' : ''} ${iso === S.kal.pilih ? 'pilih' : ''}"
      data-aksi="kal-tgl" data-tgl="${iso}" aria-label="${esc(keteranganHari(iso))}${ada.length ? T(', {n} catatan', { n: ada.length }) : ''}">
      <span class="kal-angka">${d.getDate()}</span>${sisa > 0 ? `<b class="kal-lagi">+${sisa}</b>` : ''}${label ? `<span class="kal-isi">${label}</span>` : ''}</button>`);
  }

  const dipilih = catatanPada(S.kal.pilih);
  const tagihanDipilih = tagihanPada(S.kal.pilih);
  return `
    <div class="kal-kepala">
      <button type="button" class="tombol-ikon" data-aksi="kal-bulan" data-geser="-1" aria-label="${T('Bulan sebelumnya')}">${svg('kembali')}</button>
      <b>${awal.toLocaleDateString(LOKAL, { month: 'long', year: 'numeric' })}</b>
      <button type="button" class="tombol-ikon" data-aksi="kal-bulan" data-geser="1" aria-label="${T('Bulan berikutnya')}">${svg('maju')}</button>
      ${S.kal.bulan !== hari.slice(0, 7) || S.kal.pilih !== hari ? '<button type="button" class="chip" data-aksi="kal-tgl" data-tgl="' + hari + '">' + T('Hari ini') + '</button>' : ''}
    </div>
    <div class="kal-hari">${NAMA_HARI_PENDEK.map(h => `<span>${h}</span>`).join('')}</div>
    <div class="kal-grid" id="kal-grid">${sel.join('')}</div>
    <h3 class="kal-judul-hari">${esc(keteranganHari(S.kal.pilih))}</h3>
    ${dipilih.map(itemCatatan).join('')}
    ${tagihanDipilih.map(r => `
      <button type="button" class="kal-item tagihan" data-aksi="kelola-rutin">
        <span class="isi"><b>💡 ${esc(r.nama)}</b><small>${T('Tagihan rutin')} · ${rp(r.jumlah)}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>`).join('')}
    ${dipilih.length || tagihanDipilih.length ? '' : '<p class="info-kecil" style="text-align:left;margin-top:0">' + T('Belum ada catatan di tanggal ini.') + '</p>'}
    ${S.data.bisaCatatan === false ? '<p class="info-kecil" style="text-align:left">' + T('⚠️ Buku ini belum bisa menyimpan catatan (butuh akses Editor ke spreadsheet).') + '</p>' : ''}
    ${htmlCatatanTanpaTanggal()}
    <div class="aksi-form"><button type="button" class="btn btn-utama" data-aksi="tambah-catatan">${T('＋ Catatan')}</button></div>`;
}

/** Catatan tanpa tanggal: selalu tampil di bawah kalender, apa pun tanggal yang dipilih. */
function htmlCatatanTanpaTanggal() {
  const daftar = daftarCatatan().filter(c => !c.tanggal);
  if (!daftar.length) return '';
  return `<h3 class="kal-judul-hari">📌 ${T('Tanpa tanggal')}</h3>${daftar.map(itemCatatan).join('')}`;
}

/** Geser kiri/kanan di kalender untuk ganti bulan. */
function pasangGeserKalender() {
  const grid = $('#kal-grid');
  if (!grid) return;
  let x0 = null, y0 = 0;
  grid.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) gantiBulanKalender(dx < 0 ? 1 : -1);
  });
}

function gantiBulanKalender(n) {
  const [y, m] = S.kal.bulan.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  S.kal.bulan = isoDari(d).slice(0, 7);
  // Tanggal terpilih ikut pindah ke bulan itu (hari ini kalau bulan ini, selain itu tanggal 1).
  S.kal.pilih = S.kal.bulan === hariIni().slice(0, 7) ? hariIni() : S.kal.bulan + '-01';
  renderKalender();
}

// ---------- Daftar tugas (to-do) di catatan ----------
// Disimpan di kolom Isi sebagai baris "[ ] item" / "[x] item", jadi tetap terbaca di spreadsheet & tanpa kolom baru.
const POLA_TUGAS = /^\[( |x)\] ?(.*)$/i;
function bacaTugas(isi) {
  const baris = String(isi || '').split('\n').map(b => b.trim()).filter(Boolean);
  if (!baris.length || !baris.every(b => POLA_TUGAS.test(b))) return null;
  return baris.map(b => { const m = b.match(POLA_TUGAS); return { teks: m[2], selesai: m[1].toLowerCase() === 'x' }; });
}
const tulisTugas = daftar => daftar.filter(t => t.teks.trim()).map(t => (t.selesai ? '[x] ' : '[ ] ') + t.teks.trim()).join('\n');

/** Checklist yang bisa dicentang langsung (kalender & overlay pengingat). */
function daftarCentang(c, semua) {
  const tugas = bacaTugas(c.isi) || [];
  const tampil = semua ? tugas : tugas.slice(0, 6);
  return `<div class="daftar-centang">${tampil.map((t, i) => `
      <button type="button" class="centang ${t.selesai ? 'selesai' : ''}" role="checkbox" aria-checked="${t.selesai}"
        data-aksi="centang-tugas" data-id="${esc(c.id)}" data-i="${i}"><span class="kotak-centang" aria-hidden="true"></span><span>${esc(t.teks)}</span></button>`).join('')}
      ${tugas.length > tampil.length ? `<small class="centang-lagi">${T('+{n} item lagi', { n: tugas.length - tampil.length })}</small>` : ''}</div>`;
}

function itemCatatan(c) {
  const meta = `${c.pengingat ? T('🔔 Pengingat') : T('📝 Catatan')}${c.ulang ? ' · 🔁 ' + namaT(c.ulang).toLowerCase() : ''}${c.oleh ? ' · ' + esc(namaPendek(c.oleh)) : ''}`;
  const tugas = bacaTugas(c.isi);
  if (!tugas) {
    return `
      <button type="button" class="kal-item" data-aksi="ubah-catatan" data-id="${esc(c.id)}" style="--w:${warnaCatatan(c.warna)}">
        <span class="isi"><b>${esc(c.judul)}</b>${c.isi ? `<small>${esc(c.isi)}</small>` : ''}<small class="kal-meta">${meta}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>`;
  }
  const selesai = tugas.filter(t => t.selesai).length;
  return `
    <div class="kal-item kal-tugas ${selesai === tugas.length ? 'tuntas' : ''}" style="--w:${warnaCatatan(c.warna)}">
      <button type="button" class="kal-tugas-kepala" data-aksi="ubah-catatan" data-id="${esc(c.id)}">
        <span class="isi"><b>${esc(c.judul)}</b><small class="kal-meta">☑️ ${T('{a}/{b} selesai', { a: selesai, b: tugas.length })} · ${meta}</small></span>
        <span class="panah">${svg('maju')}</span>
      </button>
      <div class="progres-tugas"><i style="width:${Math.round(selesai / tugas.length * 100)}%"></i></div>
      ${daftarCentang(c)}
    </div>`;
}

function barisTugasForm(t) {
  return `<div class="baris-tugas ${t.selesai ? 'selesai' : ''}">
      <button type="button" class="kotak-centang" data-aksi="c-tugas-centang" role="checkbox" aria-checked="${t.selesai}" aria-label="${T('Tandai selesai')}"></button>
      <input maxlength="200" enterkeyhint="next" placeholder="${T('Tulis item…')}" value="${esc(t.teks)}">
      <button type="button" class="tombol-hapus-tugas" data-aksi="c-tugas-hapus" aria-label="${T('Hapus item')}">✕</button>
    </div>`;
}
const tugasDariForm = () => [...document.querySelectorAll('#c-tugas .baris-tugas')].map(r => ({
  teks: r.querySelector('input').value, selesai: r.classList.contains('selesai'),
}));
function tambahBarisTugas(setelah, teks) {
  const tmp = document.createElement('div');
  tmp.innerHTML = barisTugasForm({ teks: teks || '', selesai: false });
  const baris = tmp.firstElementChild;
  if (setelah) setelah.after(baris); else $('#c-tugas').appendChild(baris);
  baris.querySelector('input').focus();
}

// Centang dari kalender/overlay: tampilan langsung berubah, simpan di latar (berurutan supaya tidak saling timpa).
let antrianTugas = Promise.resolve();
let tugasUntukTrx = '';
function centangTugas(id, i) {
  const c = daftarCatatan().find(x => x.id === id);
  const tugas = c && bacaTugas(c.isi);
  if (!tugas || !tugas[i]) return;
  const isiLama = c.isi;
  tugas[i].selesai = !tugas[i].selesai;
  c.isi = tulisTugas(tugas);
  getar();
  segarkanCentang(c);
  if (tugas[i].selesai) { // item belanja dicentang → tawarkan catat sebagai pengeluaran
    tugasUntukTrx = tugas[i].teks;
    toast('✔ ' + tugas[i].teks, false, { label: T('Catat pengeluaran'), aksi: 'tugas-jadi-trx' });
  }
  const kirimIsi = c.isi;
  antrianTugas = antrianTugas.then(() => api('simpanCatatan', {
    id: c.id, tanggal: c.tanggal, judul: c.judul, isi: kirimIsi, pengingat: c.pengingat, ulang: c.ulang, warna: c.warna,
  })).catch(e => {
    c.isi = isiLama;
    segarkanCentang(c);
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(T('Centang belum tersimpan: {pesan}', { pesan: pesanError(e) }), true);
  });
}
function segarkanCentang(c) {
  if ($('#kalender')) renderKalender();
  const overlay = document.querySelector('#ingat .ingat-isi');
  if (overlay && overlay.querySelector(`[data-id="${CSS.escape(c.id)}"]`)) overlay.innerHTML = daftarCentang(c, true);
}

Object.assign(AKSI, {
  'centang-tugas': el => centangTugas(el.dataset.id, Number(el.dataset.i)),
  'c-jenis': el => {
    const jenis = el.dataset.v;
    if (jenis === S.formCatatan.jenis) return;
    simpanDraftCatatan();
    S.formCatatan.jenis = jenis;
    document.querySelectorAll('#c-jenis button').forEach(b => { b.classList.toggle('aktif', b === el); b.setAttribute('aria-selected', b === el); });
    $('#c-jenis').dataset.jenis = jenis;
    if (jenis === 'tugas') {
      // Teks yang sudah ditulis jadi item per baris.
      const baris = $('#c-isi').value.split('\n').map(b => b.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
      if (baris.length) $('#c-tugas').innerHTML = baris.map(t => barisTugasForm({ teks: t, selesai: false })).join('');
    } else {
      const isi = tugasDariForm().filter(t => t.teks.trim()).map(t => '- ' + t.teks.trim()).join('\n');
      if (isi && !$('#c-isi').value.trim()) $('#c-isi').value = isi;
    }
    $('#c-isi-teks').hidden = jenis === 'tugas';
    $('#c-isi-tugas').hidden = jenis !== 'tugas';
    tinggiIsiCatatan();
    if (jenis === 'tugas') { const kosong = [...document.querySelectorAll('#c-tugas input')].find(x => !x.value); if (kosong) kosong.focus(); }
  },
  'c-tugas-tambah': () => tambahBarisTugas(),
  'suara-catatan': () => mulaiDikte(),
  'c-tugas-centang': el => {
    const baris = el.closest('.baris-tugas');
    baris.classList.toggle('selesai');
    el.setAttribute('aria-checked', baris.classList.contains('selesai'));
  },
  'c-tugas-hapus': el => {
    const baris = el.closest('.baris-tugas');
    if (document.querySelectorAll('#c-tugas .baris-tugas').length > 1) baris.remove();
    else { baris.querySelector('input').value = ''; baris.classList.remove('selesai'); }
  },
});

// Enter di item = item baru di bawahnya; Backspace di item kosong = hapus & pindah ke item sebelumnya.
document.addEventListener('keydown', e => {
  const input = e.target.closest && e.target.closest('#c-tugas .baris-tugas input');
  if (!input) return;
  const baris = input.closest('.baris-tugas');
  if (e.key === 'Enter') {
    e.preventDefault();
    tambahBarisTugas(baris);
  } else if (e.key === 'Backspace' && !input.value && document.querySelectorAll('#c-tugas .baris-tugas').length > 1) {
    e.preventDefault();
    const sebelum = baris.previousElementSibling || baris.nextElementSibling;
    baris.remove();
    const x = sebelum && sebelum.querySelector('input');
    if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); }
  }
});

/**
 * Form catatan sebagai halaman penuh (tab 'catatan-edit'). c: catatan yang diubah (null = baru); tanggal: untuk catatan baru.
 * Isian disimpan di S.formCatatan & dibaca ulang dari layar sebelum render, supaya muat ulang data di latar tidak menghapus ketikan.
 */
/** tanggal '' = catatan tanpa tanggal (tanpa pengingat & pengulangan). */
function bukaFormCatatan(c, tanggal) {
  const x = c || { judul: '', isi: '', tanggal: tanggal === '' ? '' : tanggal || hariIni(), pengingat: tanggal !== '', ulang: '', warna: 'biru' };
  const tugas = bacaTugas(x.isi);
  S.formCatatan = {
    id: c ? c.id : '', oleh: c ? c.oleh : '', judul: x.judul, tanggal: x.tanggal, pengingat: x.pengingat, ulang: x.ulang,
    warna: x.warna || 'biru', jenis: tugas ? 'tugas' : 'teks', isi: tugas ? '' : x.isi, tugas: tugas || [{ teks: '', selesai: false }],
    fokus: !c,
  };
  const draf = bacaDrafCatatan(S.formCatatan.id);
  S.formCatatan.awal = jejakCatatan(S.formCatatan);
  if (draf) {
    Object.assign(S.formCatatan, draf);
    setTimeout(() => toast(T('📝 Isian yang belum disimpan dipulihkan'), false, { label: T('Buang'), aksi: 'buang-draf-catatan' }), 300);
  }
  bukaHalaman('catatan-edit');
}

// ---------- Catatan tanpa sinyal: disimpan di HP, dikirim otomatis saat online ----------
const catatanTertunda = () => bacaLokal('catatan_tertunda', []).filter(bukuIni);
function antreCatatan(input, idLama) {
  const x = Object.assign({}, input, { id: input.id || crypto.randomUUID(), buku: S.data.spreadsheetId });
  tulisLokal('catatan_tertunda', bacaLokal('catatan_tertunda', []).filter(c => c.id !== x.id).concat([x]));
  // Tampil langsung di kalender (data lokal), sebelum terkirim.
  const daftar = S.data.catatan || (S.data.catatan = []);
  const lokal = { id: x.id, tanggal: x.tanggal, judul: x.judul, isi: x.isi, pengingat: x.pengingat, ulang: x.ulang, warna: x.warna, oleh: S.data.user, tertunda: true };
  const i = daftar.findIndex(c => c.id === x.id);
  if (i >= 0) daftar[i] = lokal; else daftar.push(lokal);
  tulisLokal('data', S.data);
  buangDrafCatatan(idLama);
  toast(T('📴 Catatan disimpan di HP. Dikirim otomatis begitu ada sinyal.'));
  bukaKalender(x.tanggal);
  return true;
}
let mengirimCatatan = false;
async function kirimCatatanTertunda() {
  if (mengirimCatatan || !GOOGLE.sudahMasuk() || !catatanTertunda().length) return;
  mengirimCatatan = true;
  let terkirim = 0;
  try {
    for (const c of catatanTertunda()) {
      const input = Object.assign({}, c);
      delete input.buku;
      await api('simpanCatatan', input);
      tulisLokal('catatan_tertunda', bacaLokal('catatan_tertunda', []).filter(x => x.id !== c.id));
      terkirim++;
    }
  } catch (e) { /* sinyal putus lagi: dicoba lain kali */ }
  mengirimCatatan = false;
  if (terkirim) { toast(T('{n} catatan terkirim ✔', { n: terkirim })); muat(); }
}

// ---------- Draf catatan (tersimpan di HP selama belum disimpan ke spreadsheet) ----------
const kunciDrafCatatan = id => 'dk_draf_catatan_' + (S.data && S.data.spreadsheetId || '') + '_' + (id || 'baru');
const jejakCatatan = f => JSON.stringify([f.judul, f.jenis === 'tugas' ? '' : f.isi, f.jenis === 'tugas' ? tulisTugas(f.tugas || []) : '',
  f.jenis, f.tanggal, f.pengingat, f.ulang, f.warna]);
function bacaDrafCatatan(id) {
  try {
    const d = JSON.parse(bacaHp(kunciDrafCatatan(id)));
    return d && Date.now() - d.waktu < 14 * 864e5 ? d.isian : null;
  } catch (e) { return null; }
}
function buangDrafCatatan(id) { tulisHp(kunciDrafCatatan(id), null); }
/** Dipanggil saat mengetik / mengubah opsi: simpan draf kalau berbeda dari isi awal, hapus kalau sama. */
function catatDrafCatatan() {
  const f = S.formCatatan;
  if (!f || !$('#c-judul')) return;
  simpanDraftCatatan();
  if (jejakCatatan(f) === f.awal) return buangDrafCatatan(f.id);
  tulisHp(kunciDrafCatatan(f.id), JSON.stringify({ waktu: Date.now(), isian: {
    judul: f.judul, isi: f.isi, tugas: f.tugas, jenis: f.jenis, tanggal: f.tanggal, pengingat: f.pengingat, ulang: f.ulang, warna: f.warna,
  } }));
}
let timerDrafCatatan = 0;
document.addEventListener('input', e => {
  if (S.tab !== 'catatan-edit' || !e.target.closest || !e.target.closest('.form-catatan')) return;
  clearTimeout(timerDrafCatatan);
  timerDrafCatatan = setTimeout(catatDrafCatatan, 400);
});
document.addEventListener('click', e => {
  if (S.tab === 'catatan-edit' && e.target.closest && e.target.closest('.form-catatan [data-aksi]')) setTimeout(catatDrafCatatan, 50);
});
document.addEventListener('change', e => {
  if (S.tab === 'catatan-edit' && e.target.closest && e.target.closest('.form-catatan')) setTimeout(catatDrafCatatan, 50);
});
/** Keluar dari form catatan tanpa menyimpan: isian tetap ada sebagai draf. */
function tinggalkanFormCatatan() {
  if (S.tab !== 'catatan-edit' || !S.formCatatan) return;
  catatDrafCatatan();
  if (bacaDrafCatatan(S.formCatatan.id)) toast(T('📝 Belum disimpan · isian disimpan sebagai draf'), false, { label: T('Lanjutkan'), aksi: 'lanjut-draf-catatan' });
  S.drafTerakhir = { id: S.formCatatan.id, tanggal: S.formCatatan.tanggal };
}

/** Ambil isian form yang sedang tampil ke S.formCatatan (dipanggil sebelum render ulang & saat ganti jenis). */
/** Catatan di form jadi tanpa tanggal (sekaligus tanpa pengingat & pengulangan). */
function jadikanCatatanTanpaTanggal() {
  simpanDraftCatatan();
  Object.assign(S.formCatatan, { tanggal: '', pengingat: false, ulang: '' });
  render();
}

function simpanDraftCatatan() {
  const f = S.formCatatan;
  if (!f || !$('#c-judul')) return;
  f.judul = $('#c-judul').value;
  if (f.tanggal) f.tanggal = $('#c-tanggal').value || f.tanggal; // tanpa tanggal tetap kosong
  f.isi = $('#c-isi').value;
  f.tugas = tugasDariForm();
}

// [nilai, label pendek di chip, teks pilihan]
const LABEL_ULANG = [['', T('Sekali'), T('Tidak berulang')], ['Mingguan', namaT('Mingguan'), T('Tiap minggu')], ['Bulanan', namaT('Bulanan'), T('Tiap bulan')], ['Tahunan', namaT('Tahunan'), T('Tiap tahun')]];

function viewFormCatatan() {
  const f = S.formCatatan;
  if (!f) { S.tab = 'catatan'; return viewCatatan(); }
  const tugas = f.jenis === 'tugas';
  return `
    <div class="kepala kepala-kembali kepala-form-catatan">
      <button class="tombol-ikon" data-aksi="keluar-catatan" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${f.id ? T('Ubah catatan') : T('Catatan baru')}</h1>
    </div>
    <div class="form-catatan" style="--w:${warnaCatatan(f.warna)}">
      <input class="judul-catatan" id="c-judul" maxlength="80" enterkeyhint="next" placeholder="${T('Judul')}" value="${esc(f.judul)}" aria-label="${T('Judul')}">

      <div class="saklar-jenis" id="c-jenis" data-jenis="${f.jenis}" role="tablist" aria-label="${T('Jenis catatan')}">
        <button type="button" role="tab" aria-selected="${!tugas}" class="${tugas ? '' : 'aktif'}" data-aksi="c-jenis" data-v="teks">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/></svg>${T('Teks')}</button>
        <button type="button" role="tab" aria-selected="${tugas}" class="${tugas ? 'aktif' : ''}" data-aksi="c-jenis" data-v="tugas">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="m4.5 7 1.2 1.2L8 6M12 7h9"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><path d="M12 17h9"/></svg>${T('Daftar tugas')}</button>
      </div>

      <div id="c-isi-teks" ${tugas ? 'hidden' : ''}>
        <textarea class="isi-catatan" id="c-isi" maxlength="2000" placeholder="${T('Tulis catatan… atau ketuk 🎤 untuk bicara')}" aria-label="${T('Isi catatan')}">${esc(f.isi)}</textarea>
      </div>
      <div id="c-isi-tugas" ${tugas ? '' : 'hidden'}>
        <div id="c-tugas">${f.tugas.map(barisTugasForm).join('')}</div>
        <button type="button" class="tombol-tambah-tugas" data-aksi="c-tugas-tambah">${T('＋ Tambah item')}</button>
      </div>

      ${f.oleh ? `<p class="oleh-catatan">${T('Dibuat oleh {nama}', { nama: esc(namaPendek(f.oleh)) })}</p>` : ''}

      <!-- Bilah bawah menempel (ikut naik di atas keyboard): opsi ringkas + Hapus/Simpan, mudah dijangkau jempol. -->
      <div class="bilah-catatan">
        <div class="pratinjau-dikte" id="pratinjau-dikte" role="status" aria-live="polite" hidden></div>
        <div class="opsi-catatan">
          <!-- Ketuk tanggal untuk menggantinya; ✕ (atau Clear di pemilih tanggal) = catatan tanpa tanggal. -->
          <span class="grup-tanggal-catatan"><label class="chip-opsi">${f.tanggal ? '📅' : '📌'} <span id="c-tanggal-label">${f.tanggal ? esc(labelHariPendek(f.tanggal)) : T('Tanpa tanggal')}</span>
            <input type="date" id="c-tanggal" value="${f.tanggal}" aria-label="${T('Tanggal')}"></label>${f.tanggal ? `<button type="button" class="chip-opsi chip-hapus-tanggal" data-aksi="c-tanpa-tanggal" aria-label="${T('Hapus tanggal (jadi catatan tanpa tanggal)')}">✕</button>` : ''}</span>
          ${f.tanggal ? `<button type="button" class="chip-opsi ${f.pengingat ? 'nyala' : ''}" data-aksi="c-pengingat" role="switch" aria-checked="${f.pengingat}">${f.pengingat ? T('🔔 Ingatkan') : T('🔕 Ingatkan')}</button>
          <label class="chip-opsi ${f.ulang ? 'nyala' : ''}">🔁 <span id="c-ulang-label">${LABEL_ULANG.find(u => u[0] === f.ulang)[1]}</span>
            <select id="c-ulang" aria-label="${T('Ulangi')}">${LABEL_ULANG.map(([v, , l]) => `<option value="${v}" ${f.ulang === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
          <button type="button" class="chip-opsi" data-aksi="c-warna" aria-label="${T('Ganti warna (sekarang {warna})', { warna: esc(NAMA_WARNA[f.warna] || f.warna) })}"><i class="titik-warna"></i></button>
        </div>
        <div class="aksi-catatan">
          ${(window.SpeechRecognition || window.webkitSpeechRecognition) ? `<button type="button" class="tombol-dikte" id="tombol-dikte" data-aksi="suara-catatan" aria-label="${T('Tulis dengan suara')}">
            <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}
          ${f.id ? `<button type="button" class="btn btn-hapus btn-hapus-catatan" data-aksi="hapus-catatan">${T('🗑 Hapus')}</button>` : ''}
          <button type="button" class="btn btn-utama" data-aksi="simpan-catatan">${T('Simpan')}</button>
        </div>
      </div>
    </div>`;
}

// ---------- Dikte suara di catatan ----------
// Setiap kalimat yang selesai diucapkan DITAMBAHKAN ke isi catatan (tidak pernah menimpa). Satu kali tekan mic =
// satu sesi: mulai di baris baru, kalimat berikutnya disambung dengan spasi. Mic tetap mendengar sampai ditekan lagi
// (pengenal dimulai ulang otomatis setelah jeda). Di mode Daftar tugas, tiap kalimat jadi item baru.
var dikte = { aktif: false, r: null, awalSesi: true, tahap: '', sementara: '', galat: false };

function tampilDikte() {
  const tombol = $('#tombol-dikte'), pratinjau = $('#pratinjau-dikte');
  if (tombol) {
    tombol.classList.toggle('dengar', dikte.aktif);
    tombol.setAttribute('aria-label', dikte.aktif ? T('Berhenti merekam suara') : T('Tulis dengan suara'));
  }
  if (!pratinjau) return;
  pratinjau.hidden = !dikte.aktif;
  if (!dikte.aktif) return;
  pratinjau.innerHTML = `<span class="gelombang-suara kecil" aria-hidden="true">${'<i></i>'.repeat(5)}</span>
    <span class="teks-dikte">${dikte.sementara ? '“' + esc(dikte.sementara) + '”'
      : dikte.tahap === 'siap' ? T('Menyalakan mikrofon…') : T('<b>Mic menyala</b> · bicara, teks ditambahkan ke catatan')}</span>
    <button type="button" class="tombol-teks" data-aksi="suara-catatan">${T('Selesai')}</button>`;
  pratinjau.dataset.tahap = dikte.sementara ? 'bicara' : dikte.tahap;
}

const hurufBesarAwal = t => t.charAt(0).toUpperCase() + t.slice(1);

function tambahTeksDikte(t) {
  t = t.trim();
  if (!t || !S.formCatatan) return;
  if (S.formCatatan.jenis === 'tugas') {
    const kosong = [...document.querySelectorAll('#c-tugas .baris-tugas input')].find(x => !x.value.trim());
    if (kosong) kosong.value = hurufBesarAwal(t);
    else {
      const tmp = document.createElement('div');
      tmp.innerHTML = barisTugasForm({ teks: hurufBesarAwal(t), selesai: false });
      $('#c-tugas').appendChild(tmp.firstElementChild);
    }
  } else {
    const ta = $('#c-isi');
    if (!ta) return;
    const ada = ta.value.replace(/\s+$/, '');
    const sambung = !ada ? '' : dikte.awalSesi ? '\n' : ' ';
    ta.value = ada + sambung + (dikte.awalSesi || !ada || /[.!?]$/.test(ada) ? hurufBesarAwal(t) : t);
    tinggiIsiCatatan();
    ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  dikte.awalSesi = false;
  simpanDraftCatatan();
}

function dengarLagi() {
  const Pengenal = window.SpeechRecognition || window.webkitSpeechRecognition;
  const r = new Pengenal();
  r.lang = BAHASA === 'en' ? 'en-US' : 'id-ID';
  r.interimResults = true;
  r.maxAlternatives = 1;
  dikte.r = r;
  r.onaudiostart = () => { if (dikte.tahap === 'siap' && navigator.vibrate) navigator.vibrate(30); dikte.tahap = 'dengar'; tampilDikte(); };
  r.onresult = ev => {
    let sementara = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) tambahTeksDikte(t);
      else sementara += t;
    }
    dikte.sementara = sementara.trim();
    tampilDikte();
  };
  r.onerror = ev => {
    if (ev.error === 'no-speech' || ev.error === 'aborted') return; // jeda biasa: dengar lagi
    dikte.galat = true;
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast(T('Izinkan akses mikrofon untuk menulis dengan suara.'), true);
    else if (ev.error === 'network') toast(T('Menulis dengan suara butuh sinyal internet.'), true);
    else toast(T('Mikrofon berhenti ({galat}).', { galat: ev.error }), true);
  };
  r.onend = () => {
    dikte.sementara = '';
    if (dikte.aktif && !dikte.galat && S.tab === 'catatan-edit') {
      try { dengarLagi(); return; } catch (e) { /* jatuh ke berhenti */ }
    }
    hentikanDikte();
  };
  r.start();
}

function mulaiDikte() {
  if (dikte.aktif) return hentikanDikte();
  Object.assign(dikte, { aktif: true, awalSesi: true, tahap: 'siap', sementara: '', galat: false });
  tampilDikte();
  try { dengarLagi(); } catch (e) { hentikanDikte(); toast(T('Mikrofon tidak bisa dipakai.'), true); }
}

function hentikanDikte() {
  const r = dikte.r;
  Object.assign(dikte, { aktif: false, r: null, tahap: '', sementara: '' });
  if (r) { r.onend = null; try { r.stop(); } catch (e) { /* sudah berhenti */ } }
  tampilDikte();
}

/** Textarea isi catatan ikut memanjang sesuai isi (halaman yang scroll, bukan kotaknya). */
function tinggiIsiCatatan() {
  const t = $('#c-isi');
  if (!t) return;
  t.style.height = 'auto';
  t.style.height = Math.max(t.scrollHeight, 180) + 'px';
}
document.addEventListener('input', e => { if (e.target.id === 'c-isi') tinggiIsiCatatan(); });
document.addEventListener('change', e => {
  if (!S.formCatatan) return;
  if (e.target.id === 'c-tanggal') {
    const f = S.formCatatan, dariTanpa = !f.tanggal;
    if (!e.target.value) { // Clear di pemilih tanggal (desktop) → tanpa tanggal
      if (!dariTanpa) jadikanCatatanTanpaTanggal();
      return;
    }
    f.tanggal = e.target.value;
    if (dariTanpa) { simpanDraftCatatan(); render(); return; }
    $('#c-tanggal-label').textContent = labelHariPendek(e.target.value);
  }
  if (e.target.id === 'c-ulang') {
    S.formCatatan.ulang = e.target.value;
    $('#c-ulang-label').textContent = LABEL_ULANG.find(u => u[0] === e.target.value)[1];
    e.target.closest('.chip-opsi').classList.toggle('nyala', !!e.target.value);
  }
});

// ---------- Overlay pengingat ----------

let pengingatTampil = false;
let pengingatDilewatiHari = ''; // ditutup dengan tombol kembali: tidak dimunculkan lagi hari ini di sesi ini
const kunciPengingat = () => 'dk_ingat_' + (S.data && S.data.spreadsheetId || '');
const bacaPengingat = () => { try { return JSON.parse(bacaHp(kunciPengingat())) || {}; } catch (e) { return {}; } };

/** Pengingat yang perlu ditampilkan sekarang: [{ c, tgl }] (kejadian terakhir ≤ hari ini, maks. 7 hari lalu). */
function pengingatJatuhTempo() {
  const hari = hariIni();
  const status = bacaPengingat();
  const hasil = [];
  daftarCatatan().filter(c => c.pengingat).forEach(c => {
    for (let i = 0; i <= 7; i++) {
      const tgl = geserHari(hari, -i);
      if (!terjadiPada(c, tgl)) continue;
      const s = status[c.id + '|' + tgl] || '';
      const ditunda = s.startsWith('tunda:') && s.slice(6) > hari;
      if (s !== 'ok' && !ditunda) hasil.push({ c, tgl });
      break; // hanya kejadian terakhir
    }
  });
  return hasil.sort((a, b) => b.tgl.localeCompare(a.tgl));
}

function cekPengingat() {
  if (pengingatTampil || pengingatDilewatiHari === hariIni()) return;
  if (!S.data || S.data.perluSetup || !$('#kunci').hidden || !$('#sesi').hidden || !$('#tanya').hidden) return;
  const daftar = pengingatJatuhTempo();
  if (!daftar.length) return;
  tampilPengingat(daftar);
}

function tampilPengingat(daftar) {
  const { c, tgl } = daftar[0];
  let el = $('#ingat');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ingat';
    el.className = 'sesi ingat';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ingat-judul');
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="sesi-kartu ingat-kartu" style="--w:${warnaCatatan(c.warna)}">
      <span class="ingat-label">${T('🔔 Pengingat')} · ${esc(labelHariPendek(tgl))}${daftar.length > 1 ? ' · ' + T('1 dari {n}', { n: daftar.length }) : ''}</span>
      <b id="ingat-judul">${esc(c.judul)}</b>
      ${bacaTugas(c.isi) ? `<div class="ingat-isi">${daftarCentang(c, true)}</div>` : c.isi ? `<p class="ingat-isi">${esc(c.isi)}</p>` : ''}
      ${c.oleh ? `<small class="ingat-oleh">${T('Dari {nama}', { nama: esc(namaPendek(c.oleh)) })}${c.ulang ? ' · ' + T('berulang {ulang}', { ulang: namaT(c.ulang).toLowerCase() }) : ''}</small>` : ''}
      <button type="button" class="btn btn-utama" data-aksi="ingat-ok" data-id="${esc(c.id)}" data-tgl="${tgl}">${T('Oke, sudah')}</button>
      <div class="ingat-aksi">
        <button type="button" class="tombol-teks" data-aksi="ingat-tunda" data-id="${esc(c.id)}" data-tgl="${tgl}">${T('Ingatkan besok')}</button>
        <button type="button" class="tombol-teks" data-aksi="ingat-lihat" data-tgl="${tgl}">${T('Lihat di kalender')}</button>
      </div>
    </div>`;
  el.hidden = false;
  pengingatTampil = true;
  getar();
}

function tutupPengingat(id, tgl, nilai) {
  if (id) {
    const status = bacaPengingat();
    status[id + '|' + tgl] = nilai;
    // Bersihkan status lama (> 60 hari) supaya penyimpanan tidak terus membesar.
    const batas = geserHari(hariIni(), -60);
    Object.keys(status).forEach(k => { if (k.split('|')[1] < batas) delete status[k]; });
    tulisHp(kunciPengingat(), JSON.stringify(status));
  }
  $('#ingat').hidden = true;
  pengingatTampil = false;
}
