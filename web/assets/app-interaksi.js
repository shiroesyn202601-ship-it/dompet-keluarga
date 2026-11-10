// Dompet Keluarga · Sholat & kiblat, gestur (kembali, geser, seret), suara, kilas balik, kartu konfirmasi suara/struk.
// Bagian dari aplikasi (dimuat berurutan di index.html: app.js → app-*.js → muda.js; semua berbagi lingkup global).

// ---------- Jadwal sholat & kiblat ----------

const NAMA_WAKTU = [['imsak', T('Imsak')], ['subuh', T('Subuh')], ['terbit', T('Terbit')], ['dzuhur', T('Dzuhur')], ['ashar', T('Ashar')], ['maghrib', T('Maghrib')], ['isya', T('Isya')]];
/** Nama arah mata angin dari SHOLAT.namaArah, diterjemahkan untuk tampilan. */
const NAMA_ARAH = {
  utara: T('utara'), 'timur laut': T('timur laut'), timur: T('timur'), tenggara: T('tenggara'),
  selatan: T('selatan'), 'barat daya': T('barat daya'), barat: T('barat'), 'barat laut': T('barat laut'),
};
const namaArahT = d => { const a = SHOLAT.namaArah(d); return NAMA_ARAH[a] || a; };
const WAKTU_SHOLAT = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
const bacaLokasi = () => { try { return JSON.parse(bacaHp('dk_lokasi')); } catch (e) { return null; } };
const jamMenit = m => String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
const zonaHp = () => -new Date().getTimezoneOffset() / 60;

function jadwalHari(lok, tanggal) {
  return SHOLAT.hitung(tanggal || new Date(), lok.lat, lok.lng, zonaHp());
}

/** Sholat berikutnya dari sekarang: { kunci, nama, menit (jam), sisa (menit) }; lewat Isya → Subuh besok. */
function sholatBerikut(lok) {
  const kini = new Date();
  const m = kini.getHours() * 60 + kini.getMinutes();
  const j = jadwalHari(lok);
  const k = WAKTU_SHOLAT.find(x => j[x] > m);
  if (k) return { kunci: k, nama: NAMA_WAKTU.find(n => n[0] === k)[1], menit: j[k], sisa: j[k] - m };
  const besok = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate() + 1);
  const jb = jadwalHari(lok, besok);
  return { kunci: 'subuh', nama: T('Subuh'), menit: jb.subuh, sisa: jb.subuh + 1440 - m };
}

const teksSisa = n => (n >= 60 ? T('{j} j {m} m lagi', { j: Math.floor(n / 60), m: n % 60 }) : T('{m} m lagi', { m: n % 60 }));

/** Kota terdekat dari koordinat (untuk nama lokasi GPS), kalau dalam 60 km. */
function kotaTerdekat(lat, lng) {
  let terbaik = null;
  SHOLAT.KOTA.forEach(([nama, a, b]) => {
    const km = Math.hypot((a - lat) * 111, (b - lng) * 111 * Math.cos(lat * Math.PI / 180));
    if (!terbaik || km < terbaik.km) terbaik = { nama, km };
  });
  return terbaik && terbaik.km < 60 ? terbaik.nama : '';
}

function bukaSholat() {
  bukaHalaman('sholat');
}

function viewSholat() {
  const kepala = `
    <div class="kepala kepala-kembali">
      <button class="tombol-ikon" data-aksi="tab" data-tab="beranda" aria-label="${T('Kembali')}">${svg('kembali')}</button>
      <h1>${T('Jadwal Sholat & Kiblat')}</h1>
    </div>`;
  const lok = bacaLokasi();
  if (!lok) {
    return kepala + `
    <section class="kartu halaman-sholat">
      <p style="margin-top:0">${T('Jadwal sholat dan arah kiblat dihitung dari lokasi Anda, langsung di HP (tanpa internet).')}</p>
      <div class="aksi-form" style="margin-bottom:14px"><button type="button" class="btn btn-utama" data-aksi="lokasi-gps">${T('📍 Pakai lokasi saya')}</button></div>
      ${pilihKota()}
    </section>`;
  }
  // Satu layar penuh tanpa scroll: jadwal ringkas di atas, kompas mengisi sisa tinggi layar.
  const j = jadwalHari(lok);
  const s = sholatBerikut(lok);
  const kiblat = SHOLAT.arahKiblat(lok.lat, lok.lng);
  const tanggal = new Date().toLocaleDateString(LOKAL, { weekday: 'long', day: 'numeric', month: 'long' });
  return `<div class="hal-sholat">${kepala}
    <div class="sholat-kepala">
      <div><small>${esc(tanggal)}</small><b>📍 ${esc(lok.nama)}</b></div>
      <button type="button" class="chip" data-aksi="ganti-lokasi">${T('Ganti')}</button>
    </div>
    <div class="sholat-berikut">
      <div><small>${T('Berikutnya')}</small><b>${esc(s.nama)} · ${jamMenit(s.menit)}</b></div>
      <span data-sisa-sholat>${teksSisa(s.sisa)}</span>
    </div>
    <div class="jadwal-sholat">${WAKTU_SHOLAT.map(k => `
      <div class="${k === s.kunci ? 'berikut' : ''}"><span>${NAMA_WAKTU.find(n => n[0] === k)[1]}</span><b>${jamMenit(j[k])}</b></div>`).join('')}</div>
    <p class="sholat-pelengkap">${T('Imsak')} <b>${jamMenit(j.imsak)}</b> · ${T('Terbit')} <b>${jamMenit(j.terbit)}</b></p>
    <p class="sholat-pelengkap">${T("Metode Kemenag RI (Subuh 20°, Isya 18°, Ashar Syafi'i, ihtiyat 2 menit). Bisa berbeda 1–3 menit dengan jadwal masjid setempat.")}</p>

    <div class="area-kompas">${htmlKompas(kiblat)}${tombolKompas()}</div>
    <p class="teks-kiblat" id="teks-kiblat">${T('<b>Kiblat {derajat}°</b> dari utara', { derajat: Math.round(kiblat) })} · ${namaArahT(kiblat)}</p>
    <p class="sholat-pelengkap">${T('Letakkan HP mendatar dan jauhkan dari benda logam/magnet. Putar badan sampai 🕋 tepat di garis atas.')}</p>
  </div>`;
}

function pilihKota() {
  return `<div class="grup-form">
      <label class="label" for="pilih-kota">${T('Atau pilih kota terdekat')}</label>
      <select class="field" id="pilih-kota" data-pilih-kota>
        <option value="">${T('Pilih kota…')}</option>
        ${SHOLAT.KOTA.map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join('')}
      </select>
    </div>`;
}

function simpanLokasi(lok) {
  tulisHp('dk_lokasi', JSON.stringify(lok));
  bukaSholat();
}

// Kompas: arah HP dari sensor. Android (Chrome): deviceorientationabsolute; iPhone: webkitCompassHeading (perlu izin).
/**
 * Kompas kiblat. Piringan (skala, U/T/S/B, penanda 🕋) berputar mengikuti arah HP; huruf & 🕋 diputar balik supaya
 * tetap tegak. Segitiga di atas = arah depan HP. Busur di tepi = sisa putaran menuju kiblat.
 * Nilai sensor dihaluskan & dianimasikan per frame, dan tidak melompat saat melewati 359° → 0°.
 */
function htmlKompas(kiblat) {
  const huruf = [[T('U||kompas'), 0, 'u'], [T('T||kompas'), 90, ''], [T('S||kompas'), 180, ''], [T('B||kompas'), 270, '']];
  return `<div class="kompas ${statusKompas === 'aktif' ? 'hidup' : ''}" id="kompas" style="--kiblat:${kiblat.toFixed(1)}deg;--hp:${tampilHp.toFixed(1)}deg">
      <div class="kompas-riak" aria-hidden="true"><i></i><i></i></div>
      <div class="kompas-piringan" id="kompas-piringan">
        <div class="kompas-skala"></div>
        ${huruf.map(([h, d, c]) => `<div class="kompas-sudut" style="--a:${d}deg"><span class="mata-angin ${c}">${h}</span></div>`).join('')}
        <div class="kompas-sudut kompas-kiblat" style="--a:var(--kiblat)"><i class="garis-kiblat"></i><span class="ikon-kabah">🕋</span></div>
      </div>
      <div class="kompas-busur" aria-hidden="true"></div>
      <div class="penanda-atas" aria-hidden="true"></div>
      <div class="kompas-tengah" id="kompas-tengah" aria-live="polite">${isiTengahKompas(kiblat, null)}</div>
    </div>`;
}

function isiTengahKompas(kiblat, selisih) {
  if (selisih == null) return `<b>${Math.round(kiblat)}°</b><small>${namaArahT(kiblat)}</small>`;
  if (statusPas) return '<b class="cek">✓</b><small>' + T('Menghadap kiblat') + '</small>';
  return `<b>${Math.round(Math.abs(selisih))}°</b><small>${selisih > 0 ? T('putar ke kanan ↻') : T('putar ke kiri ↺')}</small>`;
}

// Tombol melayang di atas kompas & hilang saat kompas menyala.
// Status: 'mati' → 'menunggu' (izin diberikan, belum ada data sensor) → 'aktif'; 'tidak-ada' kalau sensor tak pernah mengirim data.
let statusKompas = 'mati';
let jenisKompas = '';
let statusPas = false;
let targetHp = 0;   // arah HP dari sensor, tidak "dibungkus" ke 0–360 supaya animasi tidak berputar balik
let tampilHp = 0;   // arah yang sedang digambar (mengejar targetHp)
let adaDataHp = false;
let frameKompas = 0;
let teksTengahTerakhir = '';
const LABEL_KOMPAS = {
  mati: T('🧭 Aktifkan kompas'),
  menunggu: T('⏳ Menunggu sensor kompas…'),
  aktif: T('🧭 Kompas aktif'),
  'tidak-ada': T('⚠️ HP ini tidak punya sensor kompas'),
};
function tombolKompas() {
  return `<button type="button" class="tombol-kompas ${statusKompas}" data-aksi="kompas" id="tombol-kompas"
    ${statusKompas === 'aktif' ? 'hidden' : ''}>${LABEL_KOMPAS[statusKompas]}</button>`;
}
function aturStatusKompas(st) {
  statusKompas = st;
  const t = $('#tombol-kompas');
  if (t) t.outerHTML = tombolKompas();
  const k = $('#kompas');
  if (k) k.classList.toggle('hidup', st === 'aktif');
}

function terimaArahHp(arah) {
  if (statusKompas === 'menunggu') aturStatusKompas('aktif');
  if (statusKompas !== 'aktif') return;
  if (!adaDataHp) { targetHp = tampilHp = arah; adaDataHp = true; }
  targetHp += ((arah - targetHp) % 360 + 540) % 360 - 180; // jalur terpendek ke arah baru
  if (!frameKompas) frameKompas = requestAnimationFrame(gambarKompas);
}

