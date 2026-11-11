// Cek: setiap <script> inline di web/index.html harus punya hash sha256 yang cocok di Content-Security-Policy.
// Kalau tidak, browser memblokirnya diam-diam (mis. tema/tampilan pilihan pengguna tidak terpasang saat dibuka).
const fs = require('fs');
const crypto = require('crypto');
const html = fs.readFileSync('web/index.html', 'utf8');
const csp = (html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
let gagal = 0;
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  const hash = 'sha256-' + crypto.createHash('sha256').update(m[1]).digest('base64');
  if (!csp.includes(`'${hash}'`)) {
    console.error(`Hash skrip inline tidak ada di CSP web/index.html. Ganti nilai sha256-… di tag CSP dengan: ${hash}`);
    gagal++;
  }
}
if (gagal) process.exit(1);
console.log('CSP: hash skrip inline cocok.');
