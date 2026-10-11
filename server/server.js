const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

dotenv.config({
  path: path.join(__dirname, "../.env")
});

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT) || 5000;

const CLIENT_DIR = path.join(__dirname, "../client");
const ADMIN_DIR = path.join(__dirname, "../admin");
const UPLOADS_DIR = path.join(__dirname, "uploads");

const allowedOrigins = new Set([
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5501"
]);

// --------------------------------------------------
// SECURITY HEADERS
// --------------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],

       scriptSrc: [
  "'self'",
  "'unsafe-inline'",
  "https://accounts.google.com",
  "https://cdn.jsdelivr.net",
  "https://connect.facebook.net"
],

        scriptSrcAttr: ["'unsafe-inline'"],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https:"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:"
        ],

        connectSrc: [
          "'self'",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
          "http://localhost:5500",
          "http://127.0.0.1:5500",
          "http://localhost:5501",
          "http://127.0.0.1:5501",
          "https://accounts.google.com",
          "https://connect.facebook.net",
          "https://www.facebook.com"
        ],

        frameSrc: [
          "'self'",
          "https://accounts.google.com"
        ],

        fontSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"]
      }
    }
  })
);

// --------------------------------------------------
// CORS
// --------------------------------------------------

app.use(
  cors({
    origin(origin, callback) {
      // Requests such as curl may not send an Origin header.
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      // Deny unapproved origins without crashing the server.
      return callback(null, false);
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

// --------------------------------------------------
// REQUEST PARSING
// --------------------------------------------------

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

// --------------------------------------------------
// RATE LIMITING
// --------------------------------------------------

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

// --------------------------------------------------
// STATIC FILES
// --------------------------------------------------

// Public website:
// client/index.html         -> /index.html
// client/pages/business.html -> /pages/business.html
// client/css/style.css      -> /css/style.css
app.use(
  express.static(CLIENT_DIR, {
    index: "index.html",
    extensions: ["html"]
  })
);

// Uploaded images and documents.
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    dotfiles: "deny",
    index: false
  })
);

// Admin dashboard:
// admin/index.html -> /admin/index.html
app.use(
  "/admin",
  express.static(ADMIN_DIR, {
    index: "index.html",
    extensions: ["html"]
  })
);

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

const authRoutes = require("./routes/authRoutes");
const businessRoutes = require("./routes/businessRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const quoteRoutes = require("./routes/quoteRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const featuredRoutes = require("./routes/featuredRoutes");
const adminRoutes = require("./routes/adminRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api", serviceRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/featured", featuredRoutes);
app.use("/api/admin", adminRoutes);

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "PataPro Kenya API is running",
    port: PORT
  });
});

// --------------------------------------------------
// API NOT FOUND
// --------------------------------------------------

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl
  });
});

// --------------------------------------------------
// WEBSITE PAGE NOT FOUND
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 | PataPro Kenya</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 20px;
          box-sizing: border-box;
          background: #071a33;
          color: white;
          font-family: Arial, sans-serif;
          text-align: center;
        }
        a { color: #39ff88; }
      </style>
    </head>
    <body>
      <main>
        <h1>404 — Page Not Found</h1>
        <p>The requested PataPro Kenya page could not be found.</p>
        <p><a href="/index.html">Return to homepage</a></p>
      </main>
    </body>
    </html>
  `);
});

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  console.error("PataPro server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  const status =
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 600
      ? err.status
      : 500;

  return res.status(status).json({
    success: false,
    message:
      status === 413
        ? "Request body is too large."
        : status >= 500
          ? "An internal server error occurred."
          : "The request could not be processed."
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("--------------------------------------");
  console.log(" PataPro Kenya API");
  console.log("--------------------------------------");
  console.log(` Server:  http://127.0.0.1:${PORT}`);
  console.log(` Website: http://127.0.0.1:${PORT}/index.html`);
  console.log(` Health:  http://127.0.0.1:${PORT}/api/health`);
  console.log("--------------------------------------");
});

// Graceful shutdown.
function shutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);

  server.close((error) => {
    if (error) {
      console.error("Error closing server:", error);
      process.exitCode = 1;
    }

    process.exit();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
