import { describe, it, expect } from 'vitest';
import { resolveWarRoomLimit, WAR_ROOM_LIMITS } from '../../supabase/functions/_shared/warRoomQuota';

describe('warRoomQuota — resolveWarRoomLimit', () => {
  it('returns free limits for "free" plan — 1 session/month, hard blocked', () => {
    const l = resolveWarRoomLimit('free');
    expect(l.cap).toBe(1);
    expect(l.included).toBe(0);
    expect(l.overageUnitPrice).toBe(0);
    expect(l.hardBlock).toBe(true);
  });

  it('returns uncapped pro — unlimited sessions, no overage', () => {
    const l = resolveWarRoomLimit('pro');
    expect(l.cap).toBeNull();
    expect(l.included).toBeGreaterThanOrEqual(1000000);
    expect(l.overageUnitPrice).toBe(0);
    expect(l.hardBlock).toBe(false);
  });

  it('returns team with soft cap at 500 (no monetization)', () => {
    const l = resolveWarRoomLimit('team');
    expect(l.cap).toBe(500);
    expect(l.included).toBe(500);
    expect(l.overageUnitPrice).toBe(0);
    expect(l.hardBlock).toBe(false);
  });

  it('returns business with soft cap at 2000 (no monetization)', () => {
    const l = resolveWarRoomLimit('business');
    expect(l.cap).toBe(2000);
    expect(l.included).toBe(2000);
    expect(l.overageUnitPrice).toBe(0);
    expect(l.hardBlock).toBe(false);
  });

  it('returns effectively uncapped enterprise', () => {
    const l = resolveWarRoomLimit('enterprise');
    expect(l.cap).toBeNull();
    expect(l.included).toBeGreaterThanOrEqual(1000000);
  });

  it('falls back to free for unknown / null / undefined', () => {
    expect(resolveWarRoomLimit(null).cap).toBe(1);
    expect(resolveWarRoomLimit(undefined).cap).toBe(1);
    expect(resolveWarRoomLimit('nonsense').cap).toBe(1);
  });

  it('WAR_ROOM_LIMITS has exactly the five tiers', () => {
    expect(Object.keys(WAR_ROOM_LIMITS).sort()).toEqual(['business', 'enterprise', 'free', 'pro', 'team']);
  });
});

/**
 * The race-condition guarantee (two concurrent Free requests at the cap return
 * exactly one allowed) is enforced by the `consume_war_room_session` SQL RPC's
 * SELECT ... FOR UPDATE row lock, not by this module. It is covered by an
 * integration test against the database, not a unit test here.
 */
