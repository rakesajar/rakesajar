import type { DestinationSlug, SourceRef } from './types';

export interface Destination {
  slug: DestinationSlug;
  name: string;
  /** Name as used mid-sentence, e.g. "the United Kingdom". */
  inName: string;
  /** ISO 3166-1 alpha-2, used for the visual badge. */
  code: string;
  currency: string;
  /** Delivery wave from req.md §13 (premium rollout order). */
  wave: 0 | 1 | 2 | 3;
  tagline: string;
  /** Official starting points shown in "Steps" and "Checks" — T1/T2 only. */
  portals: SourceRef[];
  /** Official scholarship / funding portals (no figures until verified). */
  funding: SourceRef[];
  /** Ordered application steps. Procedural wording only; figures live in facts. */
  steps: string[];
  /** Official places to research courses and admissions (T1/T2 only). First entry is the headline. */
  admissions: (SourceRef & { short: string })[];
}

export const DESTINATIONS: Destination[] = [
  {
    slug: 'singapore',
    name: 'Singapore',
    inName: 'Singapore',
    code: 'SG',
    currency: 'SGD',
    wave: 0,
    tagline: 'Student’s Pass from ICA, with a job-search pass after graduation.',
    portals: [
      { url: 'https://www.ica.gov.sg/reside/STP', tier: 'T1', title: 'ICA — Student’s Pass' },
      {
        url: 'https://www.mom.gov.sg/passes-and-permits',
        tier: 'T1',
        title: 'MOM — Passes and permits',
      },
    ],
    funding: [{ url: 'https://www.moe.gov.sg', tier: 'T1', title: 'Ministry of Education' }],
    steps: [
      'Receive an offer from a Singapore institution.',
      'Apply for the Student’s Pass through ICA’s SOLAR+ system.',
      'Pay the Student’s Pass fees.',
      'Follow the instructions in your ICA approval before and after arrival.',
    ],
    admissions: [
      { url: 'https://www.nus.edu.sg', tier: 'T2', title: 'National University of Singapore', short: 'NUS' },
      { url: 'https://www.ntu.edu.sg', tier: 'T2', title: 'Nanyang Technological University', short: 'NTU' },
      { url: 'https://www.smu.edu.sg', tier: 'T2', title: 'Singapore Management University', short: 'SMU' },
    ],
  },
  {
    slug: 'usa',
    name: 'United States',
    inName: 'the United States',
    code: 'US',
    currency: 'USD',
    wave: 1,
    tagline: 'F-1 study, with OPT and a STEM extension for eligible degrees.',
    portals: [
      {
        url: 'https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html',
        tier: 'T1',
        title: 'U.S. Department of State — Student visa',
      },
      {
        url: 'https://studyinthestates.dhs.gov',
        tier: 'T1',
        title: 'DHS — Study in the States',
      },
    ],
    funding: [
      {
        url: 'https://studyinthestates.dhs.gov',
        tier: 'T1',
        title: 'Study in the States (DHS)',
      },
    ],
    steps: [
      'Receive admission and the school documents you need for an F-1 application.',
      'Pay the SEVIS fee.',
      'Apply for the F-1 visa and pay the visa fee.',
      'Follow the U.S. embassy or consulate instructions for your appointment.',
    ],
    admissions: [
      { url: 'https://studyinthestates.dhs.gov', tier: 'T1', title: 'Study in the States (DHS)', short: 'Study in the States' },
    ],
  },
  {
    slug: 'uk',
    name: 'United Kingdom',
    inName: 'the United Kingdom',
    code: 'GB',
    currency: 'GBP',
    wave: 1,
    tagline: 'Student visa, and a Graduate Route that changes for applications from 1 Jan 2027.',
    portals: [
      { url: 'https://www.gov.uk/student-visa', tier: 'T1', title: 'GOV.UK — Student visa' },
      { url: 'https://www.ukcisa.org.uk', tier: 'T2', title: 'UKCISA' },
    ],
    funding: [{ url: 'https://www.ukcisa.org.uk', tier: 'T2', title: 'UKCISA — funding guidance' }],
    steps: [
      'Accept an offer from a UK university.',
      'Prepare evidence of maintenance funds.',
      'Apply for the Student visa on GOV.UK and pay the fee.',
    ],
    admissions: [
      {
        url: 'https://www.ukcisa.org.uk',
        tier: 'T2',
        title: 'UKCISA (UK Council for International Student Affairs)',
        short: 'UKCISA',
      },
    ],
  },
  {
    slug: 'canada',
    name: 'Canada',
    inName: 'Canada',
    code: 'CA',
    currency: 'CAD',
    wave: 1,
    tagline: 'Study permits under a national cap, with post-graduation work options.',
    portals: [
      {
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
        tier: 'T1',
        title: 'IRCC — Study permit',
      },
    ],
    funding: [
      {
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html',
        tier: 'T1',
        title: 'IRCC — Study in Canada',
      },
    ],
    steps: [
      'Get a letter of acceptance from a designated learning institution (DLI).',
      'Obtain a provincial or territorial attestation letter (PAL/TAL) unless you are exempt.',
      'Prepare proof of funds and pay the application fees.',
      'Apply for your study permit online with IRCC.',
    ],
    admissions: [
      {
        url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html',
        tier: 'T1',
        title: 'IRCC — Designated learning institutions list',
        short: 'DLI list',
      },
    ],
  },
  {
    slug: 'australia',
    name: 'Australia',
    inName: 'Australia',
    code: 'AU',
    currency: 'AUD',
    wave: 1,
    tagline: 'Subclass 500 student visa with a post-study 485 pathway.',
    portals: [
      {
        url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
        tier: 'T1',
        title: 'Home Affairs — Student visa (subclass 500)',
      },
      { url: 'https://www.studyaustralia.gov.au', tier: 'T1', title: 'Study Australia' },
      { url: 'https://cricos.education.gov.au', tier: 'T1', title: 'CRICOS register' },
    ],
    funding: [
      {
        url: 'https://www.studyaustralia.gov.au',
        tier: 'T1',
        title: 'Study Australia — scholarships',
      },
    ],
    steps: [
      'Choose a course listed on the official CRICOS register and accept your offer.',
      'Prepare evidence of funds.',
      'Apply for the Student visa (subclass 500) online and pay the fee.',
    ],
    admissions: [
      { url: 'https://cricos.education.gov.au', tier: 'T1', title: 'CRICOS register of courses', short: 'CRICOS' },
      { url: 'https://www.studyaustralia.gov.au', tier: 'T1', title: 'Study Australia', short: 'Study Australia' },
    ],
  },
  {
    slug: 'germany',
    name: 'Germany',
    inName: 'Germany',
    code: 'DE',
    currency: 'EUR',
    wave: 2,
    tagline: 'National visa for study, a blocked account for proof of funds, and a post-study job-search permit.',
    portals: [
      { url: 'https://www.auswaertiges-amt.de/en/visa-service', tier: 'T1', title: 'Federal Foreign Office — Visa' },
      { url: 'https://www.make-it-in-germany.com/en/', tier: 'T1', title: 'Make it in Germany' },
      { url: 'https://www.daad.de/en/', tier: 'T2', title: 'DAAD' },
    ],
    funding: [{ url: 'https://www.daad.de/en/', tier: 'T2', title: 'DAAD — scholarship database' }],
    steps: [
      'Receive admission from a German university.',
      'Arrange proof of funds (commonly a blocked account).',
      'Apply for a national (D) visa for study at the German mission responsible for you.',
    ],
    admissions: [{ url: 'https://www.daad.de/en/', tier: 'T2', title: 'DAAD — study programmes in Germany', short: 'DAAD' }],
  },
  {
    slug: 'france',
    name: 'France',
    inName: 'France',
    code: 'FR',
    currency: 'EUR',
    wave: 2,
    tagline: 'Set national fees for non-EU students at public universities, on a VLS-TS visa.',
    portals: [
      { url: 'https://france-visas.gouv.fr', tier: 'T1', title: 'France-Visas' },
      { url: 'https://www.campusfrance.org/en', tier: 'T2', title: 'Campus France' },
    ],
    funding: [{ url: 'https://www.campusfrance.org/en', tier: 'T2', title: 'Campus France — scholarships' }],
    steps: [
      'Apply to programmes (Campus France is the official starting point).',
      'Receive admission and prepare proof of resources.',
      'Apply for the VLS-TS student visa on France-Visas and pay the fee.',
    ],
    admissions: [{ url: 'https://www.campusfrance.org/en', tier: 'T2', title: 'Campus France', short: 'Campus France' }],
  },
  {
    slug: 'ireland',
    name: 'Ireland',
    inName: 'Ireland',
    code: 'IE',
    currency: 'EUR',
    wave: 2,
    tagline: 'D study visa and Stamp 2 permission, with Stamp 1G after graduation.',
    portals: [
      { url: 'https://www.irishimmigration.ie', tier: 'T1', title: 'Irish Immigration Service' },
      { url: 'https://www.educationinireland.com', tier: 'T2', title: 'Education in Ireland' },
    ],
    funding: [{ url: 'https://www.educationinireland.com', tier: 'T2', title: 'Education in Ireland — scholarships' }],
    steps: [
      'Accept an offer on an eligible course.',
      'Prepare evidence of funds.',
      'Apply for a D study visa and pay the fee.',
      'Obtain Stamp 2 immigration permission.',
    ],
    admissions: [
      { url: 'https://www.educationinireland.com', tier: 'T2', title: 'Education in Ireland', short: 'Education in Ireland' },
      { url: 'https://www.qqi.ie', tier: 'T2', title: 'QQI — Quality and Qualifications Ireland', short: 'QQI' },
    ],
  },
  {
    slug: 'new-zealand',
    name: 'New Zealand',
    inName: 'New Zealand',
    code: 'NZ',
    currency: 'NZD',
    wave: 2,
    tagline: 'Fee Paying Student Visa, with a post-study work visa after graduation.',
    portals: [
      { url: 'https://www.immigration.govt.nz', tier: 'T1', title: 'Immigration New Zealand' },
      { url: 'https://www.enz.govt.nz', tier: 'T1', title: 'Education New Zealand' },
    ],
    funding: [{ url: 'https://www.enz.govt.nz', tier: 'T1', title: 'Education New Zealand' }],
    steps: [
      'Receive an offer of place from a New Zealand education provider.',
      'Prepare evidence of funds.',
      'Apply for the Fee Paying Student Visa online.',
    ],
    admissions: [{ url: 'https://www.enz.govt.nz', tier: 'T1', title: 'Education New Zealand', short: 'ENZ' }],
  },
  {
    slug: 'uae',
    name: 'United Arab Emirates',
    inName: 'the United Arab Emirates',
    code: 'AE',
    currency: 'AED',
    wave: 3,
    tagline: 'University-sponsored residence, with a Golden Visa route for top graduates.',
    portals: [
      { url: 'https://u.ae', tier: 'T1', title: 'UAE Government portal (u.ae)' },
      { url: 'https://icp.gov.ae', tier: 'T1', title: 'ICP' },
    ],
    funding: [{ url: 'https://www.moe.gov.ae', tier: 'T1', title: 'Ministry of Education' }],
    steps: [
      'Receive admission from a UAE university.',
      'Your university sponsors your student residence visa.',
      'Follow your university’s instructions to complete the residence visa.',
    ],
    admissions: [
      { url: 'https://www.caa.ae', tier: 'T2', title: 'Commission for Academic Accreditation', short: 'CAA' },
      { url: 'https://www.khda.gov.ae', tier: 'T2', title: 'KHDA (Dubai)', short: 'KHDA' },
    ],
  },
  {
    slug: 'japan',
    name: 'Japan',
    inName: 'Japan',
    code: 'JP',
    currency: 'JPY',
    wave: 3,
    tagline: 'Certificate of Eligibility first, then the Student status of residence.',
    portals: [
      { url: 'https://www.isa.go.jp/en/', tier: 'T1', title: 'Immigration Services Agency' },
      { url: 'https://www.studyinjapan.go.jp/en/', tier: 'T2', title: 'Study in Japan (JASSO)' },
    ],
    funding: [{ url: 'https://www.studyinjapan.go.jp/en/', tier: 'T2', title: 'JASSO — scholarships' }],
    steps: [
      'Receive admission from a Japanese institution.',
      'Obtain a Certificate of Eligibility (CoE).',
      'Apply for the Student visa at a Japanese embassy or consulate with your CoE.',
    ],
    admissions: [{ url: 'https://www.studyinjapan.go.jp/en/', tier: 'T2', title: 'Study in Japan (JASSO)', short: 'JASSO' }],
  },
];

export const DESTINATION_BY_SLUG = Object.fromEntries(DESTINATIONS.map((d) => [d.slug, d])) as Record<
  DestinationSlug,
  Destination
>;

/** India overlay: official starting points only (FR-2). No figures until verified. */
export const INDIA_OFFICIAL_LINKS: (SourceRef & { topic: string })[] = [
  { topic: 'Sending money abroad (remittances)', url: 'https://www.rbi.org.in', tier: 'T1', title: 'Reserve Bank of India' },
  { topic: 'Tax on overseas remittances', url: 'https://www.incometax.gov.in', tier: 'T1', title: 'Income Tax Department' },
  {
    topic: 'Document attestation and apostille',
    url: 'https://www.mea.gov.in',
    tier: 'T1',
    title: 'Ministry of External Affairs',
  },
  { topic: 'Official policy announcements', url: 'https://www.pib.gov.in', tier: 'T1', title: 'Press Information Bureau' },
];
