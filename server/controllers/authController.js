const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const pool = require("../config/db");

const {
  createUser,
  findUserByEmail,
  findUserById,
  emailExists,
} = require("../models/userModel");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const createToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const createMailer = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured in .env");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS.replace(/\s/g, ""),
    },
  });
};

/*
|--------------------------------------------------------------------------
| Register
|--------------------------------------------------------------------------
*/
const register = async (req, res) => {
  try {
    const {
      firstName, lastName, name, email, phone, role, password,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const allowedRoles = ["customer", "business", "service_provider"];
    const userRole = allowedRoles.includes(role) ? role : "customer";

    if (await emailExists(normalizedEmail)) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const displayName =
      name?.trim() || `${firstName.trim()} ${lastName.trim()}`;

    const user = await createUser({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: displayName,
      email: normalizedEmail,
      phone: phone?.trim() || null,
      role: userRole,
      passwordHash,
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while creating your account.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await findUserByEmail(email.trim().toLowerCase());

    if (
      !user ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user);

    const safeUser = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while logging in.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Request a password reset
|--------------------------------------------------------------------------
*/
const forgotPassword = async (req, res) => {
  let user;

  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    // Validate mail configuration even when the account is unknown.
    const mailer = createMailer();

    user = await findUserByEmail(email);

    // Use the same public response for existing and unknown accounts.
    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists for that email, a reset link will be sent.",
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await pool.query(
      `UPDATE users
       SET password_reset_token_hash = $1,
           password_reset_expires_at = NOW() + INTERVAL '30 minutes'
       WHERE id = $2`,
      [tokenHash, user.id]
    );

    const baseUrl = (
      process.env.FRONTEND_URL || "http://localhost:5000"
    ).replace(/\/+$/, "");

    const resetUrl =
      `${baseUrl}/pages/reset-password.html?token=${rawToken}`;

    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: "Reset your PataPro Kenya password",
        text:
          `We received a request to reset your PataPro password.\n\n` +
          `Use this link within 30 minutes:\n${resetUrl}\n\n` +
          `If you did not request this, you can ignore this email.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
            <h2>Reset your PataPro password</h2>
            <p>We received a request to reset your password.</p>
            <p>This link expires in 30 minutes and can only be used once.</p>
            <p>
              <a href="${resetUrl}"
                 style="display:inline-block;padding:14px 22px;background:#00c99a;color:#06251e;text-decoration:none;border-radius:8px;font-weight:bold">
                Choose a new password
              </a>
            </p>
            <p>If you did not request this, ignore this email.</p>
          </div>
        `,
      });
    } catch (mailError) {
      await pool.query(
        `UPDATE users
         SET password_reset_token_hash = NULL,
             password_reset_expires_at = NULL
         WHERE id = $1`,
        [user.id]
      );
      throw mailError;
    }

    return res.json({
      success: true,
      message: "If an account exists for that email, a reset link will be sent.",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: "We could not process the request. Check the email configuration and try again.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Reset password using a valid, unexpired token
|--------------------------------------------------------------------------
*/
const resetPassword = async (req, res) => {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired. Request a new one.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Your new password must contain at least 8 characters.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const passwordHash = await bcrypt.hash(password, 12);

    // One atomic update consumes the token and changes the password.
    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token_hash = NULL,
           password_reset_expires_at = NULL,
           updated_at = NOW()
       WHERE password_reset_token_hash = $2
         AND password_reset_expires_at > NOW()
       RETURNING id`,
      [passwordHash, tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired. Request a new one.",
      });
    }

    return res.json({
      success: true,
      message: "Your password has been reset. You can now log in.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to reset your password right now.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Current user
|--------------------------------------------------------------------------
*/
const getMe = async (req, res) => {
  try {
    const user = await findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("GET ME ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user information.",
    });
  }
};
/*
|--------------------------------------------------------------------------
| Google Sign-In
|--------------------------------------------------------------------------
*/
const googleLogin = async (req, res) => {
  try {
    const credential = String(req.body.credential || "");

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Google Sign-In is not configured on the server.",
      });
    }

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const google = ticket.getPayload();

    if (!google || !google.sub || !google.email || google.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Google account verification failed.",
      });
    }

    const email = google.email.trim().toLowerCase();

    // Find an account already linked to this Google identity.
    let result = await pool.query(
      `SELECT id, first_name, last_name, name, email, phone, role,
              created_at, is_active
       FROM users
       WHERE google_id = $1
       LIMIT 1`,
      [google.sub]
    );

    let user = result.rows[0];

    // Link an existing account only when the verified email matches.
    if (!user) {
      result = await pool.query(
        `SELECT id, first_name, last_name, name, email, phone, role,
                created_at, is_active, google_id
         FROM users
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [email]
      );

      user = result.rows[0];

      if (user) {
        if (user.google_id && user.google_id !== google.sub) {
          return res.status(409).json({
            success: false,
            message: "This email is linked to another Google account.",
          });
        }

        await pool.query(
          `UPDATE users
           SET google_id = $1, is_verified = TRUE, updated_at = NOW()
           WHERE id = $2`,
          [google.sub, user.id]
        );
      } else {
        const firstName = String(google.given_name || google.name || "Google User").trim();
        const lastName = String(google.family_name || "").trim();
        const displayName = String(google.name || `${firstName} ${lastName}`).trim();

        // Google-only accounts still need a password_hash because the
        // existing users table requires it. This random password is unknown
        // to the user and cannot be used as a shared/default password.
        const randomPassword = crypto.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        result = await pool.query(
          `INSERT INTO users
             (first_name, last_name, name, email, role, password_hash,
              google_id, is_verified, is_active)
           VALUES ($1, $2, $3, $4, 'customer', $5, $6, TRUE, TRUE)
           RETURNING id, first_name, last_name, name, email, phone,
                     role, created_at, is_active`,
          [
            firstName,
            lastName,
            displayName,
            email,
            passwordHash,
            google.sub,
          ]
        );

        user = result.rows[0];
      }
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "This account is disabled. Please contact support.",
      });
    }

    const safeUser = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at,
    };

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Google Sign-In successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("GOOGLE LOGIN ERROR:", error.message);

    return res.status(401).json({
      success: false,
      message: "Google Sign-In failed. Please try again.",
    });
  }
};
module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  forgotPassword,
  resetPassword,
};
