import { describe, expect, it } from 'vitest';
import { addMonths, addWeekdays, monthLength } from './calendar';

describe('lease calendar', () => {
  it('clamps month ends including leap years', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(monthLength('2028-02-01')).toBe(29);
  });

  it('counts weekdays after the date, without a public-holiday calendar', () => {
    expect(addWeekdays('2026-11-05', 5)).toBe('2026-11-12');
    expect(addWeekdays('2026-11-06', 1)).toBe('2026-11-09');
    expect(addWeekdays('2026-12-25', 0)).toBe('2026-12-25');
  });

  it('rejects invalid dates and intervals', () => {
    expect(() => addMonths('2026-02-29', 1)).toThrow(RangeError);
    expect(() => addWeekdays('2026-13-01', 1)).toThrow(RangeError);
    expect(() => addMonths('2026-01-01', -1)).toThrow(RangeError);
  });
});
