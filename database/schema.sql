CREATE DATABASE IF NOT EXISTS wa_test;
USE wa_test;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(30) UNIQUE,
  username VARCHAR(50) UNIQUE,
  password VARCHAR(255),
  email VARCHAR(150) UNIQUE,
  email_verified_at TIMESTAMP NULL,
  email_verification_code VARCHAR(10) NULL,
  email_verification_expires_at TIMESTAMP NULL,
  monthly_income DECIMAL(12,2) DEFAULT 0,
  currency_code VARCHAR(10) DEFAULT 'PKR',
  language_code VARCHAR(10) DEFAULT 'en',
  notifications_enabled TINYINT(1) DEFAULT 1,
  whatsapp_sharing_enabled TINYINT(1) DEFAULT 0,
  is_premium TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone_number VARCHAR(30) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  icon_name VARCHAR(50),
  color_hex VARCHAR(10),
  is_default TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50),
  is_default TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS expense_groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expense_group_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  member_name VARCHAR(120) NOT NULL,
  member_phone VARCHAR(30),
  member_email VARCHAR(150),
  FOREIGN KEY (group_id) REFERENCES expense_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  card_name VARCHAR(120) NOT NULL,
  bank_name VARCHAR(120) NOT NULL,
  last_four_digits CHAR(4) NOT NULL,
  credit_limit DECIMAL(12,2) NOT NULL,
  billing_cycle_day INT NOT NULL,
  due_day INT NOT NULL,
  outstanding_balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  group_id INT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category_id INT NOT NULL,
  payment_method_id INT NOT NULL,
  payment_account VARCHAR(120),
  expense_date DATETIME NOT NULL,
  notes VARCHAR(255),
  receipt_url VARCHAR(255),
  is_credit_card TINYINT(1) DEFAULT 0,
  credit_card_id INT NULL,
  created_via ENUM('manual', 'voice', 'scan') DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES expense_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS expense_shares (
  id INT PRIMARY KEY AUTO_INCREMENT,
  expense_id INT NOT NULL,
  participant_name VARCHAR(120) NOT NULL,
  participant_phone VARCHAR(30),
  share_type ENUM('equal', 'custom', 'percentage') DEFAULT 'equal',
  share_amount DECIMAL(12,2) DEFAULT 0,
  percentage_share DECIMAL(5,2),
  paid_amount DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS borrow_lend_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  person_name VARCHAR(120) NOT NULL,
  record_type ENUM('borrow', 'lend') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  record_date DATE NOT NULL,
  return_date DATE NULL,
  status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vendor_ledgers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  vendor_name VARCHAR(150) NOT NULL,
  vendor_phone VARCHAR(30),
  balance_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vendor_ledger_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  vendor_ledger_id INT NOT NULL,
  entry_type ENUM('purchase', 'payment') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  entry_date DATE NOT NULL,
  status ENUM('unpaid', 'partial', 'paid') DEFAULT 'unpaid',
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_ledger_id) REFERENCES vendor_ledgers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recurring_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  frequency ENUM('weekly', 'monthly', 'yearly') NOT NULL,
  next_due_date DATE NOT NULL,
  reminder_days_before INT DEFAULT 3,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS committees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  contribution_amount DECIMAL(12,2) NOT NULL,
  payout_order_index INT DEFAULT 1,
  next_payout_member VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS committee_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  committee_id INT NOT NULL,
  member_name VARCHAR(120) NOT NULL,
  member_phone VARCHAR(30),
  FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS committee_installments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  committee_id INT NOT NULL,
  paid_by_member VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  installment_date DATE NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scanned_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  image_url VARCHAR(255),
  extracted_data_json JSON,
  document_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  raw_command TEXT NOT NULL,
  parsed_result_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credit_card_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  credit_card_id INT NOT NULL,
  expense_id INT NULL,
  amount DECIMAL(12,2) NOT NULL,
  transaction_date DATETIME NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS credit_card_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  credit_card_id INT NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_type ENUM('full', 'partial') NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS financial_timeline (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  title VARCHAR(150) NOT NULL,
  subtitle VARCHAR(255),
  amount DECIMAL(12,2) DEFAULT 0,
  event_date DATETIME NOT NULL,
  reference_table VARCHAR(100),
  reference_id INT,
  metadata_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_expenses_user_date ON expenses(user_id, expense_date);
CREATE INDEX idx_timeline_user_date ON financial_timeline(user_id, event_date);
CREATE INDEX idx_borrow_lend_user_date ON borrow_lend_records(user_id, record_date);
