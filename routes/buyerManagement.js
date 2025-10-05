const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isPropertyOwner } = require("../middleware.js");
const BuyerAssignment = require("../models/buyerAssignment.js");
const User = require("../models/user.js");
const Favorite = require("../models/favorite.js");

// Get all buyers for a property owner
router.get("/buyers", isLoggedIn, isPropertyOwner, wrapAsync(async (req, res) => {
    try {
        // Get all buyers who have favorited properties owned by the current user
        const favorites = await Favorite.find()
            .populate({
                path: 'property',
                match: { owner: req.user._id }
            })
            .populate('user')
            .populate('assignedBroker');

        // Filter out favorites where property doesn't belong to current user
        const validFavorites = favorites.filter(fav => fav.property !== null);

        // Group by buyer
        const buyerMap = new Map();
        validFavorites.forEach(fav => {
            if (!buyerMap.has(fav.user._id.toString())) {
                buyerMap.set(fav.user._id.toString(), {
                    _id: fav.user._id,
                    firstName: fav.user.firstName,
                    lastName: fav.user.lastName,
                    email: fav.user.email,
                    phone: fav.user.phone,
                    location: fav.user.location,
                    propertyPreferences: fav.user.propertyPreferences,
                    assignedBroker: fav.user.assignedBroker,
                    favorites: []
                });
            }
            buyerMap.get(fav.user._id.toString()).favorites.push(fav);
        });

        const buyers = Array.from(buyerMap.values());

        // Get stats
        const stats = {
            totalBuyers: buyers.length,
            assignedBuyers: buyers.filter(b => b.assignedBroker).length,
            pendingAssignments: buyers.filter(b => !b.assignedBroker).length,
            totalFavorites: validFavorites.length
        };

        // Get available brokers
        const brokers = await User.find({ userType: 'broker' })
            .select('firstName lastName specialization agency');

        res.render("listings/broker-dashboard", {
            buyers,
            brokers,
            stats
        });

    } catch (error) {
        console.error('Error getting buyers:', error);
        req.flash('error', 'Error loading buyer data');
        res.redirect('/listings/dashboard');
    }
}));

// Assign broker to buyer
router.post("/assign-broker", isLoggedIn, isPropertyOwner, wrapAsync(async (req, res) => {
    try {
        const { buyerId, brokerId } = req.body;

        // Validate buyer and broker
        const buyer = await User.findById(buyerId);
        const broker = await User.findById(brokerId);

        if (!buyer || buyer.userType !== 'buyer') {
            return res.status(400).json({ message: 'Invalid buyer' });
        }

        if (!broker || broker.userType !== 'broker') {
            return res.status(400).json({ message: 'Invalid broker' });
        }

        // Create or update buyer assignment
        await BuyerAssignment.findOneAndUpdate(
            {
                propertyOwner: req.user._id,
                buyer: buyerId
            },
            {
                propertyOwner: req.user._id,
                buyer: buyerId,
                broker: brokerId,
                status: 'pending',
                reason: 'Property owner assignment'
            },
            { upsert: true, new: true }
        );

        // Update buyer's assigned broker
        await User.findByIdAndUpdate(buyerId, {
            assignedBroker: brokerId
        });

        res.json({ success: true, message: 'Broker assigned successfully' });

    } catch (error) {
        console.error('Error assigning broker:', error);
        res.status(500).json({ message: 'Error assigning broker' });
    }
}));

// Unassign broker from buyer
router.post("/unassign-broker", isLoggedIn, isPropertyOwner, wrapAsync(async (req, res) => {
    try {
        const { buyerId } = req.body;

        // Remove buyer assignment
        await BuyerAssignment.findOneAndDelete({
            propertyOwner: req.user._id,
            buyer: buyerId
        });

        // Remove broker from buyer
        await User.findByIdAndUpdate(buyerId, {
            $unset: { assignedBroker: 1 }
        });

        res.json({ success: true, message: 'Broker unassigned successfully' });

    } catch (error) {
        console.error('Error unassigning broker:', error);
        res.status(500).json({ message: 'Error unassigning broker' });
    }
}));

// Get buyer details
router.get("/buyer/:id", isLoggedIn, isPropertyOwner, wrapAsync(async (req, res) => {
    try {
        const buyer = await User.findById(req.params.id)
            .populate('assignedBroker')
            .populate({
                path: 'favorites',
                populate: {
                    path: 'property',
                    match: { owner: req.user._id }
                }
            });

        if (!buyer || buyer.userType !== 'buyer') {
            req.flash('error', 'Buyer not found');
            return res.redirect('/buyer-management/buyers');
        }

        // Filter favorites to only show properties owned by current user
        const validFavorites = buyer.favorites.filter(fav => fav.property !== null);

        res.json({
            buyer: {
                _id: buyer._id,
                firstName: buyer.firstName,
                lastName: buyer.lastName,
                email: buyer.email,
                phone: buyer.phone,
                location: buyer.location,
                propertyPreferences: buyer.propertyPreferences,
                assignedBroker: buyer.assignedBroker,
                favorites: validFavorites
            }
        });

    } catch (error) {
        console.error('Error getting buyer details:', error);
        res.status(500).json({ message: 'Error getting buyer details' });
    }
}));

// Get buyer analytics
router.get("/analytics", isLoggedIn, isPropertyOwner, wrapAsync(async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get buyer engagement analytics
        const analytics = await Favorite.aggregate([
            {
                $lookup: {
                    from: 'listings',
                    localField: 'property',
                    foreignField: '_id',
                    as: 'property'
                }
            },
            {
                $unwind: '$property'
            },
            {
                $match: {
                    'property.owner': req.user._id,
                    addedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        buyer: '$user',
                        month: { $month: '$addedAt' }
                    },
                    favoriteCount: { $sum: 1 },
                    lastActivity: { $max: '$addedAt' }
                }
            },
            {
                $group: {
                    _id: '$_id.month',
                    uniqueBuyers: { $sum: 1 },
                    totalFavorites: { $sum: '$favoriteCount' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Get top buyers
        const topBuyers = await Favorite.aggregate([
            {
                $lookup: {
                    from: 'listings',
                    localField: 'property',
                    foreignField: '_id',
                    as: 'property'
                }
            },
            {
                $unwind: '$property'
            },
            {
                $match: {
                    'property.owner': req.user._id,
                    addedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$user',
                    favoriteCount: { $sum: 1 },
                    lastActivity: { $max: '$addedAt' }
                }
            },
            {
                $sort: { favoriteCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'buyer'
                }
            },
            {
                $unwind: '$buyer'
            }
        ]);

        res.json({
            analytics,
            topBuyers,
            period: days
        });

    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ message: 'Error getting analytics' });
    }
}));

module.exports = router;


