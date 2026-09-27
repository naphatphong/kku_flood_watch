# Handoff Spec: เว็บแผนที่น้ำท่วมรอบ มข.

> สถานะ: **กำลังพัฒนา** — ดูการตัดสินใจล่าสุดในหัวข้อ 0 ก่อน (มีผลเหนือหัวข้ออื่น)
> ต้นฉบับ: เอกสาร Claude Docs "Handoff Spec: เว็บแผนที่น้ำท่วมรอบ มข." (27 ก.ย. 2026) — https://claude.ai/code/artifact/c562d98d-4922-472f-8dc5-b77b65d4b5f5

## 0. การตัดสินใจของเจ้าของ (27 ก.ย. 2026)

| เรื่อง | ตัดสินใจ |
|---|---|
| โซน | ไม่มีโซนตายตัว วงกลมเกิดจากการจับกลุ่มโพสต์ที่อยู่ใกล้กัน แสดงเฉพาะกลุ่มที่ท่วม พร้อมจำนวนจุด |
| พื้นที่ | กลาง มข. (16.4617, 102.8173) รัศมี 5 กม. |
| ชื่อเว็บ | KKU Flood Watch (ใช้โดเมน kku-flood-watch.vercel.app ไปก่อน) |
| ตัวคูณโหวต | ×1.2 / ×0.6 ตามหัวข้อ 4 |
| หน้าตา | แนว macOS กระจกโปร่งแสง: แถบข้างบนคอม, แผ่นล่างบนมือถือ |

**โซนแบบกลุ่มโพสต์ (แทนการแบ่งโซนในหัวข้อ 5, 9, 10):**

- จับกลุ่มด้วย DBSCAN: โพสต์ที่อนุมัติแล้วและยังไม่หมดอายุ ที่ห่างกันไม่เกิน `cluster.epsM` (ค่าเริ่มต้น 300 ม.) อยู่กลุ่มเดียวกัน
- วงกลม: จุดกลาง = ตำแหน่งเฉลี่ยของโพสต์ในกลุ่ม, รัศมี = ระยะถึงขอบโพสต์ที่ไกลที่สุด (ขั้นต่ำ `cluster.minRadiusM`)
- แสดงเฉพาะกลุ่มที่ท่วม: `report` ≥ `cluster.minReportToShow` (ค่าเริ่มต้น 30 = น้ำขังเล็กน้อยขึ้นไป)
- สูตร % ในหัวข้อ 5 ใช้เหมือนเดิม แต่คิดต่อกลุ่ม: `low` มาจาก tercile ของความสูงเฉลี่ยของจุดโพสต์ในกลุ่ม เทียบกับการกระจายความสูงของทั้งพื้นที่ (ความสูงจาก Open-Meteo Elevation API ซึ่งใช้ Copernicus DEM 90 ม.)
- ตาราง `zones`, `zone_scores`, `zone_scores_hourly` เปลี่ยนเป็น `flood_clusters` (ค่าปัจจุบัน) และ `flood_clusters_hourly` (เก็บไว้เทรน), `reports.zone_id` เปลี่ยนเป็น `reports.elevation_m`
- ไม่มีหน้า `/zone/[id]` เพราะกลุ่มเปลี่ยนทุกครั้งที่คำนวณใหม่ รายละเอียดกลุ่มแสดงในแผงข้างของหน้าแรกแทน
- นำทาง: ท่อนถนนที่อยู่ในวงกลมกลุ่มที่ % ≥ 60 บวกค่าเส้นทางเพิ่ม 50%
- schema จริงอยู่ใน `supabase/migrations/` (หัวข้อ 9 เป็นแค่โครงตั้งต้น)

### 0.1 จุดที่ผู้พัฒนาตีความเอง (รอเจ้าของยืนยัน แก้ได้ทุกข้อ)

