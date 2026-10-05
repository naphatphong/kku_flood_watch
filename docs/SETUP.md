# คู่มือเปิดใช้งานจริง (สำหรับเจ้าของโปรเจกต์)

ตอนนี้เว็บบน Vercel ยังเป็น **โหมดข้อมูลตัวอย่าง** (ขึ้นป้าย "ข้อมูลตัวอย่าง") เพราะยังไม่ได้ต่อฐานข้อมูล
ทำตามขั้นตอนนี้ครั้งเดียว เว็บจะใช้ข้อมูลจริงทั้งหมด: โพสต์ โหวต ล็อกอิน นำทาง แอดมิน และอัปเดตฝนทุก 15 นาที

> **ให้ Cowork ทำแทน:** สั่ง Cowork ว่า "ทำตามคู่มือ https://github.com/naphatphong/kku_flood_watch/blob/main/docs/COWORK.md" (มีขั้นตอน + สคริปต์ครบ)

ใช้เวลาประมาณ 30–45 นาที สิ่งที่ต้องมี: บัญชี Supabase, บัญชี Vercel (มีอยู่แล้ว), Google Cloud Console และ LINE Developers (ถ้าจะเปิดล็อกอิน LINE)

---

## 1. สร้างโปรเจกต์ Supabase

1. เข้า https://supabase.com/dashboard → **New project**
2. Region: **Southeast Asia (Singapore)** (ใกล้ไทยที่สุด)
3. ตั้งรหัสผ่านฐานข้อมูล แล้วเก็บไว้ (ใช้ในขั้นที่ 2)
4. รอจนโปรเจกต์พร้อม แล้วจด **Project ref** (ส่วน `xxxx` ใน `https://xxxx.supabase.co`)

## 2. สร้างตารางและฟังก์ชัน (migrations)

