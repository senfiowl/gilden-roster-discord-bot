export interface Character {
  id: number;
  user_id: string;
  guild_id: string;
  char_name: string;
  server: string;
  class_name: string;
  ilvl: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerChannel {
  user_id: string;
  guild_id: string;
  channel_id: string;
}

export interface WowClass {
  name: string;
  color: number;
}

export const WOW_CLASSES: WowClass[] = [
  { name: 'Death Knight', color: 0xc41e3a },
  { name: 'Demon Hunter', color: 0xa330c9 },
  { name: 'Druid',        color: 0xff7c0a },
  { name: 'Evoker',       color: 0x33937f },
  { name: 'Hunter',       color: 0xaad372 },
  { name: 'Mage',         color: 0x3fc7eb },
  { name: 'Monk',         color: 0x00ff98 },
  { name: 'Paladin',      color: 0xf48cba },
  { name: 'Priest',       color: 0xcccccc },
  { name: 'Rogue',        color: 0xfff468 },
  { name: 'Shaman',       color: 0x0070dd },
  { name: 'Warlock',      color: 0x8788ee },
  { name: 'Warrior',      color: 0xc69b3a },
];
