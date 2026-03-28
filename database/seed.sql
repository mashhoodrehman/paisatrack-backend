USE paisatrack_pk;

INSERT IGNORE INTO categories (name, icon_name, color_hex, is_default) VALUES
('Groceries', 'shopping-cart', '#16A34A', 1),
('Fuel', 'fuel', '#2563EB', 1),
('Doctor', 'stethoscope', '#EF4444', 1),
('Education Fees', 'graduation-cap', '#2563EB', 1),
('Utilities', 'bolt', '#F59E0B', 1),
('Travel', 'plane', '#0EA5E9', 1),
('Car Repair', 'wrench', '#6B7280', 1),
('Home Repair', 'home', '#10B981', 1),
('Shopping', 'bag', '#EC4899', 1),
('Wedding', 'gift', '#F97316', 1),
('Subscriptions', 'refresh-cw', '#8B5CF6', 1),
('Borrow/Lend', 'wallet', '#EF4444', 1),
('Parchi', 'book-open', '#16A34A', 1),
('Committee', 'users', '#2563EB', 1);

INSERT IGNORE INTO payment_methods (name, type, is_default) VALUES
('Cash', 'cash', 1),
('Debit Card', 'bank_card', 1),
('Credit Card', 'bank_card', 1),
('JazzCash', 'wallet', 1),
('Easypaisa', 'wallet', 1),
('Bank Transfer', 'bank', 1),
('Loan/Installment', 'liability', 1);
