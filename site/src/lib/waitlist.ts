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
  /** Version of the consent wording the visitor saw. */
  consentVersion?: string;
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
  consent: { given: true; at: string; text: string; version: string };
  source: string;
}

export const CONSENT_TEXT =
  'I agree that Pathfinder may contact me about what I asked for here. I can ask for my details to be deleted at any time.';
/** Version of the consent wording shown to the visitor; the server rejects any other version. */
export const CONSENT_VERSION = '2026-11-21.1';
const LEVELS = ['ug', 'pg', 'phd'] as const;
const PURPOSES = ['waitlist', 'alerts'] as const;

/** Deliberately strict: no quotes, angle brackets, commas or spaces can reach storage or a mailer. Linear-time check. */
function validEmail(e: string): boolean {
  const at = e.indexOf('@');
  if (at < 1 || at !== e.lastIndexOf('@')) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!/^[A-Za-z0-9._%+-]{1,64}$/.test(local) || domain.length > 253) return false;
  const labels = domain.split('.');
  return (
    labels.length >= 2 &&
    labels.slice(0, -1).every((l) => /^[A-Za-z0-9-]{1,63}$/.test(l)) &&
    /^[A-Za-z]{2,24}$/.test(labels[labels.length - 1])
  );
}
/** Indian mobiles: +91 then 10 digits starting 6–9. Other countries: E.164 without the +91 prefix. */
function validPhone(p: string): boolean {
  if (p.startsWith('+91')) return /^\+91[6-9]\d{9}$/.test(p);
  return /^\+[1-9]\d{7,14}$/.test(p);
}
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
  if (!input.who) errors.who = 'Tell us who is signing up.';
  else if (input.who === 'student_under_18')
    errors.who = 'If you’re under 18, please ask a parent or guardian to sign up with their own details.';
  else if (input.who !== 'student' && input.who !== 'parent') errors.who = 'Tell us who is signing up.';

  const email = input.email?.trim() || undefined;
  const whatsapp = input.whatsapp?.trim() ? normalisePhone(input.whatsapp.trim()) : undefined;
  if (!email && !whatsapp) errors.contact = 'Give an email address or a WhatsApp number.';
  if (email && !validEmail(email)) errors.email = 'That email address doesn’t look right.';
  if (whatsapp && !validPhone(whatsapp)) errors.whatsapp = 'Use a mobile number, for example +91 98765 43210.';

  const destinations = [...new Set(input.destinations)].filter((d) => knownDestinations.includes(d));
  if (destinations.length === 0) errors.destinations = 'Pick at least one country.';
  if (input.intake && !INTAKE.test(input.intake)) errors.intake = 'Choose a month and year.';
  if (input.level && !(LEVELS as readonly string[]).includes(input.level)) errors.level = 'Choose a level from the list.';
  if (!(PURPOSES as readonly string[]).includes(input.purpose)) errors.purpose = 'Unknown sign-up type.';
  if (input.consentVersion !== undefined && input.consentVersion !== CONSENT_VERSION)
    errors.consent = 'The consent wording has changed. Please reload the page and try again.';
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
      consent: { given: true, at: now.toISOString(), text: CONSENT_TEXT, version: CONSENT_VERSION },
      source: input.source.slice(0, 200),
    },
  };
}
