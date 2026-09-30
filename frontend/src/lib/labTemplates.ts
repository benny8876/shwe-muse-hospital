// Structured definitions for the hospital's 16 printed A4 lab report formats.
// A LabOrder is matched to one of these by exact CatalogItem name (LabOrder.tests
// is set to item.name at order time — see backend/app/services/counter_service.py
// lab_order()). Orders for any other lab item fall back to the plain free-text
// result box in LabCounterPage.tsx.

export type LabRow =
  | { kind: 'section'; label: string }
  | { kind: 'row'; id: string; label: string; unit?: string; range?: string; remark?: string }
  | { kind: 'row2'; id: string; label: string; col1: string; col2: string }
  | { kind: 'text'; id: string; label: string }
  | { kind: 'checkboxGroup'; id: string; label: string; options: string[] }
  | { kind: 'info'; headers: string[]; rows: string[][] }

export type LabTemplate = {
  name: string
  patientLabel?: string
  hasUnit: boolean
  hasRange: boolean
  // Some panels (ABO/Rh, Widal, Urine Routine, Sputum/Stool AFB) have no use
  // for a free-text Remark column — set false to drop it and give the Result
  // column the extra width instead. Defaults to true when omitted.
  hasRemark?: boolean
  rows: LabRow[]
  footnotes?: string[]
  // When set, footnotes stay off the printed page until the lab tech ticks
  // the matching checkbox (General Physician's correlate / recollect lines).
  footnotesOptional?: boolean
  // Some panels' printed footnotes include a "Confirmation will be
  // necessary." line that only applies when a screening test came back
  // positive — the lab tech ticks a checkbox when entering the result, and
  // only then does that line print (see LabTemplateResult.tsx).
  hasConfirmationNote?: boolean
  // Blood Donor Issue Form's print swaps the generic "Consultant Pathologist"
  // signature for a "Done By" line, a numbered transfusion-safety notice, and
  // an Issued by / Received By signature pair — see LabTemplateResult.tsx.
  hasBloodDonorNotice?: boolean
}

