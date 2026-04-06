CREATE TABLE `integration` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`scope` text NOT NULL,
	`access_token_expires_at` integer NOT NULL,
	`provider_account_id` text,
	`provider_account_name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_user_provider_unique_idx` ON `integration` (`user_id`,`provider`);