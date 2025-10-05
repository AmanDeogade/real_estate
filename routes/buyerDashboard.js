const express = require("express");
const router = express.Router();
const { isLoggedIn, isBuyer } = require("../middleware.js");
const wrapAsync = require("../utils/wrapAsync.js");
const buyerDashboardController = require("../controllers/buyerDashboard.js");

// Buyer Dashboard Routes
router.get("/dashboard", isLoggedIn, isBuyer, wrapAsync(buyerDashboardController.buyerDashboard));

// Favorites page
router.get("/favorites", isLoggedIn, isBuyer, wrapAsync(buyerDashboardController.getUserFavorites));

// API routes for recommendations
router.get("/api/recommendations", isLoggedIn, isBuyer, wrapAsync(buyerDashboardController.getRecommendationsJSON));

// Location-based recommendations
router.get("/api/location-recommendations", isLoggedIn, isBuyer, wrapAsync(buyerDashboardController.getLocationRecommendations));

module.exports = router;


