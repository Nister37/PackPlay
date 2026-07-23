-- CreateTable
CREATE TABLE `calendar_feeds` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `provider` ENUM('GENERIC', 'TEAMSNAP', 'GAMECHANGER') NOT NULL DEFAULT 'GENERIC',
    `name` VARCHAR(200) NOT NULL,
    `encrypted_url` TEXT NOT NULL,
    `url_hash` VARCHAR(64) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `last_synced_at` DATETIME(3) NULL,
    `last_successful_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `calendar_feeds_url_hash_key`(`url_hash`),
    INDEX `calendar_feeds_group_id_active_idx`(`group_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calendar_imported_events` (
    `id` VARCHAR(191) NOT NULL,
    `feed_id` VARCHAR(191) NOT NULL,
    `external_uid` VARCHAR(500) NOT NULL,
    `recurrence_id` VARCHAR(200) NOT NULL DEFAULT '',
    `activity_id` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `source_hash` VARCHAR(64) NOT NULL,
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `calendar_imported_events_activity_id_key`(`activity_id`),
    INDEX `calendar_imported_events_feed_id_last_seen_at_idx`(`feed_id`, `last_seen_at`),
    UNIQUE INDEX `calendar_imported_events_feed_id_external_uid_recurrence_id_key`(`feed_id`, `external_uid`, `recurrence_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `calendar_feeds` ADD CONSTRAINT `calendar_feeds_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_feeds` ADD CONSTRAINT `calendar_feeds_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_imported_events` ADD CONSTRAINT `calendar_imported_events_feed_id_fkey` FOREIGN KEY (`feed_id`) REFERENCES `calendar_feeds`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_imported_events` ADD CONSTRAINT `calendar_imported_events_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
