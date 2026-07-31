import { computeChangedFields, pickChanged } from './change-detection.util';

describe('computeChangedFields', () => {
  it('detects scalar changes', () => {
    const changed = computeChangedFields({ age: 27, city: 'Dallas' }, { age: 29, city: 'Houston' });
    expect(changed.sort()).toEqual(['age', 'city']);
  });

  it('ignores unchanged fields', () => {
    const changed = computeChangedFields({ age: 27, city: 'Dallas' }, { age: 27, city: 'Houston' });
    expect(changed).toEqual(['city']);
  });

  it('treats added / removed keys as changes', () => {
    expect(computeChangedFields({ a: 1 }, { a: 1, b: 2 })).toEqual(['b']);
    expect(computeChangedFields({ a: 1, b: 2 }, { a: 1 })).toEqual(['b']);
  });

  it('deep-compares nested objects', () => {
    expect(computeChangedFields({ p: { x: 1 } }, { p: { x: 1 } })).toEqual([]);
    expect(computeChangedFields({ p: { x: 1 } }, { p: { x: 2 } })).toEqual(['p']);
  });

  it('handles null/undefined snapshots', () => {
    expect(computeChangedFields(null, null)).toEqual([]);
    expect(computeChangedFields(null, { a: 1 })).toEqual(['a']);
  });
});

describe('pickChanged', () => {
  it('reduces a snapshot to only the changed keys', () => {
    expect(pickChanged({ age: 29, city: 'Houston', religion: 'x' }, ['age', 'city'])).toEqual({
      age: 29,
      city: 'Houston',
    });
  });

  it('returns null when nothing matches', () => {
    expect(pickChanged({ a: 1 }, ['b'])).toBeNull();
    expect(pickChanged(null, ['a'])).toBeNull();
  });
});
