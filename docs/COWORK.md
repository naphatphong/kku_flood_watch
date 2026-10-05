# คู่มือสำหรับ Cowork: เปิดใช้งาน KKU Flood Watch แบบข้อมูลจริง

> **ถึง Cowork:** คุณทำงานแทนเจ้าของโปรเจกต์ อ่านไฟล์นี้ให้จบก่อนเริ่ม แล้วทำตามลำดับ
> เป้าหมาย: ต่อเว็บ https://kku-flood-watch.vercel.app เข้ากับ Supabase ให้ล็อกอิน โพสต์ นำทาง แอดมิน และอัปเดตฝนทุก 15 นาทีใช้ได้จริง
> ห้ามแก้โค้ด ห้าม commit/push อะไรเข้า repo งานนี้เป็นการตั้งค่าบริการภายนอกเท่านั้น

- Repo (public): https://github.com/naphatphong/kku_flood_watch (branch `main`)
- เว็บ: Vercel project ชื่อ `kku-flood-watch` (เจ้าของล็อกอิน Vercel ไว้แล้ว)
- คู่มือแบบละเอียดสำหรับคน (ถ้าต้องการรายละเอียดเพิ่ม): `docs/SETUP.md`

## กฎที่ต้องทำตาม

1. **ความลับ** (Supabase access token, secret key, Google/LINE client secret, `CRON_SECRET`) ใส่ได้เฉพาะช่องปลายทางกับตัวแปร shell เท่านั้น
   ห้ามเขียนลงไฟล์ใน repo ห้ามพิมพ์ลงข้อความสรุป ห้ามแคปหน้าจอที่เห็นค่าเต็ม
2. **เงิน:** ใช้แพลนฟรีทุกบริการ ถ้าหน้าไหนถามบัตรเครดิตหรือให้อัปเกรด หยุดแล้วถามเจ้าของ
3. **รหัสผ่าน / 2FA / CAPTCHA / ยืนยันตัวตน:** ให้เจ้าของทำเอง แล้วค่อยทำต่อ
4. **ถ้าหน้าจอไม่ตรงกับคู่มือ** (UI เปลี่ยน) ให้หาเมนูที่ทำหน้าที่เดียวกัน ถ้าไม่แน่ใจ ถามเจ้าของ ห้ามเดา
5. **ถ้าคำสั่งไหน error** หยุด รายงาน error ตามจริงให้เจ้าของ อย่าข้ามไปขั้นถัดไปถ้าขั้นนั้นจำเป็นต่อขั้นต่อไป

## ก่อนเริ่ม: ถามเจ้าของครั้งเดียวให้ครบ

1. อีเมลบัญชี Google ที่จะใช้เป็น **แอดมิน** ของเว็บ
2. จะเปิดล็อกอินด้วย **LINE** ตอนนี้เลยไหม (ต้องมีบัญชี LINE และเข้า LINE Developers ได้)
3. ยืนยันว่าใช้ **Supabase แพลนฟรี** และตั้งชื่อโปรเจกต์ `kku-flood-watch`

## ขั้น 0: เตรียมเครื่องมือ (ใน shell ของ Cowork)

```bash
git clone https://github.com/naphatphong/kku_flood_watch.git && cd kku_flood_watch
node --version   # ต้อง 18 ขึ้นไป
```

ไม่ต้อง `npm install` สคริปต์ `scripts/setup-supabase.mjs` ใช้แค่ Node และคุยกับ Supabase ผ่าน HTTPS
(ถ้า shell ของ Cowork เข้า `api.supabase.com` ไม่ได้ ให้บอกเจ้าของรันคำสั่งในขั้น 2, 3, 6, 7, 9 บนเครื่องตัวเองแทน)

## ขั้น 1: สร้างโปรเจกต์ Supabase (เบราว์เซอร์)

