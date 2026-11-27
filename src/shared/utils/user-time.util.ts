// eslint-disable-next-line @typescript-eslint/no-var-requires
const moment = require('moment-timezone');

/**
 * Wall-clock times stored in the user's own timezone (users.timezone).
 *
 * `users.verification_code_expiry` is a DATETIME without zone information.
 * It is written as the user's local wall-clock time and always read back
 * together with `users.timezone`, so the stored value matches what the user
 * sees on their own clock. Every writer must also store the zone it used.
 */
const FORMAT = 'YYYY-MM-DD HH:mm:ss';
/** `users.timezone` is VARCHAR(20); longer IANA names fall back to UTC. */
const MAX_ZONE_LENGTH = 20;

/** A valid IANA zone that fits the column, otherwise 'UTC'. */
export function resolveUserZone(tz?: string | null): string {
  const z = (tz ?? '').trim();
  return z && z.length <= MAX_ZONE_LENGTH && moment.tz.zone(z) ? z : 'UTC';
}

/** "now + minutes" as wall-clock time in `zone` (pass a resolved zone). */
export function wallClockAfterMinutes(minutes: number, zone: string): string {
  return moment.tz(resolveUserZone(zone)).add(minutes, 'minutes').format(FORMAT);
}

/**
 * True when a stored wall-clock time (in `zone`) is in the past or missing.
 * mysql2 returns DATETIME values as Dates built in the server's local zone,
 * so formatting with local getters recovers the stored wall-clock text.
 */
export function isWallClockPast(stored: Date | string | null | undefined, zone: string | null | undefined): boolean {
  if (!stored) return true;
  const wall = stored instanceof Date ? moment(stored).format(FORMAT) : String(stored);
  const at = moment.tz(wall, FORMAT, resolveUserZone(zone));
  return !at.isValid() || at.isBefore(moment());
}