function gambarKompas() {
  frameKompas = 0;
  const kompas = $('#kompas');
  if (!kompas || statusKompas !== 'aktif') return;
  const sisa = targetHp - tampilHp;
  tampilHp = Math.abs(sisa) < 0.05 ? targetHp : tampilHp + sisa * 0.2; // pelembut gerak
  kompas.style.setProperty('--hp', tampilHp.toFixed(2) + 'deg');

  const kiblat = parseFloat(kompas.style.getPropertyValue('--kiblat')) || 0;
  const selisih = ((kiblat - tampilHp) % 360 + 540) % 360 - 180; // + = putar ke kanan
  const jarak = Math.abs(selisih);
  // Histeresis: masuk "pas" di bawah 3°, keluar baru di atas 6°, supaya tidak berkedip saat tangan bergetar.
  const pas = statusPas ? jarak < 6 : jarak < 3;
  if (pas && !statusPas && navigator.vibrate) navigator.vibrate([40, 60, 40]);
  statusPas = pas;
  kompas.classList.toggle('pas', pas);
  kompas.classList.toggle('dekat', !pas && jarak < 20);
  kompas.style.setProperty('--busur-mulai', (selisih < 0 ? selisih : 0).toFixed(2) + 'deg');
  kompas.style.setProperty('--busur', jarak.toFixed(2) + 'deg');
  const tengah = $('#kompas-tengah');
  const teks = isiTengahKompas(kiblat, selisih);
  if (tengah && teks !== teksTengahTerakhir) { tengah.innerHTML = teks; teksTengahTerakhir = teks; }
  if (tampilHp !== targetHp) frameKompas = requestAnimationFrame(gambarKompas);
}

function saatOrientasi(e) {
  if (typeof e.webkitCompassHeading === 'number') return terimaArahHp(e.webkitCompassHeading);
  if (e.absolute && typeof e.alpha === 'number') terimaArahHp(360 - e.alpha);
}

async function nyalakanKompas() {
  if (statusKompas === 'aktif' || statusKompas === 'menunggu') return matikanKompas();
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      if (await DeviceOrientationEvent.requestPermission() !== 'granted') return toast(T('Izin sensor arah ditolak.'), true);
    }
  } catch (e) { return toast(T('Sensor arah tidak bisa diakses.'), true); }
  jenisKompas = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  adaDataHp = false;
  window.addEventListener(jenisKompas, saatOrientasi);
  aturStatusKompas('menunggu');
  setTimeout(() => {
    if (statusKompas !== 'menunggu') return;
    window.removeEventListener(jenisKompas, saatOrientasi);
    aturStatusKompas('tidak-ada');
    toast(T('Sensor kompas tidak terbaca. Pakai derajat di atas dengan kompas biasa.'), true);
  }, 3000);
}

/** Matikan kompas & kembalikan tampilan ke arah utara di atas (dipanggil juga saat meninggalkan halaman). */
function matikanKompas() {
  if (jenisKompas) window.removeEventListener(jenisKompas, saatOrientasi);
  jenisKompas = '';
  statusPas = false;
  adaDataHp = false;
  targetHp = tampilHp = 0;
  teksTengahTerakhir = '';
  if (frameKompas) cancelAnimationFrame(frameKompas);
  frameKompas = 0;
  const k = $('#kompas');
  if (k) {
    k.classList.remove('pas', 'dekat');
    k.style.setProperty('--hp', '0deg');
    k.style.setProperty('--busur', '0deg');
    const kiblat = parseFloat(k.style.getPropertyValue('--kiblat')) || 0;
    const tengah = $('#kompas-tengah');
    if (tengah) tengah.innerHTML = isiTengahKompas(kiblat, null);
  }
  aturStatusKompas('mati');
}

// Hitung mundur sholat di halaman jadwal, tiap 30 detik.
setInterval(() => {
  const lok = bacaLokasi();
  const el = document.querySelectorAll('[data-sisa-sholat]');
  if (!lok || !el.length) return;
  const s = sholatBerikut(lok);
  el.forEach(x => { x.textContent = teksSisa(s.sisa); });
}, 30000);

document.addEventListener('change', e => {
  if (!e.target.matches('[data-pilih-kota]') || e.target.value === '') return;
  const [nama, lat, lng] = SHOLAT.KOTA[Number(e.target.value)];
  simpanLokasi({ nama, lat, lng });
});

Object.assign(AKSI, {
  'kalender': () => bukaKalender(),
  'kal-tgl': el => {
    S.kal.pilih = el.dataset.tgl;
    S.kal.bulan = el.dataset.tgl.slice(0, 7);
    renderKalender();
  },
  'kal-bulan': el => gantiBulanKalender(Number(el.dataset.geser)),
  // ＋ Catatan: pilih dulu catatan di tanggal terpilih atau tanpa tanggal.
  'tambah-catatan': () => {
    const tgl = (S.kal && S.kal.pilih) || hariIni();
    bukaSheet(T('Catatan baru'), `<div class="pilih-jenis-catatan">
      <button type="button" class="baris" data-aksi="catatan-baru" data-tgl="${tgl}">
        <span class="ikon-bulat">📅</span><span class="isi"><b>${esc(keteranganHari(tgl))}</b><small>${T('Bisa diingatkan & diulang')}</small></span><span class="panah">${svg('maju')}</span></button>
      <button type="button" class="baris" data-aksi="catatan-baru" data-tgl="">
        <span class="ikon-bulat">📌</span><span class="isi"><b>${T('Tanpa tanggal')}</b><small>${T('Mis. daftar belanja atau ide')}</small></span><span class="panah">${svg('maju')}</span></button>
    </div>`);
  },
  'catatan-baru': el => bukaFormCatatan(null, el.dataset.tgl),
  'c-tanpa-tanggal': () => jadikanCatatanTanpaTanggal(),
  'ubah-catatan': el => {
    const c = daftarCatatan().find(x => x.id === el.dataset.id);
    if (c) bukaFormCatatan(c);
  },
  'c-pengingat': el => {
    const on = S.formCatatan.pengingat = !S.formCatatan.pengingat;
    el.setAttribute('aria-checked', on);
    el.classList.toggle('nyala', on);
    el.textContent = on ? T('🔔 Ingatkan') : T('🔕 Ingatkan');
  },
  'c-warna': el => { // ketuk = warna berikutnya
    const i = WARNA_CATATAN.findIndex(w => w[0] === S.formCatatan.warna);
    S.formCatatan.warna = WARNA_CATATAN[(i + 1) % WARNA_CATATAN.length][0];
    el.setAttribute('aria-label', T('Ganti warna (sekarang {warna})', { warna: NAMA_WARNA[S.formCatatan.warna] || S.formCatatan.warna }));
    const f = $('.form-catatan');
    if (f) f.style.setProperty('--w', warnaCatatan(S.formCatatan.warna));
  },
  'simpan-catatan': async el => {
    hentikanDikte();
    simpanDraftCatatan();
    const f = S.formCatatan;
    const input = {
      id: f.id, judul: f.judul, tanggal: f.tanggal, pengingat: f.pengingat, ulang: f.ulang, warna: f.warna,
      isi: f.jenis === 'tugas' ? tulisTugas(f.tugas) : f.isi,
    };
    if (!input.judul.trim()) return toast(T('Isi judul catatannya dulu.'), true);
    if (S.offline || !navigator.onLine) return antreCatatan(input, f.id);
    if (await kirim(el, 'simpanCatatan', [input], input.pengingat ? T('Pengingat tersimpan 🔔') : T('Catatan tersimpan ✔'),
      e => e.jaringan && antreCatatan(input, f.id))) {
      buangDrafCatatan(f.id);
      bukaKalender(input.tanggal);
    }
  },
  'hapus-catatan': async el => {
    const tgl = S.formCatatan.tanggal;
    const idDraf = S.formCatatan.id;
    const ok = await kirim(el, 'hapusCatatan', [S.formCatatan.id], baris => {
      catatanTerhapus = baris;
      toast(T('Catatan dihapus'), false, { label: T('Urungkan'), aksi: 'urungkan-catatan' });
    });
    if (ok) { buangDrafCatatan(idDraf); bukaKalender(tgl); }
  },
  'urungkan-catatan': el => {
    const baris = catatanTerhapus;
    catatanTerhapus = null;
    $('#toast').hidden = true;
    if (baris) kirim(el, 'kembalikanCatatan', [baris], T('Catatan dikembalikan'));
  },
  'ingat-ok': el => { tutupPengingat(el.dataset.id, el.dataset.tgl, 'ok'); setTimeout(cekPengingat, 300); },
  'ingat-tunda': el => {
    tutupPengingat(el.dataset.id, el.dataset.tgl, 'tunda:' + geserHari(hariIni(), 1));
    toast(T('Diingatkan lagi besok'));
    setTimeout(cekPengingat, 300);
  },
  'ingat-lihat': el => { tutupPengingat('', '', ''); pengingatDilewatiHari = hariIni(); bukaKalender(el.dataset.tgl); },
  'sholat': () => bukaSholat(),
  'ganti-lokasi': () => bukaSheet(T('Lokasi jadwal sholat'), `
    <div class="aksi-form" style="margin:0 0 14px"><button type="button" class="btn btn-utama" data-aksi="lokasi-gps">${T('📍 Pakai lokasi saya sekarang')}</button></div>
    ${pilihKota()}`),
  'lokasi-gps': el => {
    if (!navigator.geolocation) return toast(T('HP ini tidak mendukung lokasi. Pilih kota di bawah.'), true);
    el.disabled = true;
    el.textContent = T('📍 Mencari lokasi…');
    navigator.geolocation.getCurrentPosition(p => {
      const lat = p.coords.latitude, lng = p.coords.longitude;
      const kota = kotaTerdekat(lat, lng);
      simpanLokasi({ nama: kota ? T('Sekitar {kota}', { kota }) : T('Lokasi Anda ({lat}, {lng})', { lat: lat.toFixed(2), lng: lng.toFixed(2) }), lat, lng });
    }, err => {
      el.disabled = false;
      el.textContent = T('📍 Pakai lokasi saya');
      toast(err.code === 1 ? T('Izin lokasi ditolak. Pilih kota terdekat di bawah.') : T('Lokasi tidak ditemukan. Pilih kota terdekat di bawah.'), true);
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
  },
  'kompas': () => nyalakanKompas(),
});

// Pengingat dicek setelah tampilan pertama, setelah PIN dibuka, dan saat aplikasi dibuka lagi (bisa sudah ganti hari).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(cekPengingat, 600);
});

// ---------- Tombol kembali (Android) ----------
// Satu entri riwayat "penjaga" selalu dipasang di atas halaman, supaya tombol kembali tidak langsung
// menutup aplikasi. Saat ditekan: tutup dialog/form → kembali ke Beranda → di Beranda harus ditekan
// 2× dalam JEDA_KELUAR_MS untuk keluar.

const JEDA_KELUAR_MS = 2000;
let adaPenjaga = !!(history.state && history.state.dkJaga); // halaman dimuat ulang: penjaganya masih ada
let timerPenjaga = 0;

function pasangPenjaga() {
  clearTimeout(timerPenjaga);
  if (adaPenjaga) return;
  history.pushState({ dkJaga: 1 }, '');
  adaPenjaga = true;
}

