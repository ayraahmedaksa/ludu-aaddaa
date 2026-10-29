-- লুডু আড্ডা Database Schema
-- MySQL

CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `key` VARCHAR(100) UNIQUE NOT NULL,
  `value` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default Settings
INSERT INTO `settings` (`key`, `value`) VALUES
('min_deposit', '500'),
('min_withdraw', '2000'),
('min_bet', '100'),
('max_bet', '5000'),
('table_fee_per_player', '10'),
('deposit_numbers', '{"bkash":["017XXXXXXXX"],"nagad":["017XXXXXXXX"],"rocket":["017XXXXXXXX"]}'),
('site_name', 'লুডু আড্ডা'),
('maintenance', '0')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

CREATE TABLE IF NOT EXISTS `agents` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `username` VARCHAR(50) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100),
  `role` ENUM('client','sub_agent') DEFAULT 'client',
  `parent_agent_id` INT NULL,
  `status` ENUM('active','inactive','banned') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`parent_agent_id`) REFERENCES `agents`(`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `phone` VARCHAR(15) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100),
  `avatar` VARCHAR(255),
  `balance` DECIMAL(10,2) DEFAULT 0.00,
  `hold_balance` DECIMAL(10,2) DEFAULT 0.00,
  `referral_code` VARCHAR(20) UNIQUE,
  `referred_by` INT NULL,
  `status` ENUM('active','inactive','banned') DEFAULT 'active',
  `last_login` TIMESTAMP NULL,
  `ip_address` VARCHAR(45),
  `device_info` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`referred_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX idx_phone (`phone`),
  INDEX idx_referral (`referral_code`)
);

CREATE TABLE IF NOT EXISTS `balance_log` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `type` ENUM('credit','debit','hold','release','refund') NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `balance_before` DECIMAL(10,2) NOT NULL,
  `balance_after` DECIMAL(10,2) NOT NULL,
  `description` VARCHAR(255),
  `reference_type` ENUM('deposit','withdraw','bet','win','table_fee','refund','admin') NULL,
  `reference_id` VARCHAR(50) NULL,
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX idx_user_date (`user_id`, `created_at`)
);

CREATE TABLE IF NOT EXISTS `deposit_requests` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `method` ENUM('bkash','nagad','rocket') NOT NULL,
  `sender_number` VARCHAR(15) NOT NULL,
  `receiver_number` VARCHAR(15) NOT NULL,
  `trx_id` VARCHAR(50) NOT NULL,
  `screenshot` VARCHAR(255),
  `status` ENUM('pending','approved','rejected') DEFAULT 'pending',
  `note` TEXT,
  `approved_by` INT NULL,
  `approved_at` TIMESTAMP NULL,
  `rejected_by` INT NULL,
  `rejected_at` TIMESTAMP NULL,
  `reject_reason` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY unique_trx (`trx_id`),
  INDEX idx_status (`status`),
  INDEX idx_user (`user_id`)
);

CREATE TABLE IF NOT EXISTS `withdraw_requests` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `method` ENUM('bkash','nagad','rocket') NOT NULL,
  `account_number` VARCHAR(15) NOT NULL,
  `status` ENUM('pending','paid','rejected') DEFAULT 'pending',
  `hold_amount` DECIMAL(10,2) NOT NULL,
  `note` TEXT,
  `paid_by` INT NULL,
  `paid_at` TIMESTAMP NULL,
  `rejected_by` INT NULL,
  `rejected_at` TIMESTAMP NULL,
  `reject_reason` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX idx_status (`status`),
  INDEX idx_user (`user_id`)
);

CREATE TABLE IF NOT EXISTS `rooms` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `room_code` VARCHAR(20) UNIQUE NOT NULL,
  `bet_amount` DECIMAL(10,2) NOT NULL,
  `table_fee` DECIMAL(10,2) NOT NULL,
  `min_players` INT DEFAULT 2,
  `max_players` INT DEFAULT 2,
  `current_players` INT DEFAULT 0,
  `players` JSON,
  `status` ENUM('waiting','playing','finished','cancelled') DEFAULT 'waiting',
  `winner_id` INT NULL,
  `pot_amount` DECIMAL(10,2) DEFAULT 0.00,
  `table_fee_total` DECIMAL(10,2) DEFAULT 0.00,
  `win_amount` DECIMAL(10,2) DEFAULT 0.00,
  `started_at` TIMESTAMP NULL,
  `finished_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`winner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX idx_status (`status`),
  INDEX idx_room_code (`room_code`)
);

CREATE TABLE IF NOT EXISTS `game_history` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `room_id` INT NOT NULL,
  `room_code` VARCHAR(20) NOT NULL,
  `player_id` INT NOT NULL,
  `opponent_id` INT NOT NULL,
  `bet_amount` DECIMAL(10,2) NOT NULL,
  `table_fee` DECIMAL(10,2) NOT NULL,
  `result` ENUM('win','lose','draw') NOT NULL,
  `amount_won` DECIMAL(10,2) DEFAULT 0.00,
  `amount_lost` DECIMAL(10,2) DEFAULT 0.00,
  `played_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`player_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`opponent_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX idx_player (`player_id`),
  INDEX idx_played_at (`played_at`)
);

CREATE TABLE IF NOT EXISTS `room_chats` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `room_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `message` TEXT NOT NULL,
  `is_muted` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX idx_room (`room_id`, `created_at`)
);

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('deposit','withdraw','game','system') DEFAULT 'system',
  `is_read` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX idx_user_read (`user_id`, `is_read`)
);
