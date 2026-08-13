// Fayllarni QR kod orqali almashish serveri
// Ishlatish: npm install -> npm start

const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Fayl qanchalik saqlanadi (millisekundda) - 30 daqiqa
const FILE_TTL_MS = 30 * 60 * 1000;

// Yuklangan fayllarni RAM'da saqlaymiz: { id: { buffer, mimetype, originalname, expiresAt } }
const storedFiles = new Map();
// Ko'p fayl uchun to'plamlar: { batchId: { files: [{id,name,size,mimetype}], expiresAt } }
const batches = new Map();

// Eskirgan fayllarni har 1 daqiqada tozalash
setInterval(() => {
  const now = Date.now();
  for (const [id, file] of storedFiles.entries()) {
    if (file.expiresAt < now) storedFiles.delete(id);
  }
  for (const [id, batch] of batches.entries()) {
    if (batch.expiresAt < now) batches.delete(id);
  }
}, 60 * 1000);

// Multer - faylni RAM'ga qabul qilish (max 500MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.use(express.static(path.join(__dirname, 'public')));

// Serverning tashqi manzilini aniqlash (deploy qilingan platformalar odatda buni beradi)
function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

// Fayl(lar) yuklash endpoint'i - bir nechta fayl qo'llab-quvvatlanadi
app.post('/upload', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Fayl topilmadi' });
    }

    const expiresAt = Date.now() + FILE_TTL_MS;
    const filesMeta = [];

    for (const f of req.files) {
      const fid = uuidv4();
      storedFiles.set(fid, {
        buffer: f.buffer,
        mimetype: f.mimetype,
        originalname: f.originalname,
        expiresAt,
      });
      filesMeta.push({ id: fid, name: f.originalname, size: f.size, mimetype: f.mimetype });
    }

    const batchId = uuidv4();
    batches.set(batchId, { files: filesMeta, expiresAt });

    const base = getBaseUrl(req);
    const downloadUrl = `${base}/b/${batchId}`;
    const qrDataUrl = await QRCode.toDataURL(downloadUrl, { width: 320, margin: 2 });

    res.json({
      batchId,
      url: downloadUrl,
      qr: qrDataUrl,
      expiresInMinutes: FILE_TTL_MS / 60000,
      files: filesMeta.map(f => ({ name: f.name, size: f.size, url: `${base}/f/${f.id}` })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Fayllar to'plamini ko'rish/yuklab olish sahifasi
app.get('/b/:batchId', (req, res) => {
  const batch = batches.get(req.params.batchId);
  if (!batch || batch.expiresAt < Date.now()) {
    return res
      .status(404)
      .send('<h2 style="font-family:sans-serif;text-align:center;margin-top:40px;color:#eee;background:#0a0e14;min-height:100vh;padding-top:1px">Havola topilmadi yoki muddati tugagan<br>Link not found or expired</h2>');
  }

  const base = getBaseUrl(req);
  const rows = batch.files.map(f => {
    const isImage = f.mimetype && f.mimetype.startsWith('image/');
    const thumb = isImage
      ? `<img class="file-thumb" src="${base}/f/${f.id}" alt="" />`
      : `<div class="file-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>`;
    const nameLine = isImage ? '' : `<div class="file-row-name">${escapeHtml(f.name)}</div>`;
    return `
    <a class="file-row" href="${base}/f/${f.id}" download>
      ${thumb}
      <div class="file-row-info">
        ${nameLine}
        <div class="file-row-size">${fmtBytes(f.size)}</div>
      </div>
    </a>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="uz"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fayllar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  :root{ --bg:#060911; --surface:rgba(22,29,46,0.72); --surface2:#1e2740; --line:rgba(255,255,255,0.08);
    --text:#f3f5fa; --text-dim:#8890a4; --accent:#4ff0a7; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;
    display:flex;justify-content:center;padding:40px 16px}
  .wrap{max-width:420px;width:100%}
  h1{font-family:'Space Grotesk',sans-serif;font-size:24px;margin:0 0 4px}
  p{color:var(--text-dim);font-size:13.5px;margin:0 0 20px}
  .card{background:var(--surface);backdrop-filter:blur(20px);border:1px solid var(--line);
    border-radius:18px;padding:10px;box-shadow:0 8px 32px rgba(0,0,0,0.35)}
  .file-row{display:flex;align-items:center;gap:12px;padding:10px;
    border-radius:12px;text-decoration:none;color:var(--text)}
  .file-row:active{background:var(--surface2)}
  .file-row + .file-row{border-top:1px solid var(--line)}
  .file-thumb{width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0;background:var(--surface2)}
  .file-icon{width:52px;height:52px;border-radius:10px;background:var(--surface2);color:var(--accent);
    display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .file-row-info{min-width:0;flex:1}
  .file-row-name{font-size:13.5px;font-weight:500;word-break:break-all}
  .file-row-size{font-size:12px;color:var(--text-dim);font-family:'JetBrains Mono',monospace}
</style></head>
<body><div class="wrap">
  <h1>${batch.files.length} ta fayl</h1>
  <p>Yuklab olish uchun faylga bosing</p>
  <div class="card">${rows}</div>
</div></body></html>`);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(0) + ' KB';
  return (b/1024/1024).toFixed(1) + ' MB';
}

// Faylni yuklab olish / ko'rish endpoint'i
app.get('/f/:id', (req, res) => {
  const file = storedFiles.get(req.params.id);

  if (!file || file.expiresAt < Date.now()) {
    return res
      .status(404)
      .send('<h2 style="font-family:sans-serif;text-align:center;margin-top:40px">Fayl topilmadi yoki muddati tugagan</h2>');
  }

  res.set('Content-Type', file.mimetype);
  res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalname)}"`);
  res.send(file.buffer);
});

// Fayl haqida meta-ma'lumot (frontend uchun, ixtiyoriy)
app.get('/info/:id', (req, res) => {
  const file = storedFiles.get(req.params.id);
  if (!file || file.expiresAt < Date.now()) {
    return res.status(404).json({ error: 'topilmadi' });
  }
  res.json({
    name: file.originalname,
    type: file.mimetype,
    expiresAt: file.expiresAt,
  });
});

app.listen(PORT, () => {
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
