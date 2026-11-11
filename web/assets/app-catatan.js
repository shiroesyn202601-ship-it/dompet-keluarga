// Dompet Keluarga · Catatan & pengingat: kalender, daftar tugas, catatan offline, draf, dikte, overlay pengingat.
// Bagian dari aplikasi (dimuat berurutan di index.html: app.js → app-*.js → muda.js; semua berbagi lingkup global).

// ---------- Catatan & pengingat (kalender) ----------
// Catatan disimpan di sheet "Catatan" buku ini, jadi seluruh anggota keluarga melihat kalender yang sama.
// Catatan berpengingat muncul sebagai overlay saat aplikasi dibuka di tanggalnya (atau sampai 7 hari sesudahnya
// kalau terlewat), sampai ditutup "Oke" di HP itu. "Ingatkan besok" menunda sehari.

// 'polos' = kartu tanpa warna di Papan (garis abu-abu di kalender).
const WARNA_CATATAN = [['biru', '#3b82f6'], ['hijau', '#10b981'], ['kuning', '#f59e0b'], ['merah', '#ef4444'], ['ungu', '#8b5cf6'], ['polos', '#94a3b8']];
const warnaCatatan = k => (WARNA_CATATAN.find(w => w[0] === k) || WARNA_CATATAN[0])[1];
const NAMA_WARNA = { biru: T('biru'), hijau: T('hijau'), kuning: T('kuning'), merah: T('merah'), ungu: T('ungu'), polos: T('tanpa warna') };
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

/**
 * Halaman kalender bulanan (mulai Senin). S.kal = { bulan: 'yyyy-mm', pilih: 'yyyy-mm-dd' }.
 * pilih: tanggal yang dibuka di Kalender; '' = catatan tanpa tanggal → buka Papan; undefined = mode terakhir.
 */
function bukaKalender(pilih) {
  if (pilih === '') aturModeCatatan('papan');
  else if (pilih) aturModeCatatan('kalender');
  const tgl = pilih || (S.kal && S.kal.pilih) || hariIni();
  S.kal = { bulan: tgl.slice(0, 7), pilih: tgl };
  bukaHalaman('catatan');
}

/** Halaman Catatan punya dua mode: 'kalender' (catatan bertanggal & pengingat) dan 'papan' (tanpa tanggal, gaya Google Keep). Diingat per HP. */
const modeCatatan = () => bacaHp('dk_mode_catatan') === 'papan' ? 'papan' : 'kalender';
const aturModeCatatan = m => tulisHp('dk_mode_catatan', m === 'papan' ? 'papan' : null);

function viewCatatan() {
  if (!S.kal) S.kal = { bulan: hariIni().slice(0, 7), pilih: hariIni() };
  const papan = modeCatatan() === 'papan';
  const n = hitungPapan();
  return `
    <div class="kepala kepala-kembali">
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${T('Catatan & Pengingat')}</h1>
    </div>
    <div class="segmen mode-catatan" role="tablist" aria-label="${T('Tampilan catatan')}">
      <button type="button" role="tab" aria-selected="${!papan}" class="${papan ? '' : 'aktif'}" data-aksi="mode-catatan" data-mode="kalender">📅 ${T('Kalender')}</button>
      <button type="button" role="tab" aria-selected="${papan}" class="${papan ? 'aktif' : ''}" data-aksi="mode-catatan" data-mode="papan">📌 ${T('Papan')}${n ? ` <span class="jumlah-mode">${n}</span>` : ''}</button>
    </div>
    ${papan ? `<section class="halaman-papan" id="papan">${htmlPapan()}</section>`
      : `<section class="kartu halaman-kalender"><div id="kalender">${htmlKalender()}</div></section>`}`;
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

/** Di bawah kalender: tautan ke Papan, tempat catatan tanpa tanggal. */
function htmlCatatanTanpaTanggal() {
  const n = hitungPapan();
  if (!n) return '';
  return `<button type="button" class="baris tautan-papan" data-aksi="mode-catatan" data-mode="papan">
      <span class="ikon-bulat">📌</span><span class="isi"><b>${T('Catatan tanpa tanggal')}</b><small>${T('{n} catatan di Papan', { n })}</small></span>
      <span class="panah">${svg('maju')}</span></button>`;
}

// ---------- Papan catatan (gaya Google Keep) ----------
// Catatan tanpa tanggal tampil sebagai kartu berwarna bersusun (2 kolom di HP, lebih banyak di layar lebar).
// Disematkan di atas, sisanya urut terakhir diubah; Arsip menyembunyikan tanpa menghapus. Semua tetap di sheet
// Catatan buku ini, jadi seluruh anggota keluarga melihat papan yang sama (Google Keep tidak bisa dipakai bersama).
const catatanPapan = () => daftarCatatan().filter(c => !c.tanggal);
const hitungPapan = () => catatanPapan().filter(c => !c.arsip).length;
const urutPapan = (a, b) => String(b.diubah || '').localeCompare(String(a.diubah || ''));

function cocokCari(c, q) {
  if (!q) return true;
  // Tanda baca diabaikan, jadi "wifi" menemukan "Wi-Fi".
  const norm = x => String(x).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '');
  const teks = norm(c.judul + ' ' + polosMd(c.isi));
  return norm(q).split(/\s+/).filter(Boolean).every(k => teks.includes(k));
}

