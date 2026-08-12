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

// Eskirgan fayllarni har 1 daqiqada tozalash
setInterval(() => {
  const now = Date.now();
  for (const [id, file] of storedFiles.entries()) {
    if (file.expiresAt < now) storedFiles.delete(id);
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

// Fayl yuklash endpoint'i
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fayl topilmadi' });
    }

    const id = uuidv4();
    storedFiles.set(id, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      expiresAt: Date.now() + FILE_TTL_MS,
    });

    const downloadUrl = `${getBaseUrl(req)}/f/${id}`;
    const qrDataUrl = await QRCode.toDataURL(downloadUrl, { width: 320, margin: 2 });

    res.json({
      id,
      url: downloadUrl,
      qr: qrDataUrl,
      expiresInMinutes: FILE_TTL_MS / 60000,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

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
