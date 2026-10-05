# KKU Campus

เว็บรวมเรื่องในมหาวิทยาลัยขอนแก่น (มข.): ค้นหาตึกและไฮไลต์แบบ 3 มิติ, ตารางเรียน, ตึกที่บันทึก, นำทางหลายทางเลือก
(เลี่ยงน้ำท่วม/รถติด), แผนที่น้ำท่วมจากรายงานของชุมชน, แจ้งเหตุบนถนน, จราจร และพยากรณ์อากาศ — https://kku-flood-watch.vercel.app

- **อัปเดตรายชื่อตึก:** `NODE_USE_ENV_PROXY=1 npx tsx scripts/import-buildings.ts` (ชื่อเรียกเพิ่ม: [`lib/building-aliases.ts`](lib/building-aliases.ts))

- **เปิดใช้งานจริง (ต่อ Supabase, ล็อกอิน, งานตั้งเวลา):** [docs/SETUP.md](docs/SETUP.md)
- **แพลนและการตัดสินใจของเจ้าของ:** [docs/PLAN.md](docs/PLAN.md) (หัวข้อ 0 มีผลเหนือหัวข้ออื่น)
- **ตัวเลขที่ปรับได้ทั้งหมด:** [`lib/config.ts`](lib/config.ts)
- ยังไม่ต่อ Supabase = โหมดข้อมูลตัวอย่าง (ฝนจริงจาก Open-Meteo, โพสต์ตัวอย่าง)

## โครงสร้าง

| โฟลเดอร์ | ทำอะไร |
|---|---|
| `lib/domain/` | สูตรและกฎล้วน ๆ (ไม่แตะ DB): ฝน, จับกลุ่มโพสต์, % โอกาสท่วม, สีถนน, สแปม, เลือกเส้นทาง, คำสั่งเลี้ยว + `domain.test.ts` |
| `lib/data/` | อ่าน/เขียนข้อมูล (Supabase, Open-Meteo) และโหมดตัวอย่าง |
| `lib/supabase/` | client ของ Supabase (ผู้ใช้, anon, service role) |
| `app/` | หน้าเว็บ (`/`, `/navigate`, `/report`, `/post/[id]`, `/me`, `/admin`, `/about`, `/login`) และ API (`app/api/`) |
| `components/` | UI แยกตามหน้า (`home`, `navigate`, `report`, `post`, `admin`) + ชิ้นส่วนกลาง (`ui`, `map`) |
| `supabase/migrations/` | schema, RLS, ฟังก์ชัน SQL (pgRouting), Realtime, pg_cron |
| `supabase/seed/roads.sql` | ถนน OSM รอบ มข. (สร้างด้วย `scripts/import-roads.ts`) |
| `scripts/` | เตรียมข้อมูลครั้งเดียว: ถนน OSM, เกณฑ์ความสูงพื้นดิน |

## รันบนเครื่อง

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # unit tests
npm run test:db   # migrations + RLS + SQL (ต้องมี Postgres, PostGIS, pgRouting)
```

## Deploy

Vercel deploy อัตโนมัติทุกครั้งที่ push ขึ้น `main`

ข้อมูลแผนที่และถนน © OpenStreetMap contributors · ฝนและความสูง: Open-Meteo
