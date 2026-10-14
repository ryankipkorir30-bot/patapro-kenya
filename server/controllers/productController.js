const productModel = require("../models/productModel");

async function requireActiveSeller(req, res) {
  if (!req.user || !req.user.id) {
    res.status(401).json({
      success: false,
      message: "Please log in to manage products."
    });
    return false;
  }

  const active = await productModel.isActiveSeller(req.user.id);

  if (!active) {
    res.status(403).json({
      success: false,
      message: "Your seller account is inactive or not authorized."
    });
    return false;
  }

  return true;
}

function validateProduct(body) {
  const {
    name,
    description,
    category,
    price,
    stockQuantity,
    imageUrl
  } = body;

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 180
  ) {
    return "Product name is required and must be at most 180 characters.";
  }

  if (
    typeof description !== "string" ||
    !description.trim()
  ) {
    return "Product description is required.";
  }

  if (
    typeof category !== "string" ||
    !category.trim() ||
    category.trim().length > 100
  ) {
    return "A valid product category is required.";
  }

  if (
    price === undefined ||
    price === null ||
    price === "" ||
    !Number.isFinite(Number(price)) ||
    Number(price) < 0
  ) {
    return "Enter a valid product price.";
  }

  if (
    stockQuantity === undefined ||
    stockQuantity === null ||
    stockQuantity === "" ||
    !Number.isInteger(Number(stockQuantity)) ||
    Number(stockQuantity) < 0
  ) {
    return "Stock quantity must be a non-negative whole number.";
  }

  if (imageUrl) {
    try {
      const parsedUrl = new URL(imageUrl);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return "Product image must use HTTP or HTTPS.";
      }
    } catch {
      return "Enter a valid product image URL.";
    }
  }

  return null;
}

function normaliseProduct(body) {
  return {
    name: body.name.trim(),
    description: body.description.trim(),
    category: body.category.trim(),
    price: Number(body.price),
    imageUrl: body.imageUrl || null,
    stockQuantity: Number(body.stockQuantity)
  };
}

/*
 * GET /api/products
 * Public product catalogue.
 */
exports.getProducts = async (req, res) => {
  try {
    const products = await productModel.listPublishedProducts({
      search: String(req.query.q || ""),
      category: String(req.query.category || ""),
      limit: req.query.limit,
      offset: req.query.offset
    });

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load products."
    });
  }
};

/*
 * GET /api/products/:id
 * Public product details.
 */
exports.getProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const product = await productModel.findProductById(id);

    if (!product || product.status !== "published") {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error("Get product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load product."
    });
  }
};

/*
 * GET /api/products/seller/mine
 * Authenticated seller's products.
 */
exports.getMyProducts = async (req, res) => {
  try {
    const products = await productModel.listSellerProducts(req.user.id);

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error("Get seller products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load your products."
    });
  }
};

/*
 * POST /api/products
 * Authenticated seller creates a listing.
 */
exports.createProduct = async (req, res) => {
  try {
    if (!(await requireActiveSeller(req, res))) return;

    const validationError = validateProduct(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const product = await productModel.createProduct(
      req.user.id,
      normaliseProduct(req.body)
    );

    res.status(201).json({
      success: true,
      message: "Product listed successfully.",
      product
    });
  } catch (error) {
    console.error("Create product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create product."
    });
  }
};

/*
 * PUT /api/products/:id
 * Seller can update only their own product.
 */
exports.updateProduct = async (req, res) => {
  try {
    if (!(await requireActiveSeller(req, res))) return;

    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const validationError = validateProduct(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const existing = await productModel.findProductById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    if (String(existing.seller_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot edit another seller's product."
      });
    }

    const product = await productModel.updateProduct(
      req.user.id,
      id,
      normaliseProduct(req.body)
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product could not be updated."
      });
    }

    res.json({
      success: true,
      message: "Product updated successfully.",
      product
    });
  } catch (error) {
    console.error("Update product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update product."
    });
  }
};

/*
 * PATCH /api/products/:id/archive
 * Seller archives their own product.
 */
exports.archiveProduct = async (req, res) => {
  try {
    if (!(await requireActiveSeller(req, res))) return;

    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const existing = await productModel.findProductById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    if (String(existing.seller_id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot archive another seller's product."
      });
    }

    await productModel.archiveProduct(req.user.id, id);

    res.json({
      success: true,
      message: "Product archived successfully."
    });
  } catch (error) {
    console.error("Archive product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to archive product."
    });
  }
};
