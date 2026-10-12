const pool = require("../config/db");

async function createProductOrder(customerId, details, items) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock product rows so concurrent checkouts cannot oversell stock.
    const productIds = [
      ...new Set(items.map((item) => Number(item.productId)))
    ].sort((a, b) => a - b);

    if (
      productIds.length !== items.length ||
      productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    ) {
      throw new Error("Invalid or duplicate product in cart.");
    }

    const result = await client.query(
      `SELECT id, seller_id, name, price, stock_quantity, status
       FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    const products = new Map(
      result.rows.map((product) => [String(product.id), product])
    );

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = products.get(String(item.productId));
      const quantity = Number(item.quantity);

      if (!product || product.status !== "published") {
        throw new Error(`Product ${item.productId} is unavailable.`);
      }

      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
      ) {
        throw new Error("Each quantity must be between 1 and 100.");
      }

      if (Number(product.stock_quantity) < quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}.`
        );
      }

      const unitPrice = Number(product.price);
      const lineSubtotal = Math.round(unitPrice * quantity * 100) / 100;

      subtotal += lineSubtotal;

      orderItems.push({
        productId: product.id,
        sellerId: product.seller_id,
        name: product.name,
        unitPrice,
        quantity,
        subtotal: lineSubtotal
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;

    const orderResult = await client.query(
      `INSERT INTO product_orders (
         customer_id, status, payment_method, payment_status,
         subtotal, delivery_name, delivery_phone, delivery_email,
         delivery_county, delivery_town, delivery_address, customer_note
       )
       VALUES (
         $1, 'pending', $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10
       )
       RETURNING id, status, payment_method, payment_status, subtotal, created_at`,
      [
        customerId,
        details.paymentMethod,
        subtotal,
        details.fullName,
        details.phone,
        details.email || null,
        details.county,
        details.town,
        details.address,
        details.notes || null
      ]
    );

    const order = orderResult.rows[0];

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO product_order_items (
           order_id, product_id, seller_id, product_name,
           unit_price, quantity, subtotal
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.productId,
          item.sellerId,
          item.name,
          item.unitPrice,
          item.quantity,
          item.subtotal
        ]
      );

      const stockUpdate = await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1,
             updated_at = NOW()
         WHERE id = $2 AND stock_quantity >= $1`,
        [item.quantity, item.productId]
      );

      if (stockUpdate.rowCount !== 1) {
        throw new Error(`Stock changed for ${item.name}. Please try again.`);
      }
    }

    await client.query("COMMIT");

    return {
      ...order,
      items: orderItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal
      }))
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCustomerOrders(customerId) {
  const result = await pool.query(
    `SELECT
       o.id, o.status, o.payment_method, o.payment_status,
       o.subtotal, o.created_at,
       COALESCE(
         json_agg(
           json_build_object(
             'productName', i.product_name,
             'quantity', i.quantity,
             'unitPrice', i.unit_price,
             'subtotal', i.subtotal
           )
         ) FILTER (WHERE i.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM product_orders o
     LEFT JOIN product_order_items i ON i.order_id = o.id
     WHERE o.customer_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [customerId]
  );

  return result.rows;
}


async function getCustomerOrder(customerId, orderId) {
  const result = await pool.query(
    `SELECT
       o.id, o.customer_id, o.status, o.payment_method, o.payment_status,
       o.subtotal, o.delivery_name, o.delivery_phone, o.delivery_email,
       o.delivery_county, o.delivery_town, o.delivery_address,
       o.customer_note, o.created_at, o.updated_at,
       COALESCE(
         json_agg(
           json_build_object(
             'id', i.id,
             'productId', i.product_id,
             'sellerId', i.seller_id,
             'productName', i.product_name,
             'quantity', i.quantity,
             'unitPrice', i.unit_price,
             'subtotal', i.subtotal
           )
         ) FILTER (WHERE i.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM product_orders o
     LEFT JOIN product_order_items i ON i.order_id = o.id
     WHERE o.customer_id = $1 AND o.id = $2
     GROUP BY o.id
     LIMIT 1`,
    [customerId, orderId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createProductOrder,
  listCustomerOrders,
  getCustomerOrder
};
