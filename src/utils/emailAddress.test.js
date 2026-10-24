// Owner 2026-10-25 (typed L-12): the permissive e-mail check accepts every real ending and still refuses what is clearly not an address
import { describe, it, expect } from 'vitest';
import { isValidEmailAddress } from './emailAddress';

describe('isValidEmailAddress', () => {
  it.each(['a@012.net.il', 'moshe@zahav.net.il', 'x@netvision.net.il', 'st@tau.ac.il', 'info@amuta.org.il', 'm@city.muni.il', 'ops@gov.il',
    'jo@shop.co.uk', 'h@firma.de', 'p@site.fr', 'a@x.eu', 'b@y.ca', 'c@z.com.au', 'dev@app.dev', 'hi@studio.ai', 'name.surname+tag@gmail.com',
    '  spaced@gmail.com  ', 'x@sub.domain-1.co.il'])('accepts %s', (e) => { expect(isValidEmailAddress(e)).toBe(true); });
  it.each(['', '   ', 'no-at.com', 'a@b', 'a@b.c', 'a@@b.com', 'a b@c.com', 'a@b .com', 'a@-b.com', 'a@b-.com', 'a@b..com', '@b.com', 'a@.com', 'a@b.123', null, undefined, 5])('refuses %s', (e) => { expect(isValidEmailAddress(e)).toBe(false); });
});
