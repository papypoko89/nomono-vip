# Nomono VIP + Staff SOP Checklist

Mobile-first internal app untuk mencatat complimentary VIP room, checklist SOP staff, report harian, foto bukti, dan master data operasional.

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
- Master staff, role, template checklist, dan item checklist.
- Report checklist dengan detail item dan foto bukti.
- Issue tracking dari item checklist yang bermasalah.
- Follow up issue dengan status, priority, assignee, dan komentar.
- Manager dashboard untuk overview checklist, open issue, dan VIP complimentary.
- Realtime refresh dari Supabase untuk update lintas device.
- Export CSV.
- Persistence lokal via localStorage sebagai fallback.
- Sync database via Supabase.
- Foto bukti via Supabase Storage.

## Supabase Setup

1. Buat project Supabase.
2. Jalankan migration di `supabase/migrations`.
3. Buat environment variable dari `.env.example`.
4. Di Vercel, isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
5. Deploy app.

Data aplikasi disimpan di tabel `nomono_app_state`.
Foto bukti disimpan di bucket Supabase Storage `nomono-checklist-photos`.

File `google-apps-script/VipComplimentaryLog.gs` masih disimpan sebagai arsip backend lama, tetapi app saat ini menggunakan Supabase.

## Visual System

Mengikuti style Nomono:

- Font: DM Mono
- Primary: `#003820`
- Accent: `#C39A4B`
- Cream: `#E0DBBC`
- Background: `#FAFAF7`
- Text: `#231F20`
