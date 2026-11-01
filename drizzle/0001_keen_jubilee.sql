CREATE TABLE `gate_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`lot_id` text NOT NULL,
	`token_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parking_keys` (
	`owner` text PRIMARY KEY NOT NULL,
	`private_jwk` text NOT NULL,
	`public_jwk` text NOT NULL
);
