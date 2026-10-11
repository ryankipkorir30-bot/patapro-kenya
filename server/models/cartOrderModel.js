const pool = require("../config/db");

async function getCart(customerId) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.service_id,
       c.quantity,
       s.name AS service_name,
       s.description,
       s.price,
       s.price_type,
       s.business_id,
       b.business_name,
       (s.price * c.quantity) AS subtotal
     FROM shopping_cart_items c
     JOIN services s ON s.id = c.service_id
     JOIN businesses b ON b.id = s.business_id
     WHERE c.customer_id = $1
       AND s.is_active = TRUE
     ORDER BY c.created_at DESC`,
    [customerId]
  );

  return result.rows;
}

async function addToCart(customerId, serviceId, quantity) {
  const result = await pool.query(
    `INSERT INTO shopping_cart_items
       (customer_id, service_id, quantity)
     SELECT $1, s.id, $3
     FROM services s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.id = $2
       AND s.is_active = TRUE
       AND b.is_active = TRUE
     ON CONFLICT (customer_id, service_id)
     DO UPDATE SET
       quantity = shopping_cart_items.quantity + EXCLUDED.quantity,
       updated_at = NOW()
     RETURNING id, customer_id, service_id, quantity`,
    [customerId, serviceId, quantity]
  );

  if (!result.rowCount) {
    throw new Error("Service not found or unavailable.");
  }

  if (result.rows[0].quantity > 100) {
    await pool.query(
      `UPDATE shopping_cart_items
       SET quantity = 100, updated_at = NOW()
       WHERE id = $1`,
      [result.rows[0].id]
    );
  }

  return result.rows[0];
}

async function updateCartQuantity(customerId, serviceId, quantity) {
  const result = await pool.query(
    `UPDATE shopping_cart_items
     SET quantity = $3, updated_at = NOW()
     WHERE customer_id = $1 AND service_id = $2
     RETURNING id, service_id, quantity`,
    [customerId, serviceId, quantity]
  );

  return result.rows[0] || null;
}

async function removeFromCart(customerId, serviceId) {
  const result = await pool.query(
    `DELETE FROM shopping_cart_items
     WHERE customer_id = $1 AND service_id = $2
     RETURNING id`,
    [customerId, serviceId]
  );

  return result.rowCount > 0;
}

async function checkout(customerId, deliveryLocation, customerNote) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cartResult = await client.query(
      `SELECT
         c.service_id,
         c.quantity,
         s.name AS service_name,
         s.price,
         s.price_type,
         b.business_name
       FROM shopping_cart_items c
       JOIN services s ON s.id = c.service_id
       JOIN businesses b ON b.id = s.business_id
       WHERE c.customer_id = $1
         AND s.is_active = TRUE
         AND b.is_active = TRUE
       FOR UPDATE OF c`,
      [customerId]
    );

    const items = cartResult.rows;

    if (!items.length) {
      throw new Error("Your cart is empty.");
    }

    for (const item of items) {
      if (
        item.price === null ||
        item.price_type !== "fixed" ||
        Number(item.price) < 0
      ) {
        throw new Error(
          `"${item.service_name}" requires a quote instead of checkout.`
        );
      }
    }

    const total = items.reduce(
      (sum, item) =>
        sum + Number(item.price) * Number(item.quantity),
      0
    );

    const orderResult = await client.query(
      `INSERT INTO orders
         (customer_id, total_amount, delivery_location, customer_note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, customer_id, status, total_amount,
                 delivery_location, customer_note, created_at`,
      [customerId, total, deliveryLocation || null, customerNote || null]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      const unitPrice = Number(item.price);
      const quantity = Number(item.quantity);

      await client.query(
        `INSERT INTO order_items
           (order_id, service_id, service_name, business_name,
            quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.service_id,
          item.service_name,
          item.business_name,
          quantity,
          unitPrice,
          unitPrice * quantity
        ]
      );
    }

    await client.query(
      "DELETE FROM shopping_cart_items WHERE customer_id = $1",
      [customerId]
    );

    await client.query("COMMIT");

    return { ...order, items };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getCustomerOrders(customerId) {
  const result = await pool.query(
    `SELECT
       o.id,
       o.status,
       o.total_amount,
       o.delivery_location,
       o.customer_note,
       o.created_at,
       COALESCE(
         json_agg(
           json_build_object(
             'serviceId', oi.service_id,
             'serviceName', oi.service_name,
             'businessName', oi.business_name,
             'quantity', oi.quantity,
             'unitPrice', oi.unit_price,
             'subtotal', oi.subtotal
           )
         ) FILTER (WHERE oi.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [customerId]
  );

  return result.rows;
}

module.exports = {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  checkout,
  getCustomerOrders
};