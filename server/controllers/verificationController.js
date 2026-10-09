
const pool = require("../config/db");
const path = require("path");
const fs = require("fs");

const privateUploadDirectory = path.join(
  __dirname,
  "../private_uploads/verifications"
);

// Business owner: submit a verification request.
async function createVerificationRequest(req, res) {
  let savedFilePath;

  try {
    const userId = req.user.id;
    const { businessId, documentType, notes } = req.body;

    if (!businessId || !/^\d+$/.test(String(businessId))) {
      return res.status(400).json({
        message: "A valid business ID is required."
      });
    }

    if (!documentType || !documentType.trim()) {
      return res.status(400).json({
        message: "Select the type of verification document."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload your verification document."
      });
    }

    savedFilePath = req.file.path;

    const businessResult = await pool.query(
      `SELECT id, is_verified
       FROM businesses
       WHERE id = $1 AND owner_id = $2
       LIMIT 1`,
      [businessId, userId]
    );

    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        message: "Business not found or you do not own it."
      });
    }

    if (businessResult.rows[0].is_verified) {
      return res.status(400).json({
        message: "This business is already verified."
      });
    }

    const existing = await pool.query(
      `SELECT id
       FROM verification_requests
       WHERE business_id = $1 AND status = 'pending'
       LIMIT 1`,
      [businessId]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "A verification request is already pending."
      });
    }

    const result = await pool.query(
      `INSERT INTO verification_requests
         (business_id, submitted_by, document_type,
          document_url, notes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, business_id, document_type, notes,
                 status, created_at`,
      [
        businessId,
        userId,
        documentType.trim(),
        req.file.filename,
        notes?.trim() || null
      ]
    );

    return res.status(201).json({
      message: "Verification request submitted successfully.",
      request: result.rows[0]
    });
  } catch (error) {
    if (savedFilePath) {
      fs.promises.unlink(savedFilePath).catch(() => {});
    }

    console.error("Create verification request error:", error);

    return res.status(500).json({
      message: "Failed to create verification request."
    });
  }
}

// Admin: list all verification requests.
async function getVerificationRequests(req, res) {
  try {
    const result = await pool.query(
      `SELECT
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
         b.category,
         b.county,
         b.town,
         u.id AS owner_id,
         u.name AS owner_name,
         u.email AS owner_email,
         u.phone AS owner_phone
       FROM verification_requests vr
       JOIN businesses b ON b.id = vr.business_id
       JOIN users u ON u.id = b.owner_id
       ORDER BY vr.created_at DESC`
    );

    return res.json({ requests: result.rows });
  } catch (error) {
    console.error("Get verification requests error:", error);

    return res.status(500).json({
      message: "Failed to load verification requests."
    });
  }
}

// Admin: view a submitted document through an authenticated route.
async function getVerificationDocument(req, res) {
  try {
    const result = await pool.query(
      `SELECT document_url
       FROM verification_requests
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0 || !result.rows[0].document_url) {
      return res.status(404).json({
        message: "Verification document not found."
      });
    }

    const filename = path.basename(result.rows[0].document_url);
    const filePath = path.join(privateUploadDirectory, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "The stored document file is missing."
      });
    }

    return res.sendFile(filePath);
  } catch (error) {
    console.error("Get verification document error:", error);

    return res.status(500).json({
      message: "Failed to open verification document."
    });
  }
}

// Admin: approve a pending verification request.
async function approveVerification(req, res) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `SELECT id, business_id, status
       FROM verification_requests
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Verification request not found."
      });
    }

    const request = result.rows[0];

    if (request.status !== "pending") {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        message: `This request is already ${request.status}.`
      });
    }

    await client.query(
      `UPDATE verification_requests
       SET status = 'approved',
           reviewed_by = $2,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [request.id, req.user.id]
    );

    await client.query(
      `UPDATE businesses
       SET is_verified = TRUE
       WHERE id = $1`,
      [request.business_id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      message: "Business verified successfully."
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Approve verification error:", error);

    return res.status(500).json({
      message: "Failed to approve verification."
    });
  } finally {
    client.release();
  }
}

// Admin: reject a pending verification request.
async function rejectVerification(req, res) {
  try {
    const result = await pool.query(
      `UPDATE verification_requests
       SET status = 'rejected',
           reviewed_by = $2,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'
       RETURNING id, business_id, status, reviewed_by, reviewed_at`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      const exists = await pool.query(
        `SELECT id, status
         FROM verification_requests
         WHERE id = $1`,
        [req.params.id]
      );

      if (exists.rows.length === 0) {
        return res.status(404).json({
          message: "Verification request not found."
        });
      }

      return res.status(409).json({
        message: `This request is already ${exists.rows[0].status}.`
      });
    }

    return res.json({
      message: "Verification request rejected.",
      request: result.rows[0]
    });
  } catch (error) {
    console.error("Reject verification error:", error);

    return res.status(500).json({
      message: "Failed to reject verification request."
    });
  }
}

module.exports = {
  createVerificationRequest,
  getVerificationRequests,
  getVerificationDocument,
  approveVerification,
  rejectVerification
};
