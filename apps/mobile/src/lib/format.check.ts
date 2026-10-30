// Self-check from docs/09 §8.4. Run: npm run check:format
import assert from 'node:assert/strict';
import * as f from './format';
const now = new Date('2026-10-29T12:12:00Z'); // 5:42 pm IST
assert.equal(f.formatINR(350000), '₹3,500');
assert.equal(f.formatINR(250050), '₹2,500.50');
assert.equal(f.formatINR(12345678900), '₹12,34,56,789');
assert.equal(f.formatDateTime(now, now), '29 Oct, 5:42 pm');
assert.equal(f.formatRelative(new Date(now.getTime() - 4 * 60_000), now), '4 min ago');
assert.equal(f.formatRelative(new Date('2026-10-28T12:40:00Z'), now), 'Yesterday, 6:10 pm');
assert.equal(f.formatRelative(new Date(now.getTime() + 8 * 60_000), now), 'In 8 min');
assert.equal(f.formatCountdown(521_000), '8:41');
assert.equal(f.formatPeriod('2026-10'), 'October 2026');
assert.equal(f.flatLabel('A', '101'), 'A-101');
assert.equal(f.maskPhone('9876543210'), '+91 ••••• 43210');
assert.equal(f.istDay(0, new Date('2026-10-29T19:00:00Z')).key, '2026-10-30'); // 00:30 IST next day
assert.equal(f.formatWeekdayDate(now), 'Thursday, 29 Oct');
assert.equal(f.greeting(now), 'Good evening');
assert.equal(f.isNightIST(now), false); // 5:42 pm
assert.equal(f.isNightIST(new Date('2026-10-29T13:30:00Z')), true); // 7:00 pm
assert.equal(f.isNightIST(new Date('2026-10-29T00:29:00Z')), true); // 5:59 am
assert.equal(f.isNightIST(new Date('2026-10-29T00:30:00Z')), false); // 6:00 am
console.log('format.ts: all checks passed');