/** Menutup lapisan paling atas yang boleh ditutup dengan tombol kembali; true kalau ada yang ditutup. */
function tutupLapisanAtas() {
  if (kilas) { tutupKilasBalik(); return true; }
  if (tutupFoto()) return true;
  if (tutupTur()) return true;
  if (S.pilih && $('#sheet').hidden) { S.pilih = null; render(); return true; }
  if ($('#ringkas-suara') && !$('#ringkas-suara').hidden) { tutupRingkasanSuara(); hasilSuara = null; return true; }
  if ($('#ingat') && !$('#ingat').hidden) {
    // Pengingat ditutup dengan tombol kembali: muncul lagi saat aplikasi dibuka besok / sesi berikutnya.
    tutupPengingat('', '', '');
    pengingatDilewatiHari = hariIni();
    return true;
  }
  if (!$('#tanya').hidden) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // = Batal
    return true;
  }
  if (!$('#loading').hidden) return true; // sedang menyimpan: jangan diganggu
  if (!$('#sheet').hidden) {
    tutupSheet();
    return true;
  }
  return false;
}

window.addEventListener('popstate', e => {
  if (e.state && e.state.dkJaga) { adaPenjaga = true; return; } // maju lagi ke entri penjaga
  adaPenjaga = false;
  if (tutupLapisanAtas()) return pasangPenjaga();
  if (S.tab === 'catatan-edit') { tinggalkanFormCatatan(); bukaKalender(S.formCatatan && S.formCatatan.tanggal); return pasangPenjaga(); }
  const bisaKeBeranda = S.data && !S.data.perluSetup && $('#kunci').hidden && $('#sesi').hidden && S.tab !== 'beranda';
  if (bisaKeBeranda) {
    S.tab = 'beranda';
    render();
    window.scrollTo(0, 0);
    return pasangPenjaga();
  }
  // Di Beranda: penjaga tidak dipasang dulu, jadi tekan kembali sekali lagi = keluar.
  toast(T('Tekan kembali sekali lagi untuk keluar'));
  timerPenjaga = setTimeout(pasangPenjaga, JEDA_KELUAR_MS);
});

// Chrome melewati (tidak berhenti di) entri riwayat yang dibuat sebelum pengguna menyentuh halaman,
// jadi penjaga baru dipasang setelah sentuhan pertama.
if (navigator.userActivation && navigator.userActivation.hasBeenActive) pasangPenjaga();
else document.addEventListener('pointerdown', function sentuhanPertama() {
  document.removeEventListener('pointerdown', sentuhanPertama);
  pasangPenjaga();
});

// ---------- Geser lembar ke bawah untuk menutup ----------
// Hanya dari garis pegangan & judul lembar, supaya tidak bentrok dengan menggulir isi form.

const geser = { awal: null, jarak: 0, waktu: 0 };
const panelSheet = () => $('#sheet .sheet-panel');

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1 || !e.target.closest('#sheet .grabber, #sheet .sheet-head') || e.target.closest('button')) return;
  geser.awal = e.touches[0].clientY;
  geser.jarak = 0;
  geser.waktu = Date.now();
  panelSheet().classList.add('ditarik');
  panelSheet().classList.remove('lepas');
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (geser.awal == null) return;
  geser.jarak = Math.max(0, e.touches[0].clientY - geser.awal);
  panelSheet().style.transform = `translate(-50%, ${geser.jarak}px)`;
}, { passive: true });

document.addEventListener('touchend', () => {
  if (geser.awal == null) return;
  const p = panelSheet();
  // Ditutup kalau digeser cukup jauh, atau dikibas cepat ke bawah.
  const kibas = geser.jarak > 40 && geser.jarak / Math.max(1, Date.now() - geser.waktu) > 0.6;
  const tutup = geser.jarak > Math.min(160, p.offsetHeight * 0.3) || kibas;
  geser.awal = null;
  p.classList.remove('ditarik');
  p.classList.add('lepas');
  p.style.transform = tutup ? 'translate(-50%, 100%)' : '';
  if (tutup) {
    setTimeout(() => {
      tutupSheet();
      p.classList.remove('lepas');
      p.style.transform = '';
    }, 200);
  }
});

// ---------- Getar singkat saat ada kesalahan (Android) ----------
const toastAsli = toast;
toast = function (pesan, error, tombol) { // eslint-disable-line no-func-assign
  if (error) { try { if (navigator.vibrate) navigator.vibrate([25, 40, 25]); } catch (e) { /* abaikan */ } }
  return toastAsli(pesan, error, tombol);
};

// Ketuk tanggal di kalender panas Laporan.
Object.assign(AKSI, {
  'hari-laporan': el => {
    const n = Number(el.dataset.n), k = Number(el.dataset.k);
    toast(`${labelHariPendek(el.dataset.tgl)}: ${n ? rp(n) + ' · ' + T('{n} transaksi', { n: k }) : T('tanpa pengeluaran 🌱')}`);
  },
});

// Pilihan tema (dropdown di Pengaturan).
document.addEventListener('change', e => {
  if (e.target.id === 'pilih-bahasa') gantiBahasa(e.target.value);
  if (e.target.id === 'pilih-gaya') { tulisHp('dk_gaya_ditawarkan', '1'); gantiGaya(e.target.value); }
  if (e.target.id === 'pilih-tema') { aturTema(e.target.value); render(); }
  if (e.target.id === 'pilih-ukuran') { aturUkuran(e.target.value); render(); }
});

// ---------- Mencatat dengan suara ----------
// Tombol 🎤 di kotak "ketik cepat": ucapkan "bakso dua puluh lima ribu pakai gopay", teksnya diisi lalu
// dibaca sama seperti ketikan biasa. Hanya muncul kalau browser mendukung (Chrome Android, Safari iOS).

const PengenalSuara = window.SpeechRecognition || window.webkitSpeechRecognition;
let suaraAktif = null;

function pasangTombolSuara() {
  const kotak = document.querySelector('.ketik-cepat');
  if (!PengenalSuara || !kotak || kotak.querySelector('.tombol-suara')) return;
  kotak.classList.add('ada-suara');
  setTimeout(() => petunjukSekali('mic', kotak.querySelector('.tombol-suara'), T('🎤 Ketuk lalu ucapkan, mis. <i>"bakso 25 ribu pakai gopay kemarin"</i>')), 700);
  kotak.insertAdjacentHTML('beforeend', '<button type="button" class="tombol-suara" data-aksi="suara" aria-label="' + T('Catat dengan suara') + '">'
    + '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>');
}
// Form dirender ulang berkali-kali; tombol dipasang setiap kotak ketik cepat muncul.
new MutationObserver(pasangTombolSuara).observe(document.getElementById('sheet-isi'), { childList: true, subtree: true });

/**
 * Panel di bawah kotak ketik cepat selama mikrofon dipakai.
 * tahap: 'siap' (menyalakan mic) → 'dengar' (mic menyala, belum ada suara) → 'bicara' (suara tertangkap).
 */
function panelSuara(tahap, teks) {
  const kotak = document.querySelector('.ketik-cepat');
  if (!kotak) return;
  kotak.classList.toggle('sedang-dengar', !!tahap);
  const tombol = kotak.querySelector('.tombol-suara');
  if (tombol) {
    tombol.classList.toggle('dengar', !!tahap);
    tombol.setAttribute('aria-label', tahap ? T('Berhenti mendengarkan') : T('Catat dengan suara'));
  }
  let panel = document.getElementById('panel-suara');
  if (!tahap) { if (panel) panel.remove(); return; }
  if (!panel) {
    kotak.insertAdjacentHTML('afterend', `<div class="panel-suara" id="panel-suara">
        <div class="kepala-panel-suara" role="status" aria-live="polite">
          <div class="gelombang-suara" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
          <div class="teks-suara"><b></b><span></span></div>
          <button type="button" class="tombol-teks" data-aksi="suara">${T('Selesai')}</button>
        </div>
        <div class="contoh-suara">
          <small>${T('Contoh yang bisa diucapkan <i>(ketuk untuk mencoba)</i>')}</small>
          <ul>${contohSuara().map(([kal, ket]) =>
            `<li><button type="button" data-aksi="contoh-suara" data-teks="${esc(kal)}"><span>“${esc(kal)}”</span><em>${esc(ket)}</em></button></li>`).join('')}</ul>
          <p>${T('Sebut <b>untuk apa</b>, <b>berapa</b>, dan <b>pakai dompet apa</b>. Tanggal & transfer diatur di form.')}</p>
        </div>
      </div>`);
    panel = document.getElementById('panel-suara');
  }
  panel.dataset.tahap = tahap;
  panel.querySelector('b').textContent = tahap === 'siap' ? T('Menyalakan mikrofon…') : tahap === 'dengar' ? T('Mic menyala, silakan bicara') : T('Mendengarkan…');
  panel.querySelector('.teks-suara span').textContent = teks || (tahap === 'bicara' ? '' : T('Ucapkan transaksinya seperti mengobrol'));
}

/**
 * Contoh kalimat untuk input suara, memakai nama dompet milik pengguna supaya bisa langsung dicoba.
 * Hanya pola yang memang dikenali bacaKetikCepat: nominal angka/kata/rb/jt/slang, nama dompet, kata pemasukan.
 */
function contohSuara() {
  const dompet = dompetBiasa().map(w => w.nama);
  const nonTunai = dompet.filter(n => !/tunai|cash|dompet/i.test(n));
  const d1 = nonTunai[0] || dompet[0] || 'GoPay';
  const d2 = nonTunai[1] || dompet[1] || d1;
  const tunai = dompet.find(n => /tunai|cash/i.test(n)) || dompet[0] || 'tunai';
  if (BAHASA === 'en') {
    // Contoh bahasa Inggris (dibaca bacaKetikCepat yang juga mengenali kata kunci Inggris).
    const cash = dompet.find(n => /tunai|cash/i.test(n)) ? namaT(tunai) : 'cash';
    return [
      [`Coffee 25k ${cash}`, 'Expense · Food & Drinks'],
      [`Lunch 50 thousand yesterday`, 'Expense · dated yesterday'],
      [`Gas 30k via ${d1}`, 'Expense · Transport'],
      [`Groceries 75k`, 'Expense · wallet selected in the form'],
      [`Electricity bill 350k via ${d2}`, 'Expense · Bills'],
      [`Medicine 45k via ${d1}`, 'Expense · Health'],
      [`Coffee 25k, parking 5k, gas 30k via ${d1}`, 'Several transactions at once'],
      [`Salary 5 million ${d2}`, 'Income · Salary'],
      [`Bonus 1.5 million`, 'Income · Bonus'],
      [`Fried rice 2 plates 40k`, 'Small numbers (2 plates) are not read as the amount'],
    ];
  }
  return [
    [`Bakso dua puluh lima ribu pakai ${d1}`, 'Pengeluaran · Makan & Minum'],
    [`Bensin motor 30 ribu ${tunai}`, 'Pengeluaran · Transportasi'],
    [`Belanja sayur di pasar 75rb`, 'Pengeluaran · dompet yang terpilih di form'],
    [`Bayar listrik tiga ratus lima puluh ribu ${d2}`, 'Pengeluaran · Tagihan'],
    [`Beli obat 45 ribu pakai ${d1}`, 'Pengeluaran · Kesehatan'],
    [`Parkir goceng`, 'Bahasa gaul: gopek, seceng, goceng, ceban, gocap, cepek'],
    [`Bakso 25 ribu, parkir goceng, bensin 30 ribu pakai ${d1}`, 'Beberapa transaksi sekaligus'],
    [`Belanja sayur 50 ribu Sabtu minggu lalu`, 'Tanggal: kemarin, Sabtu lalu, tanggal 1 bulan kemarin'],
    [`Gaji lima juta masuk ${d2}`, 'Pemasukan · Gaji'],
    [`Dapat bonus satu setengah juta`, 'Pemasukan · Bonus'],
    [`Nasi padang 2 bungkus 40 ribu`, 'Angka kecil (2 bungkus) tidak dianggap nominal'],
  ];
}

