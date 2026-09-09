CREATE TABLE `corporations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`english_name` text,
	`market` text NOT NULL,
	`dart_code` text,
	`stock_code` text,
	`ceo` text,
	`founded_on` text,
	`anniversary_on` text,
	`anniversary_base_year` integer,
	`address` text,
	`phone` text,
	`email` text,
	`email_department` text,
	`summary` text,
	`tags_json` text,
	`website` text,
	`social_links_json` text,
	`careers_url` text,
	`group_name` text,
	`sources_json` text,
	`verified_at` text
);

--> statement-breakpoint
CREATE TABLE `follows` (
	`user_id` text NOT NULL,
	`company_id` text NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`kakao_enabled` integer DEFAULT false NOT NULL,
	`lead_days` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `company_id`),
	FOREIGN KEY (`company_id`) REFERENCES `corporations`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `relationships` (
	`parent_id` text NOT NULL,
	`child_id` text NOT NULL,
	`kind` text NOT NULL,
	`ownership_percent` text,
	`source_url` text NOT NULL,
	`verified_at` text NOT NULL,
	PRIMARY KEY(`parent_id`, `child_id`, `kind`),
	FOREIGN KEY (`parent_id`) REFERENCES `corporations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_id`) REFERENCES `corporations`(`id`) ON UPDATE no action ON DELETE no action
);
