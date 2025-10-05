const express = require("express");
const router = express.Router();
const Favorite = require("../models/favorite.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isBuyer } = require("../middleware.js");
const wrapAsync = require("../utils/wrapAsync.js");
const RecommendationService = require("../services/recommendationService.js");
const User = require("../models/user.js"); // Added for test route

// Show user's favorites
router.get("/", isLoggedIn, wrapAsync(async (req, res) => {
    const favorites = await Favorite.find({ user: req.user._id })
        .populate({
            path: 'property',
            populate: {
                path: 'owner',
                select: 'firstName lastName companyName'
            }
        })
        .populate('assignedBroker', 'firstName lastName email phone companyName')
        .sort({ addedAt: -1 });
    
    // Get popular recommendations based on favorites
    let recommendations = [];
    if (favorites.length > 0) {
        try {
            recommendations = await RecommendationService.getSimilarToListings(req.user._id, 6);
        } catch (error) {
            console.error('Error getting recommendations:', error);
        }
    }
    
    res.render("favorites/index", { favorites, recommendations });
}));

// Add property to favorites with enhanced preferences
router.post("/", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const { 
            propertyId, 
            notes, 
            priority, 
            interestLevel, 
            timeline, 
            budgetMin, 
            budgetMax, 
            financing 
        } = req.body;
        
        console.log('Adding to favorites:', { propertyId, userId: req.user._id });
        
        // Check if already in favorites
        const existingFavorite = await Favorite.findOne({
            user: req.user._id,
            property: propertyId
        });
        
        if (existingFavorite) {
            req.flash("error", "Property is already in your favorites!");
            return res.redirect(`/listings/${propertyId}`);
        }
        
        // Create new favorite with enhanced preferences
        const favorite = new Favorite({
            user: req.user._id,
            property: propertyId,
            notes: notes || "",
            priority: priority || "medium",
            buyerPreferences: {
                interestLevel: interestLevel || "interested",
                timeline: timeline || "flexible",
                budget: {
                    min: budgetMin ? parseInt(budgetMin) : null,
                    max: budgetMax ? parseInt(budgetMax) : null,
                    currency: "INR"
                },
                financing: financing || "both"
            }
        });
        
        console.log('Saving favorite:', favorite);
        await favorite.save();
        console.log('Favorite saved successfully');
        
        // Update user preferences based on this property (completely non-blocking)
        // This is now completely optional and won't affect the favorite functionality
        setTimeout(async () => {
            try {
                console.log('Updating user preferences for user:', req.user._id);
                await RecommendationService.updateUserPreferences(req.user._id, propertyId);
                console.log('User preferences updated successfully');
            } catch (prefError) {
                console.error('Error updating user preferences (non-critical):', prefError);
                // This error is completely ignored - it won't affect the user experience
            }
        }, 100); // Small delay to ensure favorite is saved first
        
        req.flash("success", "Property added to favorites!");
        res.redirect(`/listings/${propertyId}`);
    } catch (error) {
        console.error('Error adding to favorites:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            userId: req.user._id,
            propertyId: req.body.propertyId
        });
        req.flash("error", "Failed to add property to favorites. Please try again.");
        res.redirect(`/listings/${propertyId}`);
    }
}));

// Remove property from favorites
router.delete("/:id", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    
    await Favorite.findByIdAndDelete(id);
    req.flash("success", "Property removed from favorites!");
    res.redirect("/favorites");
}));

// Update favorite notes/priority and preferences
router.patch("/:id", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { 
        notes, 
        priority, 
        interestLevel, 
        timeline, 
        budgetMin, 
        budgetMax, 
        financing 
    } = req.body;
    
    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (priority !== undefined) updateData.priority = priority;
    
    // Update buyer preferences
    if (interestLevel || timeline || budgetMin || budgetMax || financing) {
        updateData.buyerPreferences = {};
        if (interestLevel) updateData.buyerPreferences.interestLevel = interestLevel;
        if (timeline) updateData.buyerPreferences.timeline = timeline;
        if (budgetMin || budgetMax) {
            updateData.buyerPreferences.budget = {};
            if (budgetMin) updateData.buyerPreferences.budget.min = parseInt(budgetMin);
            if (budgetMax) updateData.buyerPreferences.budget.max = parseInt(budgetMax);
        }
        if (financing) updateData.buyerPreferences.financing = financing;
    }
    
    await Favorite.findByIdAndUpdate(id, updateData);
    
    req.flash("success", "Favorite updated successfully!");
    res.redirect("/favorites");
}));

// Quick add/remove favorite (AJAX endpoint)
router.post("/toggle", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const { propertyId } = req.body;
        
        const existingFavorite = await Favorite.findOne({
            user: req.user._id,
            property: propertyId
        });
        
        if (existingFavorite) {
            // Remove from favorites
            await Favorite.findByIdAndDelete(existingFavorite._id);
            res.json({ action: 'removed', message: 'Removed from favorites' });
        } else {
            // Add to favorites
            const favorite = new Favorite({
                user: req.user._id,
                property: propertyId,
                buyerPreferences: {
                    interestLevel: "interested",
                    timeline: "flexible",
                    financing: "both"
                }
            });
            await favorite.save();
            
            // Update user preferences (completely non-blocking)
            setTimeout(async () => {
                try {
                    await RecommendationService.updateUserPreferences(req.user._id, propertyId);
                } catch (prefError) {
                    console.error('Error updating user preferences (non-critical):', prefError);
                    // This error is completely ignored
                }
            }, 100);
            
            res.json({ action: 'added', message: 'Added to favorites' });
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({ 
            error: true, 
            message: 'Failed to update favorites. Please try again.' 
        });
    }
}));