function htmlPapan() {
  const q = (S.cariPapan || '').trim();
  const arsip = !!S.lihatArsip;
  const semua = catatanPapan();
  const daftar = semua.filter(c => !!c.arsip === arsip && cocokCari(c, q)).sort(urutPapan);
  const sematan = arsip ? [] : daftar.filter(c => c.sematkan);
  const lain = arsip ? daftar : daftar.filter(c => !c.sematkan);
  const nArsip = semua.filter(c => c.arsip).length;
  const kisi = d => `<div class="kisi-papan">${d.map(kartuPapan).join('')}</div>`;
  const kosong = q ? ['🔍', T('Tidak ada catatan yang cocok dengan "{q}".', { q: esc(q) })]
    : arsip ? ['🗄', T('Belum ada catatan yang diarsipkan.')]
    : ['💡', T('Tulis ide, daftar belanja, resep, atau info penting keluarga di sini. Semua anggota keluarga bisa melihatnya.')];
  return `
    <label class="cari-papan">${svg('cari')}<input type="search" id="cari-papan" placeholder="${T('Cari catatan')}" value="${esc(S.cariPapan || '')}" aria-label="${T('Cari catatan')}" enterkeyhint="search"></label>
    ${arsip ? `<div class="papan-kepala-arsip"><button type="button" class="tombol-ikon" data-aksi="papan-arsip-tutup" aria-label="${T('Kembali ke Papan')}">${svg('kembali')}</button><b>🗄 ${T('Arsip')}</b></div>`
      : `<div class="papan-tulis">
        <button type="button" class="papan-tulis-teks" data-aksi="papan-baru">${T('Tulis catatan…')}</button>
        <button type="button" class="tombol-ikon" data-aksi="papan-baru" data-jenis="tugas" aria-label="${T('Daftar tugas baru')}">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="m4.5 7 1.2 1.2L8 6M12 7h9"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><path d="M12 17h9"/></svg></button>
      </div>`}
    <div id="papan-isi">
      ${sematan.length ? `<h3 class="papan-judul">📌 ${T('Disematkan')}</h3>${kisi(sematan)}${lain.length ? `<h3 class="papan-judul">${T('Lainnya||papan')}</h3>` : ''}` : ''}
      ${lain.length ? kisi(lain) : ''}
      ${daftar.length ? '' : `<div class="papan-kosong"><span aria-hidden="true">${kosong[0]}</span><p>${kosong[1]}</p></div>`}
    </div>
    ${!arsip && nArsip ? `<button type="button" class="chip papan-buka-arsip" data-aksi="papan-arsip-buka">🗄 ${T('Arsip ({n})', { n: nArsip })}</button>` : ''}
    ${S.data.bisaCatatan === false ? '<p class="info-kecil">' + T('⚠️ Buku ini belum bisa menyimpan catatan (butuh akses Editor ke spreadsheet).') + '</p>' : ''}`;
}

