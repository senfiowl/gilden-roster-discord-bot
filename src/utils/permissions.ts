import type { GuildMember } from 'discord.js';

function roleNames(): { management: string[]; members: string[] } {
  return {
    management: [
      process.env.ADMIN_ROLE_NAME   ?? 'Admin',
      process.env.COUNCIL_ROLE_NAME ?? 'Council',
    ],
    members: [
      process.env.RAIDMEMBER_ROLE_NAME ?? 'Raidmember',
      process.env.TRIAL_ROLE_NAME      ?? 'Trial',
    ],
  };
}

export function isManagement(member: GuildMember): boolean {
  const { management } = roleNames();
  return member.roles.cache.some(r => management.includes(r.name));
}

export function isMember(member: GuildMember): boolean {
  const { members } = roleNames();
  return member.roles.cache.some(r => members.includes(r.name));
}

export function hasAnyGuildRole(member: GuildMember): boolean {
  return isManagement(member) || isMember(member);
}
