// eslint-disable-next-line @typescript-eslint/no-var-requires
const moment = require('moment-timezone');
import { isWallClockPast, resolveUserZone, wallClockAfterMinutes } from './user-time.util';

describe('user-time.util', () => {
  it('resolveUserZone keeps valid short IANA zones and falls back to UTC', () => {
    expect(resolveUserZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(resolveUserZone('America/Chicago')).toBe('America/Chicago');
    expect(resolveUserZone('Not/AZone')).toBe('UTC');
    expect(resolveUserZone('')).toBe('UTC');
    expect(resolveUserZone(null)).toBe('UTC');
    expect(resolveUserZone('America/Argentina/Buenos_Aires')).toBe('UTC'); // longer than the VARCHAR(20) column
  });

  it('wallClockAfterMinutes is the user’s local wall-clock time + N minutes', () => {
    const s = wallClockAfterMinutes(15, 'Asia/Kolkata');
    const expected = moment.tz('Asia/Kolkata').add(15, 'minutes');
    const got = moment.tz(s, 'YYYY-MM-DD HH:mm:ss', 'Asia/Kolkata');
    expect(Math.abs(got.diff(expected, 'seconds'))).toBeLessThanOrEqual(2);
  });

  it('a fresh 15-minute expiry is not past in its own zone, in every zone', () => {
    for (const z of ['Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'UTC']) {
      expect(isWallClockPast(wallClockAfterMinutes(15, z), z)).toBe(false);
    }
  });

  it('an expiry 1 minute ago is past', () => {
    expect(isWallClockPast(wallClockAfterMinutes(-1, 'Asia/Kolkata'), 'Asia/Kolkata')).toBe(true);
  });

  it('reads DATETIME values returned as server-local Dates (mysql2 default)', () => {
    const wall = wallClockAfterMinutes(15, 'Asia/Kolkata');
    const asMysqlReturnsIt = moment(wall, 'YYYY-MM-DD HH:mm:ss').toDate(); // local Date with the same wall-clock
    expect(isWallClockPast(asMysqlReturnsIt, 'Asia/Kolkata')).toBe(false);
  });

  it('missing expiry counts as expired', () => {
    expect(isWallClockPast(null, 'UTC')).toBe(true);
  });
});
