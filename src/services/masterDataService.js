const pool = require("../db/pool");

async function getCategories() {
  const [rows] = await pool.query(
    "SELECT id, name, icon_name, color_hex, is_default FROM categories ORDER BY name"
  );
  return rows;
}

async function getPaymentMethods() {
  const [rows] = await pool.query(
    "SELECT id, name, type, is_default FROM payment_methods ORDER BY name"
  );
  return rows;
}

module.exports = {
  getCategories,
  getPaymentMethods
};