function kartuPapan(c) {
  const tugas = bacaTugas(c.isi);
  const selesai = tugas ? tugas.filter(t => t.selesai).length : 0;
  const pin = `<button type="button" class="kp-tombol kp-pin ${c.sematkan ? 'nyala' : ''}" data-aksi="papan-sematkan" data-id="${esc(c.id)}" aria-pressed="${!!c.sematkan}"
      aria-label="${c.sematkan ? T('Lepas sematan') : T('Sematkan')}"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4-1-6ZM12 13v8"/></svg></button>`;
  const keluarArsip = `<button type="button" class="kp-tombol" data-aksi="papan-arsip" data-id="${esc(c.id)}" data-v="0" aria-label="${T('Keluarkan dari arsip')}">
      <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg></button>`;
  return `
    <article class="kartu-papan ${c.tertunda ? 'tertunda' : ''}" data-warna="${esc(c.warna || 'polos')}" style="--w:${warnaCatatan(c.warna || 'polos')}">
      <button type="button" class="kp-buka" data-aksi="ubah-catatan" data-id="${esc(c.id)}">
        <b class="kp-judul">${esc(c.judul)}</b>${!tugas && c.isi ? `<span class="kp-isi">${mdKeHtml(c.isi)}</span>` : ''}
      </button>
      ${tugas ? daftarCentang(c) : ''}
      <div class="kp-kaki">
        <small>${tugas ? `☑️ ${selesai}/${tugas.length} · ` : ''}${c.oleh ? esc(namaPendek(c.oleh)) : ''}${c.tertunda ? ' · 📤' : ''}</small>
        ${c.arsip ? keluarArsip : pin}
      </div>
    </article>`;
}

function renderPapan() {
  const isi = $('#papan-isi');
  if (!isi) return;
  // Hanya kartunya yang digambar ulang, supaya kotak cari tidak kehilangan fokus saat mengetik.
  const sementara = document.createElement('div');
  sementara.innerHTML = htmlPapan();
  isi.replaceWith(sementara.querySelector('#papan-isi'));
}

document.addEventListener('input', e => {
  if (e.target.id !== 'cari-papan') return;
  S.cariPapan = e.target.value;
  renderPapan();
});