**ทางลัด (แนะนำ):** ขั้น 2–3 ทำด้วยคำสั่งเดียว ใช้แค่ Node.js ไม่ต้องมี psql
(สร้าง access token ที่ https://supabase.com/dashboard/account/tokens)

```bash
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<Project ref> node scripts/setup-supabase.mjs db
```

สคริปต์เดียวกันยังตั้งค่า Auth, Vault, แอดมิน และดึงคีย์ให้ได้ ดูคำสั่งทั้งหมดที่หัวไฟล์ `scripts/setup-supabase.mjs`

หรือใช้ Supabase CLI บนเครื่องที่มีโค้ดโปรเจกต์นี้:

```bash
npx supabase login
npx supabase link --project-ref <Project ref>
npx supabase db push
```

`db push` จะรันไฟล์ใน `supabase/migrations/` ตามลำดับ: เปิด PostGIS + pgRouting, สร้างตาราง, RLS, ฟังก์ชัน, bucket รูป, Realtime และตั้งงาน pg_cron

> ถ้าไม่สะดวกใช้ CLI: เปิด **SQL Editor** แล้ววางเนื้อหาแต่ละไฟล์ใน `supabase/migrations/` รันทีละไฟล์ตามลำดับชื่อไฟล์

## 3. นำเข้าถนน (สำหรับสีถนนและนำทาง)

ไฟล์ `supabase/seed/roads.sql` (ถนนรอบ มข. 5 กม. จาก OpenStreetMap ~21,800 ท่อน) ใหญ่เกินกว่าจะวางใน SQL Editor ให้ใช้ `psql`:

```bash
psql "<Connection string>" -f supabase/seed/roads.sql
```

Connection string ดูได้ที่ Dashboard → ปุ่ม **Connect** → **Session pooler** (ใส่รหัสผ่านจากขั้นที่ 1)
ถ้าไม่มี `psql` ติดตั้งได้จาก https://www.postgresql.org/download/ (เลือกเฉพาะ command line tools)

อยากอัปเดตถนนใหม่ภายหลัง: `npx tsx scripts/import-roads.ts` แล้วรัน `psql` คำสั่งเดิมอีกครั้ง

## 4. ตั้งค่าล็อกอิน

### 4.1 URL ของเว็บ

Dashboard → **Authentication → URL Configuration**

- **Site URL:** `https://kku-flood-watch.vercel.app`
- **Redirect URLs:** เพิ่ม `https://kku-flood-watch.vercel.app/auth/callback`
  (ถ้าจะทดสอบบนเครื่อง เพิ่ม `http://localhost:3000/auth/callback` ด้วย)

### 4.2 Google

1. https://console.cloud.google.com → APIs & Services → **Credentials** → Create credentials → **OAuth client ID** → Web application
2. **Authorized redirect URIs:** `https://<Project ref>.supabase.co/auth/v1/callback`
3. คัดลอก Client ID และ Client Secret
4. Supabase → **Authentication → Providers → Google** → เปิด แล้ววาง Client ID / Secret

### 4.3 LINE (ไม่บังคับ)

1. https://developers.line.biz/console/ → สร้าง Provider → สร้างช่อง **LINE Login** (Web app)
2. แท็บ LINE Login → **Callback URL:** ใส่ URL ที่ Supabase แสดงในข้อ 4 ด้านล่าง
3. คัดลอก **Channel ID** และ **Channel secret** (แท็บ Basic settings)
4. Supabase → **Authentication → Providers** → **New Provider** → **Manual configuration**
   - Identifier: `custom:line` (ต้องตรงตัวนี้ โค้ดใช้ชื่อนี้)
   - Client ID: Channel ID · Client Secret: Channel secret
   - Authorization URL: `https://access.line.me/oauth2/v2.1/authorize`
   - Token URL: `https://api.line.me/oauth2/v2.1/token`
   - UserInfo URL: `https://api.line.me/oauth2/v2.1/userinfo`
   - Scopes: `profile`, `openid`
   - คัดลอก Callback URL ที่ฟอร์มแสดง ไปใส่ใน LINE ตามข้อ 2 แล้วกด **Create and enable provider**
5. แพลนฟรีของ Supabase เพิ่ม custom provider ได้ 3 ตัว (ใช้ตัวเดียวพอ)

> LINE ไม่ส่งอีเมลให้ ถ้าทดสอบแล้วล็อกอิน LINE ไม่ผ่าน บอกผมพร้อมข้อความ error ที่ขึ้น

## 5. ตั้งค่า Environment Variables บน Vercel

Vercel → โปรเจกต์ kku-flood-watch → **Settings → Environment Variables** (เลือก Production + Preview)

| ชื่อ | ค่า | เอามาจาก |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<Project ref>.supabase.co` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Project Settings → API Keys (Publishable key) |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | Project Settings → API Keys (Secret key) **ห้ามเผยแพร่** |
| `CRON_SECRET` | สุ่มยาว ≥ 32 ตัวอักษร | สร้างเอง เช่น `openssl rand -hex 32` |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | `google` หรือ `google,custom:line` | ใส่ `custom:line` เมื่อทำข้อ 4.3 เสร็จ |
| `NEXT_PUBLIC_SITE_URL` | `https://kku-flood-watch.vercel.app` | เปลี่ยนเมื่อมีโดเมนจริง |

(ถ้าโปรเจกต์ Supabase ยังใช้คีย์แบบเก่า ใส่ `anon` key แทน publishable และ `service_role` key แทน secret ได้)

จากนั้น **Deployments → Redeploy** ครั้งหนึ่ง ป้าย "ข้อมูลตัวอย่าง" จะหายไป

## 6. เปิดงานอัปเดตทุก 15 นาที

pg_cron เรียก `https://<เว็บ>/api/cron/refresh` ทุก 15 นาที (ดึงฝน → คำนวณวงกลม สีถนน และเก็บข้อมูลรายชั่วโมง)
ต้องเก็บ URL และรหัสไว้ใน Vault ครั้งเดียว: Supabase → **SQL Editor** รัน

```sql
select vault.create_secret('https://kku-flood-watch.vercel.app/api/cron/refresh', 'refresh_url');
select vault.create_secret('<ค่า CRON_SECRET เดียวกับบน Vercel>', 'cron_secret');
```

ตรวจว่างานทำงาน (หลังผ่านไป 15 นาที):

```sql
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
```

## 7. ตั้งตัวเองเป็นแอดมิน

1. เข้าเว็บแล้วล็อกอินด้วยบัญชีของคุณหนึ่งครั้ง
2. SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = '<อีเมลของคุณ>');
```

3. รีเฟรชเว็บ เมนูบัญชีจะมี **แอดมิน** (หน้า `/admin`)

## 7.1 ภาพถ่ายดาวเทียม (ไม่บังคับ)

ปุ่มสลับภาพดาวเทียมบนแผนที่จะขึ้นเมื่อใส่คีย์ MapTiler (ฟรีสำหรับเว็บไม่แสวงกำไร)

1. สมัครที่ https://cloud.maptiler.com/auth/widget?next=https://cloud.maptiler.com/maps/ (แพลน Free)
2. เมนู **API keys** → คัดลอกคีย์ (Default key) → กดแก้คีย์ → **Allowed HTTP origins** ใส่ `kku-flood-watch.vercel.app` (กันคนอื่นเอาคีย์ไปใช้)
3. Vercel → Settings → Environment Variables → เพิ่ม `NEXT_PUBLIC_MAPTILER_KEY` = คีย์นั้น (Production + Preview) → Redeploy
   ปิด **Sensitive** (ตัวแปร `NEXT_PUBLIC_` ถูกส่งไปเบราว์เซอร์ เป็น secret ไม่ได้ Vercel จะขึ้น error `cannot use visibility: secret`)

## 7.2 ข้อมูลรถติด (ไม่บังคับ)

ปุ่มไฟจราจรบนแผนที่ (เส้นรถติด จุดอุบัติเหตุ/ปิดถนน) และเวลาเดินทางตามรถติดในหน้านำทาง ใช้ TomTom
แพลนฟรี: tile แผนที่ 50,000 ครั้ง/วัน และ API อื่น 2,500 ครั้ง/วัน ไม่ต้องใช้บัตรเครดิต เกินโควตาจะถูกบล็อก ไม่เก็บเงิน

1. สมัครที่ https://developer.tomtom.com → ยืนยันอีเมล
2. **Dashboard → Keys** → คัดลอกคีย์ (ต้องเปิด Maps, Traffic และ Routing ซึ่งคีย์แรกเปิดไว้ครบ)
3. (แนะนำ) ในหน้าคีย์ เปิด **Domain whitelisting** ใส่ `kku-flood-watch.vercel.app` (เซิร์ฟเวอร์ของเว็บส่งโดเมนนี้ไปด้วย จึงใช้ได้ทั้งสองฝั่ง)
4. Vercel → Environment Variables → `NEXT_PUBLIC_TOMTOM_KEY` = คีย์ (Production + Preview, ปิด Sensitive) → Redeploy

## 7.3 อัปเดตฐานข้อมูลหลังอัปเดตเว็บ

บางครั้งโค้ดใหม่มีไฟล์ใหม่ใน `supabase/migrations/` (เช่น `20260927000800_incidents.sql` สำหรับแจ้งเหตุบนถนน)
ต้องรันไฟล์ใหม่ **ก่อน** เว็บเวอร์ชันใหม่ขึ้น ไม่งั้นหน้าเว็บจะโหลดข้อมูลไม่ได้ เลือกทางใดทางหนึ่ง:

- สคริปต์ (รันเฉพาะไฟล์ที่ยังไม่เคยรัน ไม่แตะถนนและโพสต์เดิม):
  `SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=<Project ref> node scripts/setup-supabase.mjs migrate`
- หรือ Supabase → **SQL Editor** → วางเนื้อหาไฟล์ใหม่ → Run

ทางเดินเท้าใน มข. (`supabase/seed/footways.sql`) โหลดหลังถนนเสมอ (คำสั่ง `db` ทำให้แล้ว) ถ้านำเข้าถนนใหม่ ให้รันไฟล์นี้ซ้ำ
อัปเดตรายชื่อตึก: `NODE_USE_ENV_PROXY=1 npx tsx scripts/import-buildings.ts` แล้ว push (ไฟล์อยู่ใน `public/data/`)

## 8. สิ่งที่ยังรอคุณตัดสินใจ

- **คำต้องห้าม** สำหรับคะแนนสแปม: ใส่ใน `lib/config.ts` → `SPAM.bannedWords` (ตอนนี้ตรวจแค่ลิงก์)
- **โดเมนจริง:** ถ้ามี ตั้งใน Vercel → Domains แล้วแก้ `NEXT_PUBLIC_SITE_URL`, Site URL / Redirect URLs ในข้อ 4.1 และ `refresh_url` ในข้อ 6
  (แก้ secret: `select vault.update_secret((select id from vault.secrets where name = 'refresh_url'), '<URL ใหม่>');`)

---

## ปรับค่าต่าง ๆ

ตัวเลขทุกค่า (สูตร %, อายุโพสต์, ตัวคูณโหวต, ลิมิต, กฎสแปม, ค่าเส้นทาง) อยู่ใน `lib/config.ts` ไฟล์เดียว แก้แล้ว push ขึ้น `main` Vercel จะ deploy ให้เอง
หน้า `/about` ดึงตัวเลขจากไฟล์นี้ จึงอัปเดตตามอัตโนมัติ

## ทดสอบบนเครื่อง (สำหรับนักพัฒนา)

```bash
npm install
npm run dev        # http://localhost:3000 (ไม่มี .env.local = โหมดข้อมูลตัวอย่าง)
npm test           # unit test สูตรและกฎทั้งหมด
npm run test:db    # ทดสอบ migrations + RLS + ฟังก์ชัน SQL (ต้องมี Postgres + PostGIS + pgRouting)
```

ต่อฐานข้อมูลจริงบนเครื่อง: สร้าง `.env.local` ใส่ค่าชุดเดียวกับข้อ 5 (ไฟล์นี้ไม่ถูก commit)
