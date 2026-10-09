const pool = require("../config/db");

/*
|--------------------------------------------------------------------------
| Create Featured Listing Request
|--------------------------------------------------------------------------
*/
exports.createFeaturedRequest = async (req, res) => {
  try {
    const { businessId, days = 7 } = req.body;

    if (!businessId) {
      return res.status(400).json({
        message: "businessId is required",
      });
    }

    const durationDays = Number(days);

    if (
      !Number.isInteger(durationDays) ||
      durationDays < 1 ||
      durationDays > 365
    ) {
      return res.status(400).json({
        message: "Featured duration must be between 1 and 365 days",
      });
    }

    // Check business ownership
    const businessResult = await pool.query(
      `
      SELECT id, business_name, is_featured
      FROM businesses
      WHERE id = $1
        AND owner_id = $2
      `,
      [businessId, req.user.id]
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        message: "Business not found or you do not own this business",
      });
    }

    const business = businessResult.rows[0];

    if (business.is_featured) {
      return res.status(400).json({
        message: "This business is already featured",
      });
    }

    // Check for existing pending/active request
    const existingResult = await pool.query(
      `
      SELECT id, status
      FROM featured_listings
      WHERE business_id = $1
        AND status IN ('pending', 'active')
      LIMIT 1
      `,
      [businessId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        message: `A featured listing is already ${existingResult.rows[0].status}`,
      });
    }

    // KSh 500 per week
    const pricePerWeek = 500;
    const amount = Math.ceil(durationDays / 7) * pricePerWeek;

    const result = await pool.query(
      `
      INSERT INTO featured_listings
      (
        business_id,
        duration_days,
        amount,
        status
      )
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
      `,
      [businessId, durationDays, amount]
    );

    res.status(201).json({
      message: "Featured listing request submitted successfully",
      listing: result.rows[0],
      amount,
      durationDays,
    });
  } catch (error) {
    console.error("Create featured request error:", error);

    res.status(500).json({
      message: "Failed to create featured listing request",
      error: error.message,
    });
  }
};


/*
|--------------------------------------------------------------------------
| Get Featured Listing Requests - Admin
|--------------------------------------------------------------------------
*/
exports.getFeaturedRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        fl.id,
        fl.business_id,
        fl.duration_days,
        fl.amount,
        fl.status,
        fl.start_date,
        fl.end_date,
        fl.created_at,

        b.business_name,
        b.category,
        b.county,
        b.town,

        u.id AS owner_id,
        u.name AS owner_name,
        u.email AS owner_email,
        u.phone AS owner_phone

      FROM featured_listings fl

      JOIN businesses b
        ON b.id = fl.business_id

      JOIN users u
        ON u.id = b.owner_id

      ORDER BY fl.created_at DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get featured requests error:", error);

    res.status(500).json({
      message: "Failed to load featured listing requests",
      error: error.message,
    });
  }
};


/*
|--------------------------------------------------------------------------
| Approve Featured Listing - Admin
|--------------------------------------------------------------------------
*/
exports.approveFeatured = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    // Get listing
    const listingResult = await client.query(
      `
      SELECT
        id,
        business_id,
        duration_days,
        amount,
        status
      FROM featured_listings
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (listingResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Featured listing request not found",
      });
    }

    const listing = listingResult.rows[0];

    if (listing.status === "active") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "This listing is already active",
      });
    }

    if (listing.status === "rejected") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Rejected listings cannot be approved",
      });
    }

    const durationDays = listing.duration_days || 7;

    // Activate listing
    const updatedListing = await client.query(
      `
      UPDATE featured_listings
      SET
        status = 'active',
        start_date = CURRENT_DATE,
        end_date = CURRENT_DATE + ($1 || ' days')::interval
      WHERE id = $2
      RETURNING *
      `,
      [durationDays, id]
    );

    // Mark business as featured
    await client.query(
      `
      UPDATE businesses
      SET
        is_featured = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [listing.business_id]
    );

    await client.query("COMMIT");

    res.json({
      message: `Featured listing approved for ${durationDays} days`,
      listing: updatedListing.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Approve featured error:", error);

    res.status(500).json({
      message: "Failed to approve featured listing",
      error: error.message,
    });
  } finally {
    client.release();
  }
};


/*
|--------------------------------------------------------------------------
| Reject Featured Listing - Admin
|--------------------------------------------------------------------------
*/
exports.rejectFeatured = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE featured_listings
      SET status = 'rejected'
      WHERE id = $1
        AND status = 'pending'
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Pending featured listing request not found",
      });
    }

    res.json({
      message: "Featured listing rejected",
      listing: result.rows[0],
    });
  } catch (error) {
    console.error("Reject featured error:", error);

    res.status(500).json({
      message: "Failed to reject featured listing",
      error: error.message,
    });
  }
};
