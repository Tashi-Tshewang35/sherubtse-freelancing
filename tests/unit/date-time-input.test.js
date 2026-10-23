const { normalize, display } = require('../../public/js/dateTimeInput');
const { dateInput } = require('../../config/workRules');
const { isValidWorkRange } = require('../../utils/validators');
test.each([
  ['23/10/2026 02:30 PM', '2026-10-23T14:30'],
  ['23/10/2026 12:00 AM', '2026-10-23T00:00'],
  ['23/10/2026 12:00 PM', '2026-10-23T12:00'],
  ['29/02/2028 09:05 am', '2028-02-29T09:05'],
  ['2026-10-23T14:30', '2026-10-23T14:30'],
])('parses %s without browser locale ambiguity', (value, expected) => expect(normalize(value)).toBe(expected));
test.each(['31/02/2026 02:30 PM','02/13/2026 02:30 PM','23/10/2026 00:30 PM','23/10/2026 13:30 PM','23/10/2026 02:60 PM','10/23/2026 02:30 PM'])('rejects invalid or month-first input %s', value => expect(dateInput(value)).toBeNull());
test('converts the displayed time to the correct Bhutan instant', () => {
  expect(dateInput('23/10/2026 02:30 PM')).toBe('2026-10-23T08:30:00.000Z');
  expect(display('2026-10-23T08:30:00Z')).toBe('23/10/2026 02:30 PM');
  expect(isValidWorkRange('31/10/2026 11:30 PM','01/11/2026 12:30 AM')).toBe(true);
});
