ALTER TABLE `group_activities`
  ADD COLUMN `recurrence_series_id` VARCHAR(191) NULL,
  ADD COLUMN `occurrence_index` INTEGER NULL;

CREATE TABLE `event_recurrence_series` (
  `id` VARCHAR(191) NOT NULL,
  `group_id` VARCHAR(191) NOT NULL,
  `frequency` ENUM('DAILY', 'WEEKLY', 'CUSTOM') NOT NULL,
  `interval` INTEGER NOT NULL DEFAULT 1,
  `days_of_week` JSON NULL,
  `custom_rule` JSON NULL,
  `timezone` VARCHAR(100) NOT NULL,
  `until` DATETIME(3) NULL,
  `count` INTEGER NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `event_recurrence_series_group_id_idx` (`group_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `event_roles` (
  `id` VARCHAR(191) NOT NULL,
  `activity_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `requirements` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `event_roles_activity_id_name_key` (`activity_id`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `event_members` (
  `id` VARCHAR(191) NOT NULL,
  `activity_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `attendance_status` ENUM('UNKNOWN', 'ATTENDING', 'NOT_ATTENDING', 'TENTATIVE') NOT NULL DEFAULT 'UNKNOWN',
  `packing_at` DATETIME(3) NULL,
  `leaving_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `event_members_activity_id_user_id_key` (`activity_id`, `user_id`),
  INDEX `event_members_user_id_idx` (`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `event_member_roles` (
  `id` VARCHAR(191) NOT NULL,
  `event_role_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `event_member_roles_event_role_id_user_id_key` (`event_role_id`, `user_id`),
  INDEX `event_member_roles_user_id_idx` (`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `event_activity_log` (
  `id` VARCHAR(191) NOT NULL,
  `activity_id` VARCHAR(191) NOT NULL,
  `actor_id` VARCHAR(191) NULL,
  `action` VARCHAR(100) NOT NULL,
  `item_id` VARCHAR(191) NULL,
  `quantity` INTEGER NULL,
  `details` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `event_activity_log_activity_id_created_at_idx` (`activity_id`, `created_at`),
  INDEX `event_activity_log_activity_id_actor_id_idx` (`activity_id`, `actor_id`),
  INDEX `event_activity_log_activity_id_item_id_idx` (`activity_id`, `item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `preparation_templates` (
  `id` VARCHAR(191) NOT NULL,
  `group_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `preparation_templates_group_id_updated_at_idx` (`group_id`, `updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `preparation_template_versions` (
  `id` VARCHAR(191) NOT NULL,
  `template_id` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `created_by_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `preparation_template_versions_template_id_version_key` (`template_id`, `version`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `group_activities_recurrence_series_id_occurrence_index_key`
  ON `group_activities`(`recurrence_series_id`, `occurrence_index`);

ALTER TABLE `group_activities`
  ADD CONSTRAINT `group_activities_recurrence_series_id_fkey`
  FOREIGN KEY (`recurrence_series_id`) REFERENCES `event_recurrence_series`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `event_recurrence_series`
  ADD CONSTRAINT `event_recurrence_series_group_id_fkey`
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `event_recurrence_series_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `event_roles`
  ADD CONSTRAINT `event_roles_activity_id_fkey`
  FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `event_members`
  ADD CONSTRAINT `event_members_activity_id_fkey`
  FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `event_members_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `event_member_roles`
  ADD CONSTRAINT `event_member_roles_event_role_id_fkey`
  FOREIGN KEY (`event_role_id`) REFERENCES `event_roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `event_member_roles_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `event_activity_log`
  ADD CONSTRAINT `event_activity_log_activity_id_fkey`
  FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `event_activity_log_actor_id_fkey`
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `preparation_templates`
  ADD CONSTRAINT `preparation_templates_group_id_fkey`
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `preparation_templates_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `preparation_template_versions`
  ADD CONSTRAINT `preparation_template_versions_template_id_fkey`
  FOREIGN KEY (`template_id`) REFERENCES `preparation_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `preparation_template_versions_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
