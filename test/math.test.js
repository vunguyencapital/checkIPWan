const { add } = require('../helpers/math');

test('add function should add two numbers correctly', () => {
  expect(add(2, 3)).toBe(5);
  expect(add(-1, 5)).toBe(4);
});