CREATE TABLE `external_identities` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `provider` ENUM('GOOGLE') NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `external_identities_provider_subject_key` (`provider`, `subject`),
  UNIQUE INDEX `external_identities_user_id_provider_key` (`user_id`, `provider`),
  INDEX `external_identities_email_idx` (`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sso_authorizations` (
  `id` VARCHAR(191) NOT NULL,
  `state_hash` VARCHAR(64) NOT NULL,
  `provider` ENUM('GOOGLE') NOT NULL,
  `intent` ENUM('SIGN_IN', 'LINK') NOT NULL,
  `user_id` VARCHAR(191) NULL,
  `encrypted_code_verifier` TEXT NOT NULL,
  `nonce_hash` VARCHAR(64) NOT NULL,
  `return_url` VARCHAR(2048) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `sso_authorizations_state_hash_key` (`state_hash`),
  INDEX `sso_authorizations_expires_at_idx` (`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `external_identities`
  ADD CONSTRAINT `external_identities_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `sso_authorizations`
  ADD CONSTRAINT `sso_authorizations_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
