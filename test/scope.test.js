'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { families, cases } = require('../src/data/cases');
test('interim scope contains only TC01-TC08 and 24 variants', () => {
  assert.deepEqual(families.map(f => f.id), ['TC01','TC02','TC03','TC04','TC05','TC06','TC07','TC08']);
  assert.equal(cases.length, 24);
  assert.ok(cases.every(c => ['D1','D2','C'].includes(c.variant)));
});
