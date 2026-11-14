import { describe, expect, it } from 'vitest';
import { parseNaturalLanguageGearList } from './smartEntry';

describe('parseNaturalLanguageGearList', () => {
  it('returns empty array for empty or whitespace string', () => {
    expect(parseNaturalLanguageGearList('')).toEqual([]);
    expect(parseNaturalLanguageGearList('   \n  \t ')).toEqual([]);
  });

  it('parses single item without explicit quantity as 1', () => {
    const items = parseNaturalLanguageGearList('whistle');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'Whistle',
      quantity: 1,
      category: 'OFFICIATING',
      target: 'SHARED',
    });
  });

  it('parses quantities with various notations', () => {
    const input = '2 match balls, 15x training bibs, 4 pairs of goalie gloves, a pair of socks';
    const items = parseNaturalLanguageGearList(input);

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ name: 'Match balls', quantity: 2, category: 'BALLS' });
    expect(items[1]).toMatchObject({ name: 'Training bibs', quantity: 15, category: 'APPAREL' });
    expect(items[2]).toMatchObject({ name: 'Goalie gloves', quantity: 4, category: 'PROTECTION' });
    expect(items[3]).toMatchObject({ name: 'Socks', quantity: 1, category: 'APPAREL' });
  });

  it('handles multiline and mixed delimiter inputs', () => {
    const input = `
      First aid kit;
      10 cones and water cooler
      water bottles
    `;
    const items = parseNaturalLanguageGearList(input);

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({ name: 'First aid kit', quantity: 1, category: 'MEDICAL' });
    expect(items[1]).toMatchObject({ name: 'Cones', quantity: 10, category: 'TRAINING' });
    expect(items[2]).toMatchObject({ name: 'Water cooler', quantity: 1, category: 'HYDRATION' });
    expect(items[3]).toMatchObject({ name: 'Water bottles', quantity: 1, category: 'HYDRATION' });
  });

  it('strips leading articles like "the", "a", "an"', () => {
    const input = 'a whistle, the first aid kit, an orange cone';
    const items = parseNaturalLanguageGearList(input);

    expect(items[0].name).toBe('Whistle');
    expect(items[1].name).toBe('First aid kit');
    expect(items[2].name).toBe('Orange cone');
  });
});
