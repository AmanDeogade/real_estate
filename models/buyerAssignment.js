const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const buyerAssignmentSchema = new Schema({
    // Property owner who made the assignment
    propertyOwner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Buyer being assigned
    buyer: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Broker being assigned to the buyer
    broker: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Property that triggered the assignment
    relatedProperty: {
        type: Schema.Types.ObjectId,
        ref: "Listing"
    },
    // Assignment reason/notes
    reason: String,
    // Assignment status
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'completed'],
        default: 'pending'
    },
    // Communication preferences for this assignment
    communicationPreferences: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        webApp: { type: Boolean, default: true }
    },
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    acceptedAt: Date,
    completedAt: Date
});

// Update timestamp on save
buyerAssignmentSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes for efficient queries
buyerAssignmentSchema.index({ propertyOwner: 1, status: 1 });
buyerAssignmentSchema.index({ buyer: 1, status: 1 });
buyerAssignmentSchema.index({ broker: 1, status: 1 });
buyerAssignmentSchema.index({ status: 1, createdAt: -1 });

const BuyerAssignment = mongoose.model("BuyerAssignment", buyerAssignmentSchema);
module.exports = BuyerAssignment;


