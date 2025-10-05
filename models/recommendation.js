const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const recommendationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    listing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    // Recommendation details
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    reasons: [{
        type: String,
        enum: [
            'matches_preferences',
            'similar_to_favorites',
            'location_match',
            'price_range_match',
            'property_type_match',
            'bedroom_match',
            'bathroom_match',
            'recently_viewed_similar',
            'trending_in_area',
            'featured_property'
        ]
    }],
    // User interaction with recommendation
    isViewed: {
        type: Boolean,
        default: false
    },
    isFavorited: {
        type: Boolean,
        default: false
    },
    isInquired: {
        type: Boolean,
        default: false
    },
    // Recommendation metadata
    algorithm: {
        type: String,
        enum: ['collaborative', 'content_based', 'hybrid', 'rule_based'],
        default: 'hybrid'
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        default: function() {
            // Recommendations expire after 30 days
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    }
});

// Indexes for efficient queries
recommendationSchema.index({ user: 1, score: -1, createdAt: -1 });
recommendationSchema.index({ user: 1, isViewed: 1, createdAt: -1 });
recommendationSchema.index({ listing: 1, score: -1 });
recommendationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for recommendation age
recommendationSchema.virtual('age').get(function() {
    return Date.now() - this.createdAt;
});

// Virtual for isExpired
recommendationSchema.virtual('isExpired').get(function() {
    return Date.now() > this.expiresAt;
});

// Update recommendation score
recommendationSchema.methods.updateScore = function(newScore, newReasons) {
    this.score = newScore;
    if (newReasons) this.reasons = newReasons;
    this.lastUpdated = Date.now();
    return this.save();
};

// Mark as viewed
recommendationSchema.methods.markAsViewed = function() {
    this.isViewed = true;
    this.lastUpdated = Date.now();
    return this.save();
};

// Mark as favorited
recommendationSchema.methods.markAsFavorited = function() {
    this.isFavorited = true;
    this.lastUpdated = Date.now();
    return this.save();
};

// Mark as inquired
recommendationSchema.methods.markAsInquired = function() {
    this.isInquired = true;
    this.lastUpdated = Date.now();
    return this.save();
};

const Recommendation = mongoose.model("Recommendation", recommendationSchema);
module.exports = Recommendation;
