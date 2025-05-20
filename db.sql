CREATE DATABASE IF NOT EXISTS ShopEase DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ShopEase;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lastname VARCHAR(50) NOT NULL,
  firstname VARCHAR(50) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(100) NOT NULL,
  avatar VARCHAR(100) DEFAULT 'default.png',
  shop_name VARCHAR(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_email VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  info TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL,
  image VARCHAR(100) NOT NULL,
  FOREIGN KEY (admin_email) REFERENCES admins(email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_email VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  FOREIGN KEY (admin_email) REFERENCES admins(email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_email VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status_info VARCHAR(20) NOT NULL default '已下单',
  FOREIGN KEY (admin_email) REFERENCES admins(email),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS infos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  detail TEXT,
  admin_email VARCHAR(100) NOT NULL,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_email) REFERENCES admins(email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admins (lastname, firstname, email, phone, password)
VALUES ('默认', '管理员', 'admin@shopease.com', '12345678910', '123456')
ON DUPLICATE KEY UPDATE email = email;  