let arsipTerakhir = ''; // untuk tombol Urungkan di toast "Diarsipkan"
/** Sematkan / arsipkan langsung dari Papan: tampilan berubah dulu, lalu disimpan; kalau gagal dikembalikan. */
async function aturDiPapan(id, ubah, pesan) {
  const c = daftarCatatan().find(x => x.id === id);
  if (!c) return;
  if (c.tertunda) return toast(T('Catatan ini belum terkirim. Tunggu sampai ada sinyal.'), true);
  if (S.offline || !navigator.onLine) return toast(T('📴 Butuh sinyal untuk menyematkan atau mengarsipkan.'), true);
  const lama = { sematkan: c.sematkan, arsip: c.arsip, diubah: c.diubah };
  const kini = new Date();
  // Format sama dengan dariSerial_ di db.js (jam lokal, tanpa zona), supaya urutan Papan langsung benar.
  const diubah = new Date(kini - kini.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
  Object.assign(c, ubah, ubah.arsip ? { sematkan: false } : {}, { diubah });
  if (S.tab === 'catatan') render();
  try {
    await api('aturCatatan', id, ubah);
    if (ubah.arsip) arsipTerakhir = id;
    if (pesan) toast(pesan, false, ubah.arsip ? { label: T('Urungkan'), aksi: 'papan-arsip-urung' } : undefined);
  } catch (e) {
    Object.assign(c, lama);
    if (S.tab === 'catatan') render();
    if (!(e instanceof GOOGLE.PerluMasuk)) toast(pesanError(e), true);
  }
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

// ---------- Format teks catatan (tebal, miring, poin, nomor, perataan) ----------
// Disimpan di kolom Isi sebagai Markdown sederhana supaya tetap terbaca di spreadsheet & bot Telegram:
//   **tebal**  *miring*  ++garis bawah++  ~~coret~~  "- poin"  "1. nomor"  "[tengah] baris" / "[kanan] baris";
//   bintang biasa ditulis \* (tanda + dan ~ ganda jarang dipakai di teks biasa, jadi tidak di-escape).
// Di aplikasi ditampilkan berformat (mdKeHtml) dan disunting dengan editor contenteditable (htmlKeMd).
const POLA_RATA = /^\[(tengah|kanan)\] ?/;
const POLA_POIN = /^\s*[-•] (.*)$/;
const POLA_NOMOR = /^\s*\d+[.)] (.*)$/;

function inlineMd(teks) {
  const simpan = '\u0001';
  return esc(teks.replace(/\\\*/g, simpan))
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<b>$1</b>')
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<i>$1</i>')
    .replace(/\+\+(?=\S)(.+?)(?<=\S)\+\+/g, '<u>$1</u>')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<s>$1</s>')
    .split(simpan).join('*');
}

/** Markdown sederhana → HTML (untuk editor & tampilan kartu). */
function mdKeHtml(md) {
  if (!String(md || '').trim()) return ''; // editor benar-benar kosong, supaya perataan & daftar menempel di baris pertama
  const baris = String(md || '').split('\n');
  let html = '';
  for (let i = 0; i < baris.length; i++) {
    const b = baris[i];
    const daftar = POLA_POIN.test(b) ? ['ul', POLA_POIN] : POLA_NOMOR.test(b) ? ['ol', POLA_NOMOR] : null;
    if (daftar) {
      let li = '';
      while (i < baris.length && daftar[1].test(baris[i])) { li += `<li>${inlineMd(baris[i].match(daftar[1])[1])}</li>`; i++; }
      i--;
      html += `<${daftar[0]}>${li}</${daftar[0]}>`;
      continue;
    }
    const rata = (b.match(POLA_RATA) || [])[1];
    const isi = b.replace(POLA_RATA, '');
    html += `<div${rata ? ` style="text-align:${rata === 'tengah' ? 'center' : 'right'}"` : ''}>${isi ? inlineMd(isi) : '<br>'}</div>`;
  }
  return html;
}

/** Teks polos tanpa tanda format (untuk ringkasan satu baris & pencarian). */
const polosMd = md => String(md || '').split('\n')
  .map(b => b.replace(POLA_RATA, '').replace(POLA_POIN, '• $1').replace(/\\\*/g, '\u0001').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '$1')
    .replace(/\+\+(?=\S)(.+?)(?<=\S)\+\+/g, '$1').replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1').split('\u0001').join('*'))
  .join('\n');

/** Isi editor (DOM contenteditable) → Markdown sederhana. */
function htmlKeMd(akar) {
  const baris = [];
  let buf = '';
  let rataSekarang = '';
  const lepas = s => s.replace(/\*/g, '\\*').replace(/ /g, ' ');
  const bungkus = (isi, tanda) => {
    const m = isi.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? m[1] + tanda + m[2] + tanda + m[3] : isi;
  };
  const inline = el => {
    let s = '';
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) s += lepas(n.nodeValue);
      else if (n.nodeType === 1) {
        if (n.tagName === 'BR') s += ' ';
        else if (/^(B|STRONG)$/.test(n.tagName) || Number(n.style.fontWeight) >= 600 || n.style.fontWeight === 'bold') s += bungkus(inline(n), '**');
        else if (/^(I|EM)$/.test(n.tagName) || n.style.fontStyle === 'italic') s += bungkus(inline(n), '*');
        else if (n.tagName === 'U' || /underline/.test(n.style.textDecoration)) s += bungkus(inline(n), '++');
        else if (/^(S|STRIKE|DEL)$/.test(n.tagName) || /line-through/.test(n.style.textDecoration)) s += bungkus(inline(n), '~~');
        else s += inline(n);
      }
    });
    return s;
  };
  const awalan = () => rataSekarang === 'center' ? '[tengah] ' : rataSekarang === 'right' || rataSekarang === 'end' ? '[kanan] ' : '';
  const tutup = paksa => { if (buf || paksa) { baris.push(buf.trim() ? awalan() + buf.replace(/\s+$/, '') : ''); } buf = ''; };
  const jalan = (el, rata) => {
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) { rataSekarang = rata; buf += lepas(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { rataSekarang = rata; tutup(true); return; }
      if (tag === 'UL' || tag === 'OL') {
        tutup();
        let no = 0;
        n.querySelectorAll(':scope > li').forEach(li => baris.push((tag === 'UL' ? '- ' : ++no + '. ') + inline(li).trim()));
        return;
      }
      if (/^(DIV|P|H[1-6]|BLOCKQUOTE|LI|SECTION)$/.test(tag)) {
        tutup();
        const sebelum = baris.length;
        jalan(n, n.style.textAlign || rata);
        rataSekarang = n.style.textAlign || rata;
        tutup();
        if (baris.length === sebelum) baris.push('');
        return;
      }
      // Elemen sebaris (b, i, span…)
      rataSekarang = rata;
      const wadah = document.createElement('span');
      wadah.appendChild(n.cloneNode(true));
      buf += inline(wadah);
    });
  };
  jalan(akar, akar.style.textAlign || '');
  tutup();
  while (baris.length && !baris[baris.length - 1]) baris.pop();
  return baris.join('\n');
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
        <span class="isi"><b>${esc(c.judul)}</b>${c.isi ? `<small>${esc(polosMd(c.isi))}</small>` : ''}<small class="kal-meta">${meta}</small></span>
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
  if ($('#papan-isi')) renderPapan();
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
      const baris = polosMd($('#c-isi').value).split('\n').map(b => b.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean);
      if (baris.length) $('#c-tugas').innerHTML = baris.map(t => barisTugasForm({ teks: t, selesai: false })).join('');
    } else {
      const isi = tugasDariForm().filter(t => t.teks.trim()).map(t => '- ' + t.teks.trim()).join('\n');
      if (isi && !$('#c-isi').value.trim()) { $('#c-isi').value = isi; isiEditorDari(isi); }
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
/** tanggal '' = catatan tanpa tanggal (tanpa pengingat & pengulangan). jenis 'tugas' = catatan baru langsung berupa daftar tugas. */
function bukaFormCatatan(c, tanggal, jenis) {
  // Catatan baru tanpa tanggal (Papan) mulai tanpa warna, seperti Google Keep.
  const x = c || { judul: '', isi: '', tanggal: tanggal === '' ? '' : tanggal || hariIni(), pengingat: tanggal !== '', ulang: '', warna: tanggal === '' ? 'polos' : 'biru' };
  const tugas = bacaTugas(x.isi);
  S.formCatatan = {
    id: c ? c.id : '', oleh: c ? c.oleh : '', judul: x.judul, tanggal: x.tanggal, pengingat: x.pengingat, ulang: x.ulang,
    warna: x.warna || 'biru', jenis: tugas || jenis === 'tugas' ? 'tugas' : 'teks', isi: tugas ? '' : x.isi, tugas: tugas || [{ teks: '', selesai: false }],
    sematkan: !!(c && c.sematkan), arsip: !!(c && c.arsip), fokus: !c,
  };
  // Form dibuka ulang dari form yang masih tampil (mis. "Buang" draf): buang tampilan lama dulu, karena render()
  // membaca isian dari layar (simpanDraftCatatan) dan isian lama akan menimpa form yang baru.
  if (S.tab === 'catatan-edit') { clearTimeout(timerDrafCatatan); $('#view').innerHTML = ''; }
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
  const lokal = { id: x.id, tanggal: x.tanggal, judul: x.judul, isi: x.isi, pengingat: x.pengingat, ulang: x.ulang, warna: x.warna, sematkan: !x.tanggal && !!x.sematkan, arsip: false, diubah: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 19), oleh: S.data.user, tertunda: true };
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
  f.jenis, f.tanggal, f.pengingat, f.ulang, f.warna, !!f.sematkan]);
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
    judul: f.judul, isi: f.isi, tugas: f.tugas, jenis: f.jenis, tanggal: f.tanggal, pengingat: f.pengingat, ulang: f.ulang, warna: f.warna, sematkan: f.sematkan,
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
      <input class="judul-catatan" id="c-judul" maxlength="80" enterkeyhint="next" placeholder="${f.tanggal ? T('Judul') : T('Judul (boleh kosong)')}" value="${esc(f.judul)}" aria-label="${T('Judul')}">

      <div class="saklar-jenis" id="c-jenis" data-jenis="${f.jenis}" role="tablist" aria-label="${T('Jenis catatan')}">
        <button type="button" role="tab" aria-selected="${!tugas}" class="${tugas ? '' : 'aktif'}" data-aksi="c-jenis" data-v="teks">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 11h16M4 16h10"/></svg>${T('Teks')}</button>
        <button type="button" role="tab" aria-selected="${tugas}" class="${tugas ? 'aktif' : ''}" data-aksi="c-jenis" data-v="tugas">
          <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="m4.5 7 1.2 1.2L8 6M12 7h9"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><path d="M12 17h9"/></svg>${T('Daftar tugas')}</button>
      </div>

      <div id="c-isi-teks" ${tugas ? 'hidden' : ''}>
        ${alatFormat()}
        <!-- Placeholder sengaja elemen terpisah: ::before di dalam contenteditable membuat perataan teks Chrome gagal. -->
        <div class="bungkus-editor${polosMd(f.isi).trim() ? '' : ' kosong'}">
          <div class="isi-catatan editor-catatan" id="c-editor" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true"
            aria-label="${T('Isi catatan')}">${mdKeHtml(f.isi)}</div>
          <span class="petunjuk-editor" aria-hidden="true">${T('Tulis catatan… atau ketuk 🎤 untuk bicara')}</span>
        </div>
        <!-- Sumber isi (Markdown sederhana) yang dibaca draf, dikte & simpan; selalu disamakan dengan editor di atas. -->
        <textarea id="c-isi" hidden>${esc(f.isi)}</textarea>
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
          ${f.tanggal ? "" : `<button type="button" class="chip-opsi ${f.sematkan ? "nyala" : ""}" data-aksi="c-sematkan" role="switch" aria-checked="${!!f.sematkan}">📌 ${T("Sematkan")}</button>`}
        </div>
        <div class="aksi-catatan">
          ${(window.SpeechRecognition || window.webkitSpeechRecognition) ? `<button type="button" class="tombol-dikte" id="tombol-dikte" data-aksi="suara-catatan" aria-label="${T('Tulis dengan suara')}">
            <svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}
          ${f.id && !f.tanggal ? `<button type="button" class="btn btn-hapus btn-arsip-catatan" data-aksi="c-arsip" aria-label="${f.arsip ? T("Keluarkan dari arsip") : T("Arsipkan")}">${f.arsip ? "↩︎" : "🗄"}</button>` : ""}
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
    const kalimat = (dikte.awalSesi || !ada || /[.!?]$/.test(ada) ? hurufBesarAwal(t) : t).replace(/\*/g, '\\*');
    ta.value = ada + sambung + kalimat;
    isiEditorDari(ta.value);
    const ed = $('#c-editor');
    if (ed) ed.lastElementChild ? ed.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) : ed.scrollIntoView({ block: 'nearest' });
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
  r.onaudiostart = () => { if (dikte.tahap === 'siap' && navigator.vibrate) navigator.vibrate(30); dikte.tahap = 'dengar'; tampilDikte(); mulaiMeterSuara(); };
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
    if (meterBentrok(ev.error)) return; // mic dipakai meter gelombang: meter dimatikan, pengenal dengar lagi
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
  if (suaraButuhAi()) return; // fitur suara wajib AI Gemini (draf catatan tetap tersimpan)
  Object.assign(dikte, { aktif: true, awalSesi: true, tahap: 'siap', sementara: '', galat: false });
  tampilDikte();
  try { dengarLagi(); } catch (e) { hentikanDikte(); toast(T('Mikrofon tidak bisa dipakai.'), true); }
}

function hentikanDikte() {
  const r = dikte.r;
  Object.assign(dikte, { aktif: false, r: null, tahap: '', sementara: '' });
  if (r) { r.onend = null; try { r.stop(); } catch (e) { /* sudah berhenti */ } }
  hentikanMeterSuara();
  tampilDikte();
}

/** Editor isi catatan memanjang sendiri (contenteditable); cukup perbarui tanda "kosong" untuk placeholder. */
function tinggiIsiCatatan() {
  const ed = $('#c-editor');
  if (ed) ed.parentElement.classList.toggle('kosong', !ed.textContent.trim() && !ed.querySelector('li'));
}

// ---------- Editor format catatan ----------
// Toolbar + shortcut keyboard (konvensi Google Docs/Keep). execCommand masih didukung semua browser untuk contenteditable.
const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
const ALAT_FORMAT = [
  ['bold', T('Tebal'), MOD_KEY + '+B', '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'],
  ['italic', T('Miring'), MOD_KEY + '+I', '<path d="M10 5h8M6 19h8M15 5 9 19"/>'],
  ['underline', T('Garis bawah'), MOD_KEY + '+U', '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>'],
  ['strikeThrough', T('Coret'), MOD_KEY + '+Shift+X', '<path d="M4 12h16M16.5 7.5C16 5.5 14.2 4.5 12 4.5c-2.6 0-4.5 1.3-4.5 3.4 0 1.5 1 2.6 3 3.1M8 16c.4 2 2 3.5 4.4 3.5 2.7 0 4.6-1.4 4.6-3.6 0-.7-.2-1.3-.6-1.9"/>'],
  ['insertUnorderedList', T('Poin'), MOD_KEY + '+Shift+8', '<circle cx="5" cy="7" r="1.3"/><circle cx="5" cy="12" r="1.3"/><circle cx="5" cy="17" r="1.3"/><path d="M10 7h10M10 12h10M10 17h10"/>'],
  ['insertOrderedList', T('Nomor'), MOD_KEY + '+Shift+7', '<path d="M4 5h1.5v4M4 9h3M4 14.5a1.5 1.5 0 0 1 3 .4L4 19h3M10 7h10M10 12h10M10 17h10"/>'],
  ['justifyLeft', T('Rata kiri'), MOD_KEY + '+Shift+L', '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>'],
  ['justifyCenter', T('Rata tengah'), MOD_KEY + '+Shift+E', '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>'],
  ['justifyRight', T('Rata kanan'), MOD_KEY + '+Shift+R', '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>'],
];
function alatFormat() {
  return `<div class="alat-format" role="toolbar" aria-label="${T('Format teks')}">${ALAT_FORMAT.map(([f, nama, kunci, ik], i) =>
    `${i === 4 || i === 6 ? '<span class="pemisah-alat" aria-hidden="true"></span>' : ''}<button type="button" data-aksi="c-format" data-f="${f}" aria-pressed="false"
      title="${esc(nama)} (${kunci})" aria-label="${esc(nama)}"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true">${ik}</svg></button>`).join('')}</div>`;
}

/** Samakan sumber Markdown (#c-isi) dengan isi editor. */
function sinkronEditor() {
  const ed = $('#c-editor'), ta = $('#c-isi');
  if (!ed || !ta) return;
  ta.value = htmlKeMd(ed);
  tinggiIsiCatatan();
}
/** Isi editor dari Markdown (dikte, ganti jenis, pulihkan draf). */
function isiEditorDari(md) {
  const ed = $('#c-editor');
  if (!ed) return;
  ed.innerHTML = mdKeHtml(md);
  tinggiIsiCatatan();
}
function terapkanFormat(f) {
  const ed = $('#c-editor');
  if (!ed) return;
  const sel = document.getSelection();
  if (!ed.firstChild) { // editor kosong: Chrome butuh satu baris dulu, kalau tidak kursornya lompat keluar editor
    ed.innerHTML = '<div><br></div>';
    ed.focus();
    const r = document.createRange(); r.setStart(ed.firstChild, 0); r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  } else if (!ed.contains(sel.anchorNode)) { // belum ada kursor di editor: taruh di akhir
    ed.focus();
    const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
    sel.removeAllRanges(); sel.addRange(r);
  }
  document.execCommand('styleWithCSS', false, false);
  document.execCommand(f, false, null);
  sinkronEditor();
  statusAlatFormat();
}
/** Tombol toolbar menyala sesuai format di posisi kursor. */
function statusAlatFormat() {
  const ed = $('#c-editor');
  if (!ed) return;
  const di = ed.contains(document.getSelection().anchorNode);
  document.querySelectorAll('.alat-format [data-f]').forEach(b => {
    let on = false;
    try { on = di && document.queryCommandState(b.dataset.f); } catch (e) { /* tidak didukung */ }
    b.classList.toggle('aktif', on);
    b.setAttribute('aria-pressed', on);
  });
}

Object.assign(AKSI, { 'c-format': el => terapkanFormat(el.dataset.f) });

// Tombol toolbar tidak mengambil fokus, supaya teks yang dipilih di editor tetap terpilih.
document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.alat-format button')) e.preventDefault(); });
document.addEventListener('selectionchange', () => { if (S.tab === 'catatan-edit') statusAlatFormat(); });

document.addEventListener('input', e => {
  if (e.target.id !== 'c-editor') return;
  // Format otomatis: "- " / "* " atau "1. " di awal baris → daftar poin / nomor (seperti Google Keep & Docs).
  if (e.inputType === 'insertText' && e.data === ' ') {
    const sel = document.getSelection();
    if (sel.rangeCount) {
      const r = sel.getRangeAt(0);
      let blok = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer;
      blok = blok.closest('div:not(#c-editor), li, p') || e.target;
      if (blok.tagName !== 'LI') {
        const awal = document.createRange();
        awal.selectNodeContents(blok);
        awal.setEnd(r.startContainer, r.startOffset);
        const teks = awal.toString().replace(/ /g, ' ');
        const perintah = /^[-*•] $/.test(teks) ? 'insertUnorderedList' : /^1[.)] $/.test(teks) ? 'insertOrderedList' : '';
        if (perintah) { // hapus "- " lewat execCommand (bukan deleteContents) supaya baris tidak tergabung ke baris sebelumnya
          sel.removeAllRanges(); sel.addRange(awal);
          document.execCommand('delete', false, null);
          document.execCommand(perintah, false, null);
        }
      }
    }
  }
  sinkronEditor();
});

// Tempel sebagai teks polos (format dari web/Word tidak ikut), tetap satu baris per baris.
document.addEventListener('paste', e => {
  if (e.target.closest && e.target.closest('#c-editor')) {
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  }
});

// Shortcut keyboard di form catatan.
document.addEventListener('keydown', e => {
  if (S.tab !== 'catatan-edit' || !(e.ctrlKey || e.metaKey) || e.altKey) return;
  const tombolSimpan = document.querySelector('[data-aksi="simpan-catatan"]');
  if (e.key === 'Enter' && tombolSimpan) { e.preventDefault(); AKSI['simpan-catatan'](tombolSimpan); return; }
  if (!e.target.closest || !e.target.closest('#c-editor')) return;
  const k = e.key.toLowerCase();
  const peta = e.shiftKey
    ? { '8': 'insertUnorderedList', '*': 'insertUnorderedList', '7': 'insertOrderedList', '&': 'insertOrderedList', l: 'justifyLeft', e: 'justifyCenter', r: 'justifyRight', x: 'strikeThrough' }
    : { b: 'bold', i: 'italic', u: 'underline' };
  // Shift+8/7 dicek dari kode tombol juga, karena e.key berbeda per tata letak keyboard.
  const f = peta[k] || (e.shiftKey && { Digit8: 'insertUnorderedList', Digit7: 'insertOrderedList' }[e.code]);
  if (!f) return;
  e.preventDefault();
  terapkanFormat(f);
});
// Alt+Shift+5 = coret (sama dengan Google Docs).
document.addEventListener('keydown', e => {
  if (S.tab !== 'catatan-edit' || !e.altKey || !e.shiftKey || e.code !== 'Digit5' || !e.target.closest || !e.target.closest('#c-editor')) return;
  e.preventDefault();
  terapkanFormat('strikeThrough');
});
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
