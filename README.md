# VIP Complimentary Log

Mobile-first internal app untuk mencatat complimentary VIP room per sesi.

## Run

```bash
npm install
npm run dev
```

Local URL:

```txt
http://127.0.0.1:5173
```

## Features

- Input sesi VIP dengan multi item.
- Auto calculate terpakai, balik stok, dan total biaya.
- Validasi qty minus, qty bulat, dan sisa segel tidak boleh lebih besar dari qty disiapkan.
- Checklist Majoo per item.
- Log harian dengan filter hari ini, bulan ini, custom date, dan belum input Majoo.
- Rekap bulanan, total biaya, item paling sering terpakai, rata-rata Aqua per sesi.
- Master item, HPP, default qty, status aktif/nonaktif.
- Master staff.
- Export CSV.
- Persistence via localStorage.
- Optional Google Sheets database via Google Apps Script Web App.

## Google Sheets Setup

1. Buat Google Sheet baru.
2. Buka `Extensions > Apps Script`.
3. Paste isi file `google-apps-script/VipComplimentaryLog.gs`.
4. Klik `Save`.
5. Pilih function `setupOnce`, lalu klik `Run`.
6. Ikuti proses authorization Google sampai selesai.
7. Klik `Deploy > New deployment`.
8. Pilih type `Web app`.
9. Set `Execute as: Me`.
10. Set `Who has access: Anyone`.
11. Copy Web App URL.
12. Di app, buka `Master > Google Sheet Sync`, paste URL itu.
13. Klik `Kirim` untuk mengirim data lokal pertama kali, lalu aktifkan `Auto-sync` jika sudah cocok.

## Visual System

Mengikuti style Nomono:

- Font: DM Mono
- Primary: `#003820`
- Accent: `#C39A4B`
- Cream: `#E0DBBC`
- Background: `#FAFAF7`
- Text: `#231F20`