| เรื่อง | ทำไว้แบบนี้ | ที่แก้ |
|---|---|---|
| GPS ผู้โพสต์ห่างเกิน 2 กม. | ปฏิเสธทันที; ไม่ส่ง GPS = +40 คะแนนสแปม | `lib/data/create-report.ts` |
| เลือกท่อนถนน | แตะทีละท่อนต่อหัว/ท้าย แทนการลาก (ใช้บนมือถือง่ายกว่า) | `components/report/` |
| สคริปต์เตรียมข้อมูล | TypeScript แทน Python (ใช้โค้ดสูตรชุดเดียวกับเว็บ) | `scripts/` |
| งานตั้งเวลา | pg_cron + pg_net เรียก `/api/cron/refresh` แทน Edge Functions | migration `_platform.sql` |
| ความสูงพื้นดิน | Copernicus DEM 90 ม. ผ่าน Open-Meteo แทน GLO-30 (ไม่ต้องโหลดไฟล์ใหญ่) | `scripts/elevation-terciles.ts` |
| ลิมิต API ต่อ IP | ดูข้อมูล 120 ครั้ง/นาที, นำทาง 20 ครั้ง/นาที, โหวต/รีพอร์ต 20 ครั้ง/นาทีต่อคน (แพลนไม่ได้ระบุ) | `LIMITS` ใน `lib/config.ts` |
| โหวตโพสต์ตัวเอง | ทำได้ | `app/api/reports/[id]/vote` |
| เดินเท้ากับถนนวันเวย์ | เดินย้อนวันเวย์ได้ | `route_edges` |
| เส้น "สมดุล" | เส้นจาก pgr_KSP ที่เร็วกว่าเส้นปลอดภัยสุด ≥ 5% (ถ้าไม่มี แสดง 2 เส้น) | `ROUTING.minSavingPct` |
| ค้นหาสถานที่ | Photon (OpenStreetMap) ฟรี ไม่ต้องใช้ key | `ROUTING.geocoderUrl` |
| คืนสถานะโพสต์ที่ถูกซ่อน | ล้างรีพอร์ตเดิม (ไม่งั้นรีพอร์ตใหม่ 1 ครั้งจะซ่อนอีก) | `lib/data/admin.ts` |
| แบนผู้ใช้ | โพสต์เดิมยังอยู่ แอดมินลบเองได้; แบนแอดมินด้วยกันไม่ได้ | `lib/data/admin.ts` |

## 1. คำชี้แจงและภาพรวม

เอกสารนี้คือ spec สำหรับ AI ที่รับงานต่อเพื่อเขียนโค้ด **เฟส 1** ของเว็บแผนที่น้ำท่วมรอบมหาวิทยาลัยขอนแก่น (มข.) อ้างอิงแนวคิดจาก rangjai-map.vercel.app ให้ทำตามขอบเขตในหัวข้อ 2 เท่านั้น ถ้ามีส่วนไหนไม่ชัด ให้ถามเจ้าของโปรเจกต์ก่อนเดา

- **เป้าหมาย:** ให้นักศึกษาและคนรอบ มข. รู้ว่าตอนนี้โซนไหนเสี่ยงท่วม ถนนเส้นไหนรถแต่ละประเภทผ่านได้ และมีเส้นทางหลบน้ำท่วม
- **พื้นที่:** รัศมีประมาณ 5 กม. รอบ มข.
- **หลักการ:** เน้นโพสต์จากผู้ใช้ (crowdsource) แสดงความเสี่ยงแบบกว้าง ๆ ระดับโซน เพราะยังไม่มีข้อมูลพอจะเจาะจง
- **การคำนวณ:** เฟส 1 ใช้สูตรแบบกฎ (rule-based) จากแท็กโพสต์ ปริมาณฝน ฝนตกติดต่อกัน และความต่ำของพื้นที่ ไม่มี ML และไม่มี LLM
- **เก็บข้อมูลไว้เทรนทีหลัง:** ออกแบบ DB ให้เก็บข้อมูลครบพอสำหรับเทรนโมเดลในอนาคต
- **ภาษา UI:** ภาษาไทย ออกแบบ mobile-first เพราะคนส่วนใหญ่เปิดดูบนมือถือตอนอยู่ข้างนอก

## 2. ขอบเขตเฟส 1

เฟส 1 มี 7 ส่วน: แผนที่โซนเสี่ยง, โพสต์แบบแท็ก, สถานะถนนเส้นสี, นำทางหลบน้ำ, กันสแปม, แอดมิน และการเก็บข้อมูลไว้เทรน

**ห้ามทำในเฟส 1 (เจ้าของตัดสินใจแล้ว):**

