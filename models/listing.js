const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js")

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: String,
    propertyType: {
        type: String,
        enum: ['apartment', 'house', 'villa', 'commercial', 'land', 'office', 'shop'],
        required: true,
    },
    listingType: {
        type: String,
        enum: ['sale', 'rent'],
        required: true,
    },
    price: {
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        negotiable: {
            type: Boolean,
            default: false,
        }
    },
    // Property details
    bedrooms: Number,
    bathrooms: Number,
    area: {
        size: Number,
        unit: {
            type: String,
            enum: ['sqft', 'sqm', 'acres'],
            default: 'sqft'
        }
    },
    floor: Number,
    totalFloors: Number,
    yearBuilt: Number,
    furnishing: {
        type: String,
        enum: ['unfurnished', 'semi-furnished', 'fully-furnished'],
        default: 'unfurnished'
    },
    // Location details
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: {
            type: String,
            default: 'India'
        }
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [Number] // [longitude, latitude]
    },
    // Property location scores
    locationScores: {
        amenityScore: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        environmentScore: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        safetyScore: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        pollutionScore: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        overallScore: {
            type: Number,
            min: 0,
            max: 100,
            default: null
        },
        scoreDetails: {
            amenityDetails: {
                hospital: { distance: Number, found: Boolean },
                school: { distance: Number, found: Boolean },
                college: { distance: Number, found: Boolean },
                mall: { distance: Number, found: Boolean },
                pharmacy: { distance: Number, found: Boolean },
                police: { distance: Number, found: Boolean },
                busStop: { distance: Number, found: Boolean }
            },
            environmentDetails: {
                greenFeatures: Number,
                industrialFeatures: Number,
                nearestMajorRoad: Number
            },
            safetyDetails: {
                policeStations: Number,
                nearestPoliceDistance: Number,
                cctvCameras: Number,
                nightlifeSpots: Number
            },
            pollutionDetails: {
                pm25Value: Number,
                dataSource: String
            }
        },
        scoresCalculatedAt: {
            type: Date,
            default: null
        }
    },
    // Media
    images: [{
        url: String,
        filename: String,
        caption: String
    }],
    // Status and management
    status: {
        type: String,
        enum: ['active', 'under_offer', 'sold', 'rented', 'inactive'],
        default: 'active'
    },
    featured: {
        type: Boolean,
        default: false
    },
    // Relationships
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    assignedBroker: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    brokerNotes: String,
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        },
    ],
    // Analytics
    views: {
        type: Number,
        default: 0
    },
    inquiries: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        message: String,
        contactPreference: {
            type: String,
            enum: ['phone', 'email', 'whatsapp'],
            default: 'email'
        },
        status: {
            type: String,
            enum: ['new', 'contacted', 'visited', 'closed'],
            default: 'new'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    statusHistory: [{
        status: {
            type: String,
            enum: ['active', 'under_offer', 'sold', 'rented', 'inactive']
        },
        changedBy: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        changedAt: {
            type: Date,
            default: Date.now
        },
        notes: String
    }],
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

// Index for location-based queries
listingSchema.index({ location: '2dsphere' });

// Index for search queries
listingSchema.index({ 
    title: 'text', 
    description: 'text', 
    'address.city': 'text',
    'address.state': 'text'
});

// Update timestamp on save
listingSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

listingSchema.post("findOneAndDelete", async (listing) => {
    if(listing) {
        await Review.deleteMany({_id : {$in: listing.reviews}});
    }
})

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;