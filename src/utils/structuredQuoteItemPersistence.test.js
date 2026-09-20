import { describe, it, expect } from 'vitest';
import { isUntouchedPlaceholderItem, excludeUntouchedPlaceholderItems } from './structuredQuoteItemPersistence';

const DEFAULT_SEED_ITEM = { description: '', quantity: '1', unit_price: '' };

describe('isUntouchedPlaceholderItem', () => {
  it('excludes the untouched default blank placeholder', () => {
    expect(isUntouchedPlaceholderItem(DEFAULT_SEED_ITEM)).toBe(true);
  });

  it('excludes the default placeholder even with isFromCatalog explicitly false', () => {
    expect(isUntouchedPlaceholderItem({ ...DEFAULT_SEED_ITEM, isFromCatalog: false })).toBe(true);
  });

  it('preserves a meaningful description with zero price', () => {
    expect(isUntouchedPlaceholderItem({ description: 'Free consultation', quantity: '1', unit_price: '0' })).toBe(false);
  });

  it('preserves an intentional zero-value line with numeric zero price', () => {
    expect(isUntouchedPlaceholderItem({ description: 'Goodwill gesture', quantity: '1', unit_price: 0 })).toBe(false);
  });

  it('preserves a real unassigned item with a description', () => {
    expect(isUntouchedPlaceholderItem({ description: 'Miscellaneous supplies', quantity: '2', unit_price: '30', section_key: null })).toBe(false);
  });

  it('preserves a sectioned real item even if otherwise blank-looking', () => {
    expect(isUntouchedPlaceholderItem({ description: '', quantity: '1', unit_price: '', section_key: 'section-1' })).toBe(false);
  });

  it('preserves a measurement-bearing item', () => {
    expect(isUntouchedPlaceholderItem({
      description: '',
      quantity: '1',
      unit_price: '',
      measurements: [{ width: '1.2', height: '0.8' }],
    })).toBe(false);
  });

  it('preserves a normal non-empty item', () => {
    expect(isUntouchedPlaceholderItem({ description: 'Installation', quantity: '3', unit_price: '100' })).toBe(false);
  });

  it('preserves a catalog-selected item even before further edits', () => {
    expect(isUntouchedPlaceholderItem({ description: 'Catalog Service', quantity: '1', unit_price: '500', isFromCatalog: true })).toBe(false);
  });

  it('preserves an already-persisted item (has an id) regardless of blank content', () => {
    expect(isUntouchedPlaceholderItem({ id: 'existing-item-id', description: '', quantity: '1', unit_price: '' })).toBe(false);
  });

  it('preserves an item with a professional pricing_unit even if description is blank', () => {
    expect(isUntouchedPlaceholderItem({ description: '', quantity: '1', unit_price: '', pricing_unit: 'm2' })).toBe(false);
  });

  it('preserves an item with specification rows', () => {
    expect(isUntouchedPlaceholderItem({
      description: '',
      quantity: '1',
      unit_price: '',
      specification: [{ label: 'Color', value: 'Blue' }],
    })).toBe(false);
  });

  it('preserves an item whose quantity was changed from the default', () => {
    expect(isUntouchedPlaceholderItem({ description: '', quantity: '5', unit_price: '' })).toBe(false);
  });

  it('handles null/undefined input safely', () => {
    expect(isUntouchedPlaceholderItem(null)).toBe(false);
    expect(isUntouchedPlaceholderItem(undefined)).toBe(false);
  });
});

describe('excludeUntouchedPlaceholderItems', () => {
  it('removes only the untouched placeholder from a mixed array', () => {
    const items = [
      DEFAULT_SEED_ITEM,
      { description: 'Real item', quantity: '1', unit_price: '100', section_key: 'sec-1' },
    ];
    const result = excludeUntouchedPlaceholderItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Real item');
  });

  it('preserves array order for surviving items', () => {
    const items = [
      { description: 'First', quantity: '1', unit_price: '10' },
      DEFAULT_SEED_ITEM,
      { description: 'Second', quantity: '1', unit_price: '20' },
    ];
    const result = excludeUntouchedPlaceholderItems(items);
    expect(result.map((i) => i.description)).toEqual(['First', 'Second']);
  });

  it('returns an empty array when every item is the untouched placeholder', () => {
    expect(excludeUntouchedPlaceholderItems([DEFAULT_SEED_ITEM])).toEqual([]);
  });

  it('passes through non-array input unchanged', () => {
    expect(excludeUntouchedPlaceholderItems(null)).toBe(null);
    expect(excludeUntouchedPlaceholderItems(undefined)).toBe(undefined);
  });
});
