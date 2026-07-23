-- AlterTable
ALTER TABLE `equipment_items` ADD COLUMN `catalogue_item_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `shared_items` ADD COLUMN `catalogue_item_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `equipment_catalogue_items` (
    `id` VARCHAR(191) NOT NULL,
    `canonical_name` VARCHAR(200) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `sports` JSON NOT NULL,
    `roles` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `equipment_catalogue_items_canonical_name_key`(`canonical_name`),
    INDEX `equipment_catalogue_items_category_active_idx`(`category`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_catalogue_aliases` (
    `id` VARCHAR(191) NOT NULL,
    `catalogue_item_id` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(200) NOT NULL,

    INDEX `equipment_catalogue_aliases_alias_idx`(`alias`),
    UNIQUE INDEX `equipment_catalogue_aliases_catalogue_item_id_alias_key`(`catalogue_item_id`, `alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_equipment_usage` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `catalogue_item_id` VARCHAR(191) NOT NULL,
    `use_count` INTEGER NOT NULL DEFAULT 0,
    `last_used_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `team_equipment_usage_group_id_last_used_at_idx`(`group_id`, `last_used_at`),
    UNIQUE INDEX `team_equipment_usage_group_id_catalogue_item_id_key`(`group_id`, `catalogue_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_suggestion_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `personalized_ranking` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `equipment_suggestion_preferences_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `equipment_items_catalogue_item_id_idx` ON `equipment_items`(`catalogue_item_id`);

-- CreateIndex
CREATE INDEX `shared_items_catalogue_item_id_idx` ON `shared_items`(`catalogue_item_id`);

-- AddForeignKey
ALTER TABLE `equipment_items` ADD CONSTRAINT `equipment_items_catalogue_item_id_fkey` FOREIGN KEY (`catalogue_item_id`) REFERENCES `equipment_catalogue_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shared_items` ADD CONSTRAINT `shared_items_catalogue_item_id_fkey` FOREIGN KEY (`catalogue_item_id`) REFERENCES `equipment_catalogue_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment_catalogue_aliases` ADD CONSTRAINT `equipment_catalogue_aliases_catalogue_item_id_fkey` FOREIGN KEY (`catalogue_item_id`) REFERENCES `equipment_catalogue_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_equipment_usage` ADD CONSTRAINT `team_equipment_usage_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_equipment_usage` ADD CONSTRAINT `team_equipment_usage_catalogue_item_id_fkey` FOREIGN KEY (`catalogue_item_id`) REFERENCES `equipment_catalogue_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment_suggestion_preferences` ADD CONSTRAINT `equipment_suggestion_preferences_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