function row(id: string, label: string, unit?: string, range?: string, remark?: string): LabRow {
  return { kind: 'row', id, label, unit, range, remark }
}
function section(label: string): LabRow {
  return { kind: 'section', label }
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    name: 'General Physician Panel',
    hasUnit: true,
    hasRange: true,
    rows: [
      row('hpylori', 'H.Pylori Ab'),
      row('bilirubin', 'Serum Bilirubin', 'mg/dl', '< 13'),
      row('hba1c', 'HbA1C', '%', '< 6.5'),
      row('ldh', 'LDH', 'U/L', '132 - 248', 'IFCC Method'),
      row('rbs', 'RBS (Glucometer)', 'mg/dL', '81 - 180'),
      row('troponin', 'Troponin T', 'ng/ml', '0 - 0.1'),
      row('ospt', 'OSPT', 'sec', '10.0 - 14'),
      row('inr', 'INR', '', '0.7 - 1.3'),
      row('aptt', 'APTT', 'sec', '22 - 38'),
      row('esr', 'ESR', 'mm/1st hr', 'Male: 3-5 / Female: 4-7'),
      row('salb', 'Serum Albumin', 'g/dL', '3.5 - 5.2'),
      row('urea_sp', 'Urea (Serum/Plasma)', 'mg/dL', '10 - 50'),
      row('urea_urine', 'Urea (Urine)', 'gm/24 hr', '20 - 35'),
      row('creatinine', 'Creatinine', 'mg/dl', 'Adult male: 0.9-1.3 / Adult female: 0.6-1.2 (see full chart on file)'),
      row('calcium', 'Calcium', 'mg/dL', '8.6 - 10.3'),
      row('magnesium', 'Magnesium', 'mg/dL', '1.6 - 2.6'),
      row('amylase_sp', 'Amylase (Serum/Plasma)', 'U/L', '25 - 86'),
      row('amylase_urine', 'Amylase (Urine)', '', '< 470'),
      row('ft3', 'Free T3', 'pmol/L', '2.8 - 7.1'),
      row('ft4', 'Free T4', 'pmol/L', '12.0 - 22.0'),
      row('tsh', 'TSH', 'mIU/L', '0.3 - 4.2'),
      row('tt3', 'Total T3', 'nmol/L', '1.34 - 2.73'),
      row('tt4', 'Total T4', 'nmol/L', '78.3 - 157.4'),
      row('ddimer', 'D-Dimer', 'mg/L', '0 - 0.5'),
      row('crp_q', 'CRP (Quali)', 'mg/L', '< 6'),
      row('crp_quant', 'CRP (Quanti)', 'mg/L', '< 10'),
      row('hscrp', 'hs CRP', 'mg/L', '< 1.0'),
      row('uric', 'Uric Acid', 'mg/dl', '2.6 - 6.0'),
      row('aso', 'ASO (titre)', 'IU/mL', '< 200'),
      section('Electrolyte'),
      row('sodium', 'Sodium', 'mmol/L', '136 - 145'),
      row('potassium', 'Potassium', 'mmol/L', '3.5 - 5.2'),
      row('chloride', 'Chloride', 'mmol/L', '96 - 108'),
      row('bicarb', 'Bicarbonate', 'mmol/L', '24 - 30'),
      section('Total Protein & Differential (T & DP)'),
      row('tprotein', 'Total Protein', 'g/L', '60 - 78'),
      row('albumin', 'Albumin', 'g/L', '35 - 52'),
      row('globulin', 'Globulin', 'g/L', '20 - 39'),
      section('Lipid Profile'),
      row('tchol', 'Total Cholesterol', 'mg/dL', 'Desirable: < 200'),
      row('trig', 'Triglyceride', 'mg/dL', 'Male: 60-165 / Female: 40-140'),
      row('hdl', 'HDL', 'mg/dL', 'Male: 35-80 / Female: 42-88'),
      row('ldl', 'LDL (Direct)', 'mg/dL', '< 130'),
      section('Liver Function Test'),
      row('tbili', 'Total Bilirubin', 'mg/dl', 'Adult up to: 1.2 / Infant: 0.2-8'),
      row('alp', 'Alkaline Phosphatase', 'U/L', 'Men: 80-306 / Women: 64-306 / Child: 180-1200'),
      row('sgpt', 'SGPT (ALT)', 'U/L', 'Men up to 45 / Women up to 35'),
      row('sgot', 'SGOT (AST)', 'U/L', 'Men up to 35 / Women up to 31'),
      row('ra', 'RA (Quali)'),
      row('ana', 'ANA (Quali)'),
      row('hbsag1', 'HBs Ag', '', '', 'ACE Bio'),
      row('hcvab1', 'HCV Ab', '', '', 'ACE Bio'),
      row('hivab1', 'HIV Ab', '', '', 'ACE Bio'),
      row('vdrl1', 'VDRL', '', '', 'ACE Bio'),
      section('Dengue Duo (ICT)'),
      row('dengue_ns1', 'NS1Ag'),
      row('dengue_igg', 'IgG'),
      row('dengue_igm', 'IgM'),
      row('mp_ict', 'MP (ICT)'),
      row('mp_film', 'MP (Film)'),
      row('psa', 'PSA (Total)', 'ng/ml', 'Normal level: < 4'),
      row('ketone', 'Blood Ketone', 'mmol/L', '< 0.6'),
      row('u_albumin', 'Urine Albumin', 'mg/dl', '<= 2'),
      row('u_for_albumin', 'Urine for Albumin'),
      row('afp', 'AFP', 'ng/ml', 'Normal level: 0 - 20'),
      row('cea', 'CEA', 'ng/ml', '0 - 5.0'),
      row('abo', 'ABO Grouping'),
      row('rh', 'Rh Grouping'),
      row('bleeding', 'Bleeding Time', 'min', '2 - 5'),
      row('clotting', 'Clotting Time', 'min', '2 - 7'),
      row('egfr', 'Serum Creatinine eGFR', 'ml/min/1.73m2', '> 90'),
      row('retic', 'Reticulocyte Count', '%', '0.2 - 2'),
      section("Coomb's Test"),
      row('direct_coombs', "Direct Coomb's Test"),
      row('indirect_coombs', "Indirect Coomb's Test"),
      section("Coomb's Test (Temperature Specific)"),
      row('direct_4c', 'Direct 4°C'),
      row('direct_37c', 'Direct 37°C'),
      row('indirect_4c', 'Indirect 4°C'),
      row('indirect_37c', 'Indirect 37°C'),
      row('u_for_ucg', 'Urine for UCG'),
      row('ca125', 'CA-12-5', 'U/mL', '0 - 35'),
      row('ca153', 'CA-15-3', 'U/mL', '< 31.3'),
      row('ca199', 'CA-19-9', 'U/mL', '< 35'),
      row('hbsab_quanti', 'HBs Ab (Quanti)', 'mIU/ml', '> 10'),
      row('tpha', 'TPHA'),
      section('HBV Profile'),
      row('hbsag2', 'HBsAg'),
      row('hbsab2', 'HBsAb'),
      row('hbeag', 'HBeAg'),
      row('hbeab', 'HBeAb'),
      row('hbcab', 'HBcAb'),
      section('TB (ICT)'),
      row('tb_igg', 'IgG'),
      row('tb_igm', 'IgM'),
      row('g6pd', 'G6PD (Quantitative)', 'U/g Hb', '> 4.6'),
      section('Iron Study'),
      row('ferritin', 'Ferritin', 'ng/ml', 'Male: 20-250 / Female: 20-200 / Child: 15-150'),
      row('iron', 'Iron', 'ug/dl', 'Male: 70-180 / Female: 60-180 / Child: 50-120'),
      row('tibc', 'TIBC', 'ug/dl', 'Male: 171-505 / Female: 149-492 / Child: 240-450'),
      row('tsat', 'Transferrin Saturation Rate', '%', '20 - 60'),
      row('dbili', 'Direct Bilirubin', 'mg/dl', '< 0.3'),
      row('indbili', 'Indirect Bilirubin', 'mmol/L', '0.2 - 8.0'),
      section('Vitamin D'),
      row('vitd', 'Vitamin D', 'ng/ml', 'Deficient < 20 / Insufficient 20-29 / Sufficient 30-100 / Toxicity > 100'),
      section('OGTT (Plasma Glucose)'),
      row('ogtt_fasting', 'Fasting', 'mg/dL', '< 95'),
      row('ogtt_1hr', '1 hr. after glucose', 'mg/dL', '< 180'),
      row('ogtt_2hr', '2 hr. after glucose', 'mg/dL', '0 - 140'),
      row('occult_blood', 'Stool For Occult Blood', '', 'Positive / Negative'),
    ],
    footnotes: [
      'Please correlate with clinical condition.',
      'Recollected second sample if needed confirmation.',
    ],
    footnotesOptional: true,
    hasConfirmationNote: true,
  },
  {
    name: 'OG Panel',
    hasUnit: true,
    hasRange: true,
    rows: [
      row('rbs', 'RBS (Glucometer)', 'mg/dL', '81 - 180'),
      row('abo', 'ABO Grouping'),
      row('rh', 'Rh Grouping'),
      row('bleeding', 'Bleeding Time', 'min', '2 - 5'),
      row('clotting', 'Clotting Time', 'min', '2 - 7'),
      row('hbsag', 'HBs Ag', '', '', 'ACE Bio'),
      row('hcvab', 'HCV Ab', '', '', 'ACE Bio'),
      row('hivab', 'HIV Ab', '', '', 'ACE Bio'),
      row('vdrl', 'VDRL', '', '', 'ACE Bio'),
    ],
    hasConfirmationNote: true,
  },
  {
    name: 'BCRVD Screening (HBsAg, HCV, HIV, VDRL)',
    hasUnit: false,
    hasRange: true,
    rows: [
      row('hbsag', 'HBsAg', '', 'ACE Bio'),
      row('hcvab', 'HCV Ab', '', 'ACE Bio'),
      row('hivab', 'HIV Ab', '', 'ACE Bio'),
      row('vdrl', 'VDRL', '', 'ACE Bio'),
    ],
    hasConfirmationNote: true,
  },
  {
    name: 'ABO and Rh Blood Grouping',
    hasUnit: false,
    hasRange: false,
    hasRemark: false,
    rows: [
      row('abo', 'ABO Grouping'),
      row('rh', 'Rh Grouping'),
    ],
  },
  {
    name: 'Beta hCG',
    hasUnit: true,
    hasRange: true,
    rows: [
      row('betahcg', 'Beta hCG', 'mIU/mL', 'See below'),
      { kind: 'text', id: 'impression', label: 'Impression' },
      {
        kind: 'info',
        headers: ['Gestational Age', 'Beta hCG Range (mIU/mL)'],
        rows: [
          ['Non-pregnant female', '< 5'],
          ['3 week', '5 - 50'],
          ['4 week', '5 - 426'],
          ['5 week', '18 - 4340'],
          ['6 week', '1080 - 56500'],
          ['7-8 week', '7650 - 229000'],
          ['9-12 week', '25700 - 288000'],
          ['13-16 week', '13300 - 254000'],
          ['17-24 week', '4060 - 165400'],
          ['25-40 week', '3640 - 117000'],
        ],
      },
    ],
  },
  {
    name: 'Urine Routine Examination',
    hasUnit: false,
    hasRange: true,
    hasRemark: false,
    rows: [
      section('Urine Analysis'),
      row('leu', 'Leukocytes (LEU)', '', '9 - 15 Leu/ul'),
      row('nit', 'Nitride (NIT)', '', '0.05 - 0.1 mg/dL'),
      row('uro', 'Urobilinogen (URO)', '', '3.5 - 17 umol/L'),
      row('pro', 'Protein (PRO)', '', '0.075 - 0.15 g/L'),
      row('ph', 'pH', '', '5.0 - 9.0'),
      row('blo', 'Blood (BLO)', '', '5 - 10 Ery/ul'),
      row('sg', 'Specific Gravity (SG)', '', '1.000 - 1.030'),
      row('ket', 'Ketone (KET)', '', '0.25 - 0.5 mmol/L'),
      row('bil', 'Bilirubin (BIL)', '', '6.8 - 17 umol/L'),
      row('glu', 'Glucose (GLU)', '', '2.5 - 5 mmol/L'),
      row('asc', 'Ascorbic Acid (ASC)', '', '0.28 - 0.56 mmol/L'),
      section('Microscopic Examination'),
      row('appearance', 'Appearance'),
      row('epithelial', 'Epithelial Cells', '/HPF'),
      row('pus', 'Pus Cells', '/HPF'),
      row('rbcs', 'RBCs', '/HPF'),
      row('casts', 'Casts'),
      row('crystals', 'Crystals'),
      row('others', 'Others'),
    ],
  },
  {
    name: 'Blood Donor Issue Form',
    patientLabel: "Donor Name",
    hasUnit: true,
    hasRange: true,
    hasBloodDonorNotice: true,
    rows: [
      row('hb', 'Hb%', 'g/dL', 'Male: 12.5-15.5 / Female: 11.5-14.5'),
      row('abo', 'ABO Grouping'),
      row('rh', 'Rh Grouping'),
      row('hbsag', 'HBsAg', '', '', 'ACE Bio'),
      row('hcvab', 'HCV Antibody', '', '', 'Intec'),
      row('hivab', 'HIV Antibody', '', '', 'Intec'),
      row('vdrl', 'VDRL', '', '', 'Intec'),
      { kind: 'text', id: 'crossmatch', label: "Cross-matching remarks (patient's name, age, sex, admission no., blood group, major/minor cross matching result)" },
    ],
  },
  {
    name: 'RPR Dilution (VDRL Titre)',
    hasUnit: false,
    hasRange: false,
    rows: [
      section('VDRL Dilution (Rapid Plasma Reagin Test)'),
      row('neat', 'Neat'),
      row('d2', 'RPR (1 in 2 dilution)'),
      row('d4', 'RPR (1 in 4 dilution)'),
      row('d8', 'RPR (1 in 8 dilution)'),
      row('d16', 'RPR (1 in 16 dilution)'),
      row('d32', 'RPR (1 in 32 dilution)'),
      row('d64', 'RPR (1 in 64 dilution)'),
      row('d128', 'RPR (1 in 128 dilution)'),
    ],
  },
  {
    name: 'Widal Test',
    hasUnit: false,
    hasRange: false,
    hasRemark: false,
    rows: [
      { kind: 'row2', id: 'styphi', label: 'Sal. Typhi', col1: 'O Antibody', col2: 'H Antibody' },
      { kind: 'row2', id: 'sparaa', label: 'Sal. Para Typhi A', col1: 'O Antibody', col2: 'H Antibody' },
      { kind: 'row2', id: 'sparab', label: 'Sal. Para Typhi B', col1: 'O Antibody', col2: 'H Antibody' },
    ],
  },
  {
    name: 'Semen Analysis',
    hasUnit: true,
    hasRange: true,
    rows: [
      section('Macroscopic Examination'),
      row('volume', 'Volume', 'mL', '> 1.5'),
      row('liquefaction', 'Liquefaction Time', 'minutes after collection', 'Complete by 30 mins.'),
      row('color', 'Color', '', 'Grey-White'),
      row('viscosity', 'Viscosity'),
      row('ph', 'PH', '', '7.2 - 8.0'),
      section('Microscopic Examination'),
      row('sperm_count', 'Sperm count', 'million sperm / mL', '15 - 200'),
      section('Sperm Motility'),
      row('active', 'Active', '%'),
      row('sluggish', 'Sluggish', '%'),
      row('dead', 'Dead', '%'),
      section('Sperm Morphology'),
      row('normal_head', 'Normal Head', '%'),
      row('small_head', 'Small Head', '%'),
      row('giant_head', 'Giant Head', '%'),
      row('pus', 'Pus Cells'),
      row('others', 'Others'),
      { kind: 'checkboxGroup', id: 'remarks', label: 'Remarks', options: ['Normospermia', 'Oligozoospermia', 'Azoospermia'] },
    ],
  },
  {
    name: 'Sputum and Stool AFB',
    hasUnit: false,
    hasRange: false,
    hasRemark: false,
    rows: [
      row('day1', 'Sputum for AFB (1st day)'),
      row('day2', 'Sputum for AFB (2nd day)'),
      row('day3', 'Sputum for AFB (3rd day)'),
      row('stool', 'Stool for AFB'),
    ],
  },
  {
    name: 'Stool Routine Examination',
    hasUnit: false,
    hasRange: false,
    rows: [
      section('Macroscopic Examination'),
      row('appearance', 'Appearance'),
      row('consistency', 'Consistency'),
      row('mucous', 'Mucous'),
      row('blood', 'Blood'),
      section('Microscopic Examination'),
      row('pus', 'Pus Cell'),
      row('rbcs', 'RBCs'),
      row('ova', 'Ova'),
      row('cyst', 'Cyst'),
      row('others', 'Others'),
    ],
  },
  {
    name: 'ADA (Adenosine Deaminase)',
    hasUnit: true,
    hasRange: true,
    rows: [
      row('specimen', 'Type of Specimen'),
      row('ada', 'ADA', 'U/L'),
      {
        kind: 'info',
        headers: ['Type of Specimen', 'Cut-off Value', 'Sensitivity %', 'Specificity %'],
        rows: [
          ['Pleural Fluid', '36 - 45', '78 %', '85 % - 95 %'],
          ['Pericardial Fluid', '36 - 45', '78 %', '85 % - 95 %'],
          ['Ascites Fluid', '36 - 45', '100 %', '97 %'],
          ['CSF', '9 - 10', '50 % - 80 %', '85 % - 95 %'],
          ['Serum', '24', '35 %', '91 %'],
          ['Sputum', '93', '90 % - 95%', '90 % - 95%'],
        ],
      },
    ],
  },
  {
    name: 'Urine Albumin Creatinine Ratio (UACR)',
    hasUnit: true,
    hasRange: true,
    rows: [
      row('u_albumin', 'Urine Albumin', 'mg/dL', '<= 2'),
      row('u_creatinine', 'Urine Creatinine', 'mg/dL', '29 - 226'),
      row('uacr', 'Urine Albumin Creatinine Ratio', 'mg/g', '< 30'),
      {
        kind: 'info',
        headers: ['Category', 'ACR (mg/g)', 'Terms'],
        rows: [
          ['A1', '< 30 mg/g', 'Normal to mildly increased'],
          ['A2', '30 - 300 mg/g', 'Moderately increased'],
          ['A3', '> 300 mg/g', 'Severely increased'],
        ],
      },
    ],
  },
  {
    name: 'Urine Protein Creatinine Ratio (UPCR)',
    hasUnit: true,
    hasRange: true,
    rows: [
      row('u_protein', 'Urine Protein', 'mg/dL', '< 15'),
      row('u_creatinine', 'Urine Creatinine', 'mg/dL', '29 - 226'),
      row('upcr', 'Urine Protein Creatinine Ratio', 'mg/mg', '< 0.15'),
      { kind: 'text', id: 'comment', label: 'Comment' },
      {
        kind: 'info',
        headers: ['Ratio', 'Interpretation'],
        rows: [
          ['Less than 0.2', 'Normal'],
          ['0.2 - 3.5', 'Moderately increased'],
          ['More than 3.5', 'Increased'],
        ],
      },
    ],
  },
  {
    name: 'Blood Film Report',
    hasUnit: false,
    hasRange: false,
    rows: [
      { kind: 'text', id: 'rbcs', label: 'RBCs' },
      { kind: 'text', id: 'wbcs', label: 'WBCs' },
      { kind: 'text', id: 'platelets', label: 'Platelets' },
    ],
  },
]

