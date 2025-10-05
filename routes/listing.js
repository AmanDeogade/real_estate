const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, validateListing, isPropertyOwner, canManageListing, isBroker } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer  = require('multer');
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// Main listing routes
router
    .route("/")
    .get(wrapAsync(listingController.index))
    .post(isLoggedIn, isPropertyOwner, upload.array('listing[images]', 10), /* validateListing, */ wrapAsync(listingController.createListing));

// Search and filter routes
router.get("/search", wrapAsync(listingController.searchListings));
router.get("/filter", wrapAsync(listingController.filterListings));

// New listing form
router.get("/new", isLoggedIn, isPropertyOwner, listingController.renderNewForm);
// Broker assignment (for property owners)
router.post("/assign-broker", isLoggedIn, isPropertyOwner, wrapAsync(listingController.assignBroker));

// Property status management
router.post("/update-status", isLoggedIn, canManageListing, wrapAsync(listingController.updateStatus));

// Dashboard route for property owners and brokers
router.get("/dashboard", isLoggedIn, wrapAsync(listingController.showDashboard));

// Broker-specific CRM dashboard
router.get("/broker-dashboard", isLoggedIn, isBroker, wrapAsync(listingController.showBrokerDashboard));

// Update inquiry status
router.post("/update-inquiry-status", isLoggedIn, canManageListing, wrapAsync(listingController.updateInquiryStatus));

// API routes for dashboard functionality
router.get("/api/brokers", isLoggedIn, wrapAsync(listingController.getBrokers));

// API route for calculating location scores
router.post("/api/calculate-scores", isLoggedIn, wrapAsync(listingController.calculateLocationScores));

// Individual listing routes (parameterized) - keep after static routes to avoid collisions
router
    .route("/:id")
    .get(wrapAsync(listingController.showListing))
    .put(isLoggedIn, canManageListing, upload.array('listing[images]', 10), validateListing, wrapAsync(listingController.updateListing))
    .delete(isLoggedIn, canManageListing, wrapAsync(listingController.destroyListing));

// Edit listing
router.get("/:id/edit", isLoggedIn, canManageListing, wrapAsync(listingController.renderEditForm));

// Property inquiry
router.post("/:id/inquire", isLoggedIn, wrapAsync(listingController.createInquiry));

// Analytics and insights (for property owners and brokers)
router.get("/:id/analytics", isLoggedIn, canManageListing, wrapAsync(listingController.showAnalytics));



module.exports = router;