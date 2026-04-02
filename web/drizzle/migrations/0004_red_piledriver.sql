CREATE TABLE `daily_image_generation_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`usage_date` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_image_generation_usage_user_date_unique_idx` ON `daily_image_generation_usage` (`user_id`,`usage_date`);