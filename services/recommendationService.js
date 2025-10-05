const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const Favorite = require("../models/favorite.js");
const propertyScoreService = require("./propertyScoreService.js");

class RecommendationService {
    // Get personalized recommendations based on user preferences
    static async getPersonalizedRecommendations(userId, limit = 6) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.propertyPreferences) {
                return await this.getPopularListings(limit);
            }

            const { propertyPreferences } = user;
            let query = { status: 'active' };

            // Filter by preferred property types
            if (propertyPreferences.preferredTypes && propertyPreferences.preferredTypes.length > 0) {
                query.propertyType = { $in: propertyPreferences.preferredTypes };
            }

            // Filter by preferred locations
            if (propertyPreferences.preferredLocations && propertyPreferences.preferredLocations.length > 0) {
                query['address.city'] = { $in: propertyPreferences.preferredLocations };
            }

            // Filter by budget range
            if (propertyPreferences.budgetRange) {
                query['price.amount'] = {};
                if (propertyPreferences.budgetRange.min) {
                    query['price.amount'].$gte = propertyPreferences.budgetRange.min;
                }
                if (propertyPreferences.budgetRange.max) {
                    query['price.amount'].$lte = propertyPreferences.budgetRange.max;
                }
            }

            // Filter by bedroom/bathroom preferences
            if (propertyPreferences.bedrooms) {
                if (propertyPreferences.bedrooms.min) {
                    query.bedrooms = { $gte: propertyPreferences.bedrooms.min };
                }
                if (propertyPreferences.bedrooms.max) {
                    query.bedrooms = { ...query.bedrooms, $lte: propertyPreferences.bedrooms.max };
                }
            }

            if (propertyPreferences.bathrooms) {
                if (propertyPreferences.bathrooms.min) {
                    query.bathrooms = { $gte: propertyPreferences.bathrooms.min };
                }
                if (propertyPreferences.bathrooms.max) {
                    query.bathrooms = { ...query.bathrooms, $lte: propertyPreferences.bathrooms.max };
                }
            }

            const recommendations = await Listing.find(query)
                .populate('owner', 'firstName lastName companyName')
                .sort({ featured: -1, views: -1, createdAt: -1 })
                .limit(limit);

            // If not enough personalized results, fill with popular listings
            if (recommendations.length < limit) {
                const remainingLimit = limit - recommendations.length;
                const popularListings = await this.getPopularListings(remainingLimit, recommendations.map(r => r._id));
                recommendations.push(...popularListings);
            }

            return recommendations;
        } catch (error) {
            console.error('Error getting personalized recommendations:', error);
            return await this.getPopularListings(limit);
        }
    }

    // Get recommendations based on user's favorite properties
    static async getSimilarToListings(userId, limit = 6) {
        try {
            const userFavorites = await Favorite.find({ user: userId })
                .populate('property')
                .sort({ addedAt: -1 })
                .limit(5);

            if (userFavorites.length === 0) {
                return await this.getPopularListings(limit);
            }

            // Get property types and locations from favorites
            const favoriteTypes = [...new Set(userFavorites.map(f => f.property.propertyType))];
            const favoriteCities = [...new Set(userFavorites.map(f => f.property.address?.city).filter(Boolean))];
            const avgPrice = userFavorites.reduce((sum, f) => sum + f.property.price.amount, 0) / userFavorites.length;

            let query = { 
                status: 'active',
                _id: { $nin: userFavorites.map(f => f.property._id) }
            };

            // Build similarity query
            const similarityConditions = [];
            
            if (favoriteTypes.length > 0) {
                similarityConditions.push({ propertyType: { $in: favoriteTypes } });
            }
            
            if (favoriteCities.length > 0) {
                similarityConditions.push({ 'address.city': { $in: favoriteCities } });
            }

            // Price range around average favorite price
            if (avgPrice > 0) {
                const priceRange = avgPrice * 0.3; // 30% range
                similarityConditions.push({
                    'price.amount': { 
                        $gte: avgPrice - priceRange, 
                        $lte: avgPrice + priceRange 
                    }
                });
            }

            if (similarityConditions.length > 0) {
                query.$or = similarityConditions;
            }

            const similarListings = await Listing.find(query)
                .populate('owner', 'firstName lastName companyName')
                .sort({ featured: -1, views: -1 })
                .limit(limit);

            return similarListings;
        } catch (error) {
            console.error('Error getting similar listings:', error);
            return await this.getPopularListings(limit);
        }
    }

    // Get popular listings based on views and inquiries
    static async getPopularListings(limit = 6, excludeIds = []) {
        try {
            let query = { status: 'active' };
            if (excludeIds.length > 0) {
                query._id = { $nin: excludeIds };
            }

            return await Listing.find(query)
                .populate('owner', 'firstName lastName companyName')
                .sort({ featured: -1, views: -1, 'inquiries.length': -1, createdAt: -1 })
                .limit(limit);
        } catch (error) {
            console.error('Error getting popular listings:', error);
            return [];
        }
    }

    // Get trending properties (recently popular)
    static async getTrendingListings(limit = 6) {
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            return await Listing.find({ 
                status: 'active',
                createdAt: { $gte: oneWeekAgo }
            })
                .populate('owner', 'firstName lastName companyName')
                .sort({ views: -1, 'inquiries.length': -1 })
                .limit(limit);
        } catch (error) {
            console.error('Error getting trending listings:', error);
            return [];
        }
    }

    // Get location-based recommendations
    static async getLocationBasedRecommendations(city, limit = 6) {
        try {
            return await Listing.find({
                status: 'active',
                'address.city': { $regex: city, $options: 'i' }
            })
                .populate('owner', 'firstName lastName companyName')
                .sort({ featured: -1, views: -1, createdAt: -1 })
                .limit(limit);
        } catch (error) {
            console.error('Error getting location-based recommendations:', error);
            return [];
        }
    }

    // Get comprehensive buyer recommendations combining favorites and location scoring
    static async getBuyerRecommendations(userId, limit = 12) {
        try {
            console.log(`Getting comprehensive buyer recommendations for user: ${userId}`);
            
            // Get user's favorites to understand preferences
            const userFavorites = await Favorite.find({ user: userId })
                .populate('property')
                .sort({ addedAt: -1 })
                .limit(10);

            // Get user preferences
            const user = await User.findById(userId);
            const userPreferences = user.propertyPreferences || {};

            // Combine different recommendation types
            const [similarToListings, locationBasedRecs, popularListings, highScoreListings] = await Promise.all([
                this.getSimilarToListings(userId, Math.ceil(limit * 0.4)),
                this.getLocationBasedRecommendations(userPreferences.preferredLocations?.[0] || 'Pune', Math.ceil(limit * 0.3)),
                this.getPopularListings(Math.ceil(limit * 0.2)),
                this.getHighLocationScoreListings(Math.ceil(limit * 0.1))
            ]);

            // Combine and deduplicate recommendations
            const allRecommendations = [
                ...similarToListings.map(rec => ({ ...rec.toObject(), recommendationType: 'similar_to_favorites', score: 95 })),
                ...locationBasedRecs.map(rec => ({ ...rec.toObject(), recommendationType: 'location_match', score: 85 })),
                ...popularListings.map(rec => ({ ...rec.toObject(), recommendationType: 'trending', score: 75 })),
                ...highScoreListings.map(rec => ({ ...rec.toObject(), recommendationType: 'high_location_score', score: 90 }))
            ];

            // Remove duplicates and sort by score
            const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations);
            
            // Sort by recommendation score and limit
            return uniqueRecommendations
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

        } catch (error) {
            console.error('Error getting buyer recommendations:', error);
            return await this.getPopularListings(limit);
        }
    }

    // Get properties with high location scores
    static async getHighLocationScoreListings(limit = 6) {
        try {
            return await Listing.find({
                status: 'active',
                'locationScores.overallScore': { $gte: 75 } // High location score threshold
            })
                .populate('owner', 'firstName lastName companyName')
                .sort({ 'locationScores.overallScore': -1, featured: -1, createdAt: -1 })
                .limit(limit);
        } catch (error) {
            console.error('Error getting high location score listings:', error);
            return [];
        }
    }

    // Get nearby properties based on user's favorite locations
    static async getNearbyRecommendations(userId, radiusKm = 10, limit = 6) {
        try {
            const userFavorites = await Favorite.find({ user: userId })
                .populate('property')
                .sort({ addedAt: -1 })
                .limit(5);

            if (userFavorites.length === 0) {
                return await this.getPopularListings(limit);
            }

            const nearbyRecommendations = [];

            for (const favorite of userFavorites) {
                if (favorite.property.location && favorite.property.location.coordinates) {
                    const [favoriteLng, favoriteLat] = favorite.property.location.coordinates;
                    
                    // Find nearby properties using geospatial query
                    const nearbyProperties = await Listing.find({
                        status: 'active',
                        location: {
                            $near: {
                                $geometry: {
                                    type: 'Point',
                                    coordinates: [favoriteLng, favoriteLat]
                                },
                                $maxDistance: radiusKm * 1000 // Convert km to meters
                            }
                        },
                        _id: { $nin: userFavorites.map(f => f.property._id) }
                    })
                        .populate('owner', 'firstName lastName companyName')
                        .limit(Math.ceil(limit / userFavorites.length));

                    nearbyRecommendations.push(...nearbyProperties.map(prop => ({
                        ...prop.toObject(),
                        recommendationType: 'nearby_to_favorites',
                        score: 88,
                        distanceFromFavorite: this.calculateDistance(
                            favoriteLat, favoriteLng,
                            prop.location.coordinates[1], prop.location.coordinates[0]
                        )
                    })));
                }
            }

            // Remove duplicates and sort by distance
            const uniqueNearby = this.deduplicateRecommendations(nearbyRecommendations);
            return uniqueNearby
                .sort((a, b) => (a.distanceFromFavorite || 0) - (b.distanceFromFavorite || 0))
                .slice(0, limit);

        } catch (error) {
            console.error('Error getting nearby recommendations:', error);
            return await this.getPopularListings(limit);
        }
    }

    // Calculate distance between two coordinates (Haversine formula)
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Remove duplicate recommendations
    static deduplicateRecommendations(recommendations) {
        const seen = new Set();
        return recommendations.filter(rec => {
            if (seen.has(rec._id.toString())) {
                return false;
            }
            seen.add(rec._id.toString());
            return true;
        });
    }

    // Get recommendation reasons for display
    static getRecommendationReasons(recommendationType) {
        const reasons = {
            'similar_to_favorites': 'Similar to your favorites',
            'location_match': 'Matches your preferred location',
            'trending': 'Trending in your area',
            'high_location_score': 'Excellent location score',
            'nearby_to_favorites': 'Near your favorite properties'
        };
        return reasons[recommendationType] || 'Recommended for you';
    }

    // Update user preferences based on their behavior
    static async updateUserPreferences(userId, listingId) {
        try {
            const listing = await Listing.findById(listingId);
            if (!listing) return;

            const user = await User.findById(userId);
            if (!user) return;

            // Initialize preferences safely
            user.initializePreferences();

            // Simple updates - only add if not already present
            if (listing.propertyType && !user.propertyPreferences.preferredTypes.includes(listing.propertyType)) {
                user.propertyPreferences.preferredTypes.push(listing.propertyType);
            }

            if (listing.address?.city && !user.propertyPreferences.preferredLocations.includes(listing.address.city)) {
                user.propertyPreferences.preferredLocations.push(listing.address.city);
            }

            // Simple budget update - only update if current values are 0
            if (listing.price?.amount) {
                const amount = listing.price.amount;
                if (user.propertyPreferences.budgetRange.max === 0) {
                    user.propertyPreferences.budgetRange.max = amount;
                }
                if (user.propertyPreferences.budgetRange.min === 0) {
                    user.propertyPreferences.budgetRange.min = amount;
                }
            }

            // Simple bedroom/bathroom updates - only update if current values are 0
            if (listing.bedrooms && user.propertyPreferences.bedrooms.max === 0) {
                user.propertyPreferences.bedrooms.max = listing.bedrooms;
                user.propertyPreferences.bedrooms.min = listing.bedrooms;
            }

            if (listing.bathrooms && user.propertyPreferences.bathrooms.max === 0) {
                user.propertyPreferences.bathrooms.max = listing.bathrooms;
                user.propertyPreferences.bathrooms.min = listing.bathrooms;
            }

            // Use findByIdAndUpdate instead of save to avoid validation issues
            await User.findByIdAndUpdate(userId, {
                $set: {
                    propertyPreferences: user.propertyPreferences
                }
            }, { new: true, runValidators: false });

        } catch (error) {
            console.error('Error updating user preferences:', error);
            // Don't throw the error, just log it to avoid breaking the favorite functionality
        }
    }
}

module.exports = RecommendationService;