- ไม่ใช้ AI/LLM อ่านข้อความโพสต์ ให้คำนวณจากแท็กที่ผู้ใช้เลือกเท่านั้น ข้อความอิสระแสดงผลอย่างเดียว
- ไม่มีระบบแจ้งเตือน (LINE, Web Push, email)
- ไม่เทรนโมเดล ML เพราะยังไม่มีข้อมูลจุดที่เคยท่วม
- ไม่ทำแอปมือถือ native หรือ PWA ทำเป็นเว็บ responsive อย่างเดียว
- ไม่แบ่งพื้นที่เป็นช่องละเอียด และไม่ใช้ feature ซับซ้อน (TWI, HAND, flow accumulation)
- ไม่มีเสียงนำทาง turn-by-turn ของเราเอง

## 3. สิทธิ์ผู้ใช้

ดูและนำทางได้โดยไม่ต้องล็อกอิน ล็อกอินเฉพาะตอนส่งข้อมูลเข้าระบบ

| บทบาท | ทำได้ |
|---|---|
| ไม่ล็อกอิน | ดูแผนที่, % โซน, สถานะถนน, โพสต์ที่อนุมัติแล้ว, ใช้นำทางครบทุกฟีเจอร์ |
| ล็อกอิน (Google หรือ LINE Login) | ทุกอย่างข้างบน + โพสต์, โหวต "ยังท่วม / ลดแล้ว", รีพอร์ตสแปม, ดูโพสต์ของตัวเองที่รออนุมัติ |
| แอดมิน (`profiles.role = 'admin'`) | ทุกอย่างข้างบน + อนุมัติ/ปฏิเสธ/ลบโพสต์, แบนผู้ใช้, ดู admin log |

บังคับสิทธิ์ด้วย Row Level Security ของ Supabase ทุกตาราง ไม่พึ่งการซ่อนปุ่มใน UI

## 4. ระบบโพสต์และสถานะถนน

โพสต์มี 2 แบบ คือแบบพื้นที่และแบบถนน ทั้งคู่ใช้แท็กชุดเดียวกัน แนบรูปและข้อความได้ (ไม่บังคับ) แต่ข้อความไม่นำไปคำนวณ

**แบบพื้นที่:** ปักหมุด (ค่าเริ่มต้น = ตำแหน่ง GPS) + แถบเลื่อนรัศมี 20–300 ม. แสดงเป็นวงกลมบนแผนที่

**แบบถนน:** แตะถนน ระบบ snap เข้าท่อนถนนที่ใกล้ที่สุด (`ST_ClosestPoint` / `ST_LineLocatePoint`) แล้วลากเลือกท่อนที่ต่อเนื่องกัน รวมความยาวไม่เกิน 500 ม. ต่อโพสต์ ถนนหั่นไว้ล่วงหน้าท่อนละประมาณ 50 ม.

**แท็ก:**

| กลุ่ม | ตัวเลือก | ค่าคะแนน (0–100) |
|---|---|---|
| ระดับน้ำ (เลือก 1, บังคับ) | แห้ง/ผ่านได้, น้ำขังเล็กน้อย, ท่วมตาตุ่ม, ท่วมเข่า, ท่วมเอวขึ้นไป | 0, 30, 50, 75, 95 |
| สถานะ (เลือกหลายอัน) | ฝนกำลังตก, น้ำกำลังขึ้น, น้ำกำลังลด, ท่อระบายไม่ทัน | 0, +10, −15, 0 |
| การผ่าน (แยกตามประเภทรถ) | มอเตอร์ไซค์ / รถเก๋ง / รถกระบะหรือรถสูง / เดินเท้า: ผ่านได้, ผ่านยาก, ผ่านไม่ได้ | ใช้กำหนดสีถนนและนำทาง |

แท็ก "แห้ง/ผ่านได้" สำคัญ เพราะเป็นข้อมูลฝั่ง "ไม่ท่วม" สำหรับเทรนในอนาคต UI ควรชวนให้คนโพสต์แม้น้ำไม่ท่วม

**อายุโพสต์:** น้ำหนักลดครึ่งหนึ่งทุก 2 ชม. (`weight = 0.5 ^ (ชม.ที่ผ่านมา / 2)`) และหมดอายุ 6 ชม. หลังโพสต์หรือหลังโหวต "ยังท่วม" ครั้งล่าสุด โพสต์หมดอายุไม่แสดงบนแผนที่แต่เก็บไว้ใน DB เสมอ

