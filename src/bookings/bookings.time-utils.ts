type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type TimeInterval = {
  start: Date;
  end: Date;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cacheKey = timeZone.trim();
  const cached = formatterCache.get(cacheKey);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: cacheKey,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  formatterCache.set(cacheKey, formatter);
  return formatter;
}

function extractDateParts(date: Date, timeZone: string): DateParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = extractDateParts(date, timeZone);
  const yyyy = String(parts.year);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = extractDateParts(date, timeZone);
  const asUtcTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtcTimestamp - date.getTime();
}

function splitDate(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map((value) => Number(value));
  return [year, month, day];
}

function splitTime(time: string): [number, number] {
  const normalized = time.length >= 5 ? time.slice(0, 5) : time;
  const [hour, minute] = normalized.split(':').map((value) => Number(value));
  return [hour, minute];
}

export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = splitDate(date);
  const [hour, minute] = splitTime(time);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  const offsetGuess = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let timestamp = utcGuess - offsetGuess;

  const correctedOffset = getTimeZoneOffsetMs(new Date(timestamp), timeZone);
  if (correctedOffset !== offsetGuess) {
    timestamp = utcGuess - correctedOffset;
  }

  return new Date(timestamp);
}

export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = splitDate(date);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getUtcRangeForLocalDate(date: string, timeZone: string): TimeInterval {
  const start = zonedDateTimeToUtc(date, '00:00', timeZone);
  const end = zonedDateTimeToUtc(addDaysToDateString(date, 1), '00:00', timeZone);
  return { start, end };
}

export function getDayOfWeekFromDateString(date: string): number {
  const [year, month, day] = splitDate(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCDay();
}

export function parseTimeToMinutes(value: string): number {
  const [hour, minute] = splitTime(value);
  return hour * 60 + minute;
}

export function sortIntervals(intervals: TimeInterval[]): TimeInterval[] {
  return [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function subtractIntervals(
  sourceIntervals: TimeInterval[],
  busyIntervals: TimeInterval[],
): TimeInterval[] {
  if (sourceIntervals.length === 0) return [];
  if (busyIntervals.length === 0) return [...sourceIntervals];

  const normalizedBusy = sortIntervals(busyIntervals);
  const free: TimeInterval[] = [];

  for (const source of sortIntervals(sourceIntervals)) {
    let cursor = source.start.getTime();
    const sourceEnd = source.end.getTime();

    for (const busy of normalizedBusy) {
      const busyStart = busy.start.getTime();
      const busyEnd = busy.end.getTime();

      if (busyEnd <= cursor) continue;
      if (busyStart >= sourceEnd) break;

      if (busyStart > cursor) {
        free.push({
          start: new Date(cursor),
          end: new Date(Math.min(busyStart, sourceEnd)),
        });
      }

      cursor = Math.max(cursor, busyEnd);
      if (cursor >= sourceEnd) break;
    }

    if (cursor < sourceEnd) {
      free.push({
        start: new Date(cursor),
        end: new Date(sourceEnd),
      });
    }
  }

  return free.filter((interval) => interval.end.getTime() > interval.start.getTime());
}

export function generateSlots(
  intervals: TimeInterval[],
  slotStepMinutes: number,
  requiredDurationMinutes: number,
): Array<{ start_at_utc: Date; end_at_utc: Date }> {
  const stepMs = slotStepMinutes * 60 * 1000;
  const durationMs = requiredDurationMinutes * 60 * 1000;
  const result: Array<{ start_at_utc: Date; end_at_utc: Date }> = [];

  for (const interval of sortIntervals(intervals)) {
    let cursor = interval.start.getTime();
    const end = interval.end.getTime();

    while (cursor + durationMs <= end) {
      result.push({
        start_at_utc: new Date(cursor),
        end_at_utc: new Date(cursor + durationMs),
      });

      cursor += stepMs;
    }
  }

  return result;
}

export function hasOverlappingTimeRanges(
  ranges: Array<{ day_of_week: number; start_time_local: string; end_time_local: string }>,
): boolean {
  const grouped = new Map<number, Array<{ start: number; end: number }>>();

  for (const range of ranges) {
    const start = parseTimeToMinutes(range.start_time_local);
    const end = parseTimeToMinutes(range.end_time_local);

    if (end <= start) return true;

    const arr = grouped.get(range.day_of_week) ?? [];
    arr.push({ start, end });
    grouped.set(range.day_of_week, arr);
  }

  for (const dayRanges of grouped.values()) {
    const sorted = [...dayRanges].sort((a, b) => a.start - b.start);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].start < sorted[index - 1].end) {
        return true;
      }
    }
  }

  return false;
}
