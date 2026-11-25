import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFix } from '../../../src/services/fixFilter';
import type { GpsFix } from '../../../src/types/gps';


/**
 * Tests for GPS fix filtering logic.
 */


const startedAt = 1_000;

function fix(overrides: Partial<GpsFix> = {}): GpsFix {
  return {
    lat: 0,
    lng: 0,
    accuracy: 5,
    speed: null,
    heading: null,
    altitude: null,
    timestamp: startedAt,
    ...overrides,
  };
}

test('accepts a good first fix', () => {
  assert.equal(checkFix(fix({ accuracy: 12 }), undefined, startedAt, 'run'), null);
});

test('rejects a stale fix', () => {
  assert.equal(checkFix(fix({ timestamp: startedAt - 1 }), undefined, startedAt, 'run'), 'stale');
});

test('rejects an inaccurate first fix', () => {
  assert.equal(checkFix(fix({ accuracy: 13 }), undefined, startedAt, 'run'), 'inaccurate');
});

test('rejects an inaccurate later fix', () => {
  assert.equal(
    checkFix(fix({ timestamp: startedAt + 5_000, accuracy: 21 }), { lat: 0, lng: 0, timestamp: startedAt }, startedAt, 'run'),
    'inaccurate'
  );
});

test('rejects small movements as jitter', () => {
  assert.equal(
    checkFix(fix({ lat: 0.00001, timestamp: startedAt + 1_000 }), { lat: 0, lng: 0, timestamp: startedAt }, startedAt, 'run'),
    'jitter'
  );
});

test('uses a higher speed limit for biking than running', () => {
  const previous = { lat: 0, lng: 0, timestamp: startedAt };
  const next = fix({ lat: 0.00018, timestamp: startedAt + 2_000 });
  assert.equal(checkFix(next, previous, startedAt, 'run'), 'too-fast');
  assert.equal(checkFix(next, previous, startedAt, 'bike'), null);
});

test('rejects fixes with no time between them', () => {
  assert.equal(
    checkFix(fix({ lat: 0.001 }), { lat: 0, lng: 0, timestamp: startedAt }, startedAt, 'run'),
    'too-fast'
  );
});
