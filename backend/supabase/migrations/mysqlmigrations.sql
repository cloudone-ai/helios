-- MySQL Migration Script

-- 1. 数据库创建
CREATE DATABASE IF NOT EXISTS basejump;
USE basejump;

-- 2. 账户表（如果尚未创建，建议补充）
CREATE TABLE IF NOT EXISTS accounts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. 设备表
CREATE TABLE IF NOT EXISTS devices (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    account_id CHAR(36) NOT NULL,
    name TEXT,
    last_seen TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_online BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- 4. recordings 表
CREATE TABLE IF NOT EXISTS recordings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    account_id CHAR(36) NOT NULL,
    device_id CHAR(36) NOT NULL,
    preprocessed_file_path TEXT,
    meta JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    name TEXT,
    ui_annotated BOOLEAN DEFAULT FALSE,
    a11y_file_path TEXT,
    audio_file_path TEXT,
    action_annotated BOOLEAN DEFAULT FALSE,
    raw_data_file_path TEXT,
    metadata_file_path TEXT,
    action_training_file_path TEXT,
    CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- 5. file_storage 表（替代 Supabase storage.buckets）
CREATE TABLE IF NOT EXISTS file_storage (
    id VARCHAR(255) PRIMARY KEY,
    bucket_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    content_type VARCHAR(255),
    size BIGINT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_bucket_path (bucket_name, file_path)
);

-- 6. 索引
CREATE INDEX idx_recordings_account_id ON recordings(account_id);
CREATE INDEX idx_recordings_device_id ON recordings(device_id);
CREATE INDEX idx_devices_account_id ON devices(account_id);

-- 7. transfer_device 存储过程
DELIMITER //
DROP PROCEDURE IF EXISTS transfer_device;
CREATE PROCEDURE transfer_device(
    IN device_id CHAR(36),
    IN new_account_id CHAR(36),
    IN device_name TEXT
)
BEGIN
    DECLARE device_exists INT DEFAULT 0;

    SELECT COUNT(*) INTO device_exists FROM devices WHERE id = device_id;

    IF device_exists > 0 THEN
        UPDATE devices
        SET
            account_id = new_account_id,
            name = COALESCE(device_name, name),
            last_seen = CURRENT_TIMESTAMP
        WHERE id = device_id;
    END IF;
END//
DELIMITER ;

GRANT EXECUTE ON PROCEDURE transfer_device TO 'app_user'@'%';

-- 8. 初始化 bucket 信息
INSERT INTO file_storage (id, bucket_name, file_path, is_public)
VALUES
    ('ui_grounding', 'ui_grounding', '/', FALSE),
    ('ui_grounding_trajs', 'ui_grounding_trajs', '/', FALSE),
    ('recordings', 'recordings', '/', FALSE)
ON DUPLICATE KEY UPDATE bucket_name=VALUES(bucket_name);

-- 9. 自动维护 created_at 和 updated_at 的触发器
-- 适用于 devices、recordings、accounts 等有这两个字段的表

DELIMITER //
CREATE TRIGGER devices_set_timestamps
BEFORE INSERT ON devices
FOR EACH ROW
BEGIN
    IF NEW.created_at IS NULL THEN
        SET NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    IF NEW.updated_at IS NULL THEN
        SET NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER devices_update_timestamp
BEFORE UPDATE ON devices
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER recordings_set_timestamps
BEFORE INSERT ON recordings
FOR EACH ROW
BEGIN
    IF NEW.created_at IS NULL THEN
        SET NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    IF NEW.updated_at IS NULL THEN
        SET NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER recordings_update_timestamp
BEFORE UPDATE ON recordings
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER accounts_set_timestamps
BEFORE INSERT ON accounts
FOR EACH ROW
BEGIN
    IF NEW.created_at IS NULL THEN
        SET NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    IF NEW.updated_at IS NULL THEN
        SET NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER accounts_update_timestamp
BEFORE UPDATE ON accounts
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- 追加：原 public schema 下的核心表结构（MySQL 兼容）

-- threads 表
CREATE TABLE IF NOT EXISTS threads (
    thread_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    account_id CHAR(36),
    project_id CHAR(36),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_thread_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_thread_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE INDEX idx_threads_created_at ON threads(created_at);
CREATE INDEX idx_threads_account_id ON threads(account_id);
CREATE INDEX idx_threads_project_id ON threads(project_id);

-- projects 表
CREATE TABLE IF NOT EXISTS projects (
    project_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name TEXT NOT NULL,
    description TEXT,
    account_id CHAR(36) NOT NULL,
    sandbox JSON DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- messages 表（如有）
CREATE TABLE IF NOT EXISTS messages (
    message_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    thread_id CHAR(36) NOT NULL,
    type VARCHAR(255),
    content JSON,
    is_llm_message BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_thread FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);

-- 其他表和约束可以依照此格式继续追加

-- 触发器：自动维护 created_at 和 updated_at（如前文所述，适用于所有有这两个字段的表）

DELIMITER //
CREATE TRIGGER threads_set_timestamps
BEFORE INSERT ON threads
FOR EACH ROW
BEGIN
    IF NEW.created_at IS NULL THEN
        SET NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    IF NEW.updated_at IS NULL THEN
        SET NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER threads_update_timestamp
BEFORE UPDATE ON threads
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER projects_set_timestamps
BEFORE INSERT ON projects
FOR EACH ROW
BEGIN
    IF NEW.created_at IS NULL THEN
        SET NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    IF NEW.updated_at IS NULL THEN
        SET NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER projects_update_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER messages_set_timestamps
BEFORE INSERT ON messages
FOR EACH ROW
BEGIN
    IF NEW.created_at IS NULL THEN
        SET NEW.created_at = CURRENT_TIMESTAMP;
    END IF;
    IF NEW.updated_at IS NULL THEN
        SET NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
END//
DELIMITER ;

DELIMITER //
CREATE TRIGGER messages_update_timestamp
BEFORE UPDATE ON messages
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END//
DELIMITER ;

-- END 追加内容
-- END