const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const communicationSchema = new Schema({
    // Sender (broker)
    sender: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Receiver (buyer)
    receiver: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Communication type
    type: {
        type: String,
        enum: ['email', 'sms', 'web_app', 'phone_call'],
        required: true
    },
    // Subject/title
    subject: String,
    // Message content
    message: {
        type: String,
        required: true
    },
    // Related property (if applicable)
    relatedProperty: {
        type: Schema.Types.ObjectId,
        ref: "Listing"
    },
    // Related buyer assignment (if applicable)
    relatedAssignment: {
        type: Schema.Types.ObjectId,
        ref: "BuyerAssignment"
    },
    // Communication status
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read', 'failed'],
        default: 'sent'
    },
    // Delivery details
    deliveryDetails: {
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        failureReason: String
    },
    // Priority
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    // Tags for organization
    tags: [String],
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
communicationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Indexes for efficient queries
communicationSchema.index({ sender: 1, receiver: 1 });
communicationSchema.index({ receiver: 1, status: 1 });
communicationSchema.index({ type: 1, status: 1 });
communicationSchema.index({ createdAt: -1 });

const Communication = mongoose.model("Communication", communicationSchema);
module.exports = Communication;


