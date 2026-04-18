CREATE TABLE `file` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`status` text DEFAULT 'indexing' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_user_created_idx` ON `file` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `file_item_id_unique_idx` ON `file` (`item_id`);