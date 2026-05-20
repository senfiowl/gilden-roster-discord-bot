import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isManagement, isMember, hasAnyGuildRole } from './permissions';
import type { GuildMember } from 'discord.js';

function makeMember(roleNames: string[]): GuildMember {
  return {
    roles: {
      cache: {
        some: (fn: (r: { name: string }) => boolean) =>
          roleNames.some(name => fn({ name })),
      },
    },
  } as unknown as GuildMember;
}

describe('isManagement', () => {
  it('returns true for Admin role', () => {
    expect(isManagement(makeMember(['Admin']))).toBe(true);
  });

  it('returns true for Council role', () => {
    expect(isManagement(makeMember(['Council']))).toBe(true);
  });

  it('returns false for Raidmember role', () => {
    expect(isManagement(makeMember(['Raidmember']))).toBe(false);
  });

  it('returns false for no roles', () => {
    expect(isManagement(makeMember([]))).toBe(false);
  });
});

describe('isMember', () => {
  it('returns true for Raidmember role', () => {
    expect(isMember(makeMember(['Raidmember']))).toBe(true);
  });

  it('returns true for Trial role', () => {
    expect(isMember(makeMember(['Trial']))).toBe(true);
  });

  it('returns false for Admin role', () => {
    expect(isMember(makeMember(['Admin']))).toBe(false);
  });

  it('returns false for no roles', () => {
    expect(isMember(makeMember([]))).toBe(false);
  });
});

describe('hasAnyGuildRole', () => {
  it('returns true for Admin', () => {
    expect(hasAnyGuildRole(makeMember(['Admin']))).toBe(true);
  });

  it('returns true for Trial', () => {
    expect(hasAnyGuildRole(makeMember(['Trial']))).toBe(true);
  });

  it('returns false for unrelated role', () => {
    expect(hasAnyGuildRole(makeMember(['Lurker']))).toBe(false);
  });

  it('returns false for no roles', () => {
    expect(hasAnyGuildRole(makeMember([]))).toBe(false);
  });
});

describe('custom role names via env vars', () => {
  beforeEach(() => {
    process.env.ADMIN_ROLE_NAME = 'Gildenleiter';
    process.env.COUNCIL_ROLE_NAME = 'Offizier';
    process.env.RAIDMEMBER_ROLE_NAME = 'Raider';
    process.env.TRIAL_ROLE_NAME = 'Bewerber';
  });

  afterEach(() => {
    delete process.env.ADMIN_ROLE_NAME;
    delete process.env.COUNCIL_ROLE_NAME;
    delete process.env.RAIDMEMBER_ROLE_NAME;
    delete process.env.TRIAL_ROLE_NAME;
  });

  it('recognises custom management role names', () => {
    expect(isManagement(makeMember(['Gildenleiter']))).toBe(true);
    expect(isManagement(makeMember(['Offizier']))).toBe(true);
  });

  it('no longer recognises default names when overridden', () => {
    expect(isManagement(makeMember(['Admin']))).toBe(false);
  });

  it('recognises custom member role names', () => {
    expect(isMember(makeMember(['Raider']))).toBe(true);
    expect(isMember(makeMember(['Bewerber']))).toBe(true);
  });
});
