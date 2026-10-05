import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronIcon } from '@/components/ui/icons';
import { CLUSTER, INCIDENT_POST, INCIDENTS, LIMITS, MAP, POST, ROAD_STATUS, ROUTING, SCORE, SITE, STATUS_TAGS, TRAFFIC, WATCH, WATER_LEVELS, ZONE_LEVELS } from '@/lib/config';

export const metadata: Metadata = {
  title: 'วิธีคำนวณและข้อจำกัด',
  description: `${SITE.name} คำนวณ % โอกาสท่วม สีถนน และเส้นทางหลบน้ำอย่างไร ใช้ข้อมูลจากไหน และมีข้อจำกัดอะไร`,
};

// Every number on this page comes from lib/config.ts, so it stays in step with the app.
const r = SCORE.rain;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-white/85 p-5 text-[15px] leading-relaxed shadow-sm">
      <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <pre className="rounded-2xl bg-fill/70 px-4 py-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">{children}</pre>;
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4 pb-12">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 shrink-0 place-items-center rounded-full bg-fill hover:bg-fill-strong">
          <ChevronIcon size={16} className="rotate-180" />
        </Link>
        <h1 className="grow text-[19px] font-bold tracking-tight">วิธีคำนวณและข้อจำกัด</h1>
      </header>

      <p className="px-1 text-[15px] leading-relaxed text-secondary">
        {SITE.name} ช่วยหาตึกใน มข. และนำทางไป พร้อมรวมรายงานน้ำท่วมและเหตุบนถนนจากคนในพื้นที่รอบ มข. (รัศมี{' '}
        {MAP.radiusKm} กม.) กับข้อมูลฝนและจราจร เพื่อบอกว่าตรงไหนน่าจะท่วม ถนนเส้นไหนรถแต่ละแบบผ่านได้ และเส้นทางไหนเลี่ยงได้
        ทั้งหมดคำนวณด้วยกฎที่เปิดเผยตามหน้านี้ ไม่ใช้ AI
      </p>

      <Section title="ตึกและสถานที่">
        <p>
          รายชื่อตึก คณะ หอพัก และร้านอาหารใน มข. มาจาก OpenStreetMap เฉพาะที่มีคนใส่ชื่อไว้ ค้นได้ทั้งชื่อไทย อังกฤษ และรหัสตึก
          (SC9 = SC09) ตึกที่เลือกจะขึ้นเป็นสีฟ้าแบบ 3 มิติ แตะตึกที่มีชื่อบนแผนที่ก็ได้ ตึกที่บันทึกไว้เก็บในเครื่องนี้
        </p>
        <p>ไม่เจอตึกที่ต้องการ: เพิ่มชื่อใน OpenStreetMap แล้วรอเราอัปเดตรายชื่อ หรือแจ้งผู้ดูแลเว็บ</p>
      </Section>

      <Section title="วงกลมจุดท่วม">
        <p>
          โพสต์ที่อยู่ห่างกันไม่เกิน {CLUSTER.epsM} ม. รวมเป็นกลุ่มเดียว วงกลมอยู่กลางกลุ่มและกว้างพอครอบทุกโพสต์ (อย่างน้อย{' '}
          {CLUSTER.minRadiusM} ม.) แผนที่แสดงเฉพาะกลุ่มที่รายงานว่ามีน้ำขังขึ้นไป พร้อมจำนวนจุดรายงาน
        </p>
        <p className="font-semibold">% โอกาสท่วมของแต่ละวง คิด 4 ขั้น</p>
        <p>1. คะแนนฝน 0–1 จากฝนสะสม 3 ชม. (R3), 24 ชม. (R24) และจำนวนวันที่ฝนตกติดต่อกัน (D, วันที่ฝน ≥ {r.rainyDayMm} มม.)</p>
        <Formula>
          rain = {r.r3.weight}·min(1, R3/{r.r3.capMm}) + {r.r24.weight}·min(1, R24/{r.r24.capMm}) + {r.rainyDays.weight}·min(1, D/
          {r.rainyDays.cap})
        </Formula>
        <p>
          2. ตัวคูณความต่ำของพื้นที่ จากความสูงพื้นดินเฉลี่ยของจุดที่โพสต์ เทียบกับทั้งพื้นที่: สูง ×{SCORE.lowFactor.high} (สูงกว่า{' '}
          {SCORE.elevationTercilesM[1]} ม.), ปกติ ×{SCORE.lowFactor.normal}, ต่ำ ×{SCORE.lowFactor.low} (ต่ำกว่า{' '}
          {SCORE.elevationTercilesM[0]} ม.)
        </p>
        <Formula>base = min(100, rain × low × 100)</Formula>
        <p>
          3. คะแนนจากโพสต์ = ค่าเฉลี่ยถ่วงน้ำหนักของคะแนนแต่ละโพสต์ (ระดับน้ำ + สถานะ จำกัด 0–100) โพสต์ใหม่มีน้ำหนักมากกว่า
          น้ำหนักลดลงครึ่งหนึ่งทุก {POST.halfLifeHours} ชม.
        </p>
        <Formula>report = Σ(w·s) / Σw</Formula>
        <p>4. ยิ่งมีโพสต์มาก ยิ่งเชื่อโพสต์มากกว่าฝน (สูงสุด {SCORE.confidence.max})</p>
        <Formula>
          c = min({SCORE.confidence.max}, {SCORE.confidence.perWeight} × Σw){'\n'}% = (1 − c) × base + c × report
        </Formula>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
          {[...ZONE_LEVELS].reverse().map((l) => (
            <Swatch key={l.min} color={l.color} label={`${l.label} ${l.min}%+`} />
          ))}
        </div>
        <p className="text-[14px] text-secondary">คำนวณใหม่ทุก {SCORE.refreshMinutes} นาที และทันทีที่มีโพสต์หรือโหวตใหม่</p>
      </Section>

      <Section title="วงเฝ้าระวัง (เส้นประ)">
        <p>
          แอ่งที่ต่ำกว่าพื้นที่รอบข้าง (ในระยะ {WATCH.neighbourM} ม.) อย่างน้อย {WATCH.pocketDepthM} ม. คือที่ที่น้ำฝนมักไหลมารวม
          ระบบคิด % ของแต่ละแอ่งด้วยสูตรเดียวกับขั้น 1–2 ด้านบน (ฝน × ความต่ำของพื้นที่) และแสดงเป็นวงเส้นประเมื่อถึง {WATCH.minPct}%
          ขึ้นไป ถึงยังไม่มีใครโพสต์ก็ตาม
        </p>
        <p>
          หน้าพยากรณ์อากาศใช้สูตรเดียวกันกับฝนที่คาดไว้ของแต่ละวัน (ฝน 3 ชม. ที่หนักที่สุดของวัน ฝนรวมทั้งวัน
          และจำนวนวันที่ฝนตกติดกันก่อนหน้า) จึงดูจุดเฝ้าระวังล่วงหน้าได้ 10 วัน
        </p>
        <p className="text-[14px] text-secondary">
          วงเฝ้าระวังเป็นการคาดการณ์ ไม่ใช่รายงาน ถ้ามีโพสต์ในบริเวณนั้นแล้ว จะแสดงวงจากโพสต์แทน และยังไม่นำไปคิดในการนำทาง
        </p>
      </Section>

      <Section title="คะแนนของโพสต์">
        <ul className="flex flex-col gap-1 text-[14px]">
          {Object.values(WATER_LEVELS).map((w) => (
            <li key={w.label} className="flex justify-between">
              <span>{w.label}</span>
              <span className="text-secondary">{w.score}</span>
            </li>
          ))}
          {Object.values(STATUS_TAGS)
            .filter((t) => t.delta)
            .map((t) => (
              <li key={t.label} className="flex justify-between">
                <span>{t.label}</span>
                <span className="text-secondary">{t.delta > 0 ? `+${t.delta}` : t.delta}</span>
              </li>
            ))}
        </ul>
        <p>
          โพสต์หมดอายุ {POST.expiryHours} ชม. หลังโพสต์ หรือหลังโหวต &ldquo;ยังท่วม&rdquo; ครั้งล่าสุด โหวต &ldquo;ยังท่วม&rdquo; เพิ่มน้ำหนัก ×
          {POST.vote.stillFactor} ต่อโหวต (สูงสุด ×{POST.vote.stillMaxFactor}) โหวต &ldquo;ลดแล้ว&rdquo; ลดน้ำหนัก ×{POST.vote.recededFactor}
        </p>
      </Section>

      <Section title="สีถนน">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
          {Object.values(ROAD_STATUS).map((s) => (
            <Swatch key={s.label} color={s.color} label={s.label} />
          ))}
        </div>
        <p>
          แต่ละท่อนถนน (ประมาณ 50 ม.) แยกตามประเภทรถ ใช้สถานะที่มีน้ำหนักรวมมากที่สุดจากโพสต์ที่ยังไม่หมดอายุ โพสต์แบบถนนนับท่อนที่ผู้โพสต์เลือก
          โพสต์แบบพื้นที่นับทุกท่อนในวงกลมของโพสต์
        </p>
      </Section>

      <Section title="นำทาง">
        <p>ค่าเส้นทางของแต่ละท่อน คิดแยกตามประเภทรถที่เลือก</p>
        <Formula>
          เวลา = ความยาว / ความเร็วถนน (เดิน {ROUTING.walkSpeedKmh} กม./ชม.){'\n'}ผ่านได้ / ไม่มีข้อมูล ×1 · ผ่านยาก ×{ROUTING.costFactor.hard}{' '}
          · ผ่านไม่ได้ = ตัดทิ้ง{'\n'}อยู่ในวงที่ ≥ {ROUTING.riskyClusterMin}% บวกเพิ่ม {ROUTING.riskyClusterPenalty * 100}%
        </Formula>
        <p>
          ระบบเสนอเส้นที่ปลอดภัยสุด เส้นสมดุล (ถ้าเร็วกว่าอย่างน้อย {ROUTING.minSavingPct}%) และเส้นสั้นสุดที่ไม่สนน้ำท่วม
          ถ้าเส้นไหนผ่านจุดที่ผ่านไม่ได้ จะเตือนก่อนเลือก ถนนวันเวย์ขับย้อนไม่ได้ (ยกเว้นเดินเท้า) ปลายทางนอกพื้นที่ จะพาไปถึงขอบพื้นที่แล้วส่งต่อ
          Google Maps
        </p>
      </Section>

      <Section title="แจ้งเหตุบนถนน">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
          {Object.values(INCIDENTS).map((c) => (
            <Swatch key={c.label} color={c.color} label={c.label} />
          ))}
        </div>
        <p>
          แจ้งอุบัติเหตุ ถนนปิด รถเสีย/สิ่งกีดขวาง และงานซ่อมถนนได้จากปุ่ม &ldquo;รายงาน/แจ้งเหตุ&rdquo; ใช้กติกาเดียวกับโพสต์น้ำท่วม
          (ล็อกอิน คะแนนสแปม รีพอร์ต และแอดมินตรวจ) แต่หมดอายุเร็วกว่า: {INCIDENT_POST.expiryHours} ชม. หลังโพสต์ หรือหลังโหวต
          &ldquo;ยังอยู่&rdquo; ครั้งล่าสุด หรือเมื่อโหวต &ldquo;เคลียร์แล้ว&rdquo; มากกว่า &ldquo;ยังอยู่&rdquo; (นับผู้โพสต์เป็น 1 เสียง)
        </p>
        <p>
          ถนนที่แจ้งว่าปิด นับเป็น &ldquo;ผ่านไม่ได้&rdquo; สำหรับรถทุกแบบ ระบบนำทางจึงเลี่ยงให้ ส่วนเหตุอื่นไม่เปลี่ยนสีถนนและเส้นทาง
          แต่การ์ดเส้นทางจะเตือนถ้าผ่านใกล้กว่า {INCIDENT_POST.routeWarnM} ม. (รวมเหตุจาก TomTom ด้วย) เหตุบนถนนไม่นำไปคิด % น้ำท่วม
        </p>
      </Section>

      <Section title="สภาพจราจร">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
          {[...TRAFFIC.levels].reverse().map((l) => (
            <Swatch key={l.label} color={l.color} label={l.label} />
          ))}
          <Swatch color={TRAFFIC.closed.color} label={TRAFFIC.closed.label} />
        </div>
        <p>
          ปุ่มไฟจราจรบนแผนที่แสดงถนนที่รถวิ่งช้ากว่า {TRAFFIC.levels[TRAFFIC.levels.length - 1].below * 100}% ของความเร็วปกติ
          ถนนที่ปิด และจุดอุบัติเหตุหรือเหตุบนถนน (อัปเดตทุก {TRAFFIC.incidentsCacheMinutes} นาที) ถนนที่รถไม่ติดไม่ระบายสี
          เพื่อไม่ให้สับสนกับสีเขียว &quot;ผ่านได้&quot; ของน้ำท่วม
        </p>
        <p>
          การ์ดเส้นทางแสดงเวลาตามสภาพจราจรตอนนี้ และบอกว่าช้ากว่าปกติกี่นาที (ยกเว้นเดินเท้า) เส้นทางยังเลือกจากน้ำท่วมเหมือนเดิม
        </p>
      </Section>

      <Section title="กันสแปมและความเป็นส่วนตัว">
        <p>
          ต้องล็อกอินก่อนโพสต์ โหวต หรือรีพอร์ต โพสต์ได้ 1 ครั้งทุก {LIMITS.postCooldownMinutes} นาที ไม่เกิน {LIMITS.postsPerDay}{' '}
          ครั้งต่อวัน และต้องอยู่ห่างจุดที่รายงานไม่เกิน {LIMITS.maxPosterDistanceKm} กม. ทุกโพสต์ได้คะแนนเสี่ยงสแปมจากกฎตายตัว
          คะแนนสูงรอแอดมินตรวจ ถูกรีพอร์ตจาก {POST.flagsToHide} คนขึ้นไปจะถูกซ่อนจนแอดมินตรวจ
        </p>
        <p>
          ระบบเก็บเฉพาะระยะห่างระหว่างคุณกับจุดที่รายงาน ไม่เก็บพิกัด GPS ของคุณ รูปถูกย่อขนาดและลบข้อมูล EXIF (รวมพิกัดในรูป) ก่อนเก็บ
        </p>
      </Section>

      <Section title="แหล่งข้อมูล">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px]">
          <li>รายงานน้ำท่วมจากผู้ใช้เว็บนี้</li>
          <li>ฝนรายชั่วโมง พยากรณ์อากาศ 10 วัน และคำเตือน: Open-Meteo (ใช้จุดกลาง มข.) คำเตือนคิดจากเกณฑ์ใน WEATHER ของ lib/config.ts ไม่ใช่ประกาศของกรมอุตุนิยมวิทยา</li>
          <li>ความสูงพื้นดิน: Copernicus DEM ความละเอียด 90 ม. ผ่าน Open-Meteo</li>
          <li>ถนน แผนที่ และความสูงตึก 3 มิติ: © OpenStreetMap contributors (ODbL) แสดงผลด้วย OpenFreeMap · ภาพดาวเทียม: MapTiler</li>
          <li>ค้นหาสถานที่: Photon (ข้อมูล OpenStreetMap)</li>
          <li>สภาพจราจร อุบัติเหตุ และเวลาเดินทางตามรถติด: © TomTom</li>
        </ul>
      </Section>

      <Section title="ข้อจำกัด">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px]">
          <li>ข้อมูลมาจากคนในพื้นที่ อาจผิด ช้า หรือไม่ครบ จุดที่ไม่มีคนรายงานไม่ได้แปลว่าไม่ท่วม</li>
          <li>% เป็นค่าประมาณจากกฎง่าย ๆ ไม่ใช่การพยากรณ์ และไม่ใช่ประกาศทางการ</li>
          <li>ความสูงพื้นดินละเอียด 90 ม. และรวมความสูงของตึกกับต้นไม้ บอกได้แค่ภาพกว้าง ลานโล่งอาจดูเป็นแอ่ง และไม่เห็นแอ่งเล็ก ๆ</li>
          <li>ข้อมูลถนนจาก OpenStreetMap อาจขาดซอยหรือทิศวันเวย์บางเส้น</li>
          <li>อย่าขับหรือเดินลุยน้ำที่มองไม่เห็นพื้นถนน และติดตามประกาศจากหน่วยงานในพื้นที่เสมอ</li>
        </ul>
      </Section>
    </main>
  );
}
