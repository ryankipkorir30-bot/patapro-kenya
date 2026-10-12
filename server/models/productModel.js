const pool = require("../config/db");

async function listPublishedProducts({
  search = "",
  category = "",
  limit = 24,
  offset = 0
} = {}) {
  const conditions = ["p.status = 'published'"];
  const values = [];

  if (search.trim()) {
    values.push(`%${search.trim()}%`);
    conditions.push(
      `(p.name ILIKE $${values.length}
        OR p.description ILIKE $${values.length}
        OR p.category ILIKE $${values.length})`
    );
  }

  if (category.trim()) {
    values.push(category.trim());
    conditions.push(`p.category ILIKE $${values.length}`);
  }

  values.push(Math.min(Math.max(Number(limit) || 24, 1), 60));
  const limitIndex = values.length;

  values.push(Math.max(Number(offset) || 0, 0));
  const offsetIndex = values.length;

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.category,
        p.price,
        p.image_url,
        p.stock_quantity,
        p.created_at,
        u.name AS seller_name
      FROM products p
      LEFT JOIN users u ON u.id = p.seller_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `,
    values
  );

  return result.rows;
}

async function findProductById(id) {
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.category,
        p.price,
        p.image_url,
        p.stock_quantity,
        p.status,
        p.seller_id,
        p.created_at,
        u.name AS seller_name
      FROM products p
      LEFT JOIN users u ON u.id = p.seller_id
      WHERE p.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function isActiveSeller(sellerId) {
  const result = await pool.query(
    `SELECT id
     FROM users
     WHERE id = $1
       AND is_active = TRUE
       AND role IN ('business', 'service_provider')
     LIMIT 1`,
    [sellerId]
  );

  return result.rowCount === 1;
}

async function listSellerProducts(sellerId) {
  const result = await pool.query(
    `
      SELECT *
      FROM products
      WHERE seller_id = $1
      ORDER BY created_at DESC
    `,
    [sellerId]
  );

  return result.rows;
}

async function createProduct(sellerId, product) {
  const {
    name,
    description,
    category,
    price,
    imageUrl,
    stockQuantity
  } = product;

  const result = await pool.query(
    `
      INSERT INTO products (
        seller_id,
        name,
        description,
        category,
        price,
        image_url,
        stock_quantity,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
      RETURNING *
    `,
    [
      sellerId,
      name.trim(),
      description.trim(),
      category.trim(),
      price,
      imageUrl || null,
      stockQuantity
    ]
  );

  return result.rows[0];
}

async function updateProduct(sellerId, productId, product) {
  const {
    name,
    description,
    category,
    price,
    imageUrl,
    stockQuantity
  } = product;

  const result = await pool.query(
    `
      UPDATE products
      SET
        name = $1,
        description = $2,
        category = $3,
        price = $4,
        image_url = $5,
        stock_quantity = $6,
        updated_at = NOW()
      WHERE id = $7 AND seller_id = $8
      RETURNING *
    `,
    [
      name.trim(),
      description.trim(),
      category.trim(),
      price,
      imageUrl || null,
      stockQuantity,
      productId,
      sellerId
    ]
  );

  return result.rows[0] || null;
}

async function archiveProduct(sellerId, productId) {
  const result = await pool.query(
    `
      UPDATE products
      SET status = 'archived', updated_at = NOW()
      WHERE id = $1 AND seller_id = $2
      RETURNING id
    `,
    [productId, sellerId]
  );

  return result.rows[0] || null;
}

module.exports = {
  isActiveSeller,
  listPublishedProducts,
  findProductById,
  listSellerProducts,
  createProduct,
  updateProduct,
  archiveProduct
};