**โหวต:** "ยังท่วม" คูณน้ำหนักโพสต์ ×1.2 ต่อโหวต (สูงสุด ×2) ส่วน "ลดแล้ว" คูณ ×0.6 ต่อโหวต 1 คนโหวตได้ 1 ครั้งต่อโพสต์ (เปลี่ยนได้)

**สีถนน (แบบ Google Maps):** เขียว = ผ่านได้, เหลือง = ผ่านยาก, แดง = ผ่านไม่ได้, เทา = ไม่มีข้อมูล สถานะของแต่ละท่อน แยกตามประเภทรถ = สถานะที่ได้น้ำหนักรวมมากที่สุดจากโพสต์ที่ยังไม่หมดอายุ ผู้ใช้สลับมุมมองตามประเภทรถได้ ค่าเริ่มต้น = มอเตอร์ไซค์

## 5. สูตรคำนวณ % โอกาสท่วมต่อโซน

แบ่งพื้นที่เป็น 10–20 โซนกว้าง ๆ (ขนาดประมาณ 500 ม.–1 กม. หรือตามชื่อย่านที่คนรู้จัก) คำนวณใหม่ทุก 15 นาที และทันทีเมื่อมีโพสต์หรือโหวตใหม่ในโซน ค่าตัวเลขทั้งหมดเก็บในไฟล์ config เดียว เพื่อปรับทีหลัง

**1) คะแนนฝน (0–1)** จากฝนสะสม 3 ชม. (R3, มม.), 24 ชม. (R24, มม.) และจำนวนวันที่ฝนตกติดต่อกัน (D, นับวันที่ฝน ≥ 10 มม.)

```
rain = 0.5 · min(1, R3/50) + 0.3 · min(1, R24/90) + 0.2 · min(1, D/5)
```

**2) ตัวคูณพื้นที่ต่ำ (low)** คำนวณครั้งเดียวจาก DEM: เทียบความสูงเฉลี่ยของโซนกับความสูงเฉลี่ยของทั้งพื้นที่ แบ่งเป็น 3 กลุ่มตาม tercile: โซนสูง = 0.6, ปกติ = 1.0, โซนต่ำ = 1.3

**3) % จากฝนและพื้นที่**

```
base = min(100, rain · low · 100)
```

**4) % จากโพสต์** = ค่าเฉลี่ยถ่วงน้ำหนักของคะแนนโพสต์ที่อนุมัติแล้ว ยังไม่หมดอายุ และตำแหน่งอยู่ในโซน คะแนนโพสต์ = ค่าระดับน้ำ + ค่าสถานะ (จำกัด 0–100) น้ำหนัก = น้ำหนักตามเวลา × ตัวคูณโหวต (หัวข้อ 4)

```
report = Σ(w_i · s_i) / Σ(w_i)
```

**5) % สุดท้าย** ยิ่งมีโพสต์มาก ยิ่งเชื่อโพสต์มาก โดย c สูงสุด 0.8 เมื่อผลรวมน้ำหนักโพสต์ (Σw) ถึง 5 ถ้าไม่มีโพสต์ c = 0 ใช้ base ล้วน

```
c     = min(0.8, 0.16 · Σ w_i)
final = (1 − c) · base + c · report
```

**ระดับสีโซน:** 0–29 ต่ำ (เขียว), 30–59 ปานกลาง (เหลือง), 60–79 สูง (ส้ม), 80–100 อันตราย (แดง) หน้าโซนต้องแสดง base, report, c และค่าฝนที่ใช้ เพื่ออธิบายว่าทำไมได้ % นี้

## 6. ระบบนำทางหลบน้ำ

ใช้ pgRouting บนตาราง `road_segments` ใน Supabase เดียวกัน ไม่ต้องตั้งเซิร์ฟเวอร์แยก ใช้ได้โดยไม่ต้องล็อกอิน

**ค่าเส้นทางต่อท่อน (คำนวณแยกตามประเภทรถที่ผู้ใช้เลือก):**

- พื้นฐาน = `length_m / speed` (วินาที)
- ผ่านได้ หรือไม่มีข้อมูล ×1, ผ่านยาก ×3, ผ่านไม่ได้ = ตัดทิ้ง (cost = -1)
- ท่อนที่อยู่ในโซน % ≥ 60 บวกเพิ่ม 50%
- ถนนวันเวย์จาก OSM ใช้ `reverse_cost` = -1

