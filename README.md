# Fayl Yuborish (QR orqali)

## Nima qiladi
- Bir telefondan fayl yuklanadi → server QR kod chiqaradi
- Boshqa telefon kamerasi bilan QR ni skanerlaydi → fayl to'g'ridan-to'g'ri ochiladi/yuklanadi
- Fayllar 10 daqiqadan keyin serverdan avtomatik o'chib ketadi
- Max fayl hajmi: 50MB (server.js ichida o'zgartirish mumkin)

## Lokal test qilish (kompyuteringizda)
```bash
cd fileshare
npm install
npm start
```
Brauzerda oching: http://localhost:3000

**Diqqat:** QR kod ishlashi uchun (ya'ni boshqa telefon skanerlab ochishi uchun)
server INTERNETGA ochiq bo'lishi kerak — localhost boshqa telefondan ko'rinmaydi.
Shuning uchun quyidagi bepul hostinglardan birida joylashtiring:

## Deploy qilish (bepul variantlar)

### Railway.app (eng oson)
1. https://railway.app ga GitHub akkaunt bilan kiring
2. "New Project" → "Deploy from GitHub repo" (avval shu papkani GitHub'ga yuklang)
3. Railway avtomatik aniqlaydi, npm install + npm start qiladi
4. "Settings" → "Generate Domain" bosing — sizga public URL beradi
5. Shu URL'ni telefoningizda oching, tayyor

### Render.com
1. https://render.com da "New Web Service"
2. GitHub repo'ni ulang
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Deploy qiling, public URL avtomatik beriladi

### O'zingizning VPS/serveringiz bo'lsa
```bash
npm install
BASE_URL=https://sizning-domeningiz.uz npm start
```
`BASE_URL` environment o'zgaruvchisini domeningizga moslang, aks holda
server o'zi so'rov manzilidan (host header) avtomatik aniqlashga harakat qiladi.

## Xavfsizlik bo'yicha eslatma
Bu oddiy demo/shaxsiy foydalanish uchun. Production uchun quyidagilarni qo'shish tavsiya etiladi:
- HTTPS (Railway/Render buni avtomatik beradi)
- Fayl turi bo'yicha cheklov (virus/zararli fayllarni tekshirish)
- Bir martalik yuklab olish (linkni ishlatgach darhol o'chirish)
- Rate limiting (spam yuklashlardan himoya)