// ---------- Peringatan anggaran setelah menyimpan pengeluaran ----------

/** Pengeluaran yang baru disimpan membuat kategorinya ≥ 80% anggaran? → { teks, lewat }; selain itu null. */
function pesanAnggaran(t) {
  if (!t || t.tipe !== TIPE.KELUAR || !t.kategori || !S.data) return null;
  if (SERVER.periodeDari(t.tanggal, S.data.mulaiPeriode || 1) !== S.data.bulan) return null; // anggaran periode yang tampil
  const k = kategoriBeranggaran().find(x => x.nama === t.kategori);
  if (!k || !k.batas) return null;
  const pakai = pengeluaranPerKategori()[k.nama] || 0;
  const persen = Math.round(pakai / k.batas * 100);
  if (persen >= 100) return { lewat: true, teks: T('⛔ anggaran {kategori} lewat {jumlah}', { kategori: namaT(k.nama), jumlah: rp(pakai - k.batas) }) };
  if (persen >= 80) return { lewat: false, teks: T('⚠️ {kategori} sudah {persen}% anggaran (sisa {sisa})', { kategori: namaT(k.nama), persen, sisa: rp(k.batas - pakai) }) };
  // Masih aman: tetap beri tahu sisanya, supaya terasa dampak transaksi barusan.
  return { lewat: false, teks: T('sisa anggaran {kategori} {sisa}', { kategori: namaT(k.nama), sisa: rp(k.batas - pakai) }) };
}

// ---------- Geser transaksi: kiri = hapus, kanan = catat lagi ----------

let geserTrx = null;
const BATAS_GESER = 90;
document.addEventListener('pointerdown', e => {
  const kotak = e.target.closest && e.target.closest('.trx-geser');
  // Daftar di bawah kalender Riwayat: tekan lama = seret ke tanggal lain (juga dengan mouse di komputer).
  const diKalender = !!(kotak && kotak.closest('.daftar-hari-kal'));
  if (!kotak || e.button > 0 || (e.pointerType === 'mouse' && !diKalender) || S.pilih || seretKal) return;
  const g = geserTrx = { kotak, x0: e.clientX, y0: e.clientY, dx: 0, arah: '', mouse: e.pointerType === 'mouse' };
  if (S.tab === 'riwayat') {
    g.timer = setTimeout(() => {
      if (geserTrx !== g || g.arah) return;
      geserTrx = null;
      abaikanKlikSampai = Infinity; // ketukan dari tekan lama ini tidak membuka detail
      document.addEventListener('pointerup', () => { abaikanKlikSampai = Date.now() + 350; }, { once: true });
      document.addEventListener('pointercancel', () => { abaikanKlikSampai = Date.now() + 350; }, { once: true });
      if (diKalender) mulaiSeretKal(kotak, g.x0, g.y0);
      else mulaiPilih(kotak.querySelector('.trx').dataset.id);
    }, diKalender ? 380 : 480);
  }
});
document.addEventListener('pointermove', e => {
  const g = geserTrx;
  if (!g) return;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
  if (g.mouse) { // mouse hanya untuk tekan lama → seret; digerakkan sebelum waktunya = batal
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { clearTimeout(g.timer); geserTrx = null; }
    return;
  }
  if (!g.arah) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    g.arah = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
    clearTimeout(g.timer);
    if (g.arah === 'x') g.kotak.classList.add('digeser');
  }
  if (g.arah !== 'x') return;
  g.dx = Math.max(-150, Math.min(150, dx));
  g.kotak.style.setProperty('--dx', g.dx + 'px');
  g.kotak.dataset.arah = g.dx < 0 ? 'hapus' : 'ulang';
  const lewat = Math.abs(g.dx) > BATAS_GESER;
  if (lewat !== g.kotak.classList.contains('lewat') && lewat && navigator.vibrate) navigator.vibrate(15);
  g.kotak.classList.toggle('lewat', lewat);
}, { passive: true });
function selesaiGeser() {
  const g = geserTrx;
  geserTrx = null;
  if (g) clearTimeout(g.timer);
  if (!g || g.arah !== 'x') return;
  const lewat = Math.abs(g.dx) > BATAS_GESER;
  g.kotak.classList.remove('digeser', 'lewat');
  g.kotak.style.setProperty('--dx', '0px');
  g.kotak.dataset.dicegah = '1'; // ketukan dari geseran ini tidak membuka form
  setTimeout(() => { delete g.kotak.dataset.dicegah; }, 60);
  if (!lewat) return;
  const tombol = g.kotak.querySelector('.trx');
  const t = S.data.transaksi.concat((S.cariData && S.cariData.transaksi) || []).find(x => x.id === tombol.dataset.id);
  if (!t) return;
  if (g.dx < 0) {
    g.kotak.classList.add('terhapus');
    kirim(tombol, 'hapusTransaksi', [t.id], baris => {
      trxTerhapus = baris;
      toast(T('Transaksi dihapus'), false, { label: T('Urungkan'), aksi: 'urungkan-hapus' });
    }).then(ok => { if (!ok) g.kotak.classList.remove('terhapus'); });
  } else {
    bukaFormTrx(null, { tipe: t.tipe, jumlah: t.jumlah, kategori: t.kategori, dompet: t.dompet, dompetTujuan: t.dompetTujuan,
      catatan: t.catatan, tanggal: hariIni() }, T('Catat lagi'));
  }
}
document.addEventListener('pointerup', selesaiGeser);
document.addEventListener('pointercancel', selesaiGeser);
document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('.trx-geser[data-dicegah]')) { e.stopPropagation(); e.preventDefault(); }
}, true);

// ---------- Kalender Riwayat: tekan lama transaksi lalu seret ke hari lain = ganti tanggal ----------