1. https://supabase.com/dashboard → ถ้ายังไม่มีบัญชี ให้เจ้าของสมัคร/ล็อกอิน (ใช้ GitHub หรือ Google ได้)
2. **New project**: Name `kku-flood-watch` · Region **Southeast Asia (Singapore)** · Plan Free
   · Database password: กด **Generate a password** แล้วบอกเจ้าของให้เก็บไว้ในที่ปลอดภัย (ขั้นอื่นไม่ต้องใช้)
3. รอจนโปรเจกต์พร้อม (1–2 นาที) จด **Project ref** = ส่วน `xxxx` ใน `https://xxxx.supabase.co` (ไม่ใช่ความลับ)
4. สร้าง access token: https://supabase.com/dashboard/account/tokens → **Generate new token** ชื่อ `kku-setup`
   (ถ้าเลือกวันหมดอายุได้ เลือกสั้นที่สุด) คัดลอกค่า `sbp_...`

ใน shell:

```bash
export SUPABASE_ACCESS_TOKEN='sbp_...'      # ค่าจากข้อ 4
export SUPABASE_PROJECT_REF='xxxx'          # ค่าจากข้อ 3
```

## ขั้น 2: สร้างตาราง ฟังก์ชัน และนำเข้าถนน

```bash
node scripts/setup-supabase.mjs db
```

ต้องเห็น `✓` ครบ 7 migration และบรรทัดสุดท้าย `✓ roads: 21838 segments, 19115 routable nodes`
รันซ้ำได้ถ้าหลุดกลางทาง (ข้าม migration ที่ทำแล้ว และโหลดถนนใหม่ทั้งชุด)

## ขั้น 3: ตั้ง URL ของเว็บใน Supabase Auth

```bash
node scripts/setup-supabase.mjs auth
```

จดบรรทัด `OAuth callback ...` = `https://<ref>.supabase.co/auth/v1/callback` ใช้ในขั้น 4 และ 5

## ขั้น 4: ล็อกอินด้วย Google (เบราว์เซอร์ + shell)

1. https://console.cloud.google.com → สร้างโปรเจกต์ใหม่ชื่อ `KKU Flood Watch` (แพลนฟรี ไม่ต้องผูกบัตร)
2. เมนู **Google Auth Platform** (หรือ APIs & Services → OAuth consent screen):
   - App name `KKU Flood Watch` · User support email และ Developer contact = อีเมลเจ้าของ · Audience **External**
3. **Clients → Create client** (หรือ Credentials → Create credentials → OAuth client ID): ชนิด **Web application** ชื่อ `KKU Flood Watch`
   - Authorized JavaScript origins: `https://kku-flood-watch.vercel.app`
   - Authorized redirect URIs: `https://<ref>.supabase.co/auth/v1/callback`
   - กด Create แล้วคัดลอก Client ID และ Client secret
4. **Audience → Publish app** (เปลี่ยนจาก Testing เป็น In production) ไม่งั้นคนอื่นล็อกอินไม่ได้
   (ขอแค่ชื่อ อีเมล รูปโปรไฟล์ ไม่ต้องรอ Google ตรวจ)
5. ใน shell เปิด Google ใน Supabase:

```bash
GOOGLE_CLIENT_ID='....apps.googleusercontent.com' GOOGLE_CLIENT_SECRET='...' node scripts/setup-supabase.mjs auth
```

ต้องเห็น `Google sign-in on`

## ขั้น 5: ล็อกอินด้วย LINE (ทำเฉพาะเมื่อเจ้าของตอบว่าเปิด)

1. https://developers.line.biz/console/ → ให้เจ้าของล็อกอินบัญชี LINE
2. **Create a new provider** ชื่อ `KKU Flood Watch` → **Create a LINE Login channel**
   - Region: Thailand · App types: **Web app** · Channel name `KKU Flood Watch` · ใส่คำอธิบายและอีเมลเจ้าของ · ยอมรับข้อตกลง