**ผู้ใช้เลือกเองได้:**

- ประเภทรถ: มอเตอร์ไซค์ / เก๋ง / กระบะ / เดินเท้า
- ระดับการหลบ: หลบเฉพาะ "ผ่านไม่ได้" หรือหลบ "ผ่านยาก" ด้วย (ตัดทิ้งเหมือนแดง)
- เลือกจาก 2–3 เส้นทาง (`pgr_KSP`): ปลอดภัยสุด, สมดุล, สั้นสุด (ไม่สนน้ำท่วม แต่เตือนว่าผ่านจุดไหน) แต่ละเส้นแสดงระยะทาง เวลา และจำนวนท่อนเหลือง/แดง
- ลากจุดบนเส้นทางเพื่อเพิ่ม waypoint แล้วคำนวณใหม่
- เลือกเส้นที่ผ่านแดงได้ แต่ต้องขึ้นคำเตือนก่อน

**ระหว่างเดินทาง:** จุด GPS แบบสด, รายการเลี้ยวแบบข้อความ, ถ้า Realtime แจ้งว่าท่อนถนนข้างหน้ากลายเป็นแดง ให้ถาม "คำนวณเส้นทางใหม่ไหม" และมีปุ่ม "เปิดใน Google Maps" ที่ส่ง waypoint ของเส้นที่เลือกไปใน URL เพื่อบังคับให้วิ่งตามเส้นเรา

**นอกพื้นที่:** ปลายทางอยู่นอกรัศมี 5 กม. → พาไปถึงขอบพื้นที่แล้วส่งต่อให้ Google Maps

## 7. กันสแปมและแอดมิน

ทุกโพสต์ผ่านการตรวจฝั่งเซิร์ฟเวอร์ก่อนบันทึก ไม่เชื่อค่าจาก client

**ลิมิต:**

- ต้องล็อกอินก่อนโพสต์ โหวต หรือรีพอร์ต
- ผู้โพสต์ต้องอยู่ห่างจากจุดที่รายงานไม่เกิน 2 กม. (ส่ง GPS มาด้วย)
- 1 โพสต์ต่อ 5 นาที และไม่เกิน 10 โพสต์ต่อวันต่อผู้ใช้
- รัศมีสูงสุด 300 ม. และความยาวถนนสูงสุด 500 ม.
- API สาธารณะ (ดูข้อมูล, นำทาง) จำกัดจำนวนครั้งต่อ IP เพราะไม่ต้องล็อกอิน
- ลบ EXIF ออกจากรูปก่อนเก็บ

**คะแนนเสี่ยงสแปม (แบบกฎ ไม่ใช้ AI):**

| สัญญาณ | คะแนน |
|---|---|
| บัญชีอายุน้อยกว่า 24 ชม. | +30 |
| ไม่มี GPS หรืออยู่ห่างจุดรายงานเกิน 2 กม. | +40 |
| ระดับน้ำ ≥ เข่า แต่ฝน 24 ชม. < 5 มม. | +30 |
| รัศมีหรือความยาวถนน ≥ 90% ของลิมิต | +10 |
| มีลิงก์หรือคำต้องห้ามในข้อความ | +40 |
| เคยถูกปฏิเสธหรือโดนซ่อนจากรีพอร์ต ≥ 2 ครั้งใน 30 วัน | +30 |
| ผู้ใช้ trusted (โพสต์ได้อนุมัติ ≥ 5 โพสต์ และไม่เคยถูกปฏิเสธ) | −40 |

คะแนน < 50 → `approved` ทันที, 50–79 → `pending` (เห็นเฉพาะเจ้าของและแอดมิน, ไม่นำไปคำนวณ), ≥ 80 → `rejected` อัตโนมัติ เก็บ `spam_reasons` ไว้ให้แอดมินดู

**รีพอร์ตโพสต์:** เหตุผล = ข้อมูลเท็จ, สแปม, ไม่เหมาะสม, ซ้ำ ถูกรีพอร์ตจากผู้ใช้ไม่ซ้ำกัน ≥ 3 คน → `hidden` อัตโนมัติและเข้าคิวแอดมิน

