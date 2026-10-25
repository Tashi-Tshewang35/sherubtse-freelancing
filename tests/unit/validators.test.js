const validators = require('../../utils/validators');

describe('Sherubtse identity', () => {
  test.each(['07240057.sherubtse@rub.edu.bt', '07240057.SHERUBTSE@RUB.EDU.BT', '07220057.sherubtse@rub.edu.bt', '07250067.sherubtse@rub.edu.bt', '07230045.sherubtse@rub.edu.bt'])('accepts valid student email %s', email => {
    expect(validators.isValidStudentEmail(email)).toBe(true);
    expect(validators.extractStudentNumber(email)).toBe(email.slice(0, 8));
  });
  test.each(['student@gmail.com', 'pema.sherubtse@rub.edu.bt', '7240057.sherubtse@rub.edu.bt', '072400571.sherubtse@rub.edu.bt', '', null, 7240057, []])('rejects invalid identity %p', email => {
    expect(validators.isValidStudentEmail(email)).toBe(false);
    expect(validators.extractStudentNumber(email)).toBeNull();
  });
});
describe('Password and required fields', () => {
  test.each(['12345678', 'a'.repeat(72), 'valid password'])('accepts password within existing limits', value => {
    expect(validators.isValidPassword(value)).toBe(true);
  });
  test.each(['1234567', '12345', '', null, 123456, 'a'.repeat(73), '界'.repeat(25)])('rejects invalid password %p', value => {
    expect(validators.isValidPassword(value)).toBe(false);
  });
  test('checks each required field while allowing numeric zero', () => {
    // Arrange: a form object and its required field names.
    const fields = { name: 'Pema', hours: 0 };
    // Act: apply the reusable required-field rule.
    const valid = validators.hasRequiredFields(fields, ['name', 'hours']);
    // Assert: a present number is valid, but absent/blank values are not.
    expect(valid).toBe(true);
    expect(validators.hasRequiredFields({ name: ' ' }, ['name'])).toBe(false);
    expect(validators.hasRequiredFields({}, ['name'])).toBe(false);
    expect(validators.hasRequiredFields(null, ['name'])).toBe(false);
    expect(validators.hasRequiredFields({ skills: [] }, ['skills'])).toBe(false);
  });
});
describe('Work ranges and application windows', () => {
  test('requires valid work dates and a strictly later end', () => {
    expect(validators.isValidWorkRange('2030-01-02T09:00', '2030-01-02T12:00')).toBe(true);
    expect(validators.isValidWorkRange('2030-01-02T09:00', '2030-01-02T09:00')).toBe(false);
    expect(validators.isValidWorkRange('2030-01-02T12:00', '2030-01-02T09:00')).toBe(false);
    expect(validators.isValidWorkRange('2030-02-30T09:00', '2030-03-02T12:00')).toBe(false);
    expect(validators.isValidWorkRange('', null)).toBe(false);
  });
  test('applications open before closing and close no later than work starts', () => {
    expect(validators.isValidApplicationWindow('2030-01-01T09:00', '2030-01-02T09:00', '2030-01-02T09:00')).toBe(true);
    expect(validators.isValidApplicationWindow('2030-01-02T09:00', '2030-01-02T09:00', '2030-01-03T09:00')).toBe(false);
    expect(validators.isValidApplicationWindow('2030-01-01T09:00', '2030-01-03T09:00', '2030-01-02T09:00')).toBe(false);
  });
  test('opening is inclusive and closing is exclusive', () => {
    expect(validators.isWithinApplicationWindow('2030-01-01T09:00', '2030-01-02T09:00', '2030-01-01T09:00')).toBe(true);
    expect(validators.isWithinApplicationWindow('2030-01-01T09:00', '2030-01-02T09:00', '2030-01-02T09:00')).toBe(false);
    expect(validators.isWithinApplicationWindow('2030-01-01T09:00', '2030-01-02T09:00', '2029-12-31T09:00')).toBe(false);
  });
});
describe('Ratings', () => {
  test.each([1, 2, 3, 4, 5, '5'])('accepts whole-number rating %p', score => expect(validators.isValidRating(score)).toBe(true));
  test.each([0, 6, -1, 2.5, 'five', '', null, true, [], [5]])('rejects invalid rating %p', score => expect(validators.isValidRating(score)).toBe(false));
});
describe('Application status transitions', () => {
  test.each([['pending','accepted'],['pending','rejected'],['pending','withdrawn'],['pending','invited'],['invited','accepted'],['invited','declined'],['invited','withdrawn'],['accepted','in_progress'],['accepted','completed'],['in_progress','completed'],['declined','invited']])('allows %s to %s', (from,to) => expect(validators.canTransitionApplication(from,to)).toBe(true));
  test.each([['pending','completed'],['invited','completed'],['completed','accepted'],['accepted','pending'],['unknown','accepted'],['pending','pending']])('rejects %s to %s', (from,to) => expect(validators.canTransitionApplication(from,to)).toBe(false));
});
