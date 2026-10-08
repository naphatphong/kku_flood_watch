# PLAN: 3D Energy Drink Store — เฟส 1 (หน้า Landing แบบ Scroll + กระป๋อง 3D)

> เอกสารส่งต่อสำหรับเขียนโค้ด อ่านให้ครบก่อนเริ่ม ข้อใดที่ระบุว่า "รอยืนยัน" ห้ามตัดสินใจแทน ให้ใช้ค่าเริ่มต้นใน config ไปก่อนและแก้ได้จากไฟล์เดียว

---

## 1. ภาพรวม

เว็บขายสินค้าตัวอย่าง (portfolio) ที่จะต่อยอดเป็นร้านค้าเต็มระบบ เฟสนี้ทำเฉพาะหน้า Landing แบบเลื่อนลง (scroll story) โชว์สินค้าตัวแรกคือ **เครื่องดื่มชูกำลังแบรนด์สมมติ** เป็นกระป๋อง 3D ที่หมุนตามการเลื่อนจอและลากหมุนเองได้ มี 3 รส สลับสีได้

**อารมณ์ของงาน:** พรีเมียม ดุดัน สินค้าต้องเด่นที่สุดในจอ ไม่สดใส กระป๋องเป็นโลหะเงาวาว มีหยดน้ำเกาะ แสงจัดบนพื้นมืด

**ข้อห้ามเด็ดขาด**
- ห้ามใช้ชื่อ โลโก้ ลาย หรือ asset ของแบรนด์จริงใดๆ (รวมถึงภาพอ้างอิงที่ผู้ใช้ส่งมา) ทุกอย่างต้องออกแบบใหม่ทั้งหมด
- ใส่ข้อความใน footer: `Concept project — not a real product.`

---

## 2. Tech Stack

| ส่วน | เลือกใช้ |
|---|---|
| Framework | Next.js (App Router) + TypeScript (strict) |
| 3D | three, @react-three/fiber (R3F), @react-three/drei |
| Post-processing | @react-three/postprocessing (Bloom เบาๆ, ปิดได้ตาม tier) |
| Animation | GSAP + ScrollTrigger |
| Smooth scroll | Lenis (ผูกกับ ScrollTrigger) |
| Styling | Tailwind CSS + CSS variables สำหรับธีมรายรส |
| State | Zustand (flavor ที่เลือก, perf tier, drag state) |
| Deploy | Vercel (Hobby ได้ เพราะเป็น portfolio ไม่มีรายได้) |

ใช้เวอร์ชัน stable ล่าสุดของทุกแพ็กเกจ และตรวจว่า R3F/drei เข้ากับ React เวอร์ชันที่ Next.js ใช้

---

## 3. โครงสร้างโปรเจกต์

```
/app
  layout.tsx            # fonts, metadata, Lenis provider
  page.tsx              # ประกอบ sections + <Scene/> แบบ dynamic import (ssr:false)
  globals.css           # CSS variables ธีม
/components
  /sections             # Hero, Story, Flavors, Specs, CTA, Footer
  /three
    Scene.tsx           # Canvas หลัก (fixed เต็มจอ อยู่หลัง HTML)
    Can.tsx             # geometry + materials + label
    Droplets.tsx        # หยดน้ำ (instanced)
    Lights.tsx          # Environment + Lightformers
    Effects.tsx         # post-processing ตาม tier
  /ui                   # FlavorSwitcher, ScrollHint, Loader
/config
  brand.ts              # ชื่อแบรนด์, tagline (แก้ที่เดียว)
  flavors.ts            # ข้อมูล 3 รส
/lib
  can-profile.ts        # จุด profile สำหรับ LatheGeometry
  label-texture.ts      # สร้าง label texture (canvas)
  scroll-timeline.ts    # keyframes ต่อ section
  perf.ts               # ตรวจ tier อุปกรณ์
/store
  useStore.ts
/public
  /fallback             # ภาพนิ่งกระป๋องแต่ละรส (ใช้เมื่อไม่มี WebGL)
```

ข้อมูลสินค้าเก็บใน `config/flavors.ts` ในรูปแบบที่ย้ายไป Supabase ได้ในเฟสร้านค้า (มี `id`, `slug`, `name`, `price`, `colors`, `specs`)

---

## 4. ค่าที่รอยืนยัน (ใช้ค่าเริ่มต้นไปก่อน)

| รายการ | ค่าเริ่มต้น | สถานะ |
|---|---|---|
| ชื่อแบรนด์ | `VOLTRA` (ตัวเลือก: VOLTRA / FERAL / OBSIDIAN) | **รอยืนยัน** |
| สี 3 รส | ดูข้อ 5 | รอยืนยัน |
| โมเดล 3D | สร้างด้วยโค้ด | รอยืนยัน |
| ภาษาเว็บ | อังกฤษ | รอยืนยัน |

ทุกค่าต้องเปลี่ยนได้จาก `/config` โดยไม่ต้องแก้ component

---

## 5. ข้อมูล 3 รส (`config/flavors.ts`)

