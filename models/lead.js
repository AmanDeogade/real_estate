const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const leadSchema = new Schema({
    // Lead source
    source: {
        type: String,
        enum: ['property_inquiry', 'website_contact', 'phone_call', 'walk_in', 'referral', 'website', 'social_media', 'open_house', 'cold_call', 'other', 'manual_entry'],
        default: 'property_inquiry'
    },
    // Lead details
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: false,
    },
    // Lead information
    interest: {
        type: String,
        enum: ['buy', 'rent', 'sell', 'invest'],
        required: true,
    },
    propertyType: [{
        type: String,
        enum: ['apartment', 'house', 'villa', 'commercial', 'land', 'office', 'shop', 'condo', 'townhouse']
    }],
    budget: {
        min: Number,
        max: Number,
        currency: {
            type: String,
            default: 'INR'
        }
    },
    preferredLocation: [String],
    location: String,
    timeline: {
        type: String,
        enum: ['immediate', 'soon', 'flexible', 'planning', '1-3_months', '3-6_months', '6-12_months'],
        default: 'flexible'
    },
    // Lead status and assignment
    status: {
        type: String,
        enum: ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost'],
        default: 'new'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    assignedBroker: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    // Related property (if inquiry came from property)
    relatedProperty: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
    },
    // Communication history
    notes: [{
        content: String,
        broker: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        userType: {
            type: String,
            enum: ['broker', 'property_owner', 'buyer'],
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Follow-up tasks
    tasks: [{
        title: String,
        description: String,
        dueDate: Date,
        completed: {
            type: Boolean,
            default: false
        },
        broker: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        addedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        userType: {
            type: String,
            enum: ['broker', 'property_owner', 'buyer'],
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // Who created the lead (useful for owner-created leads)
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    lastContacted: Date,
    nextFollowUp: Date
});

// Virtual for full name
leadSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Update timestamp on save
leadSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for search queries
leadSchema.index({ 
    firstName: 'text', 
    lastName: 'text', 
    email: 'text',
    phone: 'text'
});

const Lead = mongoose.model("Lead", leadSchema);
module.exports = Lead;