export type PhysicianAgeBand = 'neonate' | 'infant' | 'toddler' | 'child' | 'adolescent' | 'adult'

/** Neonate 0–2 mo, Infant 3–11 mo, Toddler 1–3 y, Child 4–12 y, Adolescent 13–17 y, Adult 18+. */
export function physicianAgeBand(
  ageYears: number | null | undefined,
  ageMonths: number | null | undefined,
): PhysicianAgeBand | null {
  if (ageYears == null && ageMonths == null) return null
  const years = ageYears ?? 0
  const months = Math.min(11, Math.max(0, ageMonths ?? 0))
  const totalMonths = years * 12 + (years < 1 ? months : 0)
  if (years < 1 && totalMonths <= 2) return 'neonate'
  if (years < 1) return 'infant'
  if (years <= 3) return 'toddler'
  if (years <= 12) return 'child'
  if (years <= 17) return 'adolescent'
  return 'adult'
}

function sex(gender?: string | null): 'M' | 'F' | null {
  const g = (gender || '').trim().toLowerCase()
  if (g === 'm' || g === 'male') return 'M'
  if (g === 'f' || g === 'female') return 'F'
  return null
}

const BAND_LABEL: Record<PhysicianAgeBand, string> = {
  neonate: 'Neonate',
  infant: 'Infant',
  toddler: 'Toddler',
  child: 'Child',
  adolescent: 'Adolescent',
  adult: 'Adult',
}

