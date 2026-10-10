
require("dotenv").config();
const { Client } = require("pg");
const readline = require("readline");
const { stdin, stdout } = process;

const local = new Client({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "patapro_kenya",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || undefined,
});

function ask(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Run this script directly in a terminal."));
      return;
    }

    stdout.write(question);
    let value = "";

    function onData(data) {
      for (const char of data.toString()) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    }

    function cleanup() {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

function makeSlug(name, id) {
  const base = String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "business";

  return `${base}-${id}`;
}

async function main() {
  let remote;
  let transactionStarted = false;

  try {
    await local.connect();

    const password = await askHidden("Render database password (hidden): ");

    const confirmHost = await ask(
      "Render database host (hostname only, no URL): "
    );

    if (!confirmHost || confirmHost.includes("/") || confirmHost.includes("@")) {
      throw new Error("Enter only the Render database hostname.");
    }

    remote = new Client({
      host: confirmHost,
      port: 5432,
      database: "patapro",
      user: "patapro_user",
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    await remote.connect();

    const productionCounts = await remote.query(`
      SELECT
        (SELECT COUNT(*) FROM businesses) AS businesses,
        (SELECT COUNT(*) FROM services) AS services
    `);

    const counts = productionCounts.rows[0];

    if (Number(counts.businesses) !== 0 ||
        Number(counts.services) !== 0) {
      throw new Error(
        "Production businesses/services are not empty. Nothing was migrated."
      );
    }

    const businesses = await local.query(
      "SELECT * FROM businesses ORDER BY id"
    );

    const services = await local.query(`
      SELECT s.*
      FROM services s
      JOIN businesses b ON b.id = s.business_id
      ORDER BY s.id
    `);

    const ownerMap = {
      3: 2,
      5: 1,
    };

    for (const b of businesses.rows) {
      if (!ownerMap[b.owner_id]) {
        throw new Error(
          `No production owner mapping for local owner ${b.owner_id}`
        );
      }
    }

    console.log(`Businesses to copy: ${businesses.rows.length}`);
    console.log(`Services to copy: ${services.rows.length}`);

    const confirm = await ask(
      'Type MIGRATE to continue, or anything else to cancel: '
    );

    if (confirm !== "MIGRATE") {
      console.log("Cancelled. No data was changed.");
      return;
    }

    await remote.query("BEGIN");
    transactionStarted = true;

    const businessIdMap = new Map();

    for (const b of businesses.rows) {
      const result = await remote.query(`
        INSERT INTO businesses (
          owner_id, business_name, slug, description,
          category, subcategory, phone, whatsapp, email,
          website, county, town, location, logo_url,
          cover_image_url, opening_hours, rating, review_count,
          is_verified, is_featured, is_active, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23
        )
        RETURNING id
      `, [
        ownerMap[b.owner_id],
        b.business_name,
        makeSlug(b.business_name, b.id),
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
        b.opening_hours,
        b.rating,
        b.review_count,
        b.is_verified,
        b.is_featured,
        b.is_active,
        b.created_at,
        b.updated_at,
      ]);

      businessIdMap.set(String(b.id), result.rows[0].id);
      console.log(`Copied local business ${b.id}`);
    }

    for (const s of services.rows) {
      const newBusinessId = businessIdMap.get(String(s.business_id));

      if (!newBusinessId) {
        throw new Error(`Missing destination for service ${s.id}`);
      }

      await remote.query(`
        INSERT INTO services (
          business_id, name, description, price,
          price_type, image_url, is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        newBusinessId,
        s.name,
        s.description,
        s.price,
        s.price_type,
        s.image_url,
        s.is_active,
        s.created_at,
        s.updated_at,
      ]);
    }

    await remote.query("COMMIT");
    transactionStarted = false;

    const finalCounts = await remote.query(`
      SELECT
        (SELECT COUNT(*) FROM businesses) AS businesses,
        (SELECT COUNT(*) FROM services) AS services
    `);

    console.log("Migration completed successfully!");
    console.log(finalCounts.rows[0]);
  } catch (error) {
    if (remote && transactionStarted) {
      try {
        await remote.query("ROLLBACK");
        console.log("Transaction rolled back.");
      } catch (rollbackError) {
        console.error("Rollback failed; close the connection and inspect the database.");
      }
    }

    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await local.end().catch(() => {});
    if (remote) await remote.end().catch(() => {});
  }
}

main();

