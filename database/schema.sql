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
  income_source VARCHAR(120) DEFAULT 'Salary',
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
  reflect_in_net TINYINT(1) DEFAULT 1,
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
  participant_user_id INT NULL,
  participant_phone VARCHAR(30),
  share_type ENUM('equal', 'custom', 'percentage') DEFAULT 'equal',
  share_amount DECIMAL(12,2) DEFAULT 0,
  percentage_share DECIMAL(5,2),
  paid_amount DECIMAL(12,2) DEFAULT 0,
  is_registered TINYINT(1) DEFAULT 0,
  invite_status ENUM('none', 'suggested', 'requested', 'accepted') DEFAULT 'none',
  FOREIGN KEY (participant_user_id) REFERENCES users(id) ON DELETE SET NULL,
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
  person_user_id INT NULL,
  payment_method_id INT NULL,
  payment_account VARCHAR(120),
  credit_card_id INT NULL,
  reflect_in_net TINYINT(1) DEFAULT 1,
  due_alert_enabled TINYINT(1) DEFAULT 1,
  mirror_record_id INT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (person_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
  FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vendor_ledgers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  vendor_name VARCHAR(150) NOT NULL,
  vendor_phone VARCHAR(30),
  balance_amount DECIMAL(12,2) DEFAULT 0,
  reflect_in_net_by_default TINYINT(1) DEFAULT 1,
  invoice_logo_url VARCHAR(255),
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
  quantity INT DEFAULT 1,
  payment_method_id INT NULL,
  payment_account VARCHAR(120),
  credit_card_id INT NULL,
  reflect_in_net TINYINT(1) DEFAULT 1,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
  FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE SET NULL,
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
  total_amount DECIMAL(12,2) DEFAULT 0,
  total_members INT DEFAULT 0,
  total_months INT DEFAULT 0,
  payout_order_index INT DEFAULT 1,
  next_payout_member VARCHAR(120),
  reflect_in_net_by_default TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS committee_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  committee_id INT NOT NULL,
  member_name VARCHAR(120) NOT NULL,
  member_phone VARCHAR(30),
  user_id INT NULL,
  is_guest TINYINT(1) DEFAULT 0,
  is_registered TINYINT(1) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS committee_installments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  committee_id INT NOT NULL,
  paid_by_member VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  installment_date DATE NOT NULL,
  month_label VARCHAR(20),
  payment_method_id INT NULL,
  payment_account VARCHAR(120),
  credit_card_id INT NULL,
  reflect_in_net TINYINT(1) DEFAULT 1,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
  FOREIGN KEY (credit_card_id) REFERENCES credit_cards(id) ON DELETE SET NULL,
  FOREIGN KEY (committee_id) REFERENCES committees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS income_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  source VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  income_date DATE NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_friends (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  friend_user_id INT NOT NULL,
  requested_by_user_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_friend_pair (user_id, friend_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  reminder_type VARCHAR(60) NOT NULL,
  title VARCHAR(150) NOT NULL,
  message VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  reference_table VARCHAR(100),
  reference_id INT,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'income_source'),
  'SELECT 1',
  "ALTER TABLE users ADD COLUMN income_source VARCHAR(120) DEFAULT 'Salary'"
);
PREPARE s1 FROM @stmt; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'expenses' AND column_name = 'reflect_in_net'),
  'SELECT 1',
  "ALTER TABLE expenses ADD COLUMN reflect_in_net TINYINT(1) DEFAULT 1"
);
PREPARE s2 FROM @stmt; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'expense_shares' AND column_name = 'participant_user_id'),
  'SELECT 1',
  "ALTER TABLE expense_shares ADD COLUMN participant_user_id INT NULL"
);
PREPARE s3 FROM @stmt; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'expense_shares' AND column_name = 'is_registered'),
  'SELECT 1',
  "ALTER TABLE expense_shares ADD COLUMN is_registered TINYINT(1) DEFAULT 0"
);
PREPARE s4 FROM @stmt; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'expense_shares' AND column_name = 'invite_status'),
  'SELECT 1',
  "ALTER TABLE expense_shares ADD COLUMN invite_status ENUM('none', 'suggested', 'requested', 'accepted') DEFAULT 'none'"
);
PREPARE s5 FROM @stmt; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'borrow_lend_records' AND column_name = 'person_user_id'),
  'SELECT 1',
  "ALTER TABLE borrow_lend_records ADD COLUMN person_user_id INT NULL"
);
PREPARE s6 FROM @stmt; EXECUTE s6; DEALLOCATE PREPARE s6;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'borrow_lend_records' AND column_name = 'payment_method_id'),
  'SELECT 1',
  "ALTER TABLE borrow_lend_records ADD COLUMN payment_method_id INT NULL"
);
PREPARE s7 FROM @stmt; EXECUTE s7; DEALLOCATE PREPARE s7;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'borrow_lend_records' AND column_name = 'payment_account'),
  'SELECT 1',
  "ALTER TABLE borrow_lend_records ADD COLUMN payment_account VARCHAR(120)"
);
PREPARE s8 FROM @stmt; EXECUTE s8; DEALLOCATE PREPARE s8;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'borrow_lend_records' AND column_name = 'credit_card_id'),
  'SELECT 1',
  "ALTER TABLE borrow_lend_records ADD COLUMN credit_card_id INT NULL"
);
PREPARE s9 FROM @stmt; EXECUTE s9; DEALLOCATE PREPARE s9;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'borrow_lend_records' AND column_name = 'reflect_in_net'),
  'SELECT 1',
  "ALTER TABLE borrow_lend_records ADD COLUMN reflect_in_net TINYINT(1) DEFAULT 1"
);
PREPARE s10 FROM @stmt; EXECUTE s10; DEALLOCATE PREPARE s10;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'borrow_lend_records' AND column_name = 'due_alert_enabled'),
  'SELECT 1',
  "ALTER TABLE borrow_lend_records ADD COLUMN due_alert_enabled TINYINT(1) DEFAULT 1"
);
PREPARE s11 FROM @stmt; EXECUTE s11; DEALLOCATE PREPARE s11;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'borrow_lend_records' AND column_name = 'mirror_record_id'),
  'SELECT 1',
  "ALTER TABLE borrow_lend_records ADD COLUMN mirror_record_id INT NULL"
);
PREPARE s12 FROM @stmt; EXECUTE s12; DEALLOCATE PREPARE s12;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vendor_ledgers' AND column_name = 'reflect_in_net_by_default'),
  'SELECT 1',
  "ALTER TABLE vendor_ledgers ADD COLUMN reflect_in_net_by_default TINYINT(1) DEFAULT 1"
);
PREPARE s13 FROM @stmt; EXECUTE s13; DEALLOCATE PREPARE s13;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vendor_ledgers' AND column_name = 'invoice_logo_url'),
  'SELECT 1',
  "ALTER TABLE vendor_ledgers ADD COLUMN invoice_logo_url VARCHAR(255)"
);
PREPARE s14 FROM @stmt; EXECUTE s14; DEALLOCATE PREPARE s14;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vendor_ledger_entries' AND column_name = 'quantity'),
  'SELECT 1',
  "ALTER TABLE vendor_ledger_entries ADD COLUMN quantity INT DEFAULT 1"
);
PREPARE s15 FROM @stmt; EXECUTE s15; DEALLOCATE PREPARE s15;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vendor_ledger_entries' AND column_name = 'payment_method_id'),
  'SELECT 1',
  "ALTER TABLE vendor_ledger_entries ADD COLUMN payment_method_id INT NULL"
);
PREPARE s16 FROM @stmt; EXECUTE s16; DEALLOCATE PREPARE s16;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vendor_ledger_entries' AND column_name = 'payment_account'),
  'SELECT 1',
  "ALTER TABLE vendor_ledger_entries ADD COLUMN payment_account VARCHAR(120)"
);
PREPARE s17 FROM @stmt; EXECUTE s17; DEALLOCATE PREPARE s17;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vendor_ledger_entries' AND column_name = 'credit_card_id'),
  'SELECT 1',
  "ALTER TABLE vendor_ledger_entries ADD COLUMN credit_card_id INT NULL"
);
PREPARE s18 FROM @stmt; EXECUTE s18; DEALLOCATE PREPARE s18;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'vendor_ledger_entries' AND column_name = 'reflect_in_net'),
  'SELECT 1',
  "ALTER TABLE vendor_ledger_entries ADD COLUMN reflect_in_net TINYINT(1) DEFAULT 1"
);
PREPARE s19 FROM @stmt; EXECUTE s19; DEALLOCATE PREPARE s19;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committees' AND column_name = 'total_amount'),
  'SELECT 1',
  "ALTER TABLE committees ADD COLUMN total_amount DECIMAL(12,2) DEFAULT 0"
);
PREPARE s20 FROM @stmt; EXECUTE s20; DEALLOCATE PREPARE s20;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committees' AND column_name = 'total_members'),
  'SELECT 1',
  "ALTER TABLE committees ADD COLUMN total_members INT DEFAULT 0"
);
PREPARE s21 FROM @stmt; EXECUTE s21; DEALLOCATE PREPARE s21;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committees' AND column_name = 'total_months'),
  'SELECT 1',
  "ALTER TABLE committees ADD COLUMN total_months INT DEFAULT 0"
);
PREPARE s22 FROM @stmt; EXECUTE s22; DEALLOCATE PREPARE s22;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committees' AND column_name = 'reflect_in_net_by_default'),
  'SELECT 1',
  "ALTER TABLE committees ADD COLUMN reflect_in_net_by_default TINYINT(1) DEFAULT 1"
);
PREPARE s23 FROM @stmt; EXECUTE s23; DEALLOCATE PREPARE s23;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_members' AND column_name = 'user_id'),
  'SELECT 1',
  "ALTER TABLE committee_members ADD COLUMN user_id INT NULL"
);
PREPARE s24 FROM @stmt; EXECUTE s24; DEALLOCATE PREPARE s24;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_members' AND column_name = 'is_guest'),
  'SELECT 1',
  "ALTER TABLE committee_members ADD COLUMN is_guest TINYINT(1) DEFAULT 0"
);
PREPARE s25 FROM @stmt; EXECUTE s25; DEALLOCATE PREPARE s25;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_members' AND column_name = 'is_registered'),
  'SELECT 1',
  "ALTER TABLE committee_members ADD COLUMN is_registered TINYINT(1) DEFAULT 0"
);
PREPARE s26 FROM @stmt; EXECUTE s26; DEALLOCATE PREPARE s26;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_installments' AND column_name = 'month_label'),
  'SELECT 1',
  "ALTER TABLE committee_installments ADD COLUMN month_label VARCHAR(20)"
);
PREPARE s27 FROM @stmt; EXECUTE s27; DEALLOCATE PREPARE s27;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_installments' AND column_name = 'payment_method_id'),
  'SELECT 1',
  "ALTER TABLE committee_installments ADD COLUMN payment_method_id INT NULL"
);
PREPARE s28 FROM @stmt; EXECUTE s28; DEALLOCATE PREPARE s28;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_installments' AND column_name = 'payment_account'),
  'SELECT 1',
  "ALTER TABLE committee_installments ADD COLUMN payment_account VARCHAR(120)"
);
PREPARE s29 FROM @stmt; EXECUTE s29; DEALLOCATE PREPARE s29;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_installments' AND column_name = 'credit_card_id'),
  'SELECT 1',
  "ALTER TABLE committee_installments ADD COLUMN credit_card_id INT NULL"
);
PREPARE s30 FROM @stmt; EXECUTE s30; DEALLOCATE PREPARE s30;

SET @stmt = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'committee_installments' AND column_name = 'reflect_in_net'),
  'SELECT 1',
  "ALTER TABLE committee_installments ADD COLUMN reflect_in_net TINYINT(1) DEFAULT 1"
);
PREPARE s31 FROM @stmt; EXECUTE s31; DEALLOCATE PREPARE s31;

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
