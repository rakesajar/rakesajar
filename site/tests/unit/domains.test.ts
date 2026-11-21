import { describe, expect, it } from 'vitest';
import { classifyUrl, filterAllowed, hostMatches, hostOf, normaliseHost, searchDomainFilter } from '../../src/lib/domains';

describe('allowlist domain filter (DS-1, DS-2, EV-6)', () => {
  it('accepts official domains and their subdomains with the right tier', () => {
    expect(classifyUrl('https://www.gov.uk/student-visa', ['uk'])).toMatchObject({ allowed: true, tier: 'T1' });
    expect(classifyUrl('https://www.ox.ac.uk/admissions', ['uk'])).toMatchObject({ allowed: true, tier: 'T2' });
    expect(classifyUrl('https://immi.homeaffairs.gov.au/x', ['australia'])).toMatchObject({ allowed: true, tier: 'T1' });
    expect(classifyUrl('https://international.mit.edu', ['usa'])).toMatchObject({ allowed: true, tier: 'T2' });
  });

  it.each([
    'https://gov.uk.example.com/student-visa',
    'https://www.gov.uk-visa.com',
    'https://evilgov.uk',
    'https://uscis.gov-verify.com',
    'https://uscis.gov.evil.net',
    'https://travel-state-gov.com',
    'https://xn--gv-uk-9ra.com',
  ])('rejects look-alike domain %s', (url) => {
    expect(classifyUrl(url, ['uk', 'usa']).allowed).toBe(false);
  });

  it('rejects non-HTTPS, credentials, ports, IPs and garbage', () => {
    expect(classifyUrl('http://www.gov.uk', ['uk']).reason).toMatch(/HTTPS/);
    expect(classifyUrl('https://user:pw@www.gov.uk', ['uk']).reason).toMatch(/Credentials/);
    expect(classifyUrl('https://www.gov.uk:8443/', ['uk']).reason).toMatch(/port/);
    expect(classifyUrl('https://10.0.0.1/', ['uk']).allowed).toBe(false);
    expect(classifyUrl('not a url', ['uk']).reason).toMatch(/valid/);
  });

  it('scopes by destination: a UK domain is not trusted for Canada', () => {
    expect(classifyUrl('https://www.gov.uk', ['canada']).allowed).toBe(false);
  });

  it('suffix patterns need a label before the suffix', () => {
    expect(hostMatches('edu', '*.edu')).toBe(false);
    expect(hostMatches('harvard.edu', '*.edu')).toBe(true);
    expect(hostMatches('x.edu.au', '*.edu')).toBe(false);
  });

  it('normalises hosts and rejects punycode', () => {
    expect(normaliseHost('WWW.GOV.UK.')).toBe('www.gov.uk');
    expect(normaliseHost('xn--80ak6aa92e.com')).toBeNull();
    expect(normaliseHost('')).toBeNull();
  });

  it('drops non-allowlisted results before use', () => {
    const results = [{ url: 'https://www.gov.uk/a' }, { url: 'https://someblog.com/b' }, { url: 'https://reddit.com/r' }];
    expect(filterAllowed(results, ['uk'])).toEqual([{ url: 'https://www.gov.uk/a' }]);
  });

  it('builds a search filter for the scope', () => {
    const filter = searchDomainFilter(['singapore', 'india']);
    expect(filter).toContain('ica.gov.sg');
    expect(filter).toContain('rbi.org.in');
    expect(filter).not.toContain('gov.uk');
  });

  it('extracts a display host', () => {
    expect(hostOf('https://www.gov.uk/x')).toBe('gov.uk');
    expect(hostOf('nope')).toBe('nope');
  });
});
