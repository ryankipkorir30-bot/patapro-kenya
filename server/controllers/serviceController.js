const serviceModel = require("../models/serviceModel");
const businessModel = require("../models/businessModel");

exports.getServicesByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;

    const services = await serviceModel.findServicesByBusiness(businessId);

    res.json(services);
  } catch (error) {
    console.error("Get services error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load services",
      error: error.message
    });
  }
};

exports.createService = async (req, res) => {
  try {
    const { businessId } = req.params;

    const {
      name,
      description,
      price,
      priceType
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Service name is required"
      });
    }

    const business = await businessModel.findBusinessById(businessId);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found"
      });
    }

    if (Number(business.owner_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not own this business"
      });
    }
const imageUrl = req.file
  ? `/uploads/businesses/${req.file.filename}`
  : null;
    const service = await serviceModel.createService({
      businessId,
      name,
      description,
      price,
      priceType
    });

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      service
    });
  } catch (error) {
    console.error("Create service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create service",
      error: error.message
    });
  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await serviceModel.findServiceById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    const business = await businessModel.findBusinessById(
      service.business_id
    );

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found"
      });
    }

    if (Number(business.owner_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not own this business"
      });
    }

    const updatedService = await serviceModel.updateService(
      id,
      req.body
    );

    res.json({
      success: true,
      message: "Service updated successfully",
      service: updatedService
    });
  } catch (error) {
    console.error("Update service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update service",
      error: error.message
    });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await serviceModel.findServiceById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    const business = await businessModel.findBusinessById(
      service.business_id
    );

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found"
      });
    }

    if (Number(business.owner_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not own this business"
      });
    }

    await serviceModel.deleteService(id);

    res.json({
      success: true,
      message: "Service deleted successfully"
    });
  } catch (error) {
    console.error("Delete service error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete service",
      error: error.message
    });
  }
};
