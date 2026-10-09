const pool = require("../config/db");

/*
|--------------------------------------------------------------------------
| Create Service
|--------------------------------------------------------------------------
*/

const createService = async ({
  businessId,
  name,
  description,
  price,
  priceType,
  imageUrl,
}) => {
  const query = `
    INSERT INTO services (
      business_id,
      name,
      description,
      price,
      price_type,
      image_url
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    businessId,
    name,
    description || null,
    price ?? null,
    priceType || "fixed",
    imageUrl || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
};


/*
|--------------------------------------------------------------------------
| Get Services For Business
|--------------------------------------------------------------------------
*/

const findServicesByBusiness = async (businessId) => {
  const query = `
    SELECT *
    FROM services
    WHERE business_id = $1
      AND is_active = TRUE
    ORDER BY created_at DESC;
  `;

  const result = await pool.query(query, [businessId]);

  return result.rows;
};


/*
|--------------------------------------------------------------------------
| Get One Service
|--------------------------------------------------------------------------
*/

const findServiceById = async (id) => {
  const query = `
    SELECT
      s.*,
      b.business_name,
      b.owner_id
    FROM services s
    JOIN businesses b
      ON b.id = s.business_id
    WHERE s.id = $1
      AND s.is_active = TRUE
    LIMIT 1;
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};


/*
|--------------------------------------------------------------------------
| Update Service
|--------------------------------------------------------------------------
*/

const updateService = async (id, businessId, data) => {
  const {
    name,
    description,
    price,
    priceType,
    imageUrl,
  } = data;

  const query = `
    UPDATE services
    SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      price = COALESCE($3, price),
      price_type = COALESCE($4, price_type),
      image_url = COALESCE($5, image_url)
    WHERE id = $6
      AND business_id = $7
      AND is_active = TRUE
    RETURNING *;
  `;

  const values = [
    name || null,
    description || null,
    price ?? null,
    priceType || null,
    imageUrl || null,
    id,
    businessId,
  ];

  const result = await pool.query(query, values);

  return result.rows[0] || null;
};


/*
|--------------------------------------------------------------------------
| Deactivate Service
|--------------------------------------------------------------------------
*/

const deactivateService = async (id, businessId) => {
  const query = `
    UPDATE services
    SET is_active = FALSE
    WHERE id = $1
      AND business_id = $2
    RETURNING id, name, is_active;
  `;

  const result = await pool.query(query, [
    id,
    businessId,
  ]);

  return result.rows[0] || null;
};


/*
|--------------------------------------------------------------------------
| Check Business Ownership
|--------------------------------------------------------------------------
*/

const businessBelongsToUser = async (
  businessId,
  userId
) => {
  const query = `
    SELECT id
    FROM businesses
    WHERE id = $1
      AND owner_id = $2
      AND is_active = TRUE
    LIMIT 1;
  `;

  const result = await pool.query(query, [
    businessId,
    userId,
  ]);

  return result.rows.length > 0;
};


module.exports = {
  createService,
  findServicesByBusiness,
  findServiceById,
  updateService,
  deactivateService,
  businessBelongsToUser,
};