**แอดมิน (`/admin`):**

- คิว `pending`: อนุมัติ/ปฏิเสธ พร้อมแสดง `spam_reasons`
- คิวโพสต์ถูกรีพอร์ต: คืนสถานะหรือลบ
- ลบ = soft delete (`status = 'deleted'`, เก็บไว้ตรวจสอบ)
- แบน/ปลดแบนผู้ใช้ + ดูประวัติโพสต์
- ทุกการกระทำบันทึกลง `admin_logs`

## 8. Tech stack และแหล่งข้อมูล

| ส่วน | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| หน้าเว็บ | Next.js (App Router, TypeScript) + Tailwind | deploy บน Vercel |
| แผนที่ | MapLibre GL JS (หรือ Leaflet) + tile OpenStreetMap | วาดโซน, วงกลม, เส้นสีถนน, เส้นทาง |
| DB | Supabase Postgres + PostGIS + pgRouting | เปิด RLS ทุกตาราง |
| Auth | Supabase Auth: Google + LINE Login | LINE เป็น OIDC provider |
| เก็บรูป | Supabase Storage | ลดขนาด + ลบ EXIF |
| Realtime | Supabase Realtime | หมุดและสีถนนอัปเดตสด |
| งานตั้งเวลา | Supabase pg_cron + Edge Functions (ทุก 15 นาที) | ไม่ใช้ Vercel Cron เพราะแพลนฟรีตั้งได้วันละครั้ง |
| เตรียมข้อมูล | สคริปต์ Python (รันครั้งเดียว) | นำเข้าถนน OSM, คำนวณความต่ำของโซน |

**แหล่งข้อมูลภายนอก:**

- **ฝน:** Open-Meteo API (ฟรี ไม่ต้องใช้ key) ดึงค่ารายชั่วโมงย้อนหลังและพยากรณ์ พื้นที่เล็ก ใช้จุดกลาง มข. จุดเดียวพอ
- **ถนน:** OpenStreetMap ผ่าน Overpass API หรือ osm2pgrouting เก็บข้อมูล oneway และประเภทถนน
- **ความสูง:** Copernicus DEM GLO-30 (หรือ FABDEM)
- **พิกัด:** เก็บเป็น EPSG:4326 คำนวณระยะด้วย `geography` หรือแปลงเป็น EPSG:32648 (UTM 48N)

## 9. Database schema

โครงสร้างตั้งต้น ปรับชื่อหรือเพิ่ม index ได้ แต่ต้องเก็บฟิลด์ที่ใช้เทรนอนาคต (`rain_snapshot`, `zone_scores_hourly`) ไว้เสมอ