function labeled(who: string, range: string) {
  return `${who}: ${range}`
}

/** Prefix Male/Female (and an age note such as "18-60" or "adult") so the printed range says who it belongs to. */
function bySex(
  gender: string | null | undefined,
  male: string,
  female: string,
  both: string,
  ageNote?: string,
) {
  const s = sex(gender)
  if (s === 'M') return labeled(ageNote ? `Male ${ageNote}` : 'Male', male)
  if (s === 'F') return labeled(ageNote ? `Female ${ageNote}` : 'Female', female)
  return both
}

/** Age/sex reference for General Physician only. Other templates keep their static range. */
export function physicianReferenceRange(
  rowId: string,
  ageYears: number | null | undefined,
  ageMonths: number | null | undefined,
  gender?: string | null,
): string | null {
  const band = physicianAgeBand(ageYears, ageMonths)
  const years = ageYears ?? 0

  if (rowId === 'esr') return bySex(gender, '3 - 5', '4 - 7', 'Male: 3-5 / Female: 4-7')
  if (rowId === 'trig') return bySex(gender, '60 - 165', '40 - 140', 'Male: 60-165 / Female: 40-140')
  if (rowId === 'hdl') return bySex(gender, '35 - 80', '42 - 88', 'Male: 35-80 / Female: 42-88')
  if (rowId === 'sgpt') return bySex(gender, 'up to 45', 'up to 35', 'Male: up to 45 / Female: up to 35')
  if (rowId === 'sgot') return bySex(gender, 'up to 35', 'up to 31', 'Male: up to 35 / Female: up to 31')

  if (rowId === 'creatinine') {
    if (!band) return null
    if (band === 'neonate') return labeled('Neonate', '0.3 - 1.0')
    if (band === 'infant') return labeled('Infant', '0.2 - 0.4')
    if (band === 'toddler' || band === 'child') return labeled(BAND_LABEL[band], '0.3 - 0.7')
    if (band === 'adolescent') return labeled('Adolescent', '0.5 - 1')
    if (years > 90) return bySex(gender, '1 - 1.7', '0.6 - 1.3', 'Male 90+: 1-1.7 / Female 90+: 0.6-1.3', '90+')
    if (years > 60) return bySex(gender, '0.8 - 1.3', '0.6 - 1.3', 'Male 60-90: 0.8-1.3 / Female 60-90: 0.6-1.3', '60-90')
    return bySex(gender, '0.9 - 1.3', '0.6 - 1.2', 'Male 18-60: 0.9-1.3 / Female 18-60: 0.6-1.2', '18-60')
  }

  if (rowId === 'tbili') {
    if (!band) return null
    if (band === 'infant') return labeled('Infant', '0.2 - 8')
    return labeled('Adult', 'up to 1.2')
  }

  if (rowId === 'alp') {
    if (!band) return null
    if (band === 'toddler' || band === 'child') return labeled(BAND_LABEL[band], '180 - 1200')
    return bySex(gender, '80 - 306', '64 - 306', 'Male (adult): 80-306 / Female (adult): 64-306', '(adult)')
  }

  const childIron = band === 'toddler' || band === 'child'
  if (rowId === 'ferritin') {
    if (!band) return null
    if (childIron) return labeled(BAND_LABEL[band], '15 - 150')
    return bySex(gender, '20 - 250', '20 - 200', 'Male (adult): 20-250 / Female (adult): 20-200', '(adult)')
  }
  if (rowId === 'iron') {
    if (!band) return null
    if (childIron) return labeled(BAND_LABEL[band], '50 - 120')
    return bySex(gender, '70 - 180', '60 - 180', 'Male (adult): 70-180 / Female (adult): 60-180', '(adult)')
  }
  if (rowId === 'tibc') {
    if (!band) return null
    if (childIron) return labeled(BAND_LABEL[band], '240 - 450')
    return bySex(gender, '171 - 505', '149 - 492', 'Male (adult): 171-505 / Female (adult): 149-492', '(adult)')
  }
  return null
}

