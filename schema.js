const Joi = require('joi');

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required().min(3).max(100),
        description: Joi.string().required().min(10).max(1000),
        propertyType: Joi.string().valid('apartment', 'house', 'villa', 'commercial', 'land', 'office', 'shop').required(),
        listingType: Joi.string().valid('sale', 'rent').required(),
        price: Joi.object({
            amount: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
            currency: Joi.string().default('INR'),
            negotiable: Joi.alternatives().try(Joi.boolean(), Joi.string()).default(false)
        }).required(),
        bedrooms: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        bathrooms: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        area: Joi.object({
            size: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
            unit: Joi.string().valid('sqft', 'sqm', 'acres').default('sqft')
        }).optional(),
        floor: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        totalFloors: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        yearBuilt: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
        furnishing: Joi.string().valid('unfurnished', 'semi-furnished', 'fully-furnished').default('unfurnished'),
        address: Joi.object({
            street: Joi.string().optional(),
            city: Joi.string().required(),
            state: Joi.string().required(),
            pincode: Joi.string().optional(),
            country: Joi.string().default('India')
        }).required(),
        location: Joi.object({
            coordinates: Joi.string().allow('').optional()
        }).optional(),
        status: Joi.string().valid('active', 'under_offer', 'sold', 'rented', 'inactive').default('active'),
        featured: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).default(false),
        images: Joi.array().items(Joi.string()).optional()
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required().min(3).max(500),
    }).required(),
});

module.exports.userSchema = Joi.object({
    user: Joi.object({
        username: Joi.string().required().min(3).max(30),
        email: Joi.string().email().required(),
        firstName: Joi.string().required().min(2).max(50),
        lastName: Joi.string().required().min(2).max(50),
        phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).min(10).max(15),
        userType: Joi.string().valid('buyer', 'property_owner', 'broker').required(),
        companyName: Joi.string().when('userType', {
            is: 'property_owner',
            then: Joi.string().min(2).max(100),
            otherwise: Joi.string().optional()
        }),
        licenseNumber: Joi.string().when('userType', {
            is: 'property_owner',
            then: Joi.string().min(5).max(50),
            otherwise: Joi.string().optional()
        }),
        brokerLicense: Joi.string().when('userType', {
            is: 'broker',
            then: Joi.string().min(5).max(50),
            otherwise: Joi.string().optional()
        }),
        agency: Joi.string().when('userType', {
            is: 'broker',
            then: Joi.string().min(2).max(100),
            otherwise: Joi.string().optional()
        }),
        specialization: Joi.array().items(Joi.string().trim()).when('userType', {
            is: 'broker',
            then: Joi.array().min(1),
            otherwise: Joi.array().optional()
        })
    }).required(),
});

module.exports.leadSchema = Joi.object({
    lead: Joi.object({
        name: Joi.string().required().min(2).max(100),
        email: Joi.string().email().required(),
        phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).min(10).max(15).required(),
        message: Joi.string().required().min(10).max(500),
        propertyInterest: Joi.string().valid('apartment', 'house', 'villa', 'commercial', 'land'),
        budget: Joi.number().min(0),
        timeline: Joi.string().valid('immediate', '1-3_months', '3-6_months', '6+_months'),
        source: Joi.string().valid('website', 'referral', 'social_media', 'other')
    }).required(),
});