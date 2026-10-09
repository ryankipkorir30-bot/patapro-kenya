const pool = require("../config/db");


// Create a quote
async function createQuote({
  customerId,
  businessId,
  serviceId = null,
  subject,
  message,
  budget = null
}) {
  const result = await pool.query(
    `
      INSERT INTO quotes (
        customer_id,
        business_id,
        service_id,
        subject,
        message,
        budget
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      customerId,
      businessId,
      serviceId,
      subject,
      message,
      budget
    ]
  );

  return result.rows[0];
}


// Get one quote with complete information
async function findQuoteById(id) {
  const result = await pool.query(
    `
      SELECT
        q.id,
        q.customer_id,
        q.business_id,
        q.service_id,

        q.subject,
        q.message,
        q.budget,
        q.status,

        q.created_at,
        q.updated_at,

        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone,

        b.business_name,
        b.email AS business_email,
        b.phone AS business_phone,

        s.name AS service_name

      FROM quotes q

      JOIN users c
        ON c.id = q.customer_id

      JOIN businesses b
        ON b.id = q.business_id

      LEFT JOIN services s
        ON s.id = q.service_id

      WHERE q.id = $1

      LIMIT 1
    `,
    [id]
  );

  return result.rows[0];
}


// Get all quotes created by a customer
async function findQuotesByCustomer(customerId) {
  const result = await pool.query(
    `
      SELECT
        q.id,
        q.customer_id,
        q.business_id,
        q.service_id,

        q.subject,
        q.message,
        q.budget,
        q.status,

        q.created_at,
        q.updated_at,

        b.business_name,

        b.email AS business_email,
        b.phone AS business_phone,

        b.county,
        b.town,
        b.location,

        s.name AS service_name

      FROM quotes q

      JOIN businesses b
        ON b.id = q.business_id

      LEFT JOIN services s
        ON s.id = q.service_id

      WHERE q.customer_id = $1

      ORDER BY q.created_at DESC
    `,
    [customerId]
  );

  return result.rows;
}


// Get all quotes received by a business
async function findQuotesByBusiness(businessId) {
  const result = await pool.query(
    `
      SELECT
        q.id,
        q.customer_id,
        q.business_id,
        q.service_id,

        q.subject,
        q.message,
        q.budget,
        q.status,

        q.created_at,
        q.updated_at,

        CONCAT(
          c.first_name,
          ' ',
          c.last_name
        ) AS customer_name,

        c.email AS customer_email,
        c.phone AS customer_phone,

        s.name AS service_name

      FROM quotes q

      JOIN users c
        ON c.id = q.customer_id

      LEFT JOIN services s
        ON s.id = q.service_id

      WHERE q.business_id = $1

      ORDER BY q.created_at DESC
    `,
    [businessId]
  );

  return result.rows;
}


// Update quote status
async function updateQuoteStatus(
  quoteId,
  businessId,
  status
) {
  const result = await pool.query(
    `
      UPDATE quotes

      SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP

      WHERE id = $2
        AND business_id = $3

      RETURNING *
    `,
    [
      status,
      quoteId,
      businessId
    ]
  );

  return result.rows[0];
}


// Check whether a business belongs to a user
async function businessBelongsToUser(
  businessId,
  userId
) {
  const result = await pool.query(
    `
      SELECT id

      FROM businesses

      WHERE id = $1
        AND owner_id = $2

      LIMIT 1
    `,
    [
      businessId,
      userId
    ]
  );

  return result.rows.length > 0;
}


module.exports = {
  createQuote,
  findQuoteById,
  findQuotesByCustomer,
  findQuotesByBusiness,
  updateQuoteStatus,
  businessBelongsToUser
};