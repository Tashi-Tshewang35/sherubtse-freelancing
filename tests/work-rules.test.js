const assert = require('node:assert/strict');
const { dateInput } = require('../config/workRules');

test('job dates reject impossible dates and preserve Bhutan time', () => {
  for (const value of ['2030-02-30T12:00', '2030-02-29T12:00', '2030-04-31T09:00',
    '2030-01-01T24:00', '2030-13-01T12:00', '', null, ['2030-01-01T12:00']]) {
    assert.equal(dateInput(value), null, String(value));
  }
  assert.equal(dateInput('2032-02-29T12:00'), '2032-02-29T06:00:00.000Z');
  assert.equal(dateInput('2030-01-01T00:00'), '2029-12-31T18:00:00.000Z');
});
