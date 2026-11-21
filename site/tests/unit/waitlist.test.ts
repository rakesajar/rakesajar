import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT, normalisePhone, validateSignup, type SignupInput } from '../../src/lib/waitlist';

const KNOWN = ['uk', 'canada', 'australia'];
const base: SignupInput = {
  who: 'parent',
  email: 'Parent@Example.com',
  destinations: ['uk'],
  purpose: 'waitlist',
  consent: true,
  source: '/plans',
};

describe('waitlist sign-up validation', () => {
  it('accepts a parent with email and records consent with its time and wording', () => {
    const r = validateSignup(base, KNOWN, new Date('2026-11-21T10:00:00Z'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.record.email).toBe('parent@example.com');
    expect(r.record.consent).toEqual({ given: true, at: '2026-11-21T10:00:00.000Z', text: CONSENT_TEXT });
  });

  it('never accepts details from a student under 18', () => {
    const r = validateSignup({ ...base, who: 'student_under_18' }, KNOWN);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.who).toMatch(/parent or guardian/);
  });

  it('requires consent, a contact and a known country', () => {
    const r = validateSignup({ ...base, consent: false, email: '', whatsapp: '', destinations: ['mars'] }, KNOWN);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['consent', 'contact', 'destinations']);
  });

  it('normalises Indian WhatsApp numbers and rejects junk', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
    expect(normalisePhone('098765-43210')).toBe('+919876543210');
    expect(validateSignup({ ...base, email: '', whatsapp: '98765 43210' }, KNOWN).ok).toBe(true);
    expect(validateSignup({ ...base, email: '', whatsapp: '12345' }, KNOWN).ok).toBe(false);
    expect(validateSignup({ ...base, email: 'not-an-email' }, KNOWN).ok).toBe(false);
  });

  it('validates the intake month and drops unknown countries', () => {
    expect(validateSignup({ ...base, intake: '2027-09' }, KNOWN).ok).toBe(true);
    expect(validateSignup({ ...base, intake: 'next year' }, KNOWN).ok).toBe(false);
    const r = validateSignup({ ...base, destinations: ['uk', 'mars', 'uk'] }, KNOWN);
    expect(r.ok && r.record.destinations).toEqual(['uk']);
  });
});
