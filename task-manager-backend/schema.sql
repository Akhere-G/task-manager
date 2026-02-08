CREATE DATABASE IF NOT EXISTS task_db;
USE task_db;
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'General',
  is_completed BOOLEAN DEFAULT FALSE,
  due_date DATE NOT NULL,
  estimated_time INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP;
);
ALTER TABLE tasks
ADD FULLTEXT(title, description);
DELIMITER //

CREATE TRIGGER tr_ensure_completion_timestamp
BEFORE UPDATE ON tasks
FOR EACH ROW
BEGIN
    -- 1. Auto-fill timestamp if task is completed but date is missing
    IF NEW.is_completed = 1 AND NEW.completed_at IS NULL THEN
        SET NEW.completed_at = NOW();
    
    -- 2. Wipe timestamp if a task is "uncompleted"
    ELSEIF NEW.is_completed = 0 THEN
        SET NEW.completed_at = NULL;
    END IF;
END //

DELIMITER ;