```sql
create extension if not exists postgis;
create extension if not exists pgrouting;

create table profiles (
  id uuid primary key references auth.users,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  approved_count int not null default 0,
  rejected_count int not null default 0,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

create table zones (
  id serial primary key,
  name text not null,
  geom geometry(Polygon, 4326) not null,
  mean_elev_m real,
  low_factor real not null default 1.0   -- 0.6 / 1.0 / 1.3
);

create table road_nodes (
  id bigserial primary key,
  geom geometry(Point, 4326) not null
);

create table road_segments (
  id bigserial primary key,
  osm_way_id bigint,
  name text,
  highway text,
  source bigint references road_nodes,
  target bigint references road_nodes,
  oneway boolean not null default false,
  length_m real not null,
  speed_kmh real not null,
  zone_id int references zones,
  geom geometry(LineString, 4326) not null
);

create table reports (
  id bigserial primary key,
  user_id uuid not null references profiles,
  kind text not null check (kind in ('area','road')),
  geom geometry(Point, 4326) not null,
  radius_m int check (radius_m between 20 and 300),
  zone_id int references zones,
  water_level text not null,           -- dry|puddle|ankle|knee|waist
  status_tags text[] not null default '{}',
  passability jsonb,                   -- {"motorcycle":"ok|hard|blocked", "car":…, "pickup":…, "walk":…}
  note text,
  photo_path text,
  poster_distance_m real,              -- ระยะผู้โพสต์ถึงจุด ตอนโพสต์
  rain_snapshot jsonb,                 -- {r1, r3, r24, r72, rainy_days} ตอนโพสต์
  spam_score int not null default 0,
  spam_reasons text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','hidden','deleted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table report_road_segments (
  report_id bigint references reports on delete cascade,
  segment_id bigint references road_segments,
  primary key (report_id, segment_id)
);

create table votes (
  report_id bigint references reports on delete cascade,
  user_id uuid references profiles,
  vote text not null check (vote in ('still','receded')),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table post_flags (
  report_id bigint references reports on delete cascade,
  user_id uuid references profiles,
  reason text not null check (reason in ('false','spam','inappropriate','duplicate')),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table rainfall (
  ts timestamptz primary key,
  r1 real, r3 real, r24 real, r72 real,
  rainy_days int,
  forecast_3h real
);

create table zone_scores (           -- ค่าปัจจุบัน ใช้แสดงผล
  zone_id int primary key references zones,
  base real, report real, c real, final real,
  updated_at timestamptz not null
);

create table zone_scores_hourly (    -- เก็บย้อนหลังไว้เทรน
  zone_id int references zones,
  ts timestamptz,
  base real, report real, c real, final real, report_count int,
  primary key (zone_id, ts)
);

create table segment_status (        -- สถานะถนนปัจจุบันต่อประเภทรถ
  segment_id bigint references road_segments,
  vehicle text check (vehicle in ('motorcycle','car','pickup','walk')),
  status text check (status in ('ok','hard','blocked','unknown')),
  updated_at timestamptz not null,
  primary key (segment_id, vehicle)
);

create table admin_logs (
  id bigserial primary key,
  admin_id uuid references profiles,
  action text not null,              -- approve|reject|delete|restore|ban|unban
  target_type text, target_id text,
  note text,
  created_at timestamptz not null default now()
);
```

## 10. หน้าเว็บและ API

**หน้าเว็บ:**

| หน้า | เนื้อหา | ล็อกอิน |
|---|---|---|
| `/` | แผนที่ + สีโซน + เส้นสีถนน + หมุด + ตัวสลับประเภทรถ + ปุ่มลอย "รายงานน้ำท่วม" | ไม่ |
| `/navigate` | ต้นทาง/ปลายทาง, เลือกรถ, ระดับการหลบ, การ์ดเส้นทาง 2–3 เส้น, GPS | ไม่ |
| `/zone/[id]` | %, แยก base / report / c, ฝนล่าสุด, โพสต์ในโซน | ไม่ |
| `/post/[id]` | รายละเอียดโพสต์, โหวต, รีพอร์ต, แชร์ (มี OG image) | ดูไม่ต้อง, โหวต/รีพอร์ตต้อง |
| `/report` | เลือกแบบพื้นที่หรือถนน, แท็ก, รูป, ข้อความ | ต้อง |
| `/me` | โพสต์ของฉัน + สถานะอนุมัติ | ต้อง |
| `/about` | วิธีคำนวณ, แหล่งข้อมูล, ข้อจำกัด | ไม่ |
| `/admin` | คิวรออนุมัติ, โพสต์ถูกรีพอร์ต, ผู้ใช้, log | แอดมิน |

**API (Next.js route handlers):**

| Method + path | ทำอะไร | สิทธิ์ |
|---|---|---|
| `GET /api/zones` | โซนทั้งหมด + คะแนนปัจจุบัน (GeoJSON) | สาธารณะ + rate limit |
| `GET /api/segments?bbox=&vehicle=` | สถานะถนนในกรอบที่ดู | สาธารณะ + rate limit |
| `GET /api/reports?bbox=` | โพสต์ `approved` ที่ยังไม่หมดอายุ | สาธารณะ + rate limit |
| `GET /api/route?from=&to=&vehicle=&avoid=&via=` | 2–3 เส้นทาง (GeoJSON + ระยะ เวลา จำนวนท่อนเหลือง/แดง) | สาธารณะ + rate limit |
| `POST /api/reports` | สร้างโพสต์: ตรวจลิมิต → คำนวณ spam_score → บันทึก rain_snapshot → คำนวณโซน/ถนนใหม่ | ล็อกอิน |
| `POST /api/reports/[id]/vote` | โหวต still / receded | ล็อกอิน |
| `POST /api/reports/[id]/flag` | รีพอร์ต (ครบ 3 คน → hidden) | ล็อกอิน |
| `POST /api/admin/reports/[id]` | approve / reject / delete / restore | แอดมิน |
| `POST /api/admin/users/[id]` | ban / unban | แอดมิน |

