const businessModel = require("../models/businessModel");

exports.getBusinesses = async (req, res) => {
  try {
    const { q = "", county = "", category = "" } = req.query;

    const businesses = await businessModel.searchBusinesses({
      q,
      county,
      category
    });

    res.json(businesses);
  } catch (error) {
    console.error("Get businesses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load businesses",
      error: error.message
    });
  }
};

exports.getBusiness = async (req, res) => {
  try {
    const business = await businessModel.findBusinessById(req.params.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found"
      });
    }

    res.json(business);
  } catch (error) {
    console.error("Get business error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load business",
      error: error.message
    });
  }
};

exports.getMyBusiness = async (req, res) => {
  try {
    const businesses = await businessModel.findBusinessesByOwner(req.user.id);
    res.json(businesses);
  } catch (error) {
    console.error("Get my businesses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load your businesses",
      error: error.message
    });
  }
};

exports.createBusiness = async (req, res) => {
  try {
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
      logo,
      coverImage
    } = req.body;

    if (!businessName || !category) {
      return res.status(400).json({
        success: false,
        message: "Business name and category are required"
      });
    }

    const business = await businessModel.createBusiness({
      ownerId: req.user.id,
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
      logo,
      coverImage
    });

    res.status(201).json({
      success: true,
      message: "Business created successfully",
      business
    });
  } catch (error) {
    console.error("Create business error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create business",
      error: error.message
    });
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    const existingBusiness =
      await businessModel.findBusinessById(req.params.id);

    if (!existingBusiness) {
      return res.status(404).json({
        success: false,
        message: "Business not found"
      });
    }

    if (Number(existingBusiness.owner_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not own this business"
      });
    }

    const business = await businessModel.updateBusiness(
      req.params.id,
      req.body
    );

    res.json({
      success: true,
      message: "Business updated successfully",
      business
    });
  } catch (error) {
    console.error("Update business error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update business",
      error: error.message
    });
  }
};

exports.deactivateBusiness = async (req, res) => {
  try {
    const existingBusiness =
      await businessModel.findBusinessById(req.params.id);

    if (!existingBusiness) {
      return res.status(404).json({
        success: false,
        message: "Business not found"
      });
    }

    if (Number(existingBusiness.owner_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not own this business"
      });
    }

    await businessModel.deactivateBusiness(req.params.id);

    res.json({
      success: true,
      message: "Business deactivated successfully"
    });
  } catch (error) {
    console.error("Deactivate business error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to deactivate business",
      error: error.message
    });
  }
};
/* =========================================================
   POST /api/businesses/:id/photo
   Upload business photo
========================================================= */

exports.uploadBusinessPhoto = async (req, res) => {

    try {

        const { id } = req.params;

        if (!req.file) {

            return res.status(400).json({
                success: false,
                message: "Please select an image."
            });

        }

        const existingBusiness =
            await businessModel.findBusinessById(id);

        if (!existingBusiness) {

            return res.status(404).json({
                success: false,
                message: "Business not found."
            });
        }

        if (
            Number(existingBusiness.owner_id) !==
            Number(req.user.id)
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "You do not have permission to update this business."
            });
        }

        const imageUrl =
            `/uploads/businesses/${req.file.filename}`;

        const result = await businessModel.updateBusinessPhoto(
            id,
            imageUrl
        );

        return res.json({
            success: true,
            message: "Business photo uploaded successfully.",
            imageUrl,
            business: result
        });

    } catch (error) {

        console.error(
            "Business photo upload error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error.message ||
                "Failed to upload business photo."
        });
    }
};