// Check if property is in user's favorites
router.get("/check/:propertyId", isLoggedIn, wrapAsync(async (req, res) => {
    const { propertyId } = req.params;
    
    const favorite = await Favorite.findOne({
        user: req.user._id,
        property: propertyId
    });
    
    res.json({ isFavorite: !!favorite });
}));

// Get favorite details for editing
router.get("/:id/edit", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    
    const favorite = await Favorite.findById(id)
        .populate('property', 'title address price propertyType images')
        .populate('assignedBroker', 'firstName lastName email phone companyName');
    
    if (!favorite) {
        req.flash("error", "Favorite not found!");
        return res.redirect("/favorites");
    }
    
    res.render("favorites/edit", { favorite });
}));

// Show favorite details
router.get("/:id", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    
    const favorite = await Favorite.findById(id)
        .populate('property', 'title address price propertyType images owner')
        .populate('assignedBroker', 'firstName lastName email phone companyName')
        .populate('communications', 'message createdAt type');
    
    if (!favorite) {
        req.flash("error", "Favorite not found!");
        return res.redirect("/favorites");
    }
    
    res.render("favorites/show", { favorite });
}));

// Get favorites analytics for buyer
router.get("/analytics", isLoggedIn, isBuyer, wrapAsync(async (req, res) => {
    try {
        const userId = req.user._id;
        
        const favorites = await Favorite.find({ user: userId })
            .populate('property', 'title address price propertyType')
            .sort({ addedAt: -1 });
        
        // Calculate analytics
        const totalFavorites = favorites.length;
        const favoriteTypes = {};
        const favoriteLocations = {};
        let totalValue = 0;
        let avgPrice = 0;
        
        favorites.forEach(favorite => {
            const property = favorite.property;
            
            // Count property types
            favoriteTypes[property.propertyType] = (favoriteTypes[property.propertyType] || 0) + 1;
            
            // Count locations
            if (property.address && property.address.city) {
                favoriteLocations[property.address.city] = (favoriteLocations[property.address.city] || 0) + 1;
            }
            
            // Calculate total value
            if (property.price && property.price.amount) {
                totalValue += property.price.amount;
            }
        });
        
        avgPrice = totalFavorites > 0 ? totalValue / totalFavorites : 0;
        
        // Get activity timeline
        const activityTimeline = favorites.map(favorite => ({
            date: favorite.addedAt,
            action: 'Added to favorites',
            property: favorite.property.title,
            propertyType: favorite.property.propertyType,
            price: favorite.property.price?.amount
        }));
        
        // Get broker assignments
        const brokerAssignments = favorites.filter(f => f.brokerAssigned).length;
        
        res.render("favorites/analytics", { 
            favorites,
            totalFavorites,
            favoriteTypes,
            favoriteLocations,
            totalValue,
            avgPrice,
            activityTimeline,
            brokerAssignments
        });
    } catch (error) {
        console.error('Error loading favorites analytics:', error);
        req.flash("error", "Error loading analytics");
        res.redirect("/favorites");
    }
}));

// Test route to verify user model functionality
router.get("/test-user-model", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        console.log('Testing user model for user:', req.user._id);
        
        // Get current user
        const user = await User.findById(req.user._id);
        console.log('Current user preferences:', user.propertyPreferences);
        
        // Initialize preferences
        user.initializePreferences();
        console.log('After initialization:', user.propertyPreferences);
        
        // Try to save
        await user.save();
        console.log('User saved successfully');
        
        res.json({ 
            success: true, 
            message: 'User model test passed',
            preferences: user.propertyPreferences
        });
    } catch (error) {
        console.error('User model test failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'User model test failed',
            error: error.message
        });
    }
}));

// Simple test route to verify basic favorite functionality
router.get("/test-simple", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        console.log('Testing simple favorite functionality for user:', req.user._id);
        
        // Test 1: Check if user can be found
        const user = await User.findById(req.user._id);
        console.log('User found:', !!user);
        
        // Test 2: Check if user has basic structure
        console.log('User has propertyPreferences:', !!user.propertyPreferences);
        console.log('User has communicationPreferences:', !!user.communicationPreferences);
        
        // Test 3: Try to create a simple favorite (without saving to DB)
        const testFavorite = new Favorite({
            user: req.user._id,
            property: '507f1f77bcf86cd799439011', // Test ObjectId
            notes: "Test favorite"
        });
        console.log('Test favorite object created:', !!testFavorite);
        
        res.json({ 
            success: true, 
            message: 'Basic favorite functionality test passed',
            userFound: !!user,
            hasPreferences: !!user.propertyPreferences,
            favoriteCreated: !!testFavorite
        });
    } catch (error) {
        console.error('Simple test failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Simple test failed',
            error: error.message
        });
    }
}));

module.exports = router;
