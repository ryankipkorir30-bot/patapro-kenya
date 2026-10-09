const pool = require("../config/db");

/*
|--------------------------------------------------------------------------
| Create Payment
|--------------------------------------------------------------------------
*/
async function createPayment({
  userId,
  businessId,
  featuredListingId,
  amount,
  phone,
  provider = "mpesa",
  description,
}) {
  const result = await pool.query(
    `
    INSERT INTO payments (
      user_id,
      business_id,
      featured_listing_id,
      amount,
      phone,
      provider,
      description,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
    RETURNING *
    `,
    [
      userId,
      businessId,
      featuredListingId,
      amount,
      phone,
      provider,
      description,
    ]
  );

  return result.rows[0];
}


/*
|--------------------------------------------------------------------------
| Update Payment
|--------------------------------------------------------------------------
*/
async function updatePayment(id, fields) {
  const allowedFields = [
    "checkout_request_id",
    "merchant_request_id",
    "mpesa_receipt_number",
    "transaction_date",
    "status",
    "metadata",
  ];

  const updates = [];
  const values = [];
  let index = 1;

  for (const field of allowedFields) {
    if (fields[field] !== undefined) {
      updates.push(`${field} = $${index}`);
      values.push(fields[field]);
      index++;
    }
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  values.push(id);

  const result = await pool.query(
    `
    UPDATE payments
    SET ${updates.join(", ")}
    WHERE id = $${index}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| Find Payment By ID
|--------------------------------------------------------------------------
*/
async function findPaymentById(id) {
  const result = await pool.query(
    `
    SELECT
      p.*,

      u.name AS user_name,
      u.email AS user_email,

      b.business_name,

      fl.duration_days,
      fl.status AS featured_status

    FROM payments p

    JOIN users u
      ON u.id = p.user_id

    LEFT JOIN businesses b
      ON b.id = p.business_id

    LEFT JOIN featured_listings fl
      ON fl.id = p.featured_listing_id

    WHERE p.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| Find Payment By Checkout Request ID
|--------------------------------------------------------------------------
*/
async function findPaymentByCheckoutRequestId(checkoutRequestId) {
  const result = await pool.query(
    `
    SELECT *
    FROM payments
    WHERE checkout_request_id = $1
    LIMIT 1
    `,
    [checkoutRequestId]
  );

  return result.rows[0] || null;
}


/*
|--------------------------------------------------------------------------
| Get User Payments
|--------------------------------------------------------------------------
*/
async function findPaymentsByUser(userId) {
  const result = await pool.query(
    `
    SELECT
      p.*,
      b.business_name,
      fl.duration_days

    FROM payments p

    LEFT JOIN businesses b
      ON b.id = p.business_id

    LEFT JOIN featured_listings fl
      ON fl.id = p.featured_listing_id

    WHERE p.user_id = $1

    ORDER BY p.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}


/*
|--------------------------------------------------------------------------
| Get All Payments - Admin
|--------------------------------------------------------------------------
*/
async function findAllPayments() {
  const result = await pool.query(
    `
    SELECT
      p.*,

      u.name AS user_name,
      u.email AS user_email,

      b.business_name

    FROM payments p

    JOIN users u
      ON u.id = p.user_id

    LEFT JOIN businesses b
      ON b.id = p.business_id

    ORDER BY p.created_at DESC
    `
  );

  return result.rows;
}


module.exports = {
  createPayment,
  updatePayment,
  findPaymentById,
  findPaymentByCheckoutRequestId,
  findPaymentsByUser,
  findAllPayments,
};