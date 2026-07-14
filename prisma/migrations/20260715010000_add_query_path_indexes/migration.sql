CREATE INDEX `checklists_user_id_created_at_idx` ON `checklists`(`user_id`, `created_at`);
CREATE INDEX `equipment_items_checklist_id_sort_order_idx` ON `equipment_items`(`checklist_id`, `sort_order`);
CREATE INDEX `group_activities_group_id_created_at_idx` ON `group_activities`(`group_id`, `created_at`);
CREATE INDEX `group_invitations_group_id_created_at_idx` ON `group_invitations`(`group_id`, `created_at`);
CREATE INDEX `shared_responsibilities_user_id_status_idx` ON `shared_responsibilities`(`user_id`, `status`);
CREATE INDEX `packing_sessions_group_activity_id_user_id_created_at_idx` ON `packing_sessions`(`group_activity_id`, `user_id`, `created_at`);
CREATE INDEX `notifications_user_id_created_at_idx` ON `notifications`(`user_id`, `created_at`);
