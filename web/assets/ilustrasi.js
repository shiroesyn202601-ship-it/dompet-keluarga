/**
 * Ilustrasi berwarna untuk ikon kategori & dompet (gaya flat cerah), menggantikan emoji bawaan.
 * Data tetap menyimpan emoji (kolom Ikon di spreadsheet); emoji yang tidak ada di sini tetap tampil sebagai emoji.
 * Setiap ilustrasi: [warna dasar ubin, isi SVG 48×48]. Ubin diberi warna lembut lewat CSS (.ilus-ubin).
 */
const ILUSTRASI = (() => {
  const R = 'stroke-linecap="round" stroke-linejoin="round"';
  const I = {
    // ---------- Pengeluaran ----------
    '🍜': ['#EF4444', `
      <path d="M29 7l7 15M34 6l5 15" stroke="#92400E" stroke-width="2.4" ${R}/>
      <path d="M9 23h30a15 13 0 0 1-30 0z" fill="#EF4444"/>
      <path d="M9 23h30" stroke="#B91C1C" stroke-width="2.4" ${R}/>
      <path d="M14 22c1.5-3 3 0 4.5-3s3 0 4.5-3 3 0 4.5-3" fill="none" stroke="#FACC15" stroke-width="2.6" ${R}/>
      <path d="M15 28h18" stroke="#FCA5A5" stroke-width="2.4" ${R}/>
      <rect x="18" y="35" width="12" height="3.5" rx="1.75" fill="#B91C1C"/>`],
    '🛒': ['#3B82F6', `
      <path d="M7 10h5l4 18h19l4-13H14" fill="none" stroke="#1E3A8A" stroke-width="2.6" ${R}/>
      <path d="M15.5 16h22l-3 10H17.5z" fill="#3B82F6"/>
      <rect x="18" y="12" width="7" height="7" rx="1.5" fill="#22C55E"/>
      <circle cx="26" cy="13" r="3.5" fill="#F97316"/>
      <circle cx="18" cy="35" r="3.2" fill="#1E3A8A"/><circle cx="32" cy="35" r="3.2" fill="#1E3A8A"/>`],
    '⛽': ['#EF4444', `
      <rect x="10" y="9" width="18" height="30" rx="3" fill="#EF4444"/>
      <rect x="13" y="13" width="12" height="8" rx="1.5" fill="#FEF3C7"/>
      <rect x="8" y="37" width="22" height="4" rx="2" fill="#7F1D1D"/>
      <path d="M28 16h4l4 5v12a2.5 2.5 0 0 1-5 0v-6h-3" fill="none" stroke="#374151" stroke-width="2.6" ${R}/>
      <path d="M19 26c2 3 2 5 0 6.5-2-1.5-2-3.5 0-6.5z" fill="#FACC15"/>`],
    '🚗': ['#0EA5E9', `
      <path d="M8 29v-4l4-8h20l6 8h2v4z" fill="#0EA5E9"/>
      <path d="M14 18h7v7h-10zM23 18h8l5 7H23z" fill="#E0F2FE"/>
      <rect x="6" y="27" width="36" height="6" rx="3" fill="#0284C7"/>
      <circle cx="15" cy="33" r="4.2" fill="#1F2937"/><circle cx="15" cy="33" r="1.8" fill="#D1D5DB"/>
      <circle cx="33" cy="33" r="4.2" fill="#1F2937"/><circle cx="33" cy="33" r="1.8" fill="#D1D5DB"/>
      <rect x="37" y="27" width="4" height="2.5" rx="1" fill="#FACC15"/>`],
    '🛵': ['#22C55E', `
      <path d="M29 31l4-16" stroke="#16A34A" stroke-width="4.5" ${R}/>
      <path d="M30 13h7" stroke="#374151" stroke-width="3" ${R}/>
      <path d="M8 31c0-5.5 3.5-9 9-9h8l3 9z" fill="#22C55E"/>
      <path d="M17 31h14" stroke="#15803D" stroke-width="3" ${R}/>
      <rect x="13" y="18.5" width="10" height="4" rx="2" fill="#1F2937"/>
      <path d="M30 27a6 6 0 0 1 11 3" fill="none" stroke="#16A34A" stroke-width="3" ${R}/>
      <circle cx="13" cy="34" r="4.5" fill="#1F2937"/><circle cx="13" cy="34" r="1.8" fill="#D1D5DB"/>
      <circle cx="36" cy="34" r="4.5" fill="#1F2937"/><circle cx="36" cy="34" r="1.8" fill="#D1D5DB"/>`],
    '🏍️': ['#F97316', `
      <path d="M14 33l7-10h9l5 10" fill="none" stroke="#9A3412" stroke-width="3" ${R}/>
      <path d="M17 24c2-4 6-5 10-5h5l-3 7H19z" fill="#F97316"/>
      <path d="M31 14h5l-3 8" fill="none" stroke="#374151" stroke-width="2.6" ${R}/>
      <circle cx="13" cy="33" r="5" fill="#1F2937"/><circle cx="13" cy="33" r="2" fill="#D1D5DB"/>
      <circle cx="36" cy="33" r="5" fill="#1F2937"/><circle cx="36" cy="33" r="2" fill="#D1D5DB"/>`],
    '💡': ['#F59E0B', `
      <path d="M24 8a11 11 0 0 1 6.5 19.8c-1 .8-1.5 2-1.5 3.2V32H19v-1c0-1.2-.5-2.4-1.5-3.2A11 11 0 0 1 24 8z" fill="#FACC15"/>
      <path d="M20 19a5 5 0 0 1 4-4" fill="none" stroke="#FEF9C3" stroke-width="2.4" ${R}/>
      <rect x="19" y="32" width="10" height="4" rx="1.5" fill="#9CA3AF"/>
      <rect x="20.5" y="36" width="7" height="3.5" rx="1.5" fill="#6B7280"/>
      <path d="M8 18h3M37 18h3M11 8.5l2 2M37 8.5l-2 2" stroke="#F59E0B" stroke-width="2.4" ${R}/>`],
    '🏠': ['#F97316', `
      <rect x="12" y="21" width="24" height="18" rx="2" fill="#FFF7ED"/>
      <path d="M7 23L24 9l17 14" fill="none" stroke="#EA580C" stroke-width="4" ${R}/>
      <rect x="20.5" y="28" width="7" height="11" rx="1.5" fill="#F97316"/>
      <rect x="14.5" y="25" width="5" height="5" rx="1" fill="#7DD3FC"/>
      <rect x="31" y="11" width="4" height="7" rx="1" fill="#9A3412"/>`],
    '💊': ['#EC4899', `
      <g transform="rotate(-45 24 24)">
        <rect x="9" y="17" width="30" height="14" rx="7" fill="#F9FAFB"/>
        <path d="M24 17h8a7 7 0 0 1 0 14h-8z" fill="#EC4899"/>
        <rect x="9" y="17" width="30" height="14" rx="7" fill="none" stroke="#BE185D" stroke-width="1.6"/>
        <path d="M14 21h6" stroke="#FFFFFF" stroke-width="2" ${R}/>
      </g>
      <circle cx="36" cy="36" r="4.5" fill="#FDE68A"/><path d="M33 36h6" stroke="#D97706" stroke-width="1.6" ${R}/>`],
    '📚': ['#8B5CF6', `
      <rect x="9" y="30" width="30" height="8" rx="2" fill="#8B5CF6"/><path d="M12 32.5h20" stroke="#EDE9FE" stroke-width="1.6" ${R}/>
      <rect x="11" y="21" width="26" height="8" rx="2" fill="#22C55E"/><path d="M14 23.5h17" stroke="#DCFCE7" stroke-width="1.6" ${R}/>
      <rect x="8" y="12" width="28" height="8" rx="2" fill="#F97316" transform="rotate(-6 22 16)"/>
      <path d="M33 34v6l2.5-1.5L38 40v-6" fill="#EF4444"/>`],
    '👶': ['#F59E0B', `
      <circle cx="24" cy="25" r="13" fill="#FDBA74"/>
      <path d="M21 12.5c0-3 5-3 4.5 0-.3 1.5-2 1.8-2 3" fill="none" stroke="#92400E" stroke-width="2.2" ${R}/>
      <circle cx="19" cy="24" r="1.8" fill="#1F2937"/><circle cx="29" cy="24" r="1.8" fill="#1F2937"/>
      <circle cx="16" cy="28.5" r="2" fill="#FB7185" opacity=".6"/><circle cx="32" cy="28.5" r="2" fill="#FB7185" opacity=".6"/>
      <circle cx="24" cy="31" r="3.4" fill="#38BDF8"/><circle cx="24" cy="31" r="1.4" fill="#E0F2FE"/>`],
    '🍼': ['#0EA5E9', `
      <path d="M21 8h6l1 5h-8z" fill="#F9A8D4"/>
      <rect x="17" y="13" width="14" height="4" rx="2" fill="#EC4899"/>
      <rect x="16" y="17" width="16" height="23" rx="5" fill="#E0F2FE" stroke="#0EA5E9" stroke-width="2"/>
      <path d="M17.5 27h13v8a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4z" fill="#FFFFFF"/>
      <path d="M16 23h5M16 29h5" stroke="#0EA5E9" stroke-width="2" ${R}/>`],
    '🎬': ['#6366F1', `
      <rect x="9" y="20" width="30" height="19" rx="3" fill="#1F2937"/>
      <path d="M9 20l29-6.5 1.3 5.6L10.3 25.6z" fill="#F9FAFB"/>
      <path d="M15 18.6l3.5 4.5M22.5 16.9l3.5 4.5M30 15.2l3.5 4.5" stroke="#1F2937" stroke-width="3"/>
      <path d="M21 26.5v8l7-4z" fill="#818CF8"/>`],
    '👕': ['#0EA5E9', `
      <path d="M18 9l-10 5 3.5 8 4-1.5V39h17V20.5l4 1.5 3.5-8-10-5c-1 3-3.5 4.5-6 4.5s-5-1.5-6-4.5z" fill="#0EA5E9"/>
      <path d="M18 9c1 3 3.5 4.5 6 4.5s5-1.5 6-4.5" fill="none" stroke="#0369A1" stroke-width="2"/>
      <path d="M19 27h10" stroke="#BAE6FD" stroke-width="2.4" ${R}/>`],
    '🤲': ['#EC4899', `
      <path d="M24 33s-11-6.5-11-14a6 6 0 0 1 11-3.3A6 6 0 0 1 35 19c0 7.5-11 14-11 14z" fill="#EC4899"/>
      <path d="M17 18a3 3 0 0 1 3-3" fill="none" stroke="#FBCFE8" stroke-width="2" ${R}/>
      <path d="M6 30c3 0 5 1 7 3l4 4h14l4-4c2-2 4-3 7-3" fill="none" stroke="#FDBA74" stroke-width="4.5" ${R}/>`],
    '📦': ['#B45309', `
      <path d="M8 16l16-7 16 7v17l-16 7-16-7z" fill="#D97706"/>
      <path d="M8 16l16 7 16-7" fill="none" stroke="#92400E" stroke-width="2" ${R}/>
      <path d="M24 23v17" stroke="#92400E" stroke-width="2"/>
      <path d="M15 12.5l16 7v6" fill="none" stroke="#FDE68A" stroke-width="3" ${R}/>`],
    '☕': ['#92400E', `
      <path d="M11 19h22v10a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9z" fill="#F9FAFB"/>
      <path d="M33 22h2a4 4 0 0 1 0 8h-2.5" fill="none" stroke="#F9FAFB" stroke-width="3"/>
      <path d="M12 21h20" stroke="#92400E" stroke-width="3" ${R}/>
      <path d="M17 8c-2 3 2 4 0 7M24 8c-2 3 2 4 0 7" fill="none" stroke="#D6D3D1" stroke-width="2.2" ${R}/>
      <rect x="8" y="38" width="28" height="3" rx="1.5" fill="#92400E"/>`],
    '🎮': ['#8B5CF6', `
      <path d="M15 16h18a8 8 0 0 1 7.7 10.2l-2 7a4.5 4.5 0 0 1-7.6 1.9L28 32h-8l-3.1 3.1a4.5 4.5 0 0 1-7.6-1.9l-2-7A8 8 0 0 1 15 16z" fill="#8B5CF6"/>
      <path d="M15 21v7M11.5 24.5h7" stroke="#FFFFFF" stroke-width="2.6" ${R}/>
      <circle cx="31" cy="22" r="2.2" fill="#FACC15"/><circle cx="35" cy="26" r="2.2" fill="#22C55E"/>`],
    '✈️': ['#0EA5E9', `
      <path d="M38.5 9.5c1.5 1.5 1 3.5-.5 5L32 20l4 15-3 3-7-12-6 6v5l-2.5 2.5-3-7-7-3L10 27h5l6-6-12-7 3-3 15 4 6-6c1.5-1.5 3.5-2 5-.5z" fill="#0EA5E9"/>
      <path d="M33 13l2 2" stroke="#E0F2FE" stroke-width="2.4" ${R}/>`],
    '🐱': ['#F97316', `
      <path d="M11 20l-1-11 9 6h10l9-6-1 11c1.3 2 2 4.2 2 6.5C39 34 32.3 39 24 39S9 34 9 26.5c0-2.3.7-4.5 2-6.5z" fill="#FB923C"/>
      <path d="M13 13l1 5M35 13l-1 5" stroke="#FDBA74" stroke-width="2.4" ${R}/>
      <circle cx="18.5" cy="26" r="2" fill="#1F2937"/><circle cx="29.5" cy="26" r="2" fill="#1F2937"/>
      <path d="M22.5 30h3l-1.5 1.8z" fill="#BE185D"/>
      <path d="M8 29l7-1M8 33l7-2M40 29l-7-1M40 33l-7-2" stroke="#9A3412" stroke-width="1.4" ${R}/>`],
    '📞': ['#22C55E', `
      <path d="M14 9l5 1 2.5 7-3.5 2.5a19 19 0 0 0 10.5 10.5L31 26.5l7 2.5 1 5c0 2.5-2 4.5-4.5 4.5C21.5 38.5 9.5 26.5 9.5 13.5 9.5 11 11.5 9 14 9z" fill="#22C55E"/>
      <path d="M28 10a10 10 0 0 1 10 10M28 15a5 5 0 0 1 5 5" fill="none" stroke="#15803D" stroke-width="2.4" ${R}/>`],
    '🔧': ['#64748B', `
      <path d="M35 8a8 8 0 0 0-9.6 10.3L10.5 33.2a3.5 3.5 0 0 0 5 5l14.9-14.9A8 8 0 0 0 40.7 13.4l-5 5-4.6-1.5-1.5-4.6 5-5z" fill="#94A3B8"/>
      <circle cx="13" cy="35.7" r="1.6" fill="#475569"/>
      <path d="M27 21l-12 12" stroke="#CBD5E1" stroke-width="1.6" ${R}/>`],
    '🧾': ['#14B8A6', `
      <path d="M12 7h24v33l-4-2.5-4 2.5-4-2.5-4 2.5-4-2.5-4 2.5z" fill="#F9FAFB" stroke="#0F766E" stroke-width="2" stroke-linejoin="round"/>
      <path d="M17 15h14M17 21h14M17 27h8" stroke="#14B8A6" stroke-width="2.4" ${R}/>
      <path d="M28 27h3" stroke="#0F766E" stroke-width="2.4" ${R}/>`],
    '🛡️': ['#3B82F6', `
      <path d="M24 7l14 5v10c0 9-6 15.5-14 19-8-3.5-14-10-14-19V12z" fill="#3B82F6"/>
      <path d="M24 7v34c8-3.5 14-10 14-19V12z" fill="#2563EB"/>
      <path d="M18 23.5l4.5 4.5 8-9" fill="none" stroke="#FFFFFF" stroke-width="3" ${R}/>`],
    '🕋': ['#F59E0B', `
      <path d="M10 15l14-6 14 6v20l-14 6-14-6z" fill="#1F2937"/>
      <path d="M24 21v20M10 15l14 6 14-6" fill="none" stroke="#374151" stroke-width="1.6"/>
      <path d="M10 20.5l14 6 14-6" fill="none" stroke="#F59E0B" stroke-width="2.6"/>`],
    '🎓': ['#6366F1', `
      <path d="M4 19l20-9 20 9-20 9z" fill="#1F2937"/>
      <path d="M12 23v8c0 3 5.5 6 12 6s12-3 12-6v-8l-12 5.5z" fill="#475569"/>
      <path d="M40 20.5v10" stroke="#F59E0B" stroke-width="2" ${R}/><circle cx="40" cy="32" r="2.2" fill="#F59E0B"/>`],
    '🏖️': ['#0EA5E9', `
      <path d="M6 37c6-3 12-3 18 0s12 3 18 0v5H6z" fill="#FDE68A"/>
      <path d="M8 22a16 13 0 0 1 32 0z" fill="#EF4444"/>
      <path d="M13.5 22c0-6 4.5-11 10.5-11M34.5 22c0-6-4.5-11-10.5-11" fill="none" stroke="#FEE2E2" stroke-width="2"/>
      <path d="M24 11v26" stroke="#78350F" stroke-width="2.4" ${R}/>
      <circle cx="37" cy="9" r="3.5" fill="#FACC15"/>`],
    '🎯': ['#EF4444', `
      <circle cx="22" cy="26" r="14" fill="#EF4444"/><circle cx="22" cy="26" r="9.5" fill="#FFFFFF"/>
      <circle cx="22" cy="26" r="5" fill="#EF4444"/>
      <path d="M22 26l15-15" stroke="#374151" stroke-width="2.4" ${R}/>
      <path d="M34 8v5h5l3-3h-4V6z" fill="#22C55E"/>`],
    '💍': ['#A855F7', `
      <circle cx="24" cy="29" r="10" fill="none" stroke="#F59E0B" stroke-width="4"/>
      <path d="M17 12h14l3 4-10 7-10-7z" fill="#A5F3FC"/>
      <path d="M17 12l7 11 7-11M14 16h20" fill="none" stroke="#0891B2" stroke-width="1.4" stroke-linejoin="round"/>`],
    '🎁': ['#EC4899', `
      <rect x="9" y="19" width="30" height="8" rx="2" fill="#EC4899"/>
      <rect x="11" y="27" width="26" height="12" rx="2" fill="#F472B6"/>
      <rect x="21.5" y="19" width="5" height="20" fill="#FACC15"/>
      <path d="M24 19c-3-6-10-7-10-2.5S21 19 24 19zM24 19c3-6 10-7 10-2.5S27 19 24 19z" fill="none" stroke="#FACC15" stroke-width="2.6" stroke-linejoin="round"/>`],
    // ---------- Pemasukan ----------
    '💼': ['#92400E', `
      <rect x="17" y="10" width="14" height="7" rx="2.5" fill="none" stroke="#78350F" stroke-width="2.6"/>
      <rect x="7" y="16" width="34" height="23" rx="4" fill="#B45309"/>
      <path d="M7 25h34" stroke="#78350F" stroke-width="2"/>
      <rect x="20.5" y="22.5" width="7" height="5.5" rx="1.5" fill="#FACC15"/>`],
    '🏪': ['#10B981', `
      <rect x="10" y="20" width="28" height="19" rx="2" fill="#F9FAFB"/>
      <path d="M8 13h32v6a3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-7 0 3.5 3.5 0 0 1-4-1z" fill="#10B981"/>
      <path d="M15 13v6M22 13v6M29 13v6M36 13v6" stroke="#D1FAE5" stroke-width="2"/>
      <rect x="9" y="9" width="30" height="5" rx="2" fill="#047857"/>
      <rect x="15" y="27" width="7" height="12" rx="1" fill="#F59E0B"/>
      <rect x="25" y="26" width="9" height="6" rx="1" fill="#7DD3FC"/>`],
    '📈': ['#22C55E', `
      <rect x="9" y="28" width="6" height="11" rx="1.5" fill="#86EFAC"/>
      <rect x="19" y="22" width="6" height="17" rx="1.5" fill="#4ADE80"/>
      <rect x="29" y="16" width="6" height="23" rx="1.5" fill="#22C55E"/>
      <path d="M9 22l9-7 6 4 13-10" fill="none" stroke="#15803D" stroke-width="2.8" ${R}/>
      <path d="M31 9h6v6" fill="none" stroke="#15803D" stroke-width="2.8" ${R}/>`],
    '💰': ['#F59E0B', `
      <path d="M18 13h12l-3 5h-6z" fill="#D97706"/>
      <path d="M19 9h10l-2 4h-6z" fill="#F59E0B"/>
      <path d="M21 18h6c7 4 12 9 12 14 0 5-5 8-15 8S9 37 9 32c0-5 5-10 12-14z" fill="#FBBF24"/>
      <text x="24" y="34.5" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui,sans-serif" fill="#92400E">Rp</text>`],
    // ---------- Dompet ----------
    '💵': ['#22C55E', `
      <rect x="6" y="15" width="36" height="20" rx="3" fill="#22C55E" transform="rotate(-8 24 25)"/>
      <rect x="6" y="15" width="36" height="20" rx="3" fill="#4ADE80"/>
      <circle cx="24" cy="25" r="5.5" fill="#DCFCE7"/>
      <text x="24" y="28" text-anchor="middle" font-size="8" font-weight="800" font-family="system-ui,sans-serif" fill="#15803D">Rp</text>
      <circle cx="11.5" cy="25" r="1.8" fill="#DCFCE7"/><circle cx="36.5" cy="25" r="1.8" fill="#DCFCE7"/>`],
    '🏦': ['#3B82F6', `
      <path d="M6 18L24 8l18 10z" fill="#2563EB"/>
      <rect x="8" y="18" width="32" height="3" fill="#1E40AF"/>
      <path d="M12 22v12M20 22v12M28 22v12M36 22v12" stroke="#60A5FA" stroke-width="4" ${R}/>
      <rect x="7" y="35" width="34" height="5" rx="1.5" fill="#1E40AF"/>
      <circle cx="24" cy="14" r="2" fill="#FACC15"/>`],
    '📱': ['#6366F1', `
      <rect x="13" y="6" width="22" height="36" rx="5" fill="#1F2937"/>
      <rect x="15.5" y="10" width="17" height="27" rx="2" fill="#6366F1"/>
      <rect x="18" y="16" width="12" height="9" rx="2" fill="#FFFFFF"/>
      <path d="M26 20.5h4" stroke="#6366F1" stroke-width="2" ${R}/>
      <path d="M19 29h10M19 32.5h6" stroke="#C7D2FE" stroke-width="2" ${R}/>
      <rect x="21" y="38.5" width="6" height="1.6" rx=".8" fill="#6B7280"/>`],
    '💳': ['#8B5CF6', `
      <rect x="6" y="12" width="36" height="24" rx="4" fill="#8B5CF6"/>
      <rect x="6" y="17" width="36" height="5" fill="#4C1D95"/>
      <rect x="10" y="26" width="8" height="5.5" rx="1.5" fill="#FACC15"/>
      <path d="M25 29h12" stroke="#DDD6FE" stroke-width="2.2" ${R}/>`],
    '👛': ['#EC4899', `
      <path d="M17 17a7 7 0 0 1 14 0" fill="none" stroke="#BE185D" stroke-width="2.6"/>
      <path d="M9 21c0-3 2-5 5-5h20c3 0 5 2 5 5l-2 13c-.4 3-2.7 5-5.6 5H16.6c-2.9 0-5.2-2-5.6-5z" fill="#EC4899"/>
      <path d="M9.5 24h29" stroke="#BE185D" stroke-width="2"/>
      <circle cx="24" cy="24" r="3" fill="#FACC15"/>`],
    '🐷': ['#EC4899', `
      <path d="M10 26c0-7 6-12 14-12 4 0 7.5 1.2 10 3.2l4-2.2-1 6c1 1.5 1.5 3.2 1.5 5v2l2.5.5v5l-3.5.5c-1 2-2.5 3.5-4.5 4.5V42h-5v-2h-8v2h-5v-4c-3-2.2-5-5.5-5-9z" fill="#F9A8D4"/>
      <rect x="20" y="11" width="9" height="3" rx="1.5" fill="#BE185D"/>
      <circle cx="30" cy="24" r="1.8" fill="#1F2937"/>
      <ellipse cx="38.5" cy="30" rx="1.5" ry="2" fill="#EC4899"/>
      <text x="20" y="32" text-anchor="middle" font-size="9" font-weight="800" font-family="system-ui,sans-serif" fill="#BE185D">Rp</text>`],
    // ---------- Lain-lain ----------
    '🔁': ['#6366F1', `
      <path d="M12 21a12 12 0 0 1 21-6l3 3" fill="none" stroke="#6366F1" stroke-width="3.4" ${R}/>
      <path d="M37 11v8h-8" fill="none" stroke="#6366F1" stroke-width="3.4" ${R}/>
      <path d="M36 27a12 12 0 0 1-21 6l-3-3" fill="none" stroke="#22C55E" stroke-width="3.4" ${R}/>
      <path d="M11 37v-8h8" fill="none" stroke="#22C55E" stroke-width="3.4" ${R}/>`],
    '🏷️': ['#64748B', `
      <path d="M8 10v13l17 17 15-15L23 8H10a2 2 0 0 0-2 2z" fill="#94A3B8"/>
      <circle cx="16" cy="16" r="3" fill="#F9FAFB"/>
      <path d="M22 26l6 6M26 22l6 6" stroke="#CBD5E1" stroke-width="2" ${R}/>`],
  };
  I['💸'] = I['💵'];
  I['🚕'] = I['🚗'];
  I['🍔'] = I['🍜'];

  /**
   * Ubin merek bank & e-wallet: warna khas + nama mereknya sebagai teks (bukan logo resmi). Disimpan di kolom Ikon
   * sebagai emoji umum + nama, mis. '🏦BCA' / '📱GoPay', supaya tetap terbaca di spreadsheet & bot Telegram.
   * [kunci, teks di ubin, warna ubin, warna teks, kata untuk mengenali nama dompet]
   */
  const MEREK = [
    ['🏦BCA', 'BCA', '#0060AF', '#FFFFFF', ['bca', 'klikbca', 'mybca']],
    ['🏦BRI', 'BRI', '#00529C', '#FFFFFF', ['bri', 'brimo', 'bank rakyat']],
    ['🏦Mandiri', 'mandiri', '#003D79', '#FFC20E', ['mandiri', 'livin']],
    ['🏦BNI', 'BNI', '#F26522', '#FFFFFF', ['bni', 'wondr']],
    ['🏦BSI', 'BSI', '#00A19A', '#FFFFFF', ['bsi', 'syariah indonesia']],
    ['🏦BTN', 'BTN', '#0055A4', '#FFD200', ['btn']],
    ['🏦CIMB', 'CIMB', '#7A0019', '#FFFFFF', ['cimb', 'octo']],
    ['🏦Danamon', 'Danamon', '#F47920', '#FFFFFF', ['danamon']],
    ['🏦Permata', 'Permata', '#00894B', '#FFFFFF', ['permata']],
    ['🏦OCBC', 'OCBC', '#E30613', '#FFFFFF', ['ocbc', 'nyala']],
    ['🏦Muamalat', 'Muamalat', '#5B2C83', '#FFFFFF', ['muamalat']],
    ['🏦Jatim', 'jatim', '#0B4EA2', '#FFFFFF', ['jatim', 'bank jatim', 'bank jawa timur', 'jconnect']],
    ['🏦DKI', 'DKI', '#D7262B', '#FFFFFF', ['dki', 'bank dki', 'jakone']],
    ['🏦BPD', 'BPD', '#1E3A8A', '#FACC15', ['bpd', 'bjb', 'bank jateng', 'bank daerah']],
    ['🏦Jago', 'Jago', '#FFB000', '#1F2937', ['jago']],
    ['🏦SeaBank', 'SeaBank', '#FF6A13', '#FFFFFF', ['seabank', 'sea bank']],
    ['🏦blu', 'blu', '#00AEEF', '#FFFFFF', ['blu', 'bca digital']],
    ['🏦Jenius', 'Jenius', '#00A9E0', '#FFFFFF', ['jenius']],
    ['🏦Neo', 'neo', '#FFC107', '#1F2937', ['neo', 'neobank', 'bank neo']],
    ['🏦Allo', 'allo', '#E4002B', '#FFFFFF', ['allo', 'allo bank']],
    ['🏦Superbank', 'super', '#4B1FA8', '#C6FF3D', ['superbank', 'super bank']],
    ['📱GoPay', 'gopay', '#00AED6', '#FFFFFF', ['gopay', 'go-pay', 'gojek']],
    ['📱OVO', 'OVO', '#4C2A86', '#FFFFFF', ['ovo']],
    ['📱DANA', 'DANA', '#118EEA', '#FFFFFF', ['dana']],
    ['📱ShopeePay', 'Shopee', '#EE4D2D', '#FFFFFF', ['shopeepay', 'shopee', 'spay', 'shopee pay']],
    ['📱LinkAja', 'LinkAja', '#E82529', '#FFFFFF', ['linkaja', 'link aja']],
    ['📱AstraPay', 'Astra', '#1C4DA1', '#FFFFFF', ['astrapay', 'astra pay']],
    ['📱Flip', 'flip', '#FD6542', '#FFFFFF', ['flip']],
    ['📱iSaku', 'i.saku', '#E2001A', '#FFFFFF', ['isaku', 'i.saku', 'i saku']],
    ['💳Flazz', 'Flazz', '#0060AF', '#FFFFFF', ['flazz']],
    ['💳eMoney', 'e-money', '#FFC20E', '#003D79', ['e-money', 'emoney', 'e money']],
    ['💳Brizzi', 'Brizzi', '#00529C', '#FFFFFF', ['brizzi']],
    ['💳TapCash', 'TapCash', '#F26522', '#FFFFFF', ['tapcash', 'tap cash']],
    ['💳Kredit', 'Kartu Kredit', '#111827', '#FACC15', ['kartu kredit', 'credit card', 'paylater']],
    ['📈RDN', 'RDN', '#0F766E', '#FFFFFF', ['rdn', 'sekuritas', 'saham', 'bibit', 'ajaib', 'stockbit', 'pluang']],
  ];
  const M = {};
  MEREK.forEach(([k, label, bg, fg]) => { M[k] = { label, bg, fg }; });
  /** Ukuran huruf supaya nama merek muat di ubin 48×48. */
  const ukuran = n => (n <= 3 ? 15 : n <= 4 ? 13 : n <= 5 ? 11.5 : n <= 6 ? 10 : n <= 7 ? 8.6 : 7.4);
  function ubinMerek(m, esc) {
    const kata = m.label.length > 8 && m.label.includes(' ') ? m.label.split(' ') : [m.label]; // 'Kartu Kredit' → 2 baris
    const fs = ukuran(Math.max(...kata.map(k => k.length)));
    const teks = kata.map((k, i) => `<text x="24" y="${kata.length > 1 ? 22 + i * 10 : 24 + fs * 0.36}" text-anchor="middle" font-size="${fs}" font-weight="800" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" fill="${m.fg}">${esc(k)}</text>`).join('');
    return `<svg class="ilus ilus-merek" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect width="48" height="48" rx="14" fill="${m.bg}"/>${teks}</svg>`;
  }
  /** Kunci ubin merek yang cocok dengan nama dompet ('Bank BCA', 'GoPay Ayah' → '🏦BCA' / '📱GoPay'), atau ''. */
  function tebakMerek(nama) {
    const n = ' ' + String(nama || '').toLowerCase().replace(/[^a-z0-9.\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    let terbaik = '', panjang = 0;
    for (const [k, , , , kata] of MEREK) {
      for (const w of kata) if (w.length > panjang && n.includes(' ' + w + ' ')) { terbaik = k; panjang = w.length; }
    }
    return terbaik;
  }

  /** HTML ilustrasi untuk emoji ikon; emoji lain dikembalikan apa adanya (sudah di-escape). */
  function html(emoji, esc) {
    const kunci = String(emoji || '').trim();
    if (M[kunci]) return ubinMerek(M[kunci], esc);
    const x = I[kunci];
    if (!x) return esc(emoji || '');
    return `<svg class="ilus" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect class="ilus-ubin" width="48" height="48" rx="14" style="--c:${x[0]}"/>${x[1]}</svg>`;
  }
  /**
   * Warna kartu dompet bergaya kartu fisik: { bg, fg, label }. Ubin merek → warna khas merek & namanya;
   * ilustrasi biasa → warna dasar ubinnya; lainnya → null (pakai warna aksen aplikasi).
   */
  function warna(emoji) {
    const kunci = String(emoji || '').trim();
    if (M[kunci]) return { bg: M[kunci].bg, fg: M[kunci].fg, label: M[kunci].label };
    if (I[kunci]) return { bg: I[kunci][0], fg: '#FFFFFF', label: '' };
    return null;
  }

  /**
   * Maskot dompet "Dompi" dengan ekspresi: 'senang' | 'bangga' | 'biasa' | 'cemas' | 'sedih' | 'tidur'.
   * Dipakai di kartu kosong, kalimat insight Beranda, dan hasil "Cek sebelum beli".
   */
  function maskot(mood) {
    const tua = '#08363A';
    const mata = {
      senang: `<path d="M19 37q3-4 6 0M31 37q3-4 6 0" stroke="${tua}" stroke-width="2.6" fill="none" ${R}/>`,
      bangga: `<path d="M19 37q3-4 6 0M31 37q3-4 6 0" stroke="${tua}" stroke-width="2.6" fill="none" ${R}/>`,
      biasa: `<circle cx="22" cy="36" r="2.6" fill="${tua}"/><circle cx="34" cy="36" r="2.6" fill="${tua}"/>`,
      cemas: `<circle cx="22" cy="37" r="2.4" fill="${tua}"/><circle cx="34" cy="37" r="2.4" fill="${tua}"/><path d="M18 31.5l6 1.8M38 31.5l-6 1.8" stroke="${tua}" stroke-width="2.2" ${R}/>`,
      sedih: `<circle cx="22" cy="37.5" r="2.4" fill="${tua}"/><circle cx="34" cy="37.5" r="2.4" fill="${tua}"/><path d="M18.5 33l5-1.5M37.5 33l-5-1.5" stroke="${tua}" stroke-width="2.2" ${R}/>`,
      tidur: `<path d="M19 37h6M31 37h6" stroke="${tua}" stroke-width="2.6" ${R}/>`,
    };
    const mulut = {
      senang: `<path d="M23 43q5 5 10 0" stroke="${tua}" stroke-width="2.6" fill="none" ${R}/>`,
      bangga: `<path d="M22 42h12q0 7-6 7t-6-7z" fill="${tua}"/><path d="M25 46.5q3 1.6 6 0" stroke="#FB7185" stroke-width="2" fill="none" ${R}/>`,
      biasa: `<path d="M25 44q3 2 6 0" stroke="${tua}" stroke-width="2.4" fill="none" ${R}/>`,
      cemas: `<path d="M23 46q2.5-2 5 0t5 0" stroke="${tua}" stroke-width="2.3" fill="none" ${R}/>`,
      sedih: `<path d="M23 47q5-4.5 10 0" stroke="${tua}" stroke-width="2.5" fill="none" ${R}/>`,
      tidur: `<circle cx="28" cy="45" r="2" fill="${tua}"/>`,
    };
    const hiasan = {
      senang: `<circle cx="17" cy="42" r="2.6" fill="#FDA4AF" opacity=".8"/><circle cx="39" cy="42" r="2.6" fill="#FDA4AF" opacity=".8"/>`,
      bangga: `<circle cx="17" cy="42" r="2.6" fill="#FDA4AF" opacity=".8"/><circle cx="39" cy="42" r="2.6" fill="#FDA4AF" opacity=".8"/><path d="M56 6l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#FACC15"/>`,
      biasa: '',
      cemas: `<path d="M43 22c2 3 2.6 4.6 1 6a2.4 2.4 0 0 1-3.4-3c.4-1 1.4-2 2.4-3z" fill="#7DD3FC"/>`,
      sedih: `<path d="M20 41c1.4 2.2 1.8 3.4.7 4.4a1.8 1.8 0 0 1-2.6-2.2c.3-.8 1.1-1.5 1.9-2.2z" fill="#7DD3FC"/>`,
      tidur: `<text x="50" y="14" font-size="9" font-weight="800" font-family="system-ui,sans-serif" fill="#8ED9DC">z</text><text x="56" y="8" font-size="7" font-weight="800" font-family="system-ui,sans-serif" fill="#8ED9DC">z</text>`,
    };
    const m = mata[mood] ? mood : 'biasa';
    return `<svg class="maskot maskot-${m}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="25" cy="14" r="8" fill="#FACC15" stroke="#CA8A04" stroke-width="2"/><path d="M25 10v8" stroke="#CA8A04" stroke-width="2" ${R}/>
      <g class="maskot-badan">
        <rect x="6" y="18" width="50" height="38" rx="13" fill="#14A3A8"/>
        <path d="M6 31V28a10 10 0 0 1 10-10h30a10 10 0 0 1 10 10v3z" fill="#4FC3C7"/>
        <rect x="44" y="31" width="16" height="13" rx="6.5" fill="#8ED9DC"/><circle cx="51" cy="37.5" r="2.4" fill="#0B5C63"/>
        <rect x="11" y="28" width="30" height="24" rx="10" fill="#ECFBFB"/>
        ${mata[m]}${mulut[m]}${hiasan[m]}
      </g>
    </svg>`;
  }

  return {
    html, tebakMerek, warna, maskot,
    ada: e => !!(I[String(e || '').trim()] || M[String(e || '').trim()]),
    semua: () => Object.keys(I),
    /** Kunci ubin merek per kelompok, untuk pemilih ikon dompet. */
    merek: () => ({
      bank: MEREK.filter(m => m[0].startsWith('🏦')).map(m => m[0]),
      ewallet: MEREK.filter(m => m[0].startsWith('📱')).map(m => m[0]),
      kartu: MEREK.filter(m => /^(💳|📈)/u.test(m[0])).map(m => m[0]),
    }),
    /** Nama merek, mis. '🏦BCA' → 'BCA' (label aksesibilitas). */
    namaMerek: k => (M[k] ? M[k].label : ''),
  };
})();
