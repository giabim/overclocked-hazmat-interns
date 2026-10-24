CREATE TABLE `anomalies` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`carrier_id` text,
	`respawn_at` integer DEFAULT 0 NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `anomalies_room_idx` ON `anomalies` (`room_code`);--> statement-breakpoint
ALTER TABLE `players` ADD `is_bot` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `bot_level` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `target_id` text;--> statement-breakpoint
ALTER TABLE `players` ADD `next_think_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `wobble_x` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `wobble_y` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `drop_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `interact_seq` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `action_kind` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `round_ends_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `round_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `sim_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `sim_ms` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `sim_owner` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `revision` integer DEFAULT 0 NOT NULL;