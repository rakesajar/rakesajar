/**
 * Waitlist and change-alert sign-ups (idea 4). Pure validation shared by the form and the reference handler.
 *
 * Data protection (India DPDP Act and Rules): we collect the minimum needed to contact someone about what they
 * asked for, record explicit consent and its time, and never collect a minor's details. A student under 18 is asked
 * to have a parent or guardian sign up instead, so no verifiable-parental-consent flow is needed.
 */

export type Who = 'student' | 'parent' | 'student_under_18';
export type Purpose = 'waitlist' | 'alerts';

export interface SignupInput {
  who: Who;
  email?: string;
  whatsapp?: string;
  destinations: string[];
  level?: 'ug' | 'pg' | 'phd' | '';
  intake?: string;
  purpose: Purpose;
  consent: boolean;
  /** Page the sign-up came from. */
  source: string;
}

export interface SignupRecord {
  who: 'student' | 'parent';
  email?: string;
  whatsapp?: string;
  destinations: string[];
  level?: 'ug' | 'pg' | 'phd';
  intake?: string;
  purpose: Purpose;
  consent: { given: true; at: string; text: string };
  source: string;
}

export const CONSENT_TEXT =
  'I agree that Pathfinder may contact me about what I asked for here. I can ask for my details to be deleted at any time.';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,24}$/i;
/** International format; Indian mobiles are +91 followed by 10 digits starting 6–9. */
const PHONE = /^\+(91[6-9]\d{9}|[1-9]\d{7,14})$/;
const INTAKE = /^20\d{2}-(0[1-9]|1[0-2])$/;

export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[\s()-]/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return '+91' + digits;
  if (/^0[6-9]\d{9}$/.test(digits)) return '+91' + digits.slice(1);
  if (/^91[6-9]\d{9}$/.test(digits)) return '+' + digits;
  return digits;
}

export function validateSignup(
  input: SignupInput,
  knownDestinations: readonly string[],
  now = new Date(),
): { ok: true; record: SignupRecord } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (input.who === 'student_under_18')
    errors.who = 'If you’re under 18, please ask a parent or guardian to sign up with their own details.';
  else if (input.who !== 'student' && input.who !== 'parent') errors.who = 'Tell us who is signing up.';

  const email = input.email?.trim() || undefined;
  const whatsapp = input.whatsapp?.trim() ? normalisePhone(input.whatsapp.trim()) : undefined;
  if (!email && !whatsapp) errors.contact = 'Give an email address or a WhatsApp number.';
  if (email && !EMAIL.test(email)) errors.email = 'That email address doesn’t look right.';
  if (whatsapp && !PHONE.test(whatsapp)) errors.whatsapp = 'Use a mobile number, for example +91 98765 43210.';

  const destinations = [...new Set(input.destinations)].filter((d) => knownDestinations.includes(d));
  if (destinations.length === 0) errors.destinations = 'Pick at least one country.';
  if (input.intake && !INTAKE.test(input.intake)) errors.intake = 'Choose a month and year.';
  if (!input.consent) errors.consent = 'We need your agreement before we can contact you.';
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    record: {
      who: input.who as 'student' | 'parent',
      ...(email ? { email: email.toLowerCase() } : {}),
      ...(whatsapp ? { whatsapp } : {}),
      destinations,
      ...(input.level ? { level: input.level } : {}),
      ...(input.intake ? { intake: input.intake } : {}),
      purpose: input.purpose,
      consent: { given: true, at: now.toISOString(), text: CONSENT_TEXT },
      source: input.source.slice(0, 200),
    },
  };
}
