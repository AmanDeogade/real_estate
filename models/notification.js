const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    type: {
        type: String,
        enum: ['new_listing', 'price_change', 'similar_property', 'inquiry_update', 'system_message', 'recommendation'],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    // Related data
    relatedListing: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
    },
    relatedLead: {
        type: Schema.Types.ObjectId,
        ref: "Lead",
    },
    // Notification status
    isRead: {
        type: Boolean,
        default: false,
    },
    isDelivered: {
        type: Boolean,
        default: false,
    },
    // Delivery methods attempted
    deliveryAttempts: {
        email: {
            attempted: { type: Boolean, default: false },
            delivered: { type: Boolean, default: false },
            deliveredAt: Date
        },
        sms: {
            attempted: { type: Boolean, default: false },
            delivered: { type: Boolean, default: false },
            deliveredAt: Date
        },
        push: {
            attempted: { type: Boolean, default: false },
            delivered: { type: Boolean, default: false },
            deliveredAt: Date
        }
    },
    // Priority and scheduling
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    scheduledFor: Date, // For scheduled notifications
    expiresAt: Date, // For time-sensitive notifications
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
    },
    readAt: Date,
    deliveredAt: Date
});

// Indexes for efficient queries
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1, isDelivered: false });

// Virtual for notification age
notificationSchema.virtual('age').get(function() {
    return Date.now() - this.createdAt;
});

// Virtual for isExpired
notificationSchema.virtual('isExpired').get(function() {
    if (!this.expiresAt) return false;
    return Date.now() > this.expiresAt;
});

// Mark as read
notificationSchema.methods.markAsRead = function() {
    this.isRead = true;
    this.readAt = Date.now();
    return this.save();
};

// Mark as delivered
notificationSchema.methods.markAsDelivered = function(method) {
    this.isDelivered = true;
    this.deliveredAt = Date.now();
    if (method && this.deliveryAttempts[method]) {
        this.deliveryAttempts[method].delivered = true;
        this.deliveryAttempts[method].deliveredAt = Date.now();
    }
    return this.save();
};

const Notification = mongoose.model("Notification", notificationSchema);
module.exports = Notification;
