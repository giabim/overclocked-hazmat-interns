import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  hostId: text("host_id").notNull(),
  status: text("status").notNull().default("lobby"),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
  roundEndsAt: integer("round_ends_at").notNull().default(0),
  roundId: integer("round_id").notNull().default(0),
  simAt: integer("sim_at").notNull().default(0),
  simMs: integer("sim_ms").notNull().default(0),
  simOwner: text("sim_owner").notNull().default(""),
  revision: integer("revision").notNull().default(0),
});

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => rooms.code, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  vx: real("vx").notNull().default(0),
  vy: real("vy").notNull().default(0),
  seq: integer("seq").notNull().default(0),
  lastAt: integer("last_at").notNull(),
  joinedAt: integer("joined_at").notNull(),
  isBot: integer("is_bot").notNull().default(0),
  botLevel: integer("bot_level").notNull().default(1),
  score: integer("score").notNull().default(0),
  targetId: text("target_id"),
  nextThinkAt: integer("next_think_at").notNull().default(0),
  wobbleX: real("wobble_x").notNull().default(0),
  wobbleY: real("wobble_y").notNull().default(0),
  dropAt: integer("drop_at").notNull().default(0),
  interactSeq: integer("interact_seq").notNull().default(0),
  actionKind: integer("action_kind").notNull().default(0),
}, (table) => [index("players_room_idx").on(table.roomCode)]);

export const anomalies = sqliteTable("anomalies", {
  id: text("id").primaryKey(),
  roomCode: text("room_code").notNull().references(() => rooms.code, {onDelete:"cascade"}),
  x: real("x").notNull(),
  y: real("y").notNull(),
  carrierId: text("carrier_id"),
  respawnAt: integer("respawn_at").notNull().default(0),
  generation: integer("generation").notNull().default(0),
}, table => [index("anomalies_room_idx").on(table.roomCode)]);
