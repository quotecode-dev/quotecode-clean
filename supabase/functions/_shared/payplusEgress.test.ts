// Owner 2026-10-23: every PayPlus call through the fixed-IP relay (PAYPLUS_PROXY_URL); no secret = direct as before; a bad secret = a clear
// failure, never a silent direct call.
import { describe, it, expect, vi } from 'vitest';
import { proxyOptions, payplusEgress } from './payplusEgress.ts';

describe('the PayPlus relay', () => {
  it('reads the relay URL: host and port apart from the (decoded) credentials', () => {
    expect(proxyOptions('http://fixie:p%40ss@criterium.usefixie.com:80')).toEqual({ url: 'http://criterium.usefixie.com:80', basicAuth: { username: 'fixie', password: 'p@ss' } });
    expect(proxyOptions('https://relay.example.com:9293')).toEqual({ url: 'https://relay.example.com:9293' });
    for (const bad of ['', '   ', 'not a url', 'socks5://x:1080', 'ftp://h']) expect(proxyOptions(bad)).toBe(null);
  });

  it('no secret: the plain fetch, exactly as before', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const create = vi.fn();
    const e = payplusEgress(undefined, create, base);
    expect(e.via).toBe('direct');
    await e.fetch('https://restapi.payplus.co.il/x', { method: 'POST' });
    expect(base).toHaveBeenCalledWith('https://restapi.payplus.co.il/x', { method: 'POST' });
    expect(create).not.toHaveBeenCalled();
  });

  it('a secret: one relay client for the invocation, passed to every call, closed at the end', async () => {
    const client = { close: vi.fn() };
    const create = vi.fn(() => client);
    const base = vi.fn(async () => new Response('ok'));
    const e = payplusEgress('http://u:p@relay.example.com:80', create, base);
    expect(e.via).toBe('relay');
    await e.fetch('https://restapi.payplus.co.il/a', { method: 'POST' });
    await e.fetch('https://restapi.payplus.co.il/b');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ proxy: { url: 'http://relay.example.com:80', basicAuth: { username: 'u', password: 'p' } } });
    expect(base.mock.calls.every((c) => (c[1] as { client?: unknown }).client === client)).toBe(true);
    e.close();
    expect(client.close).toHaveBeenCalled();
  });

  it('a bad secret: every call fails clearly - never a silent direct call', async () => {
    const base = vi.fn();
    const e = payplusEgress('relay.example.com', vi.fn(), base);
    expect(e.via).toBe('relay_misconfigured');
    await expect(e.fetch('https://restapi.payplus.co.il/x')).rejects.toThrow('relay_misconfigured');
    expect(base).not.toHaveBeenCalled();
  });
});

// Codex review 2026-10-23 R-05: a malformed percent escape in the relay credentials is a misconfiguration, never a throw
describe('the relay secret with a malformed escape', () => {
  it('is relay_misconfigured, and every call fails clearly', async () => {
    expect(proxyOptions('http://fixie:%E0%A4%A@relay.example.com:80')).toBe(null);
    const e = payplusEgress('http://fixie:%E0%A4%A@relay.example.com:80', vi.fn(), vi.fn());
    expect(e.via).toBe('relay_misconfigured');
    await expect(e.fetch('https://restapi.payplus.co.il/x')).rejects.toThrow('relay_misconfigured');
  });
});
