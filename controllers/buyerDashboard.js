const Listing = require("../models/listing.js");
const Favorite = require("../models/favorite.js");
const User = require("../models/user.js");
const RecommendationService = require("../services/recommendationService.js");

// Buyer Dashboard - Main recommendations page
module.exports.buyerDashboard = async (req, res) => {
    try {
        console.log('Loading buyer dashboard for user:', req.user._id);
        
        // Get user's favorites for statistics
        const userFavorites = await Favorite.find({ user: req.user._id })
            .populate('property')
            .sort({ addedAt: -1 });

        // Get comprehensive recommendations
        const [
            personalizedRecs,
            nearbyRecs,
            highScoreRecs,
            trendingRecs
        ] = await Promise.all([
            RecommendationService.getBuyerRecommendations(req.user._id, 8),
            RecommendationService.getNearbyRecommendations(req.user._id, 10, 4),
            RecommendationService.getHighLocationScoreListings(6),
            RecommendationService.getTrendingListings(4)
        ]);

        // Calculate statistics
        const stats = {
            totalFavorites: userFavorites.length,
            highInterestFavorites: userFavorites.filter(f => f.buyerPreferences?.interestLevel === 'very_interested').length,
            readyToBuyFavorites: userFavorites.filter(f => f.buyerPreferences?.interestLevel === 'ready_to_buy').length,
            avgLocationScore: personalizedRecs.length > 0 ? 
                Math.round(personalizedRecs.reduce((sum, rec) => sum + (rec.locationScores?.overallScore || 0), 0) / personalizedRecs.length) : 0
        };

        // Get recent favorites for quick access
        const recentFavorites = userFavorites.slice(0, 6);

        res.render("buyers/dashboard", {
            user: req.user,
            stats,
            recommendations: {
                personalized: personalizedRecs,
                nearby: nearbyRecs,
                highScore: highScoreRecs,
                trending: trendingRecs
            },
            recentFavorites,
            userFavorites: userFavorites.slice(0, 12) // For favorites section
        });

    } catch (error) {
        console.error('Error loading buyer dashboard:', error);
        req.flash("error", "Error loading dashboard. Please try again.");
        res.redirect("/listings");
    }
};

// Get recommendations as JSON (for AJAX calls)
module.exports.getRecommendationsJSON = async (req, res) => {
    try {
        const { type = 'all', limit = 12 } = req.query;
        
        let recommendations = [];
        
        switch (type) {
            case 'personalized':
                recommendations = await RecommendationService.getBuyerRecommendations(req.user._id, parseInt(limit));
                break;
            case 'nearby':
                recommendations = await RecommendationService.getNearbyRecommendations(req.user._id, 10, parseInt(limit));
                break;
            case 'highscore':
                recommendations = await RecommendationService.getHighLocationScoreListings(parseInt(limit));
                break;
            case 'trending':
                recommendations = await RecommendationService.getTrendingListings(parseInt(limit));
                break;
            case 'similar':
                recommendations = await RecommendationService.getSimilarToListings(req.user._id, parseInt(limit));
                break;
            default:
                recommendations = await RecommendationService.getBuyerRecommendations(req.user._id, parseInt(limit));
        }

        res.json({
            success: true,
            recommendations,
            type,
            count: recommendations.length
        });

    } catch (error) {
        console.error('Error getting recommendations JSON:', error);
        res.status(500).json({
            success: false,
            message: "Error loading recommendations"
        });
    }
};

// Get user's favorite properties with enhanced details
module.exports.getUserFavorites = async (req, res) => {
    try {
        const { page = 1, limit = 12 } = req.query;
        const skip = (page - 1) * limit;

        const favorites = await Favorite.find({ user: req.user._id })
            .populate({
                path: 'property',
                populate: {
                    path: 'owner',
                    select: 'firstName lastName companyName isSpecialOwner'
                }
            })
            .populate('assignedBroker', 'firstName lastName email phone')
            .sort({ addedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Favorite.countDocuments({ user: req.user._id });
        const totalPages = Math.ceil(total / limit);

        res.render("buyers/favorites", {
            favorites,
            currentPage: parseInt(page),
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            user: req.user
        });

    } catch (error) {
        console.error('Error loading user favorites:', error);
        req.flash("error", "Error loading favorites. Please try again.");
        res.redirect("/buyers/dashboard");
    }
};

// Get property recommendations based on location
module.exports.getLocationRecommendations = async (req, res) => {
    try {
        const { city, lat, lng, radius = 10 } = req.query;
        
        let recommendations = [];
        
        if (lat && lng) {
            // Get recommendations based on coordinates
            const centerLat = parseFloat(lat);
            const centerLng = parseFloat(lng);
            const searchRadius = parseInt(radius) * 1000; // Convert to meters
            
            recommendations = await Listing.find({
                status: 'active',
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [centerLng, centerLat]
                        },
                        $maxDistance: searchRadius
                    }
                }
            })
                .populate('owner', 'firstName lastName companyName')
                .sort({ 'locationScores.overallScore': -1, featured: -1 })
                .limit(12);
                
        } else if (city) {
            // Get recommendations based on city
            recommendations = await RecommendationService.getLocationBasedRecommendations(city, 12);
        } else {
            // Default to popular listings
            recommendations = await RecommendationService.getPopularListings(12);
        }

        res.json({
            success: true,
            recommendations,
            searchParams: { city, lat, lng, radius }
        });

    } catch (error) {
        console.error('Error getting location recommendations:', error);
        res.status(500).json({
            success: false,
            message: "Error loading location recommendations"
        });
    }
};


