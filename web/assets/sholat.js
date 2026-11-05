/**
 * Jadwal sholat & arah kiblat, dihitung langsung di HP (tanpa internet, tanpa API).
 *
 * Metode mengikuti kriteria Kemenag RI: Subuh saat matahari 20° di bawah ufuk, Isya 18°, Ashar mazhab Syafi'i
 * (panjang bayangan = 1× tinggi benda + bayangan saat zawal), Imsak = Subuh − 10 menit, ihtiyat +2 menit
 * (Terbit −2 menit). Posisi matahari memakai rumus astronomi ringkas (akurasi ±1 menit), seperti PrayTimes.org.
 */
const SHOLAT = (() => {
  const KABAH = { lat: 21.4225, lng: 39.8262 };
  const SUDUT_SUBUH = 20;
  const SUDUT_ISYA = 18;
  const IHTIYAT = 2; // menit

  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;
  const sin = d => Math.sin(rad(d));
  const cos = d => Math.cos(rad(d));
  const tan = d => Math.tan(rad(d));
  const asin = x => deg(Math.asin(x));
  const acos = x => deg(Math.acos(Math.max(-1, Math.min(1, x))));
  const atan2 = (y, x) => deg(Math.atan2(y, x));
  const acot = x => deg(Math.atan(1 / x));
  const putar = (a, b) => { const x = a - b * Math.floor(a / b); return x < 0 ? x + b : x; };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  /** Deklinasi matahari & persamaan waktu pada hari Julian jd. */
  function posisiMatahari(jd) {
    const D = jd - 2451545.0;
    const g = putar(357.529 + 0.98560028 * D, 360);
    const q = putar(280.459 + 0.98564736 * D, 360);
    const L = putar(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = putar(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
    return { deklinasi: asin(sin(e) * sin(L)), eqt: q / 15 - putar(RA, 24) };
  }

  /**
   * Waktu sholat untuk satu tanggal di lokasi (lat, lng). zona = selisih jam dari UTC (WIB = 7).
   * Hasil: { imsak, subuh, terbit, dzuhur, ashar, maghrib, isya } dalam menit sejak tengah malam waktu setempat.
   */
  function hitung(tanggal, lat, lng, zona) {
    const jDate = julian(tanggal.getFullYear(), tanggal.getMonth() + 1, tanggal.getDate()) - lng / (15 * 24);
    const tengahHari = t => putar(12 - posisiMatahari(jDate + t).eqt, 24);
    const waktuSudut = (sudut, t, sebelumZawal) => {
      const dekl = posisiMatahari(jDate + t).deklinasi;
      const selisih = acos((-sin(sudut) - sin(dekl) * sin(lat)) / (cos(dekl) * cos(lat))) / 15;
      return tengahHari(t) + (sebelumZawal ? -selisih : selisih);
    };
    const waktuAshar = t => {
      const dekl = posisiMatahari(jDate + t).deklinasi;
      return waktuSudut(-acot(1 + tan(Math.abs(lat - dekl))), t, false);
    };

    // Dua putaran: tebakan awal (jam lokal kasar), lalu diperhalus memakai hasil putaran pertama.
    let w = { subuh: 5, terbit: 6, dzuhur: 12, ashar: 13, maghrib: 18, isya: 18 };
    for (let i = 0; i < 2; i++) {
      const p = k => w[k] / 24;
      w = {
        subuh: waktuSudut(SUDUT_SUBUH, p('subuh'), true),
        terbit: waktuSudut(0.833, p('terbit'), true),
        dzuhur: tengahHari(p('dzuhur')),
        ashar: waktuAshar(p('ashar')),
        maghrib: waktuSudut(0.833, p('maghrib'), false),
        isya: waktuSudut(SUDUT_ISYA, p('isya'), false),
      };
    }
    const menit = (jam, tambah) => Math.round((jam + zona - lng / 15) * 60) + tambah;
    const subuh = menit(w.subuh, IHTIYAT);
    return {
      imsak: subuh - 10,
      subuh,
      terbit: menit(w.terbit, -IHTIYAT),
      dzuhur: menit(w.dzuhur, IHTIYAT),
      ashar: menit(w.ashar, IHTIYAT),
      maghrib: menit(w.maghrib, IHTIYAT),
      isya: menit(w.isya, IHTIYAT),
    };
  }

  /** Arah kiblat dari lokasi ini, derajat searah jarum jam dari utara sejati. */
  function arahKiblat(lat, lng) {
    const dl = KABAH.lng - lng;
    return putar(atan2(sin(dl), cos(lat) * tan(KABAH.lat) - sin(lat) * cos(dl)), 360);
  }

  /** 295 → "barat laut". */
  function namaArah(derajat) {
    const n = ['utara', 'timur laut', 'timur', 'tenggara', 'selatan', 'barat daya', 'barat', 'barat laut'];
    return n[Math.round(putar(derajat, 360) / 45) % 8];
  }

  /** Kota besar Indonesia untuk pilihan lokasi manual (kalau izin lokasi ditolak / tidak tersedia). */
  const KOTA = [
    ['Banda Aceh', 5.5483, 95.3238], ['Medan', 3.5952, 98.6722], ['Padang', -0.9471, 100.4172], ['Pekanbaru', 0.5071, 101.4478],
    ['Batam', 1.0456, 104.0305], ['Jambi', -1.6101, 103.6131], ['Palembang', -2.9761, 104.7754], ['Bengkulu', -3.7928, 102.2608],
    ['Bandar Lampung', -5.3971, 105.2668], ['Jakarta', -6.2088, 106.8456], ['Bogor', -6.5971, 106.806], ['Depok', -6.4025, 106.7942],
    ['Tangerang', -6.1783, 106.6319], ['Bekasi', -6.2383, 106.9756], ['Serang', -6.1201, 106.1503], ['Bandung', -6.9175, 107.6191],
    ['Cirebon', -6.732, 108.5523], ['Semarang', -6.9667, 110.4167], ['Solo', -7.5755, 110.8243], ['Yogyakarta', -7.7956, 110.3695],
    ['Surabaya', -7.2575, 112.7521], ['Malang', -7.9666, 112.6326], ['Jember', -8.1724, 113.7008], ['Denpasar', -8.6705, 115.2126],
    ['Mataram', -8.5833, 116.1167], ['Kupang', -10.1772, 123.607], ['Pontianak', -0.0263, 109.3425], ['Palangka Raya', -2.2161, 113.9135],
    ['Banjarmasin', -3.3194, 114.5908], ['Samarinda', -0.5022, 117.1536], ['Balikpapan', -1.2379, 116.8529], ['Manado', 1.4748, 124.8421],
    ['Palu', -0.8917, 119.8707], ['Gorontalo', 0.5435, 123.0568], ['Makassar', -5.1477, 119.4327], ['Kendari', -3.9985, 122.5129],
    ['Ambon', -3.6954, 128.1814], ['Ternate', 0.7893, 127.3753], ['Jayapura', -2.5337, 140.7181], ['Sorong', -0.8762, 131.2558],
  ];

  return { hitung, arahKiblat, namaArah, KOTA };
})();
