const express = require("express");

const router = express.Router();

const {
  getServicesByBusiness,
  createService,
  updateService,
  deleteService
} = require("../controllers/serviceController");

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

/*
|--------------------------------------------------------------------------
| PUBLIC ROUTES
|--------------------------------------------------------------------------
| Anyone can view services belonging to a business.
*/

// GET /api/businesses/:businessId/services
router.get(
  "/businesses/:businessId/services",
  getServicesByBusiness
);


/*
|--------------------------------------------------------------------------
| PROTECTED ROUTES
|--------------------------------------------------------------------------
| A logged-in business owner can create, update and delete services.
*/

// POST /api/businesses/:businessId/services
// Optional photo field name: servicePhoto
router.post(
  "/businesses/:businessId/services",
  authMiddleware,
  upload.single("servicePhoto"),
  createService
);


// PUT /api/services/:id
router.put(
  "/services/:id",
  authMiddleware,
  updateService
);


// DELETE /api/services/:id
router.delete(
  "/services/:id",
  authMiddleware,
  deleteService
);


module.exports = router;