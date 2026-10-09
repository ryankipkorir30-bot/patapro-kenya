const pool = require("../config/db");

/*
|--------------------------------------------------------------------------
| ADMIN DASHBOARD OVERVIEW
|--------------------------------------------------------------------------
*/
const getOverview = async (req, res) => {
  try {
    const users = await pool.query(
      "SELECT COUNT(*)::int AS count FROM users"
    );

    const businesses = await pool.query(
      "SELECT COUNT(*)::int AS count FROM businesses"
    );

    const verifiedBusinesses = await pool.query(
      "SELECT COUNT(*)::int AS count FROM businesses WHERE is_verified = true"
    );

    const quotes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM quotes"
    );

    const pendingVerifications = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM verification_requests
       WHERE status = 'pending'`
    );

    const featured = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM featured_listings
       WHERE status = 'active'`
    );

    const payments = await pool.query(
      `SELECT
         COUNT(*)::int AS count,
         COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE status = 'completed'`
    );

    return res.json({
      users: users.rows[0].count,
      businesses: businesses.rows[0].count,
      verifiedBusinesses: verifiedBusinesses.rows[0].count,
      quotes: quotes.rows[0].count,
      pendingVerifications: pendingVerifications.rows[0].count,
      featured: featured.rows[0].count,
      completedPayments: payments.rows[0].count,
      revenue: payments.rows[0].total
    });
  } catch (error) {
    console.error("Admin overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load admin overview"
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET ALL USERS
|--------------------------------------------------------------------------
*/
const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        first_name,
        last_name,
        name,
        email,
        phone,
        role,
        is_active,
        is_verified,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Admin users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load users"
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET ONE USER'S FULL SAFE DETAILS
|--------------------------------------------------------------------------
*/
const getUserDetails = async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         first_name,
         last_name,
         name,
         email,
         phone,
         role,
         is_active,
         is_verified,
         created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Admin get user details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user details."
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET ALL BUSINESSES
|--------------------------------------------------------------------------
*/
const getBusinesses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.*,
        u.name AS owner_name,
        u.email AS owner_email
      FROM businesses b
      LEFT JOIN users u
        ON b.owner_id = u.id
      ORDER BY b.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Admin businesses error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load businesses"
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET BUSINESS VERIFICATION REQUESTS
|--------------------------------------------------------------------------
*/
const getVerificationRequests = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        vr.id,
        vr.business_id,
        vr.submitted_by,
        vr.document_type,
        vr.document_url,
        vr.notes,
        vr.status,
        vr.reviewed_by,
        vr.reviewed_at,
        vr.created_at,
        b.business_name,
        u.name AS submitted_by_name,
        u.email AS submitted_by_email
      FROM verification_requests vr
      LEFT JOIN businesses b
        ON b.id = vr.business_id
      LEFT JOIN users u
        ON u.id = vr.submitted_by
      ORDER BY vr.created_at DESC
    `);

    return res.json({
      success: true,
      verifications: result.rows
    });
  } catch (error) {
    console.error("Admin verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load verification requests."
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET QUOTE REQUESTS
|--------------------------------------------------------------------------
*/
const getQuotes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        q.*,
        b.business_name,
        b.town,
        b.county,
        b.location,
        s.name AS service_name,
        customer.name AS customer_name,
        customer.email AS customer_email
      FROM quotes q
      LEFT JOIN businesses b
        ON q.business_id = b.id
      LEFT JOIN services s
        ON q.service_id = s.id
      LEFT JOIN users customer
        ON q.customer_id = customer.id
      ORDER BY q.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Admin quotes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load quotes"
    });
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE QUOTE STATUS
|--------------------------------------------------------------------------
*/
const updateQuoteStatus = async (req, res) => {
  try {
    const quoteId = Number(req.params.id);
    const { status } = req.body || {};

    const allowedStatuses = [
      "pending",
      "viewed",
      "responded",
      "accepted",
      "rejected",
      "completed",
      "cancelled"
    ];

    if (!Number.isSafeInteger(quoteId) || quoteId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid quote ID."
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid quote status."
      });
    }

    const result = await pool.query(
      `UPDATE quotes
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, quoteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quote not found."
      });
    }

    return res.json({
      success: true,
      message: "Quote status updated successfully.",
      quote: result.rows[0]
    });
  } catch (error) {
    console.error("Admin quote status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update quote status."
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET FEATURED LISTINGS
|--------------------------------------------------------------------------
*/
const getFeaturedListings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        f.*,
        b.business_name,
        u.name AS owner_name,
        u.email AS owner_email
      FROM featured_listings f
      LEFT JOIN businesses b
        ON f.business_id = b.id
      LEFT JOIN users u
        ON b.owner_id = u.id
      ORDER BY f.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Admin featured error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load featured listings"
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET PAYMENTS
|--------------------------------------------------------------------------
*/
const getPayments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.*,
        u.name AS user_name,
        u.email AS user_email,
        b.business_name
      FROM payments p
      LEFT JOIN users u
        ON p.user_id = u.id
      LEFT JOIN businesses b
        ON p.business_id = b.id
      ORDER BY p.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Admin payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load payments"
    });
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE USER ACCOUNT STATUS
|--------------------------------------------------------------------------
*/
const updateUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { is_active } = req.body || {};

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false."
      });
    }

    if (userId === Number(req.user.id) && !is_active) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own admin account."
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, role, is_active, is_verified`,
      [is_active, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.json({
      success: true,
      message: `User ${is_active ? "activated" : "deactivated"} successfully.`,
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Admin user status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status."
    });
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE BUSINESS STATUS
|--------------------------------------------------------------------------
*/
const updateBusinessStatus = async (req, res) => {
  try {
    const businessId = Number(req.params.id);
    const { action } = req.body || {};

    const allowedActions = [
      "activate",
      "deactivate",
      "archive",
      "restore",
      "verify",
      "unverify"
    ];

    if (!Number.isSafeInteger(businessId) || businessId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid business ID."
      });
    }

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid business action."
      });
    }

    const updates = {
      activate: "is_active = TRUE",
      restore: "is_active = TRUE",
      deactivate: "is_active = FALSE",
      archive: "is_active = FALSE",
      verify: "is_verified = TRUE",
      unverify: "is_verified = FALSE"
    };

    const result = await pool.query(
      `UPDATE businesses
       SET ${updates[action]}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, business_name, is_active, is_verified`,
      [businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Business not found."
      });
    }

    return res.json({
      success: true,
      message: `Business ${action} successful.`,
      business: result.rows[0]
    });
  } catch (error) {
    console.error("Admin business status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update business status."
    });
  }
};


/*
|--------------------------------------------------------------------------
| GET SERVICES
|--------------------------------------------------------------------------
*/
const getServices = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.business_id,
        s.name,
        s.description,
        s.price,
        s.price_type,
        s.image_url,
        s.is_active,
        s.created_at,
        s.updated_at,
        b.business_name,
        b.is_verified AS business_is_verified
      FROM services s
      LEFT JOIN businesses b
        ON b.id = s.business_id
      ORDER BY s.created_at DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    console.error("Admin services error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load services."
    });
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE SERVICE STATUS
|--------------------------------------------------------------------------
*/
const updateServiceStatus = async (req, res) => {
  try {
    const serviceId = Number(req.params.id);
    const { is_active } = req.body || {};

    if (!Number.isSafeInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID."
      });
    }

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false."
      });
    }

    const result = await pool.query(
      `UPDATE services
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, business_id, name, is_active`,
      [is_active, serviceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found."
      });
    }

    return res.json({
      success: true,
      message: `Service ${is_active ? "activated" : "deactivated"} successfully.`,
      service: result.rows[0]
    });
  } catch (error) {
    console.error("Admin service status update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update service status."
    });
  }
};


/*
|--------------------------------------------------------------------------
| EXPORT CONTROLLERS
|--------------------------------------------------------------------------
*/
module.exports = {
  getOverview,
  getUsers,
  getUserDetails,
  getBusinesses,
  getVerificationRequests,
  getQuotes,
  updateQuoteStatus,
  getFeaturedListings,
  getPayments,
  updateUserStatus,
  updateBusinessStatus,
  getServices,
  updateServiceStatus
};