import { describe, expect, it } from 'vitest';
import { ROOM_EXPIRY_MS } from './constants.js';

describe('room retention', () => {
  it('expires finished rooms after one hour', () => {
    expect(ROOM_EXPIRY_MS).toBe(60 * 60 * 1000);
  });
});