3. แท็บ **Basic settings**: คัดลอก **Channel ID** และ **Channel secret**
4. Supabase Dashboard → **Authentication → Sign In / Providers** → **New Provider** (Add provider) → **Manual configuration**
   - Identifier: `custom:line` ← ต้องตรงตัวนี้ทุกตัวอักษร
   - Client ID = Channel ID · Client Secret = Channel secret
   - Authorization URL: `https://access.line.me/oauth2/v2.1/authorize`
   - Token URL: `https://api.line.me/oauth2/v2.1/token`
   - UserInfo URL: `https://api.line.me/oauth2/v2.1/userinfo`
   - Scopes: `profile` และ `openid`
   - คัดลอก **Callback URL** ที่ฟอร์มแสดง แล้วกด **Create and enable provider**
5. กลับไป LINE Developers → แท็บ **LINE Login** → Callback URL: วางค่าจากข้อ 4 → Update
6. เปลี่ยนสถานะช่องจาก **Developing** เป็น **Published** (ปุ่มด้านบนของช่อง) ไม่งั้นมีแค่เจ้าของที่ล็อกอินได้

## ขั้น 6: งานอัปเดตทุก 15 นาที

```bash
node scripts/setup-supabase.mjs cron
```

ต้องเห็น `cron job: */15 * * * *` และบรรทัด `CRON_SECRET=...` คัดลอกค่านี้ไว้ใช้ในขั้น 8 และ 9 (ความลับ)

## ขั้น 7: ดึงค่าสำหรับ Vercel

```bash
node scripts/setup-supabase.mjs keys
```

ได้ 3 บรรทัด: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (ตัวหลังเป็นความลับ)

## ขั้น 8: ใส่ค่าใน Vercel แล้ว deploy ใหม่ (เบราว์เซอร์)

https://vercel.com → project **kku-flood-watch** → **Settings → Environment Variables**
เพิ่มทีละตัว เลือก Environments: **Production** และ **Preview** (ถ้ามีตัวเลือก Sensitive ให้ติ๊กกับตัวที่เป็นความลับ)

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | จากขั้น 7 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | จากขั้น 7 |
| `SUPABASE_SECRET_KEY` | จากขั้น 7 (Sensitive) |
| `CRON_SECRET` | จากขั้น 6 (Sensitive) |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | `google,custom:line` (ถ้าไม่ได้ทำขั้น 5 ใส่ `google`) |
| `NEXT_PUBLIC_SITE_URL` | `https://kku-flood-watch.vercel.app` |

ระวังช่องว่างหรือขึ้นบรรทัดใหม่ติดมาตอนวาง
จากนั้น **Deployments** → deployment ล่าสุดของ Production → เมนู ⋯ → **Redeploy** → รอจนสถานะ **Ready**

## ขั้น 8.1: ภาพดาวเทียม (ทำเมื่อเจ้าของต้องการ)

1. สมัคร MapTiler แพลน Free ที่ https://cloud.maptiler.com (ให้เจ้าของล็อกอิน/ยืนยันอีเมลเอง)
2. **API keys** → คีย์ Default → ตั้ง **Allowed HTTP origins** = `kku-flood-watch.vercel.app`
3. Vercel → Environment Variables → `NEXT_PUBLIC_MAPTILER_KEY` = คีย์ (Production + Preview, **ปิด Sensitive**) → Redeploy
4. ตรวจ: หน้าแรกมุมขวาบนมีปุ่มรูปลูกโลก กดแล้วเป็นภาพดาวเทียม

## ขั้น 8.2: ข้อมูลรถติด (ทำเมื่อเจ้าของต้องการ)

1. สมัคร TomTom ที่ https://developer.tomtom.com (ให้เจ้าของยืนยันอีเมลเอง ไม่ต้องใส่บัตร)
2. **Dashboard → Keys** → คัดลอกคีย์ → เปิด **Domain whitelisting** ใส่ `kku-flood-watch.vercel.app`
3. Vercel → Environment Variables → `NEXT_PUBLIC_TOMTOM_KEY` = คีย์ (Production + Preview, **ปิด Sensitive**) → Redeploy
4. ตรวจ: แผนที่มีปุ่มไฟจราจรและกล่อง "จราจร" มุมขวาบน · `https://kku-flood-watch.vercel.app/api/traffic` ต้องได้ `{"incidents":[...]}` ไม่ใช่ error

