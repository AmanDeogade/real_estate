const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    userType: {
        type: String,
        enum: ['buyer', 'property_owner', 'broker'],
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    phone: {
        type: String
    },
    companyName: {
        type: String
    },
    licenseNumber: {
        type: String
    },
    brokerLicense: {
        type: String
    },
    agency: {
        type: String
    },
    specialization: [{
        type: String
    }],
    // Property preferences for buyers
    propertyPreferences: {
        preferredTypes: [String], // Simplified - removed enum validation
        preferredLocations: [String], // Cities/areas
        budgetRange: {
            min: { type: Number, default: 0 },
            max: { type: Number, default: 0 },
            currency: { type: String, default: 'INR' }
        },
        bedrooms: {
            min: { type: Number, default: 0 },
            max: { type: Number, default: 0 }
        },
        bathrooms: {
            min: { type: Number, default: 0 },
            max: { type: Number, default: 0 }
        },
        preferredFurnishing: String // Simplified - removed enum validation
    },
    // Communication preferences
    communicationPreferences: {
        email: {
            type: Boolean,
            default: true
        },
        sms: {
            type: Boolean,
            default: false
        },
        push: {
            type: Boolean,
            default: true
        },
        frequency: {
            type: String,
            enum: ['immediate', 'daily', 'weekly'],
            default: 'daily'
        }
    },
    // Location for area-based notifications
    location: {
        city: String,
        state: String,
        coordinates: [Number], // [longitude, latitude]
        radius: {
            type: Number,
            default: 10 // km radius for notifications
        }
    },
    // Broker assignment (for buyers)
    assignedBroker: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    
    // Special Owner status
    isSpecialOwner: {
        type: Boolean,
        default: false
    },
    specialOwnerSince: {
        type: Date
    },

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
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    
    // Initialize property preferences if they don't exist
    if (!this.propertyPreferences) {
        this.propertyPreferences = {
            preferredTypes: [],
            preferredLocations: [],
            budgetRange: { min: 0, max: 0, currency: 'INR' },
            bedrooms: { min: 0, max: 0 },
            bathrooms: { min: 0, max: 0 }
        };
    }
    
    // Initialize communication preferences if they don't exist
    if (!this.communicationPreferences) {
        this.communicationPreferences = {
            email: true,
            sms: false,
            push: true,
            frequency: 'daily'
        };
    }
    
    next();
});

// Method to safely initialize preferences
userSchema.methods.initializePreferences = function() {
    if (!this.propertyPreferences) {
        this.propertyPreferences = {
            preferredTypes: [],
            preferredLocations: [],
            budgetRange: { min: 0, max: 0, currency: 'INR' },
            bedrooms: { min: 0, max: 0 },
            bathrooms: { min: 0, max: 0 }
        };
    }
    
    if (!this.communicationPreferences) {
        this.communicationPreferences = {
            email: true,
            sms: false,
            push: true,
            frequency: 'daily'
        };
    }
    
    return this;
};



// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Index for location-based queries
userSchema.index({ 'location.coordinates': '2dsphere' });
userSchema.index({ 'location.city': 1 });

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);