type CalendarDate = { year: number; month: number; day: number };

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function parseDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError(`Invalid ISO date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }
  return { year, month, day };
}

function formatDate({ year, month, day }: CalendarDate): string {
  if (year > 9999) throw new RangeError('Date exceeds supported calendar range');
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Adds calendar months, clamping the day to the last day of the destination month. */
export function addMonths(date: string, months: number): string {
  const current = parseDate(date);
  if (!Number.isSafeInteger(months) || months < 0) throw new RangeError('Invalid month count');
  const total = (current.year - 1) * 12 + current.month - 1 + months;
  const year = Math.floor(total / 12) + 1;
  const month = (total % 12) + 1;
  return formatDate({ year, month, day: Math.min(current.day, daysInMonth(year, month)) });
}

/** Number of days in the month containing an ISO calendar date. */
export function monthLength(date: string): number {
  const { year, month } = parseDate(date);
  return daysInMonth(year, month);
}

/** Adds weekdays after the given day, counting Monday through Friday without a holiday calendar. */
export function addWeekdays(date: string, count: number): string {
  const current = parseDate(date);
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid weekday count');
  for (let remaining = count; remaining > 0;) {
    current.day += 1;
    if (current.day > daysInMonth(current.year, current.month)) {
      current.day = 1;
      current.month += 1;
      if (current.month > 12) {
        current.month = 1;
        current.year += 1;
      }
    }
    // Gregorian weekday: 0 is Sunday, 6 is Saturday.
    const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    const y = current.year - (current.month < 3 ? 1 : 0);
    const weekday =
      (y +
        Math.floor(y / 4) -
        Math.floor(y / 100) +
        Math.floor(y / 400) +
        (offsets[current.month - 1] ?? 0) +
        current.day) %
      7;
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return formatDate(current);
}