| id | ชื่อ | ตัวกระป๋อง | สีเน้น | พื้นหลังเว็บ |
|---|---|---|---|---|
| chrome | CHROME | เงินโครมเงาวาว | ดำ `#0A0A0A` | `#050505` → `#1A1A1A` |
| inferno | INFERNO | ดำด้าน | แดงเพลิง `#FF2A1A` | `#0A0202` → `#2A0604` |
| voltage | VOLTAGE | เทาเหล็ก gunmetal | ฟ้าไฟฟ้า `#1EA7FF` | `#02060A` → `#041A2A` |

แต่ละรสมี: `tagline`, `price` (ตัวเลขสมมติ), `specs` (caffeine, sugar, calories, volume — ค่าสมมติ ใส่ให้สมจริง)

---

## 6. กระป๋อง 3D (`Can.tsx`)

### Geometry
- `LatheGeometry` จาก profile ใน `lib/can-profile.ts` สัดส่วนกระป๋องสูง 500 ml (เส้นผ่านศูนย์กลาง ~66 mm, สูง ~168 mm) ปรับสเกลให้สูง ~3 หน่วยในฉาก
- มีขอบคอดด้านบนและล่าง, ฝาเว้าด้านบน, ฐานโค้งด้านล่าง
- ห่วงเปิด (pull tab) ทำจาก geometry ง่ายๆ แยกชิ้น
- segments: desktop 96 / mobile 48

### Materials
- ตัวกระป๋อง: `MeshPhysicalMaterial` — metalness สูง, roughness ตามรส (chrome ต่ำมาก, inferno ด้าน), clearcoat
- ฉลาก: texture จาก `label-texture.ts` วาดด้วย Canvas 2D (ขนาด 2048×1024 desktop / 1024×512 mobile) ประกอบด้วย ชื่อแบรนด์แนวตั้ง, ชื่อรส, กราฟิกเส้นเชิงเรขาคณิตแบบดุดัน, ข้อมูลเล็กๆ ด้านหลัง (volume, barcode สมมติ) — ออกแบบใหม่ทั้งหมด
- ฝาและขอบ: อลูมิเนียมเงิน brushed

### หยดน้ำ (`Droplets.tsx`)
- `InstancedMesh` ทรงกลมแบน กระจายบนผิวกระป๋อง วัสดุ transmission/ior แบบน้ำ
- desktop ~300 ชิ้น / mobile ~80 / low tier ปิด และใช้ normal map แทน

### แสง (`Lights.tsx`)
- drei `<Environment>` สร้างจาก `<Lightformer>` ภายในฉาก (ไม่โหลด HDR ภายนอก) ให้เกิด rim light แรงสองข้าง + key light ด้านบน
- สีของ rim light เปลี่ยนตามสีเน้นของรส

### Post-processing
- Bloom ระดับเบา เฉพาะ tier high
- Vignette เบาๆ

---

## 7. ระบบ Scroll + Drag

### โครงฉาก
- `<Canvas>` เป็น `position: fixed` เต็มจอ อยู่หลัง sections HTML
- sections เป็น HTML ปกติ เลื่อนด้วย Lenis
- ScrollTrigger คุม timeline เดียว ต่อ keyframes จาก `lib/scroll-timeline.ts`

### Keyframes ต่อ section (ค่าเริ่มต้น ปรับได้)
| Section | ตำแหน่งกระป๋อง | การหมุน | หมายเหตุ |
|---|---|---|---|
| Hero | กลางจอ | ลอยขึ้นลงช้าๆ + หมุนช้าอัตโนมัติ | scale ใหญ่สุด |
| Story 1–3 | สลับซ้าย/ขวา (mobile: อยู่กลาง ด้านบนของข้อความ) | หมุน Y ครบ 360° ตลอดช่วง | เอียงเล็กน้อย |
| Flavors | กลาง | หันหน้าฉลากตรง | สลับรสที่นี่ |
| Specs | ด้านข้าง (mobile: ย่อ อยู่บน) | หมุนช้า | |
| CTA | กลาง | หันหน้าตรง | scale ใหญ่ |

### การลากหมุน
- rotation สุดท้าย = rotation จาก scroll + `dragOffset`
- ลากแนวนอน → หมุนแกน Y, ลากแนวตั้งบน desktop → เอียงแกน X เล็กน้อย (จำกัด ±20°)
- มี inertia (damping) หลังปล่อยนิ้ว
- `dragOffset` ค่อยๆ คืนกลับ 0 ภายใน ~1.5 วินาทีหลังปล่อย เพื่อให้กลับเข้าจังหวะ scroll
- **มือถือ:** canvas ใช้ `touch-action: pan-y` → ลากแนวนอนหมุนกระป๋อง, ลากแนวตั้งยังเลื่อนหน้าเว็บได้ตามปกติ (สำคัญมาก ห้ามบล็อก scroll)
- เปลี่ยน cursor เป็น `grab` / `grabbing` เมื่อชี้ที่กระป๋อง (raycast)

---

## 8. การสลับรส

