const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware.js");
const wrapAsync = require("../utils/wrapAsync.js");
const RecommendationService = require("../services/recommendationService.js");

// Get personalized recommendations for logged-in user
router.get("/personalized", isLoggedIn, wrapAsync(async (req, res) => {
    const { limit = 6 } = req.query;
    const recommendations = await RecommendationService.getPersonalizedRecommendations(
        req.user._id, 
        parseInt(limit)
    );
    
    res.render("recommendations/personalized", { 
        recommendations,
        user: req.user
    });
}));

// Get recommendations similar to user's favorites
router.get("/similar", isLoggedIn, wrapAsync(async (req, res) => {
    const { limit = 6 } = req.query;
    const recommendations = await RecommendationService.getSimilarToListings(
        req.user._id, 
        parseInt(limit)
    );
    
    res.render("recommendations/similar", { 
        recommendations,
        user: req.user
    });
}));

// Get trending properties
router.get("/trending", wrapAsync(async (req, res) => {
    const { limit = 6 } = req.query;
    const trending = await RecommendationService.getTrendingListings(parseInt(limit));
    
    res.render("recommendations/trending", { 
        trending,
        user: req.user
    });
}));

// Get location-based recommendations
router.get("/location/:city", wrapAsync(async (req, res) => {
    const { city } = req.params;
    const { limit = 6 } = req.query;
    const recommendations = await RecommendationService.getLocationBasedRecommendations(
        city, 
        parseInt(limit)
    );
    
    res.render("recommendations/location", { 
        recommendations,
        city,
        user: req.user
    });
}));

// Get popular properties
router.get("/popular", wrapAsync(async (req, res) => {
    const { limit = 6 } = req.query;
    const popular = await RecommendationService.getPopularListings(parseInt(limit));
    
    res.render("recommendations/popular", { 
        popular,
        user: req.user
    });
}));

// Update user preferences (called when user views a property)
router.post("/update-preferences", isLoggedIn, wrapAsync(async (req, res) => {
    const { listingId } = req.body;
    
    if (!listingId) {
        return res.status(400).json({ error: 'Listing ID is required' });
    }
    
    await RecommendationService.updateUserPreferences(req.user._id, listingId);
    
    res.json({ success: true, message: 'Preferences updated successfully' });
}));

// Get recommendations as JSON (for AJAX calls)
router.get("/api/personalized", isLoggedIn, wrapAsync(async (req, res) => {
    const { limit = 6 } = req.query;
    const recommendations = await RecommendationService.getPersonalizedRecommendations(
        req.user._id, 
        parseInt(limit)
    );
    
    res.json({ recommendations });
}));

router.get("/api/similar", isLoggedIn, wrapAsync(async (req, res) => {
    const { limit = 6 } = req.query;
    const recommendations = await RecommendationService.getSimilarToListings(
        req.user._id, 
        parseInt(limit)
    );
    
    res.json({ recommendations });
}));

module.exports = router;