let seretKal = null; // { t, kotak, hantu, x, y, tujuan, gulir }
function mulaiSeretKal(kotak, x, y) {
  const id = kotak.querySelector('.trx').dataset.id;
  const t = S.data.transaksi.find(v => v.id === id);
  if (!t) return;
  const hantu = kotak.querySelector('.trx').cloneNode(true);
  hantu.className = 'trx hantu-seret';
  hantu.removeAttribute('data-aksi');
  hantu.style.width = Math.min(280, innerWidth - 32) + 'px';
  hantu.insertAdjacentHTML('beforeend', `<span class="tujuan-seret">${T('Seret ke tanggal')}</span>`);
  document.body.appendChild(hantu);
  kotak.classList.remove('contoh-geser'); // animasi petunjuk geser tidak boleh jalan selagi diseret
  kotak.classList.add('diseret');
  document.body.classList.add('sedang-seret');
  seretKal = { t, kotak, hantu, x, y, tujuan: '' };
  getar();
  geserHantu();
  seretKal.gulir = requestAnimationFrame(gulirSeret);
}
function geserHantu() {
  const s = seretKal;
  // Melayang di atas jari (bukan di bawahnya), supaya sel hari yang dituju tetap terlihat.
  const w = s.hantu.offsetWidth, h = s.hantu.offsetHeight;
  const kiri = Math.max(12, Math.min(innerWidth - w - 12, s.x - w / 2));
  s.hantu.style.transform = `translate(${kiri}px, ${Math.max(8, s.y - h - 44)}px)`;
  // Hantu tidak menangkap pointer (CSS), jadi elemen di bawah jari bisa dicari langsung.
  const sel = document.elementFromPoint(s.x, s.y);
  const hari = sel && sel.closest && sel.closest('.hari-kal');
  const tgl = hari ? hari.dataset.tgl : '';
  if (tgl === s.tujuan) return;
  document.querySelectorAll('.hari-kal.tujuan').forEach(h => h.classList.remove('tujuan'));
  s.tujuan = tgl && tgl !== s.t.tanggal ? tgl : '';
  if (s.tujuan) { hari.classList.add('tujuan'); if (navigator.vibrate) navigator.vibrate(8); }
  s.hantu.querySelector('.tujuan-seret').textContent = s.tujuan
    ? T('→ {tanggal}', { tanggal: tanggalPendek(s.tujuan) })
    : tgl ? T('Tanggal yang sama') : T('Seret ke tanggal');
  s.hantu.classList.toggle('ada-tujuan', !!s.tujuan);
}
/** Jari di dekat tepi atas/bawah layar: halaman ikut bergulir (kalender ada di atas daftar). */
function gulirSeret() {
  const s = seretKal;
  if (!s) return;
  const tepi = 90;
  const v = s.y < tepi ? -Math.ceil((tepi - s.y) / 6) : s.y > innerHeight - tepi - 70 ? Math.ceil((s.y - (innerHeight - tepi - 70)) / 6) : 0;
  if (v) { window.scrollBy(0, v); geserHantu(); }
  s.gulir = requestAnimationFrame(gulirSeret);
}
function selesaiSeretKal(batal) {
  const s = seretKal;
  if (!s) return;
  seretKal = null;
  cancelAnimationFrame(s.gulir);
  s.hantu.remove();
  s.kotak.classList.remove('diseret');
  document.body.classList.remove('sedang-seret');
  document.querySelectorAll('.hari-kal.tujuan').forEach(h => h.classList.remove('tujuan'));
  if (!batal && s.tujuan) pindahTanggalTrx(s.t, s.tujuan, s.kotak.querySelector('.trx'));
}
/** Simpan tanggal baru; Riwayat langsung menampilkan hari tujuan. Bisa diurungkan dari toast. */
function pindahTanggalTrx(t, tgl, tombol) {
  if (S.offline || !navigator.onLine) return toast(T('Memindah tanggal butuh sinyal. Coba lagi nanti.'), true);
  const lama = t.tanggal;
  S.hariKalender = tgl;
  kirim(tombol, 'simpanTransaksi', [Object.assign({}, t, { tanggal: tgl })], () => {
    S.pindahTerakhir = { id: t.id, tanggal: lama };
    toast(T('Dipindah ke {tanggal} ✔', { tanggal: tanggalPendek(tgl) }), false, { label: T('Urungkan'), aksi: 'urungkan-pindah' });
  });
}
document.addEventListener('pointermove', e => {
  if (!seretKal) return;
  seretKal.x = e.clientX;
  seretKal.y = e.clientY;
  geserHantu();
});
document.addEventListener('pointerup', () => selesaiSeretKal(false));
document.addEventListener('pointercancel', () => selesaiSeretKal(true));
// Selama menyeret, layar tidak boleh ikut bergulir oleh jari (bergulir hanya lewat tepi layar).
document.addEventListener('touchmove', e => { if (seretKal && e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if (seretKal && e.key === 'Escape') selesaiSeretKal(true); });
Object.assign(AKSI, {
  'urungkan-pindah': el => {
    const p = S.pindahTerakhir;
    const t = p && S.data.transaksi.find(v => v.id === p.id);
    $('#toast').hidden = true;
    if (!t) return;
    S.pindahTerakhir = null;
    S.hariKalender = p.tanggal;
    kirim(el, 'simpanTransaksi', [Object.assign({}, t, { tanggal: p.tanggal })], T('Tanggal dikembalikan'));
  },
});

// ---------- Kilas balik bulanan (gaya "story") ----------
// Muncul sekali saat aplikasi pertama dibuka di periode baru, untuk periode sebelumnya. Bisa diputar lagi dari Laporan.

let kilas = null; // { k, i, n, timer }
const kunciKilas = () => 'dk_kilas_' + (S.data && S.data.spreadsheetId || '');
let kilasDicek = false;

function cekKilasBalik() {
  if (kilas || kilasDicek || !S.data || S.data.perluSetup || S.tab !== 'beranda') return;
  kilasDicek = true;
  const lalu = bulanSebelum(periodeSekarang());
  const r = (S.data.bulanan || {})[lalu];
  if (!r || !(r.keluar || r.masuk) || bacaHp(kunciKilas()) === lalu) return;
  if (!$('#sheet').hidden || ($('#ingat') && !$('#ingat').hidden) || !$('#kunci').hidden || !$('#sesi').hidden) { kilasDicek = false; return; }
  tulisHp(kunciKilas(), lalu);
  bukaKilasBalik(lalu);
}

function slideKilas(k) {
  const r = ringkasBulan(k);
  const sebelum = ringkasBulan(bulanSebelum(k));
  const top = Object.keys(r.kategori).map(n => ({ n, v: r.kategori[n] })).sort((a, b) => b.v - a.v);
  const nama = namaPendek(S.data.user);
  const slide = [];
  slide.push(`<div class="kilas-isi tengah"><span class="kilas-emoji">✨</span><small>${T('Kilas balik')}</small>
    <h2>${esc(namaBulan(k))}</h2><p>${T('Halo {nama}, yuk lihat ke mana uang keluarga pergi bulan itu 👀', { nama: esc(nama) })}</p></div>`);
  slide.push(`<div class="kilas-isi"><small>${T('Total pengeluaran')}</small><div class="kilas-angka keluar">${rp(r.keluar)}</div>
    <div class="kilas-baris"><span>${T('💰 Pemasukan')}</span><b>${rp(r.masuk)}</b></div>
    <div class="kilas-baris"><span>${r.masuk >= r.keluar ? T('🟢 Sisa') : T('🔴 Minus')}</span><b>${rp(Math.abs(r.masuk - r.keluar))}</b></div></div>`);
  if (top.length) {
    slide.push(`<div class="kilas-isi"><small>${T('Paling banyak untuk')}</small>
      <div class="kilas-ilus">${ilus(ikonKategori(top[0].n, TIPE.KELUAR))}</div>
      <h2>${esc(namaT(top[0].n))}</h2><p><b>${rp(top[0].v)}</b> · ${T('{persen}% dari pengeluaran', { persen: r.keluar ? Math.round(top[0].v / r.keluar * 100) : 0 })}</p>
      ${top.slice(1, 4).map((x, i) => `<div class="kilas-baris"><span>${i + 2}. ${esc(namaT(x.n))}</span><b>${rp(x.v)}</b></div>`).join('')}</div>`);
  }
  if (sebelum.keluar && r.keluar) {
    const p = Math.round((r.keluar - sebelum.keluar) / sebelum.keluar * 100);
    slide.push(`<div class="kilas-isi tengah"><span class="kilas-emoji">${p > 0 ? '📈' : p < 0 ? '📉' : '⚖️'}</span>
      <small>${T('Dibanding {bulan}', { bulan: esc(namaBulan(bulanSebelum(k))) })}</small>
      <div class="kilas-angka ${p > 0 ? 'keluar' : 'masuk'}">${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%</div>
      <p>${p > 0 ? T('Pengeluaran naik {jumlah}. Cek lagi kategori yang membengkak, ya.', { jumlah: rp(r.keluar - sebelum.keluar) })
        : p < 0 ? T('Hemat {jumlah} dari bulan sebelumnya. Mantap! 🎉', { jumlah: rp(sebelum.keluar - r.keluar) }) : T('Pengeluaran sama persis. Konsisten!')}</p></div>`);
  }
  const rasio = r.masuk ? Math.round((r.masuk - r.keluar) / r.masuk * 100) : null;
  slide.push(`<div class="kilas-isi tengah"><span class="kilas-emoji">${rasio === null ? '📒' : rasio >= 20 ? '🏆' : rasio >= 0 ? '💪' : '🫶'}</span>
    <h2>${rasio === null ? T('Terus mencatat!') : rasio >= 20 ? T('Keuangan sehat!') : rasio >= 0 ? T('Masih aman') : T('Bulan yang berat')}</h2>
    <p>${rasio === null ? T('Catat pemasukan juga supaya rangkumannya lengkap.')
      : rasio >= 20 ? T('{persen}% pemasukan berhasil disisihkan. Pertahankan!', { persen: rasio })
      : rasio >= 0 ? T('Tersisa {persen}% pemasukan. Coba targetkan 20% bulan ini.', { persen: rasio })
      : T('Pengeluaran melebihi pemasukan. Pasang anggaran supaya bulan ini lebih terkendali.')}</p>
    <div class="kilas-aksi">
      <button type="button" class="btn btn-hapus" data-aksi="kilas-bagikan">${T('📤 Bagikan')}</button>
      <button type="button" class="btn btn-utama" data-aksi="kilas-tutup">${T('Mulai bulan ini 💪')}</button>
    </div></div>`);
  return slide;
}

function bukaKilasBalik(k) {
  const slide = slideKilas(k);
  let el = $('#kilas');
  if (!el) {
    el = document.createElement('div');
    el.id = 'kilas';
    el.className = 'kilas';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', T('Kilas balik bulanan'));
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="kilas-bar">${slide.map(() => '<i><b></b></i>').join('')}</div>
    <button type="button" class="kilas-x" data-aksi="kilas-tutup" aria-label="${T('Tutup')}">✕</button>
    <div class="kilas-panggung">${slide.map((h, i) => `<section class="kilas-slide" data-i="${i}">${h}</section>`).join('')}</div>
    <button type="button" class="kilas-zona kiri" data-aksi="kilas-mundur" aria-label="${T('Sebelumnya')}"></button>
    <button type="button" class="kilas-zona kanan" data-aksi="kilas-maju" aria-label="${T('Berikutnya')}"></button>`;
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  kilas = { k, i: -1, n: slide.length, timer: 0 };
  keSlideKilas(0);
}

function keSlideKilas(i) {
  if (!kilas) return;
  if (i >= kilas.n) return; // slide terakhir tetap tampil sampai ditutup
  kilas.i = Math.max(0, i);
  const el = $('#kilas');
  el.querySelectorAll('.kilas-slide').forEach((s, n) => s.classList.toggle('aktif', n === kilas.i));
  el.querySelectorAll('.kilas-bar i').forEach((b, n) => {
    b.className = n < kilas.i ? 'lewat' : n === kilas.i ? 'jalan' : '';
  });
  clearTimeout(kilas.timer);
  if (kilas.i < kilas.n - 1) kilas.timer = setTimeout(() => keSlideKilas(kilas.i + 1), 5000);
}

function tutupKilasBalik() {
  if (!kilas) return;
  clearTimeout(kilas.timer);
  kilas = null;
  const el = $('#kilas');
  if (el) el.hidden = true;
  document.body.style.overflow = '';
}

Object.assign(AKSI, {
  'kilas-maju': () => keSlideKilas(kilas ? kilas.i + 1 : 0),
  'kilas-mundur': () => keSlideKilas(kilas ? kilas.i - 1 : 0),
  'kilas-tutup': () => tutupKilasBalik(),
  'kilas-bagikan': async () => {
    const k = kilas && kilas.k;
    if (!k) return;
    try { await bagikanLaporan(k); } catch (e) { toast(T('Gambar tidak bisa dibuat: {pesan}', { pesan: pesanError(e) }), true); }
  },
  'kilas-putar': el => bukaKilasBalik(el.dataset.bulan),
});

// ---------- Ringkasan hasil suara ----------
// Setelah bicara, data yang terbaca ditampilkan dulu di kartu: Simpan langsung, Koreksi di form, atau Ulangi.

let hasilSuara = null; // { teks, h }
let urutanSuara = 0;   // hasil AI yang datang terlambat (sudah bicara lagi) diabaikan

/** Wadah kartu ringkasan (dibuat sekali). */
function kartuRingkasSuara() {
  let el = $('#ringkas-suara');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ringkas-suara';
    el.className = 'sesi ringkas-suara';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ringkas-judul');
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Hasil suara final → kartu ringkasan. Kalau ada kunci Gemini, kalimat dipahami AI dulu (bisa tanggal, transfer,
 * kalimat bebas); gagal / offline / tanpa kunci → aturan biasa (bacaKetikCepat).
 */
async function tampilRingkasanSuara(teks) {
  if (!F) return;
  const urutan = ++urutanSuara;
  let h = null;
  let daftarAi = null;
  if ((S.data.kunciGemini || []).length && navigator.onLine) {
    const el = kartuRingkasSuara();
    el.innerHTML = `
      <div class="sesi-kartu kartu-ringkas memahami">
        <span class="label-ringkas" id="ringkas-judul">${T('🤖 Memahami kalimat…')}</span>
        <p class="kutipan-suara">“${esc(teks)}”</p>
        <div class="bilah-memahami"><i></i></div>
        <button type="button" class="tombol-teks" data-aksi="ringkas-tanpa-ai">${T('Lewati, baca tanpa AI')}</button>
      </div>`;
    el.hidden = false;
    lewatiAi = false;
    try {
      const konteks = {
        hariIni: hariIni(),
        kategori: S.data.kategori.map(k => ({ nama: k.nama, tipe: k.tipe })),
        dompet: dompetBiasa().map(w => w.nama),
        tabungan: S.data.dompet.filter(w => !dompetBiasa().includes(w) && w.jenis !== JENIS.UTANG).map(w => w.nama),
      };
      const r = await Promise.race([
        api('pahamiKalimat', teks, konteks),
        new Promise((_, gagal) => setTimeout(() => gagal(new Error('lama')), 12000)),
        new Promise((_, gagal) => { tungguLewati = () => gagal(new Error('dilewati')); }),
      ]);
      if (r) {
        const t = bacaTanggalLisan(angkaDariKata(teks)).tanggal;
        daftarAi = (Array.isArray(r.transaksi) ? r.transaksi : [r]).slice(0, 8).map(x => {
          const y = rapikanHasilAi(x);
          if (t) y.tanggal = t;
          return y;
        }).filter(y => y.jumlah || y.catatan);
        h = daftarAi[0] || null;
      }
    } catch (e) {
      if (e.message !== 'dilewati') console.warn('AI suara gagal, pakai aturan biasa:', e.message);
    }
    if (urutan !== urutanSuara || !F || $('#ringkas-suara').hidden) return; // sudah ditutup / bicara lagi
  }
  const daftar = daftarAi && daftarAi.length ? daftarAi : pecahKalimat(teks.slice(0, 300));
  if (daftar.length > 1) return tampilBanyakSuara(teks, daftar);
  if (!h) h = daftar[0] || Object.assign(bacaKetikCepat(teks.slice(0, 300)), { sumber: 'aturan' });
  bacaFieldTrx();
  // Hasil langsung diterapkan ke form di belakang kartu; kartu menampilkan & bisa mengubah isian F.
  // Isian sebelumnya disimpan, supaya "Ulangi bicara" mengembalikan form seperti semula.
  const sebelum = { tipe: F.tipe, jumlah: F.jumlah, kategori: F.kategori, dompet: F.dompet, dompetTujuan: F.dompetTujuan, tanggal: F.tanggal, catatan: F.catatan };
  isiFormCepat(h);
  hasilSuara = { teks, h, sebelum };
  ringkasEdit = '';
  gambarRingkasSuara(true);
  getar();
}

function gambarRingkasSuara(pertama) {
  if (!F || !hasilSuara || hasilSuara.banyak) return;
  jenisRingkas = 'suara';
  const kurang = kurangRingkas();
  const el = kartuRingkasSuara();
  el.innerHTML = `
    <div class="sesi-kartu kartu-ringkas ${pertama ? '' : 'diam'}">
      <span class="label-ringkas" id="ringkas-judul">${hasilSuara.h.sumber === 'ai' ? T('🤖 Dipahami AI · yang akan dicatat') : T('🎤 Yang akan dicatat')}</span>
      <p class="kutipan-suara">“${esc(hasilSuara.teks)}”</p>
      ${nominalRingkas()}
      ${isianRingkas()}
      <p class="peringatan-ringkas" id="kurang-ringkas" ${kurang.length ? '' : 'hidden'}>⚠️ ${kurang.join(' · ')}</p>
      <div class="aksi-ringkas">
        <button type="button" class="btn btn-hapus" data-aksi="ringkas-koreksi">${T('✏️ Koreksi')}</button>
        <button type="button" class="btn btn-utama" data-aksi="ringkas-simpan" ${kurang.length ? 'disabled' : ''}>${T('✔ Simpan')}</button>
      </div>
      <button type="button" class="tombol-teks" data-aksi="ringkas-ulang">${T('🎤 Ulangi bicara')}</button>
    </div>`;
  el.hidden = false;
  if (pertama) setTimeout(() => { const b = el.querySelector('#r-jumlah') || el.querySelector('[data-aksi="ringkas-simpan"]:not([disabled])') || el.querySelector('[data-aksi="ringkas-koreksi"]'); if (b) b.focus(); }, 50);
}

// ---------- Kartu konfirmasi (suara & struk): isian bisa dilengkapi langsung di kartu ----------

let ringkasEdit = '';   // bagian yang sedang dibuka untuk diubah: 'jumlah' | 'kategori' | 'dompet' | 'tujuan' | 'tanggal' | 'label-baru'
let jenisRingkas = '';  // 'suara' | 'struk'

function kurangRingkas() {
  const k = [];
  if (!F.jumlah) k.push(T('Nominal belum terbaca'));
  if (F.tipe !== TIPE.TRANSFER && !F.kategori) k.push(T('Kategori belum dipilih'));
  if (!F.dompet) k.push(T('Dompet belum dipilih'));
  if (F.tipe === TIPE.TRANSFER && (!F.dompetTujuan || F.dompetTujuan === F.dompet)) k.push(T('Dompet tujuan belum dipilih'));
  return k;
}

/** Nominal besar (ketuk untuk mengubah); kosong → langsung kotak isian. */
function nominalRingkas() {
  const masuk = F.tipe === TIPE.MASUK, transfer = F.tipe === TIPE.TRANSFER;
  const tanda = masuk ? '+' : transfer ? '' : '−';
  const isi = !F.jumlah || ringkasEdit === 'jumlah';
  return `<button type="button" class="nominal-ringkas ${masuk ? 'masuk' : transfer ? '' : 'keluar'} ${F.jumlah ? '' : 'belum'}" data-aksi="ringkas-edit" data-k="jumlah" aria-label="${T('Ubah nominal')}">
      <small>${esc(namaT(F.tipe))}</small><span id="angka-ringkas">${F.jumlah ? tanda + rp(F.jumlah) : 'Rp —'}</span></button>
    ${isi ? `<label class="isi-jumlah-ringkas"><span>Rp</span><input id="r-jumlah" class="input-rp" inputmode="numeric" autocomplete="off" placeholder="${T('Isi nominal')}" value="${F.jumlah ? formatAngka(F.jumlah) : ''}"></label>` : ''}`;
}

/** Baris kategori / dompet / tanggal / label: yang kosong langsung terbuka pilihannya, yang terisi bisa diketuk untuk diubah. */
function isianRingkas() {
  const transfer = F.tipe === TIPE.TRANSFER;
  const baris = (k, ikon, label, nilai, kosong) => {
    const buka = ringkasEdit === k || kosong;
    return `<button type="button" class="baris-ringkas bisa-ubah ${kosong ? 'belum' : ''}" data-aksi="ringkas-edit" data-k="${k}" aria-expanded="${buka}">
      <span class="ikon-ringkas">${ikon}</span><span class="isi"><small>${label}</small><b>${nilai}</b></span>
      <span class="ubah-ringkas">${kosong ? T('Pilih') : buka ? T('Tutup') : T('Ubah')}</span></button>`;
  };
  const pilihan = (k, daftar, terpilih) => `<div class="pilih-ringkas">${daftar.map(([nama, ikon]) =>
    `<button type="button" class="chip ${nama === terpilih ? 'aktif' : ''}" data-aksi="ringkas-isi" data-k="${k}" data-v="${esc(nama)}"><span class="ilus-chip">${ilus(ikon)}</span>${esc(namaT(nama))}</button>`).join('')}</div>`;
  const dompet = S.data.dompet.find(w => w.nama === F.dompet);
  const tujuan = S.data.dompet.find(w => w.nama === F.dompetTujuan);
  const daftarDompet = (transfer ? dompetTransfer().filter(w => w.jenis !== JENIS.UTANG) : dompetBiasa()).map(w => [w.nama, w.ikon]);
  const tujuanSalah = !F.dompetTujuan || F.dompetTujuan === F.dompet;
  const label = labelDari(F.catatan)[0] || '';
  const semuaLabel = Array.from(new Set((label ? [label] : []).concat(labelTerakhir())));
  const tgl = F.tanggal || hariIni();
  let h = '<div class="daftar-ringkas">';
  if (!transfer) {
    h += baris('kategori', ilus(F.kategori ? ikonKategori(F.kategori, F.tipe) : '🏷️'), T('Kategori'), F.kategori ? esc(namaT(F.kategori)) : T('Belum dipilih'), !F.kategori);
    if (ringkasEdit === 'kategori' || !F.kategori) h += pilihan('kategori', S.data.kategori.filter(k => k.tipe === F.tipe).map(k => [k.nama, k.ikon]), F.kategori);
  }
  h += baris('dompet', ilus(dompet ? dompet.ikon : '👛'), transfer ? T('Dari dompet') : T('Dompet'), F.dompet ? esc(namaT(F.dompet)) : T('Belum dipilih'), !F.dompet);
  if (ringkasEdit === 'dompet' || !F.dompet) h += pilihan('dompet', daftarDompet, F.dompet);
  if (transfer) {
    h += baris('tujuan', ilus(tujuan ? tujuan.ikon : '👛'), T('Ke dompet'), F.dompetTujuan ? esc(namaT(F.dompetTujuan)) : T('Belum dipilih'), tujuanSalah);
    if (ringkasEdit === 'tujuan' || tujuanSalah) h += pilihan('tujuan', daftarDompet.filter(([n]) => n !== F.dompet), F.dompetTujuan);
  }
  if (F.catatan) h += `<div class="baris-ringkas"><span class="ikon-ringkas">📝</span><span class="isi"><small>${T('Catatan')}</small><b>${esc(F.catatan)}</b></span></div>`;
  h += baris('tanggal', '📅', T('Tanggal'), esc(labelHariPendek(tgl)), false);
  if (ringkasEdit === 'tanggal') h += `<div class="pilih-ringkas"><input class="field" type="date" id="r-tanggal" value="${esc(tgl)}" max="${geserHari(hariIni(), 1)}"></div>`;
  h += `<div class="baris-ringkas"><span class="ikon-ringkas">🏷️</span><span class="isi"><small>${T('Label (opsional)')}</small>
      <select id="r-label" class="pilih-label" aria-label="${T('Label (opsional)')}">
        <option value="">${T('Tanpa label')}</option>
        ${semuaLabel.map(l => `<option value="${esc(l)}" ${l === label ? 'selected' : ''}>#${esc(l)}</option>`).join('')}
        <option value="__baru">${T('＋ Label baru…')}</option>
      </select></span></div>`;
  if (ringkasEdit === 'label-baru') {
    h += `<div class="pilih-ringkas label-baru-ringkas"><span>#</span><input class="field" id="r-label-baru" maxlength="30" autocomplete="off" placeholder="${T('mis. lebaran')}">
      <button type="button" class="btn btn-utama btn-kecil" data-aksi="ringkas-label-pakai">${T('Pakai')}</button></div>`;
  }
  return h + '</div>';
}

/** Gambar ulang kartu yang sedang tampil setelah isian diubah (tanpa animasi masuk). */
function segarkanRingkas() {
  if (!F) return;
  renderFormTrx(); // form di belakang ikut berubah
  if (jenisRingkas === 'struk') tampilRingkasanStruk(false);
  else gambarRingkasSuara(false);
}

/** Nominal diketik di kartu: form & tombol Simpan ikut berubah tanpa menggambar ulang kartu (fokus tidak hilang). */
document.addEventListener('input', e => {
  if (e.target.id !== 'r-jumlah' || !F) return;
  F.jumlah = angka(e.target.value);
  if ($('#f-jumlah')) $('#f-jumlah').value = F.jumlah ? formatAngka(F.jumlah) : '';
  const angkaEl = $('#angka-ringkas');
  if (angkaEl) angkaEl.parentElement.classList.toggle('belum', !F.jumlah);
  if (angkaEl) angkaEl.textContent = F.jumlah ? (F.tipe === TIPE.MASUK ? '+' : F.tipe === TIPE.TRANSFER ? '' : '−') + rp(F.jumlah) : 'Rp —';
  const kurang = kurangRingkas();
  const p = $('#kurang-ringkas');
  if (p) { p.hidden = !kurang.length; p.textContent = '⚠️ ' + kurang.join(' · '); }
  const tombol = document.querySelector('#ringkas-suara [data-aksi="ringkas-simpan"], #ringkas-suara [data-aksi="ringkas-struk-simpan"]');
  if (tombol) tombol.disabled = !!kurang.length;
});
document.addEventListener('change', e => {
  if (!F || !e.target.closest || !e.target.closest('#ringkas-suara')) return;
  if (e.target.id === 'r-tanggal' && e.target.value) {
    bacaFieldTrx();
    F.tanggal = e.target.value;
    ringkasEdit = '';
    segarkanRingkas();
  }
  if (e.target.id === 'r-label') {
    if (e.target.value === '__baru') {
      ringkasEdit = 'label-baru';
      segarkanRingkas();
      setTimeout(() => $('#r-label-baru') && $('#r-label-baru').focus(), 50);
      return;
    }
    bacaFieldTrx();
    pasangLabel(e.target.value);
    ringkasEdit = '';
    segarkanRingkas();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'r-label-baru') { e.preventDefault(); AKSI['ringkas-label-pakai'](); }
  if (e.key === 'Enter' && e.target.id === 'r-jumlah') { e.preventDefault(); e.target.blur(); }
});

/** Satu label per transaksi dari kartu: label lama di catatan diganti. */
function pasangLabel(label) {
  const bersih = String(F.catatan || '').replace(POLA_LABEL, '').replace(/\s{2,}/g, ' ').trim();
  F.catatan = label ? (bersih ? bersih + ' ' : '') + '#' + label : bersih;
}

Object.assign(AKSI, {
  'ringkas-edit': el => {
    const k = el.dataset.k;
    if (k === 'jumlah' && !F.jumlah) return $('#r-jumlah') && $('#r-jumlah').focus();
    ringkasEdit = ringkasEdit === k ? '' : k;
    bacaFieldTrx();
    segarkanRingkas();
    if (ringkasEdit === 'jumlah') setTimeout(() => { const i = $('#r-jumlah'); if (i) { i.focus(); i.select(); } }, 50);
  },
  'ringkas-isi': el => {
    if (!F) return;
    bacaFieldTrx();
    const v = el.dataset.v;
    if (el.dataset.k === 'kategori') F.kategori = v;
    if (el.dataset.k === 'dompet') { F.dompet = v; if (F.dompetTujuan === v) F.dompetTujuan = ''; }
    if (el.dataset.k === 'tujuan') F.dompetTujuan = v;
    ringkasEdit = '';
    segarkanRingkas();
  },
  'ringkas-label-pakai': () => {
    const i = $('#r-label-baru');
    const l = i ? i.value.replace(/^#/, '').replace(/[^\p{L}\p{N}_-]/gu, '').toLowerCase().slice(0, 30) : '';
    if (l.length < 2) return toast(T('Label minimal 2 huruf, tanpa spasi.'), true);
    bacaFieldTrx();
    pasangLabel(l);
    ringkasEdit = '';
    segarkanRingkas();
  },
});

/**
 * Aturan biasa untuk kalimat berisi beberapa transaksi: "bakso 25rb, parkir 5rb dan bensin 30rb pakai gopay".
 * Dipecah di koma / "dan" / "terus" kalau tiap bagian punya nominal; dompet & tanggal yang disebut sekali berlaku untuk semua.
 */
function pecahKalimat(teks) {
  const utuh = Object.assign(bacaKetikCepat(teks), { sumber: 'aturan' });
  const bagian = angkaDariKata(teks).split(/\s*(?:,|;|\bdan\b|\bterus\b)\s*/i).map(x => x.trim()).filter(Boolean);
  if (bagian.length < 2) return [utuh];
  const hasil = bagian.map(b => Object.assign(bacaKetikCepat(b), { sumber: 'aturan' }));
  if (hasil.filter(x => x.jumlah).length < 2) return [utuh]; // bukan daftar transaksi, mis. "nasi dan teh 20rb"
  return hasil.filter(x => x.jumlah).map(x => Object.assign(x, {
    dompet: x.dompet || utuh.dompet,
    tanggal: x.tanggal || utuh.tanggal,
  }));
}

let banyakSuara = null; // [{ ...transaksi siap simpan, kurang: [] }]

/** Kartu ringkasan untuk beberapa transaksi sekaligus: tiap baris bisa dibuang (✕), lalu Simpan semua. */
function tampilBanyakSuara(teks, daftar) {
  bacaFieldTrx();
  banyakSuara = daftar.map(h => {
    const x = { tipe: h.tipe || TIPE.KELUAR, jumlah: h.jumlah, kategori: h.kategori || '', dompet: h.dompet || F.dompet,
      dompetTujuan: h.dompetTujuan || '', tanggal: h.tanggal || F.tanggal || hariIni(), catatan: h.catatan || '', sumber: h.sumber };
    if (x.tipe !== TIPE.TRANSFER && !(x.tipe === TIPE.KELUAR ? dompetBiasa() : dompetBiasa()).some(w => w.nama === x.dompet)) x.dompet = F.dompet;
    x.kurang = [];
    if (!x.jumlah) x.kurang.push(T('nominal'));
    if (x.tipe !== TIPE.TRANSFER && !x.kategori) x.kurang.push(T('kategori'));
    if (x.tipe === TIPE.TRANSFER && (!x.dompetTujuan || x.dompetTujuan === x.dompet)) x.kurang.push(T('dompet tujuan'));
    return x;
  });
  hasilSuara = { teks, banyak: true };
  gambarBanyakSuara(teks);
  getar();
}

function gambarBanyakSuara(teks) {
  const el = kartuRingkasSuara();
  const daftar = banyakSuara;
  const lengkap = daftar.filter(x => !x.kurang.length);
  const total = lengkap.filter(x => x.tipe === TIPE.KELUAR).reduce((a, x) => a + x.jumlah, 0);
  const ai = daftar.some(x => x.sumber === 'ai');
  el.innerHTML = `
    <div class="sesi-kartu kartu-ringkas">
      <span class="label-ringkas" id="ringkas-judul">${ai ? T('🤖 Dipahami AI · {n} transaksi', { n: daftar.length }) : T('🎤 Terbaca · {n} transaksi', { n: daftar.length })}</span>
      <p class="kutipan-suara">“${esc(teks || hasilSuara.teks)}”</p>
      <div class="daftar-banyak">${daftar.map((x, i) => {
        const ikon = x.tipe === TIPE.TRANSFER ? '🔁' : x.kategori ? ikonKategori(x.kategori, x.tipe) : '🏷️';
        return `<div class="baris-banyak ${x.kurang.length ? 'belum' : ''}">
          <span class="ikon-ringkas">${ilus(ikon)}</span>
          <span class="isi"><b>${esc(x.catatan || namaT(x.kategori || x.tipe))}</b>
            <small>${x.kurang.length ? T('⚠️ {daftar} belum terbaca', { daftar: x.kurang.join(', ') })
              : esc([x.tipe === TIPE.TRANSFER ? namaT(x.dompet) + ' → ' + namaT(x.dompetTujuan) : namaT(x.kategori), x.tipe === TIPE.TRANSFER ? '' : namaT(x.dompet), labelHariPendek(x.tanggal)].filter(Boolean).join(' · '))}</small></span>
          <b class="nominal ${x.tipe === TIPE.MASUK ? 'masuk' : x.tipe === TIPE.TRANSFER ? '' : 'keluar'}">${x.jumlah ? (x.tipe === TIPE.MASUK ? '+' : x.tipe === TIPE.TRANSFER ? '' : '−') + rp(x.jumlah) : '—'}</b>
          <button type="button" class="buang-banyak" data-aksi="buang-banyak" data-i="${i}" aria-label="${T('Buang transaksi ini')}">✕</button>
        </div>`;
      }).join('')}</div>
      ${total ? `<div class="total-banyak"><span>${T('Total pengeluaran')}</span><b>${rp(total)}</b></div>` : ''}
      ${lengkap.length < daftar.length ? `<p class="peringatan-ringkas">${T('⚠️ Yang belum lengkap tidak ikut disimpan. Buang (✕) atau catat manual nanti.')}</p>` : ''}
      <div class="aksi-ringkas">
        <button type="button" class="btn btn-hapus" data-aksi="ringkas-ulang">${T('🎤 Ulangi')}</button>
        <button type="button" class="btn btn-utama" data-aksi="simpan-banyak" ${lengkap.length ? '' : 'disabled'}>${lengkap.length > 1 ? T('✔ Simpan semua ({n})', { n: lengkap.length }) : T('✔ Simpan') + ' '}</button>
      </div>
    </div>`;
  el.hidden = false;
}

function tutupRingkasanSuara() {
  const el = $('#ringkas-suara');
  if (el) el.hidden = true;
}

/** Foto struk layar penuh (sebelum diunggah ke Drive). Ketuk di mana saja atau tombol kembali untuk menutup. */
function lihatFoto(src) {
  let el = $('#lihat-foto');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lihat-foto';
    el.className = 'lihat-foto';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', T('Foto struk||gambar'));
    el.dataset.aksi = 'tutup-foto';
    document.body.appendChild(el);
  }
  el.innerHTML = `<img src="${src}" alt="${T('Foto struk||gambar')}"><button type="button" class="tutup-foto" data-aksi="tutup-foto" aria-label="${T('Tutup')}">✕</button>`;
  el.hidden = false;
  setTimeout(() => el.querySelector('.tutup-foto').focus(), 50);
}

/** Foto lampiran yang sudah pernah dibuka / baru disimpan dari HP ini (data URL / object URL), supaya langsung tampil. */
const FOTO_TRX = {};   // ID transaksi → foto (yang baru disimpan dari HP ini)
const FOTO_DRIVE = {}; // ID file Drive → object URL (sudah pernah diunduh)
function fotoLampiranHp(idFile, idTrx) {
  return FOTO_DRIVE[idFile] || (idTrx && FOTO_TRX[idTrx]) || '';
}

/**
 * Membuka foto lampiran di aplikasi: diunduh lewat API Drive dengan login aplikasi (tanpa ditanya akun Google lagi).
 * Kalau gagal (mis. foto milik anggota lain yang belum bisa dibaca aplikasi), baru dibuka di Google Drive.
 */
const unduhanFoto = {};
/** Object URL foto lampiran (diunduh sekali lewat API Drive, lalu diingat). */
function muatFotoLampiran(idFile) {
  if (FOTO_DRIVE[idFile]) return Promise.resolve(FOTO_DRIVE[idFile]);
  if (!unduhanFoto[idFile]) {
    unduhanFoto[idFile] = api('ambilLampiran', idFile)
      .then(blob => (FOTO_DRIVE[idFile] = URL.createObjectURL(blob)))
      .finally(() => { delete unduhanFoto[idFile]; });
  }
  return unduhanFoto[idFile];
}

async function lihatLampiranDrive(idFile, idTrx) {
  const ada = fotoLampiranHp(idFile, idTrx);
  if (ada) return lihatFoto(ada);
  lihatFoto('');
  const el = $('#lihat-foto');
  el.insertAdjacentHTML('afterbegin', '<p class="muat-foto">' + T('Memuat foto…') + '</p>');
  el.querySelector('img').remove();
  try {
    await muatFotoLampiran(idFile);
    if (el.hidden) return; // sudah ditutup pengguna
    lihatFoto(FOTO_DRIVE[idFile]);
    if ($('#form-trx') && F && F.lampiran === idFile) renderFormTrx(); // tampilkan foto kecilnya di form
  } catch (e) {
    if (el.hidden) return;
    tutupFoto();
    if (e.jaringan) return toast(T('Butuh internet untuk membuka foto struk.'), true);
    window.open('https://drive.google.com/file/d/' + encodeURIComponent(idFile) + '/view', '_blank', 'noopener');
  }
}

function tutupFoto() {
  const el = $('#lihat-foto');
  if (!el || el.hidden) return false;
  el.hidden = true;
  el.innerHTML = ''; // lepas gambar besar dari memori
  return true;
}

Object.assign(AKSI, {
  'lihat-lampiran': () => {
    if (F && F.lampiranData) lihatFoto('data:image/jpeg;base64,' + F.lampiranData);
    else if (F && F.lampiran) lihatLampiranDrive(F.lampiran, F.id);
    else if (F && F.lampiranThumb) lihatFoto(F.lampiranThumb);
  },
  'tutup-foto': () => tutupFoto(),
});

/**
 * Kartu konfirmasi hasil foto struk (sama seperti hasil suara): Simpan langsung, Koreksi di form, atau Foto ulang.
 * Form transaksi sudah diisi terapkanStruk(); kartu ini hanya menampilkan isian F.
 */
function tampilRingkasanStruk(pertama = true) {
  if (!F || !F.struk) return;
  const h = F.struk;
  jenisRingkas = 'struk';
  if (pertama) ringkasEdit = '';
  const kembar = teksStrukKembar();
  const kurang = kurangRingkas();

  const el = kartuRingkasSuara();
  el.innerHTML = `
    <div class="sesi-kartu kartu-ringkas ${pertama ? '' : 'diam'}">
      <span class="label-ringkas" id="ringkas-judul">${T('🧾 Struk terbaca · yang akan dicatat')}</span>
      <div class="kepala-ringkas-struk">
        <div class="nominal-struk">${nominalRingkas()}</div>
        ${F.lampiranThumb ? `<button type="button" class="thumb-ringkas" data-aksi="lihat-lampiran" aria-label="${T('Lihat foto struk')}"><img src="${F.lampiranThumb}" alt=""></button>` : ''}
      </div>
      ${h.pilihanJumlah.length > 1 ? `
        <div class="pilih-total-ringkas"><small>${T('Total terbaca berbeda-beda, ketuk yang sesuai struk:')}</small>
          <div class="chips">${h.pilihanJumlah.map(p =>
            `<button type="button" class="chip ${p.jumlah === F.jumlah ? 'aktif' : ''}" data-aksi="ringkas-struk-jumlah" data-jumlah="${p.jumlah}">${rp(p.jumlah)}</button>`).join('')}</div>
        </div>` : ''}
      <p class="status-ringkas">${statusStruk(h)}</p>
      ${isianRingkas()}
      ${kembar ? `<p class="peringatan-ringkas">${kembar}</p>` : ''}
      <p class="peringatan-ringkas" id="kurang-ringkas" ${kurang.length ? '' : 'hidden'}>⚠️ ${kurang.join(' · ')}</p>
      ${tombolPecahStruk(h)}
      <div class="aksi-ringkas">
        <button type="button" class="btn btn-hapus" data-aksi="ringkas-struk-koreksi">${T('✏️ Koreksi')}</button>
        <button type="button" class="btn btn-utama" data-aksi="ringkas-struk-simpan" ${kurang.length ? 'disabled' : ''}>${T('✔ Simpan')}</button>
      </div>
      <button type="button" class="tombol-teks" data-aksi="ringkas-struk-ulang">${T('📷 Foto ulang')}</button>
    </div>`;
  el.hidden = false;
  if (pertama) setTimeout(() => { const b = el.querySelector('[data-aksi="ringkas-struk-simpan"]:not([disabled])') || el.querySelector('[data-aksi="ringkas-struk-koreksi"]'); if (b) b.focus(); }, 50);
}

Object.assign(AKSI, {
  'ringkas-struk-jumlah': el => {
    if (!F) return;
    bacaFieldTrx();
    F.jumlah = Number(el.dataset.jumlah);
    ringkasEdit = '';
    renderFormTrx();
    tampilRingkasanStruk(false);
  },
  'ringkas-struk-simpan': () => {
    tutupRingkasanSuara();
    const tombol = document.querySelector('#form-trx [data-aksi="simpan-trx"], #sheet [data-aksi="simpan-trx"]');
    if (F && tombol) AKSI['simpan-trx'](tombol);
  },
  // Form di belakang kartu sudah terisi: cukup tutup kartunya.
  'ringkas-struk-koreksi': () => {
    tutupRingkasanSuara();
    setTimeout(() => $('#f-jumlah') && $('#f-jumlah').focus(), 50);
  },
  'ringkas-struk-ulang': () => {
    tutupRingkasanSuara();
    if (!F) return;
    bacaFieldTrx();
    // Hasil lama dibuang (juga dari antrian), supaya tidak bisa tercatat dobel.
    if (F.dariJob) hapusJob(F.dariJob);
    Object.assign(F, { jumlah: 0, kategori: '', catatan: '', struk: null, dariJob: null, lampiranData: '', lampiranThumb: '' });
    renderFormTrx();
    sumberStruk = 'form';
    $('#input-struk-kamera').click();
  },
});

let lewatiAi = false;
let tungguLewati = () => {};

/** Hasil Gemini dicek ulang terhadap data buku: nama harus persis ada, tanggal wajar, nominal bulat positif. */
function rapikanHasilAi(r) {
  const tipe = [TIPE.KELUAR, TIPE.MASUK, TIPE.TRANSFER].includes(r.tipe) ? r.tipe : TIPE.KELUAR;
  const ada = (daftar, n) => daftar.some(w => w.nama === n) ? n : '';
  const tanggalOk = /^\d{4}-\d{2}-\d{2}$/.test(r.tanggal || '') && !isNaN(keTanggal(r.tanggal))
    && r.tanggal <= geserHari(hariIni(), 1) && r.tanggal >= geserHari(hariIni(), -400);
  return {
    sumber: 'ai',
    tipe,
    jumlah: Math.max(0, Math.round(Number(r.jumlah) || 0)),
    kategori: tipe === TIPE.TRANSFER ? '' : ada(S.data.kategori.filter(k => k.tipe === tipe), r.kategori),
    dompet: ada(tipe === TIPE.TRANSFER ? dompetTransfer() : dompetBiasa(), r.dompet),
    dompetTujuan: tipe === TIPE.TRANSFER ? ada(dompetTransfer(), r.dompetTujuan) : '',
    tanggal: tanggalOk ? r.tanggal : '',
    catatan: String(r.catatan || '').trim().slice(0, 100),
  };
}

Object.assign(AKSI, {
  // Mengetuk contoh = seolah diucapkan: mic berhenti, kartu ringkasan muncul.
  'contoh-suara': el => {
    if (suaraAktif) { suaraAktif.onresult = null; try { suaraAktif.stop(); } catch (e) { /* sudah berhenti */ } }
    const input = $('#f-cepat');
    if (input) input.value = el.dataset.teks;
    tampilRingkasanSuara(el.dataset.teks);
  },
  'ringkas-tanpa-ai': () => { lewatiAi = true; tungguLewati(); },
  // Struk berisi beberapa kategori → kartu "Simpan semua" (sama dengan suara banyak transaksi).
  'pecah-struk': () => {
    if (!F || !F.struk || !(F.struk.rincian || []).length) return;
    bacaFieldTrx();
    const toko = String(F.catatan || F.struk.catatan || '').split(/\s+-\s+/)[0].trim();
    const daftar = F.struk.rincian.map(x => ({
      sumber: 'struk', tipe: TIPE.KELUAR, jumlah: x.jumlah, kategori: x.kategori, dompet: F.dompet, tanggal: F.tanggal,
      catatan: [toko, x.barang].filter(Boolean).join(' - ').slice(0, 100),
    }));
    tampilBanyakSuara(T('Struk {toko} · total {jumlah}', { toko: toko || '', jumlah: rp(F.jumlah) }), daftar);
    const label = $('#ringkas-judul');
    if (label) label.textContent = T('🧾 Struk dipecah · {n} transaksi', { n: daftar.length });
  },
  'buang-banyak': el => {
    if (!banyakSuara) return;
    banyakSuara.splice(Number(el.dataset.i), 1);
    if (!banyakSuara.length) { tutupRingkasanSuara(); banyakSuara = null; return; }
    gambarBanyakSuara();
  },
  'simpan-banyak': async el => {
    const daftar = (banyakSuara || []).filter(x => !x.kurang.length);
    if (!daftar.length) return;
    const job = F && F.dariJob; // struk dari antrean baca di latar: dibersihkan setelah tersimpan
    el.disabled = true;
    loading(true);
    let tersimpan = 0;
    try {
      for (const x of daftar) {
        await api('simpanTransaksi', { idBaru: crypto.randomUUID(), tipe: x.tipe, jumlah: x.jumlah, kategori: x.kategori, dompet: x.dompet,
          dompetTujuan: x.dompetTujuan, tanggal: x.tanggal, catatan: x.catatan });
        tersimpan++;
      }
    } catch (e) {
      if (!(e instanceof GOOGLE.PerluMasuk)) toast(T('{n} tersimpan, sisanya gagal: {pesan}', { n: tersimpan, pesan: pesanError(e) }), true);
    }
    loading(false);
    el.disabled = false;
    if (!tersimpan) return;
    tutupRingkasanSuara();
    banyakSuara = null;
    hasilSuara = null;
    if (job && typeof hapusJob === 'function') hapusJob(job);
    tutupSheet();
    await muat();
    if (tersimpan === daftar.length) toast(T('{n} transaksi tersimpan ✔', { n: tersimpan }));
  },
  'ringkas-simpan': () => {
    if (!hasilSuara || !F) return tutupRingkasanSuara();
    tutupRingkasanSuara();
    hasilSuara = null;
    const tombol = document.querySelector('#form-trx [data-aksi="simpan-trx"], #sheet [data-aksi="simpan-trx"]');
    if (tombol) AKSI['simpan-trx'](tombol);
  },
  'ringkas-koreksi': () => {
    tutupRingkasanSuara();
    if (!hasilSuara || !F) return;
    $('#f-cepat') && ($('#f-cepat').value = hasilSuara.teks);
    hasilSuara = null;
    setTimeout(() => $('#f-jumlah') && $('#f-jumlah').focus(), 50);
  },
  'ringkas-ulang': () => {
    tutupRingkasanSuara();
    if (hasilSuara && hasilSuara.sebelum && F) { Object.assign(F, hasilSuara.sebelum); renderFormTrx(); }
    hasilSuara = null;
    const t = document.querySelector('.tombol-suara');
    if (t) AKSI.suara(t);
  },
});

AKSI.suara = el => {
  if (suaraAktif) { suaraAktif.stop(); return; }
  const r = new PengenalSuara();
  r.lang = BAHASA === 'en' ? 'en-US' : 'id-ID';
  r.interimResults = true;
  r.maxAlternatives = 1;
  suaraAktif = r;
  panelSuara('siap');
  const input = $('#f-cepat');
  r.onaudiostart = () => { panelSuara('dengar'); if (navigator.vibrate) navigator.vibrate(30); };
  r.onspeechstart = () => panelSuara('bicara');
  r.onresult = ev => {
    const teks = Array.from(ev.results).map(x => x[0].transcript).join(' ').trim();
    if (input) input.value = teks;
    panelSuara('bicara', teks ? '“' + teks + '”' : '');
    if (ev.results[ev.results.length - 1].isFinal && teks) {
      try { r.stop(); } catch (e) { /* sudah berhenti */ }
      tampilRingkasanSuara(teks);
    }
  };
  r.onerror = ev => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast(T('Izinkan akses mikrofon untuk mencatat dengan suara.'), true);
    else if (ev.error === 'no-speech') toast(T('Suara tidak terdengar. Coba lagi lebih dekat ke HP.'), true);
    else if (ev.error === 'network') toast(T('Pengenalan suara butuh sinyal internet.'), true);
  };
  r.onend = () => {
    suaraAktif = null;
    panelSuara('');
  };
  try { r.start(); } catch (e) { suaraAktif = null; panelSuara(''); }
};
