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
        q.agreed_price,
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
        q.agreed_price,
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


async function proposeQuotePrice(quoteId, businessId, agreedPrice) {
  const result = await pool.query(
    `
      UPDATE quotes
      SET
        agreed_price = $1,
        status = 'responded',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND business_id = $3
        AND status IN ('pending', 'viewed', 'responded')
      RETURNING *
    `,
    [agreedPrice, quoteId, businessId]
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
// Accept a proposed quote and create an order atomically
async function acceptQuoteAndCreateOrder(quoteId, customerId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the quote so it cannot be accepted twice concurrently.
    const quoteResult = await client.query(
      `
        SELECT
          q.id,
          q.customer_id,
          q.business_id,
          q.service_id,
          q.agreed_price,
          q.status,
          s.name AS service_name,
          b.business_name
        FROM quotes q
        JOIN businesses b ON b.id = q.business_id
        LEFT JOIN services s ON s.id = q.service_id
        WHERE q.id = $1
          AND q.customer_id = $2
        FOR UPDATE OF q
      `,
      [quoteId, customerId]
    );

    const quote = quoteResult.rows[0];

    if (!quote) {
      throw new Error("QUOTE_NOT_FOUND");
    }

    if (quote.status !== "responded" || quote.agreed_price === null) {
      throw new Error("QUOTE_NOT_READY");
    }

    if (!quote.service_id || !quote.service_name) {
      throw new Error("QUOTE_SERVICE_REQUIRED");
    }

    const agreedPrice = Number(quote.agreed_price);

    if (!Number.isFinite(agreedPrice) || agreedPrice < 0) {
      throw new Error("INVALID_AGREED_PRICE");
    }

    // Create the order at the proposed price, not the catalogue price.
    const orderResult = await client.query(
      `
        INSERT INTO orders (customer_id, total_amount)
        VALUES ($1, $2)
        RETURNING id, customer_id, status, total_amount, created_at
      `,
      [customerId, agreedPrice]
    );

    const order = orderResult.rows[0];

    await client.query(
      `
        INSERT INTO order_items (
          order_id,
          service_id,
          service_name,
          business_name,
          quantity,
          unit_price,
          subtotal
        )
        VALUES ($1, $2, $3, $4, 1, $5, $5)
      `,
      [
        order.id,
        quote.service_id,
        quote.service_name,
        quote.business_name,
        agreedPrice
      ]
    );

    const acceptedResult = await client.query(
      `
        UPDATE quotes
        SET status = 'accepted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND customer_id = $2
          AND status = 'responded'
        RETURNING *
      `,
      [quoteId, customerId]
    );

    if (!acceptedResult.rowCount) {
      throw new Error("QUOTE_NOT_READY");
    }

    await client.query("COMMIT");

    return {
      order,
      quote: acceptedResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = {
  createQuote,
  findQuoteById,
  findQuotesByCustomer,
  findQuotesByBusiness,
  updateQuoteStatus,
  proposeQuotePrice,
  businessBelongsToUser,
  acceptQuoteAndCreateOrder
};
