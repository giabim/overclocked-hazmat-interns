CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`vx` real DEFAULT 0 NOT NULL,
	`vy` real DEFAULT 0 NOT NULL,
	`seq` integer DEFAULT 0 NOT NULL,
	`last_at` integer NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_room_idx` ON `players` (`room_code`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
