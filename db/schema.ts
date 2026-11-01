import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const parkingWorlds = sqliteTable('parking_worlds', {
  owner: text('owner').primaryKey(),
  state: text('state').notNull(),
  version: integer('version').notNull().default(0),
});
export const parkingKeys = sqliteTable('parking_keys', {
  owner: text('owner').primaryKey(),
  privateJwk: text('private_jwk').notNull(),
  publicJwk: text('public_jwk').notNull(),
});
export const gateDevices = sqliteTable('gate_devices', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), lotId: text('lot_id').notNull(), tokenHash: text('token_hash').notNull(),
});
