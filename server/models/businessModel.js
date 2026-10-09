const pool = require("../config/db");

/*
|--------------------------------------------------------------------------
| Create Business
|--------------------------------------------------------------------------
*/

const createBusiness = async ({
  ownerId,
  businessName,
  slug,
  description,
  category,
  subcategory,
  phone,
  whatsapp,
  email,
  website,
  county,
  town,
  location,
  logoUrl,
  coverImageUrl,
  openingHours,
}) => {
  const query = `
    INSERT INTO businesses (
      owner_id,
      business_name,
      slug,
      description,
      category,
      subcategory,
      phone,
      whatsapp,
      email,
      website,
      county,
      town,
      location,
      logo_url,
      cover_image_url,
      opening_hours
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16
    )
    RETURNING *;
  `;

  const values = [
    ownerId,
    businessName,
    slug,
    description || null,
    category,
    subcategory || null,
    phone || null,
    whatsapp || null,
    email || null,
    website || null,
    county || null,
    town || null,
    location || null,
    logoUrl || null,
    coverImageUrl || null,
    openingHours || null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
};


/*
|--------------------------------------------------------------------------
| Find Business By ID
|--------------------------------------------------------------------------
*/

const findBusinessById = async (id) => {
  const query = `
    SELECT
      b.*,
      u.name AS owner_name,
      u.email AS owner_email
    FROM businesses b
    JOIN users u
      ON u.id = b.owner_id
    WHERE b.id = $1
      AND b.is_active = TRUE
    LIMIT 1;
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};


/*
|--------------------------------------------------------------------------
| Find Business By Slug
|--------------------------------------------------------------------------
*/

const findBusinessBySlug = async (slug) => {
  const query = `
    SELECT
      b.*,
      u.name AS owner_name
    FROM businesses b
    JOIN users u
      ON u.id = b.owner_id
    WHERE b.slug = $1
      AND b.is_active = TRUE
    LIMIT 1;
  `;

  const result = await pool.query(query, [slug]);

  return result.rows[0] || null;
};


/*
|--------------------------------------------------------------------------
| Search Businesses
|--------------------------------------------------------------------------
*/

const searchBusinesses = async ({
  search,
  category,
  county,
  town,
  limit = 20,
  offset = 0,
}) => {
  const conditions = [
    "b.is_active = TRUE"
  ];

  const values = [];
  let parameterIndex = 1;

  if (search) {
    conditions.push(`
      (
        b.business_name ILIKE $${parameterIndex}
        OR b.description ILIKE $${parameterIndex}
        OR b.category ILIKE $${parameterIndex}
        OR b.town ILIKE $${parameterIndex}
      )
    `);

    values.push(`%${search}%`);
    parameterIndex++;
  }

  if (category) {
    conditions.push(
      `b.category ILIKE $${parameterIndex}`
    );

    values.push(category);
    parameterIndex++;
  }

  if (county) {
    conditions.push(
      `b.county ILIKE $${parameterIndex}`
    );

    values.push(county);
    parameterIndex++;
  }

  if (town) {
    conditions.push(
      `b.town ILIKE $${parameterIndex}`
    );

    values.push(town);
    parameterIndex++;
  }

  values.push(limit);
  const limitIndex = parameterIndex++;

  values.push(offset);
  const offsetIndex = parameterIndex++;

  const query = `
    SELECT
      b.id,
      b.business_name,
      b.slug,
      b.description,
      b.category,
      b.subcategory,
      b.phone,
      b.whatsapp,
      b.email,
      b.website,
      b.county,
      b.town,
      b.location,
      b.logo_url,
      b.cover_image_url,
      b.rating,
      b.review_count,
      b.is_verified,
      b.is_featured,
      b.created_at
    FROM businesses b
    WHERE ${conditions.join(" AND ")}
    ORDER BY
      b.is_featured DESC,
      b.is_verified DESC,
      b.rating DESC,
      b.created_at DESC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex};
  `;

  const result = await pool.query(query, values);

  return result.rows;
};


/*
|--------------------------------------------------------------------------
| Get Businesses Owned By User
|--------------------------------------------------------------------------
*/

const findBusinessesByOwner = async (ownerId) => {
  const query = `
    SELECT *
    FROM businesses
    WHERE owner_id = $1
    ORDER BY created_at DESC;
  `;

  const result = await pool.query(query, [ownerId]);

  return result.rows;
};


/*
|--------------------------------------------------------------------------
| Update Business
|--------------------------------------------------------------------------
*/

const updateBusiness = async (id, ownerId, data) => {
  const {
    businessName,
    description,
    category,
    subcategory,
    phone,
    whatsapp,
    email,
    website,
    county,
    town,
    location,
    logoUrl,
    coverImageUrl,
    openingHours,
  } = data;

  const query = `
    UPDATE businesses
    SET
      business_name = COALESCE($1, business_name),
      description = COALESCE($2, description),
      category = COALESCE($3, category),
      subcategory = COALESCE($4, subcategory),
      phone = COALESCE($5, phone),
      whatsapp = COALESCE($6, whatsapp),
      email = COALESCE($7, email),
      website = COALESCE($8, website),
      county = COALESCE($9, county),
      town = COALESCE($10, town),
      location = COALESCE($11, location),
      logo_url = COALESCE($12, logo_url),
      cover_image_url = COALESCE($13, cover_image_url),
      opening_hours = COALESCE($14, opening_hours)
    WHERE id = $15
      AND owner_id = $16
    RETURNING *;
  `;

  const values = [
    businessName || null,
    description || null,
    category || null,
    subcategory || null,
    phone || null,
    whatsapp || null,
    email || null,
    website || null,
    county || null,
    town || null,
    location || null,
    logoUrl || null,
    coverImageUrl || null,
    openingHours || null,
    id,
    ownerId,
  ];

  const result = await pool.query(query, values);

  return result.rows[0] || null;
};


/*
|--------------------------------------------------------------------------
| Delete / Deactivate Business
|--------------------------------------------------------------------------
*/

const deactivateBusiness = async (id, ownerId) => {
  const query = `
    UPDATE businesses
    SET is_active = FALSE
    WHERE id = $1
      AND owner_id = $2
    RETURNING id, business_name, is_active;
  `;

  const result = await pool.query(query, [id, ownerId]);

  return result.rows[0] || null;
};

// Update a business logo/photo.
const updateBusinessPhoto = async (businessId, imageUrl) => {
  const result = await pool.query(
    `UPDATE businesses
     SET logo_url = $1
     WHERE id = $2
     RETURNING *`,
    [imageUrl, businessId]
  );

  return result.rows[0] || null;
};

module.exports = {
  createBusiness,
  findBusinessById,
  findBusinessBySlug,
  searchBusinesses,
  findBusinessesByOwner,
  updateBusiness,
  deactivateBusiness,
  updateBusinessPhoto
};
