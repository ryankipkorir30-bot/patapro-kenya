
const pool = require("../config/db");

/**
 * Create a new user
 */
const createUser = async ({
  firstName,
  lastName,
  name,
  email,
  phone,
  role,
  passwordHash,
}) => {
  const query = `
    INSERT INTO users
      (first_name, last_name, name, email, phone, role, password_hash)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id,
      first_name,
      last_name,
      name,
      email,
      phone,
      role,
      created_at;
  `;

  const values = [
    firstName,
    lastName,
    name,
    email,
    phone,
    role,
    passwordHash,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
};

/**
 * Find a user by email
 */
const findUserByEmail = async (email) => {
  const query = `
    SELECT
      id,
      first_name,
      last_name,
      name,
      email,
      phone,
      role,
      password_hash,
      created_at
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
  `;

  const result = await pool.query(query, [email]);

  return result.rows[0] || null;
};

/**
 * Find a user by ID
 */
const findUserById = async (id) => {
  const query = `
    SELECT
      id,
      first_name,
      last_name,
      name,
      email,
      phone,
      role,
      created_at
    FROM users
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0] || null;
};

/**
 * Check whether an email already exists
 */
const emailExists = async (email) => {
  const query = `
    SELECT id
    FROM users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
  `;

  const result = await pool.query(query, [email]);

  return result.rows.length > 0;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  emailExists,
};
