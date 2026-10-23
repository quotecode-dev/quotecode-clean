import { describe, it, expect } from 'vitest';
import { sortQuotes, getQuoteStatusKey, getQuoteActionKind, isQuoteHot, STATUS_ORDER, ACTION_ORDER, normalizeSortField } from './quoteListSort';

const q = (id, over = {}) => ({ id, status: 'sent', total: 10, view_count: 0, created_at: '2026-01-01T00:00:00.000Z', clients: { company_name: id }, ...over });
const ids = (list) => list.map((x) => x.id);

describe('quoteListSort', () => {
  it('documents the logical status and action orders', () => {
    expect(STATUS_ORDER).toEqual(['unfinished', 'needs-sending', 'sent', 'hot', 'expired', 'approved', 'paid']);
    expect(ACTION_ORDER).toEqual(['track', 'edit', 'open', 'view']);
  });

  it('derives the same hot / status / action the row shows', () => {
    expect(isQuoteHot(q('a', { view_count: 3 }))).toBe(true);
    expect(isQuoteHot(q('a', { view_count: 3, status: 'APPROVED' }))).toBe(false);
    expect(getQuoteStatusKey(q('a', { status: 'draft', total: 0 }))).toBe('unfinished');
    expect(getQuoteStatusKey(q('a', { status: 'draft', total: 5 }))).toBe('needs-sending');
    expect(getQuoteStatusKey(q('a', { status: 'sent', view_count: 4 }))).toBe('hot');
    expect(getQuoteActionKind(q('a', { status: 'draft', total: 0 }))).toBe('edit');
    expect(getQuoteActionKind(q('a', { status: 'sent', view_count: 4 }))).toBe('track');
    expect(getQuoteActionKind(q('a', { status: 'paid' }))).toBe('view');
    expect(getQuoteActionKind(q('a', { status: 'sent' }))).toBe('open');
  });

  it('sorts quote numbers numerically (A100739 > A100738) and never mutates the input', () => {
    const input = [q('x', { quote_number: 100738 }), q('y', { quote_number: 100739 }), q('z', { quote_number: 99 })];
    const copy = [...input];
    expect(ids(sortQuotes(input, 'id', 'asc'))).toEqual(['z', 'x', 'y']);
    expect(ids(sortQuotes(input, 'id', 'desc'))).toEqual(['y', 'x', 'z']);
    expect(input).toEqual(copy);
  });

  it('collates text with numeric awareness and amounts/views as numbers', () => {
    const names = ['client 10', 'client 2', 'Client 1'].map((n) => q(n, { clients: { company_name: n } }));
    expect(ids(sortQuotes(names, 'client', 'asc'))).toEqual(['Client 1', 'client 2', 'client 10']);
    const nums = [q('a', { total: 1200 }), q('b', { total: 9 }), q('c', { total: 100 })];
    expect(ids(sortQuotes(nums, 'total', 'asc'))).toEqual(['b', 'c', 'a']);
    const views = [q('a', { view_count: 40 }), q('b', { view_count: 5 })];
    expect(ids(sortQuotes(views, 'views', 'asc'))).toEqual(['b', 'a']);
  });

  it('treats the mobile "date" field as the created_at timestamp column', () => {
    expect(normalizeSortField('date')).toBe('created_at');
    const list = [q('new', { created_at: '2026-03-01T00:00:00.000Z' }), q('old', { created_at: '2026-01-01T00:00:00.000Z' })];
    expect(ids(sortQuotes(list, 'date', 'asc'))).toEqual(['old', 'new']);
  });

  it('is stable in both directions (ties keep the incoming order)', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => q(id, { total: 5 }));
    expect(ids(sortQuotes(list, 'total', 'asc'))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(sortQuotes(list, 'total', 'desc'))).toEqual(['a', 'b', 'c', 'd']);
  });
});
