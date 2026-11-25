CREATE DATABASE IF NOT EXISTS schedule_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE schedule_db;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    content TEXT,
    schedule_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT '진행중',
    category_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

INSERT INTO categories (name)
SELECT v.name
FROM (
    SELECT '학교' AS name
    UNION ALL SELECT '과제'
    UNION ALL SELECT '개인'
    UNION ALL SELECT '아르바이트'
) AS v
WHERE NOT EXISTS (SELECT 1 FROM categories);