export function findLabTemplate(testName: string): LabTemplate | undefined {
  return LAB_TEMPLATES.find((t) => t.name === testName)
}

// Shape of a lab-staff-authored template as returned by GET /lab-templates
// (?full=true) / POST/PUT /lab-templates — see backend/app/models/ancillary.py
// LabTemplate/LabTemplateRow. Deliberately simpler than LabTemplate above: just
// rows with a unit/range/remark, optionally grouped under section headings —
// no footnotes, confirmation-note checkboxes, or the Blood Donor Issue Form's
// signature layout, since those are print-behavior code, not data a generic
// builder can safely expose.
export type CustomLabTemplate = {
  id: number
  name: string
  has_unit: boolean
  has_range: boolean
  has_remark: boolean
  rows: { id: number; kind: string; label: string; unit: string; reference_range: string; remark: string }[]
}

export function toLabTemplate(t: CustomLabTemplate): LabTemplate {
  return {
    name: t.name,
    hasUnit: t.has_unit,
    hasRange: t.has_range,
    hasRemark: t.has_remark,
    rows: t.rows.map((r) =>
      r.kind === 'section'
        ? { kind: 'section', label: r.label }
        : { kind: 'row', id: `custom_${r.id}`, label: r.label, unit: r.unit, range: t.has_range ? r.reference_range : undefined, remark: r.remark },
    ),
  }
}

// Custom templates are looked up only when no built-in one matches, so an
// official panel's name can never be silently shadowed by a lab-staff one.
export function findAnyLabTemplate(testName: string, custom: CustomLabTemplate[]): LabTemplate | undefined {
  return findLabTemplate(testName) ?? (() => {
    const match = custom.find((t) => t.name === testName)
    return match ? toLabTemplate(match) : undefined
  })()
}