**งานตั้งเวลา (pg_cron):** ทุก 15 นาที ดึงฝน → คำนวณ `zone_scores` และ `segment_status` ใหม่ → ปิดโพสต์หมดอายุ ทุกชั่วโมง บันทึก `zone_scores_hourly`

## 11. ลำดับงาน (~8 สัปดาห์)

ทำตามลำดับนี้ แต่ละสัปดาห์ต้องผ่านเกณฑ์ "เสร็จ" ก่อนขึ้นสัปดาห์ถัดไป

| สัปดาห์ | งาน | เสร็จเมื่อ |
|---|---|---|
| 1 | ตั้ง Next.js + Supabase, migration schema, RLS, login Google/LINE, แผนที่, กำหนดโซน | เปิดเว็บเห็นแผนที่ + โซน ล็อกอินได้ |
| 2 | โพสต์แบบพื้นที่ + แท็ก + รูป, โหวต, หมดอายุ, Realtime | โพสต์จากมือถือแล้วขึ้นบนอีกเครื่องทันที |
| 3 | สคริปต์นำเข้าถนน OSM + topology, โพสต์แบบถนน (snap + เลือกช่วง), `segment_status`, เส้นสี | เลือกช่วงถนนได้ เส้นเปลี่ยนสีตามประเภทรถ |
| 4 | ดึงฝน (pg_cron), คำนวณ low_factor จาก DEM, สูตร %, หน้าโซน, `zone_scores_hourly` | % โซนอัปเดตทุก 15 นาที มี unit test สูตร |
| 5 | pgRouting: cost ตามสถานะ, `/api/route`, `pgr_KSP` | API คืนเส้นทางที่ไม่ผ่านท่อนแดง |
| 6 | หน้า `/navigate`: การ์ดเส้นทาง, ลาก waypoint, GPS, แจ้งรีรูต, ส่งต่อ Google Maps | นำทางจริงบนมือถือได้ |
| 7 | ลิมิตโพสต์, เช็ก GPS, spam_score, รีพอร์ต + auto-hide, rate limit ต่อ IP | ทดสอบทุกกฎในหัวข้อ 7 ผ่าน |
| 8 | หน้า `/admin` + `admin_logs`, `/about`, OG image, ทดสอบบนมือถือ, deploy | เปิดใช้จริง |

ถ้าเวลาไม่พอ ตัดการลาก waypoint และแจ้งรีรูตอัตโนมัติไปเฟส 2 ได้

## 12. เฟสถัดไปและข้อที่ยังเปิดอยู่

**เฟสถัดไป (อย่าเพิ่งทำ แต่ออกแบบให้เพิ่มทีหลังได้ง่าย):**

1. แจ้งเตือนผ่าน LINE Official Account เมื่อโซนที่ติดตามเสี่ยงสูง
2. ใช้ LLM อ่านข้อความโพสต์และสรุปสถานการณ์
3. เทรนโมเดล (XGBoost หรือ logistic regression) จาก `reports` + `rain_snapshot` + `zone_scores_hourly` หลังเก็บข้อมูลครบหนึ่งฤดูฝน แล้วค่อยลดขนาดโซนให้ละเอียดขึ้น

**ข้อที่ยังต้องตัดสินใจ (ถามเจ้าของก่อนทำ):**

- [x] รายชื่อโซนและขอบเขตจริง → จับกลุ่มจากโพสต์ (หัวข้อ 0)
- [x] จุดกึ่งกลางและรัศมีพื้นที่ครอบคลุมที่แน่นอน → กลาง มข. 5 กม.
- [ ] คำต้องห้ามสำหรับ spam_score (ระหว่างนี้ตรวจแค่ลิงก์)
- [x] ชื่อเว็บ → KKU Flood Watch (โดเมนยังค้าง)
- [x] ค่าตัวคูณโหวต → ×1.2 / ×0.6 ตามแพลน

ตัวเลขทุกค่าในหัวข้อ 4, 5, 6, 7 เป็นค่าเริ่มต้น ให้เก็บไว้ในไฟล์ config เดียว (เช่น `lib/config.ts`) และอย่า hard-code กระจายในโค้ด