- `FlavorSwitcher` ปุ่ม 3 ปุ่ม (มี label และ keyboard ใช้ได้)
- เมื่อสลับ:
  - tween สีและ roughness ของวัสดุ ~0.8 วินาที
  - เปลี่ยน label texture แบบ crossfade (สร้าง texture ทั้ง 3 รสไว้ล่วงหน้า)
  - tween CSS variables ของพื้นหลังและสีเน้นทั้งหน้า
  - กระป๋องหมุนรอบตัว 1 รอบระหว่างสลับ
- รสที่เลือกเก็บใน Zustand และสะท้อนใน URL (`?flavor=inferno`) เพื่อแชร์ลิงก์ได้

---

## 9. เนื้อหาแต่ละ Section (ภาษาอังกฤษ)

1. **Hero** — ชื่อแบรนด์ตัวใหญ่ + tagline + ScrollHint
2. **Story** — 3 บล็อกข้อความสั้น (เช่น Energy / Focus / Edge) ข้อความเข้ามาแบบ stagger
3. **Flavors** — ชื่อรส, tagline รส, FlavorSwitcher
4. **Specs** — ตัวเลข caffeine / sugar / calories / volume แบบ count-up เมื่อเลื่อนถึง
5. **CTA** — ราคา + ปุ่ม `Add to Cart` (เฟสนี้กดแล้วแสดง toast "Coming soon")
6. **Footer** — ข้อความ concept project

เขียน copy ให้สั้น หนักแน่น เข้ากับแบรนด์ดุดัน

---

## 10. Responsive + Performance

### Breakpoints
- mobile < 768px, tablet 768–1279px, desktop ≥ 1280px
- ทดสอบ: iPhone SE (375px), iPhone 14 Pro, iPad, laptop 1366, desktop 1920, จอแนวนอนมือถือ

### Performance tiers (`lib/perf.ts`)
- ใช้ drei `PerformanceMonitor` ปรับ tier อัตโนมัติขณะรัน
- **high:** DPR สูงสุด 2, bloom, droplets เต็ม
- **medium:** DPR สูงสุด 1.5, ไม่มี bloom, droplets ลดลง
- **low:** DPR 1, ไม่มี droplets, segments ต่ำ, texture เล็ก
- หยุด render loop เมื่อแท็บไม่ active (`frameloop` + visibilitychange)

### Fallback
- ไม่มี WebGL → แสดงภาพนิ่งจาก `/public/fallback` ตามรสที่เลือก (เฟสนี้ใช้ placeholder ได้ ระบุ TODO)
- `prefers-reduced-motion` → ปิดการหมุนตาม scroll และ auto-rotate เหลือแค่ลากหมุนเอง

### เป้าหมาย
- Scene โหลดแบบ dynamic import (ssr:false) พร้อม Loader ระหว่างรอ
- ข้อความ Hero แสดงได้ก่อน 3D โหลดเสร็จ
- 60fps บน desktop, ≥ 30fps ลื่นบนมือถือระดับกลาง
- Lighthouse mobile: Accessibility ≥ 90, Best Practices ≥ 90
- ไม่มี horizontal scroll ทุกขนาดจอ

---

## 11. Milestones (ทำทีละขั้น ส่งให้ตรวจทุกขั้น)

| # | งาน | เกณฑ์ผ่าน |
|---|---|---|
| M1 | Setup Next.js + TS + Tailwind + R3F, Canvas fixed, deploy Vercel ครั้งแรก | เว็บขึ้นออนไลน์ เห็นฉาก 3D เปล่า |
| M2 | กระป๋อง geometry + materials + แสง (รส chrome) | กระป๋องสวย สัดส่วนถูก ดูเป็นโลหะ |
| M3 | Label texture ทั้ง 3 รส + การสลับรส | สลับรสลื่น สีพื้นหลังเปลี่ยนตาม |
| M4 | Sections HTML + Lenis + ScrollTrigger timeline | เลื่อนแล้วกระป๋องเคลื่อนตาม keyframes |
| M5 | Drag rotate + inertia + touch pan-y | ลากหมุนได้ทั้งเมาส์และนิ้ว มือถือยังเลื่อนหน้าได้ |
| M6 | Droplets + post-processing + perf tiers | มือถือไม่กระตุก tier ปรับเองได้ |
| M7 | Responsive ทุกจอ + fallback + reduced motion + polish copy | ผ่านรายการทดสอบข้อ 10 |

---

## 12. นอกขอบเขตเฟสนี้ (เตรียมโครงไว้ แต่ยังไม่ทำ)

- สินค้าอื่นและธีมของแต่ละสินค้า
- ตะกร้า, checkout, ระบบชำระเงิน (Stripe test mode)
- ระบบสมาชิก, หน้าแอดมิน (Supabase)
- แชตบอต AI บนเว็บและ LINE OA

---

## 13. Definition of Done (เฟส 1)

- [ ] ผ่านเกณฑ์ M1–M7 ทั้งหมด
- [ ] ไม่มี asset หรือชื่อของแบรนด์จริง
- [ ] ไม่มี error ใน console, `tsc` และ `lint` ผ่าน
- [ ] README อธิบายวิธีรัน, โครงสร้าง, วิธีแก้ชื่อแบรนด์และข้อมูลรส
- [ ] Deploy บน Vercel ใช้งานได้จริงบนมือถือและคอม
