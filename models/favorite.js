const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const favoriteSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    property: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
        required: true,
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
    notes: String, // User's personal notes about the property
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    // Additional buyer preferences when adding to favorites
    buyerPreferences: {
        interestLevel: {
            type: String,
            enum: ['just_browsing', 'interested', 'very_interested', 'ready_to_buy'],
            default: 'interested'
        },
        timeline: {
            type: String,
            enum: ['immediate', '1-3_months', '3-6_months', '6-12_months', 'flexible'],
            default: 'flexible'
        },
        budget: {
            min: Number,
            max: Number,
            currency: {
                type: String,
                default: 'INR'
            }
        },
        financing: {
            type: String,
            enum: ['cash', 'loan', 'both'],
            default: 'both'
        }
    },
    // Broker assignment status
    brokerAssigned: {
        type: Boolean,
        default: false
    },
    assignedBroker: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    assignmentDate: Date,
    // Communication history
    communications: [{
        type: Schema.Types.ObjectId,
        ref: "Communication"
    }]
});

// Compound index to ensure unique user-property combinations
favoriteSchema.index({ user: 1, property: 1 }, { unique: true });

// Index for quick user favorites lookup
favoriteSchema.index({ user: 1, addedAt: -1 });

// Index for broker assignments
favoriteSchema.index({ assignedBroker: 1, brokerAssigned: 1 });

const Favorite = mongoose.model("Favorite", favoriteSchema);
module.exports = Favorite;
