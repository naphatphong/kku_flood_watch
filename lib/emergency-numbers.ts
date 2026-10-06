// Emergency numbers behind the SOS button (owner request, 6 Oct 2026). Edit numbers here only.
// KKU numbers were checked on the official pages on 6 Oct 2026; check again when one stops working.
//   sd.kku.ac.th/home/sd-about/contact-us   KKU security (กองป้องกันและรักษาความปลอดภัย)
//   srinagarind.md.kku.ac.th/post/5         Srinagarind Hospital (no ER line on its official pages: use 1669)
// `tel` is what the phone dials: a comma waits, then dials the extension.

export interface EmergencyNumber {
  group: 'มข.' | 'ทั่วประเทศ';
  label: string;
  number: string; // as shown
  tel: string;
}

export const EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { group: 'มข.', label: 'รปภ. มข. สายด่วน', number: '081-708-5891', tel: '0817085891' },
  { group: 'มข.', label: 'กองป้องกันและรักษาความปลอดภัย มข.', number: '043-009700 ต่อ 44444', tel: '043009700,44444' },
  { group: 'มข.', label: 'โรงพยาบาลศรีนครินทร์ (เบอร์กลาง)', number: '043-363111', tel: '043363111' },
  { group: 'ทั่วประเทศ', label: 'เจ็บป่วยฉุกเฉิน / รถพยาบาล', number: '1669', tel: '1669' },
  { group: 'ทั่วประเทศ', label: 'ตำรวจ เหตุด่วนเหตุร้าย', number: '191', tel: '191' },
  { group: 'ทั่วประเทศ', label: 'ดับเพลิง', number: '199', tel: '199' },
  { group: 'ทั่วประเทศ', label: 'ปภ. สาธารณภัย / น้ำท่วม', number: '1784', tel: '1784' },
  { group: 'ทั่วประเทศ', label: 'สายด่วนสุขภาพจิต', number: '1323', tel: '1323' },
];