## ขั้น 9: ตรวจว่าใช้งานได้

```bash
CRON_SECRET='...' node scripts/setup-supabase.mjs refresh   # ต้องได้ 200 และ {"ok":true,...}
node scripts/setup-supabase.mjs check                        # migrations 11, road_segments 23067 (รวมทางเดิน 1229), cron_jobs 1, vault_secrets 2, rain_rows ≥ 1
```

ในเบราว์เซอร์:

1. https://kku-flood-watch.vercel.app → ป้าย "ข้อมูลตัวอย่าง" ต้องหายไป
2. https://kku-flood-watch.vercel.app/navigate → พิมพ์ปลายทาง เช่น `คณะวิศวกรรมศาสตร์` → ต้องมีการ์ดเส้นทางขึ้น
   (ถ้าเบราว์เซอร์ถามสิทธิ์ตำแหน่ง ให้อนุญาต หรือเลือกต้นทางบนแผนที่แทน)
3. กด **เข้าสู่ระบบ → Google** ด้วยอีเมลแอดมินของเจ้าของ (ให้เจ้าของล็อกอินเองถ้าต้องใส่รหัสผ่าน)
4. ถ้าทำขั้น 5: ลองล็อกอินด้วย LINE ด้วย แล้วออกจากระบบ

## ขั้น 10: ตั้งแอดมิน

หลังเจ้าของล็อกอินด้วย Google ในขั้น 9 แล้ว:

```bash
node scripts/setup-supabase.mjs admin '<อีเมลแอดมินของเจ้าของ>'
```

รีเฟรชเว็บ → เมนูบัญชีต้องมี **แอดมิน** → เปิด `/admin` ได้

## ขั้น 11: เก็บกวาด

1. ลบ access token: https://supabase.com/dashboard/account/tokens → token `kku-setup` → Revoke/Delete
2. ใน shell: `unset SUPABASE_ACCESS_TOKEN CRON_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET`
3. ลบโฟลเดอร์ `kku_flood_watch` ที่ clone มา (ไม่ได้แก้อะไรในนั้น)

## ขั้น 12: อัปเดตฐานข้อมูลหลังโค้ดมี migration ใหม่ (ทำเมื่อเจ้าของสั่ง)

ใช้เมื่อเจ้าของบอกว่ามีไฟล์ใหม่ใน `supabase/migrations/` ต้องทำก่อน deploy เว็บเวอร์ชันใหม่

1. สร้าง access token ชั่วคราวแบบขั้น 2 แล้ว `export SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=...`
2. `node scripts/setup-supabase.mjs migrate` ต้องเห็น `✓ <ชื่อไฟล์ใหม่>` (ไฟล์เก่าขึ้น `= ... (already applied)`)
   ห้ามใช้คำสั่ง `db` ตรงนี้ เพราะ `db` นำเข้าถนนใหม่และลบการเชื่อมถนนของโพสต์เดิม
3. `node scripts/setup-supabase.mjs check` ต้องได้ migrations เท่ากับจำนวนไฟล์ใน `supabase/migrations/`
4. ลบ token ตามขั้น 11

## รายงานเจ้าของ (ห้ามใส่ค่าความลับ)

สรุปเป็นรายการ ✓ / ✗ ต่อขั้น 1–11 พร้อม:

- Project ref ของ Supabase
- ผลของ `check` (ตัวเลขในตาราง)
- ล็อกอิน Google / LINE / หน้าแอดมิน ใช้ได้ไหม
- สิ่งที่เจ้าของต้องทำต่อ (ถ้ามี) และ error ตามจริงของขั้นที่ไม่ผ่าน
- เตือนเจ้าของว่า **คำต้องห้ามสำหรับกันสแปม** ยังว่างอยู่ (`lib/config.ts` → `SPAM.bannedWords`) และยังใช้โดเมน `vercel.app`
