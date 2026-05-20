import { beforeEach, describe, expect, it } from 'vitest';
import {
  initDb,
  addCharacter, updateCharacter, deleteCharacter, deleteAllCharactersForUser,
  getUserCharacters, getAllCharacters, getCharacterById,
  setPlayerChannel, getPlayerChannel, getAllPlayerChannels,
  setLogChannel, getLogChannel,
} from './db';

beforeEach(() => {
  initDb(':memory:');
});

// ── Characters ───────────────────────────────────────────────────────────────

describe('addCharacter / getUserCharacters', () => {
  it('inserts a character and retrieves it', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    const chars = getUserCharacters('u1', 'g1');
    expect(chars).toHaveLength(1);
    expect(chars[0]).toMatchObject({
      user_id: 'u1', guild_id: 'g1',
      char_name: 'Arthas', server: 'Blackhand',
      class_name: 'Death Knight', ilvl: 639,
    });
  });

  it('returns empty array when user has no chars', () => {
    expect(getUserCharacters('unknown', 'g1')).toEqual([]);
  });

  it('rejects duplicate char_name+server per guild', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    expect(() =>
      addCharacter('u2', 'g1', 'Arthas', 'Blackhand', 'Warrior', 640),
    ).toThrow();
  });

  it('allows same char name on different servers', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    addCharacter('u1', 'g1', 'Arthas', 'Antonidas', 'Death Knight', 640);
    expect(getUserCharacters('u1', 'g1')).toHaveLength(2);
  });

  it('orders chars by ilvl descending', () => {
    addCharacter('u1', 'g1', 'Alt', 'Blackhand', 'Warrior', 600);
    addCharacter('u1', 'g1', 'Main', 'Blackhand', 'Mage', 650);
    const [first] = getUserCharacters('u1', 'g1');
    expect(first.char_name).toBe('Main');
  });
});

describe('updateCharacter', () => {
  it('updates only the specified char', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    const [char] = getUserCharacters('u1', 'g1');
    updateCharacter(char.id, 'Arthas', 'Blackhand', 'Death Knight', 660);
    const updated = getCharacterById(char.id);
    expect(updated?.ilvl).toBe(660);
  });
});

describe('deleteCharacter', () => {
  it('removes the char by id+user+guild', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    const [char] = getUserCharacters('u1', 'g1');
    deleteCharacter(char.id, 'u1', 'g1');
    expect(getUserCharacters('u1', 'g1')).toHaveLength(0);
  });

  it('does not remove char belonging to another user', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    const [char] = getUserCharacters('u1', 'g1');
    deleteCharacter(char.id, 'u2', 'g1');
    expect(getUserCharacters('u1', 'g1')).toHaveLength(1);
  });
});

describe('deleteAllCharactersForUser', () => {
  it('removes all chars for the specified user', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    addCharacter('u1', 'g1', 'Jaina', 'Blackhand', 'Mage', 640);
    addCharacter('u2', 'g1', 'Sylvanas', 'Blackhand', 'Hunter', 641);
    deleteAllCharactersForUser('u1', 'g1');
    expect(getUserCharacters('u1', 'g1')).toHaveLength(0);
    expect(getUserCharacters('u2', 'g1')).toHaveLength(1);
  });
});

describe('getAllCharacters', () => {
  it('returns all chars for a guild across users', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    addCharacter('u2', 'g1', 'Jaina', 'Blackhand', 'Mage', 640);
    expect(getAllCharacters('g1')).toHaveLength(2);
  });

  it('does not return chars from another guild', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    addCharacter('u1', 'g2', 'Jaina', 'Blackhand', 'Mage', 640);
    expect(getAllCharacters('g1')).toHaveLength(1);
  });
});

describe('getCharacterById', () => {
  it('returns the char for a valid id', () => {
    addCharacter('u1', 'g1', 'Arthas', 'Blackhand', 'Death Knight', 639);
    const [char] = getUserCharacters('u1', 'g1');
    expect(getCharacterById(char.id)?.char_name).toBe('Arthas');
  });

  it('returns undefined for an unknown id', () => {
    expect(getCharacterById(999)).toBeUndefined();
  });
});

// ── Player Channels ──────────────────────────────────────────────────────────

describe('setPlayerChannel / getPlayerChannel', () => {
  it('stores and retrieves a player channel', () => {
    setPlayerChannel('u1', 'g1', 'ch1');
    expect(getPlayerChannel('u1', 'g1')?.channel_id).toBe('ch1');
  });

  it('overwrites existing channel on re-register', () => {
    setPlayerChannel('u1', 'g1', 'ch1');
    setPlayerChannel('u1', 'g1', 'ch2');
    expect(getPlayerChannel('u1', 'g1')?.channel_id).toBe('ch2');
  });

  it('returns undefined for unregistered user', () => {
    expect(getPlayerChannel('unknown', 'g1')).toBeUndefined();
  });
});

describe('getAllPlayerChannels', () => {
  it('returns all channels for a guild', () => {
    setPlayerChannel('u1', 'g1', 'ch1');
    setPlayerChannel('u2', 'g1', 'ch2');
    expect(getAllPlayerChannels('g1')).toHaveLength(2);
  });

  it('does not return channels from another guild', () => {
    setPlayerChannel('u1', 'g1', 'ch1');
    setPlayerChannel('u1', 'g2', 'ch2');
    expect(getAllPlayerChannels('g1')).toHaveLength(1);
  });
});

// ── Guild Settings ────────────────────────────────────────────────────────────

describe('setLogChannel / getLogChannel', () => {
  it('stores and retrieves the log channel', () => {
    setLogChannel('g1', 'log1');
    expect(getLogChannel('g1')).toBe('log1');
  });

  it('overwrites the log channel on second call', () => {
    setLogChannel('g1', 'log1');
    setLogChannel('g1', 'log2');
    expect(getLogChannel('g1')).toBe('log2');
  });

  it('returns undefined when no log channel is set', () => {
    expect(getLogChannel('g1')).toBeUndefined();
  });
});
