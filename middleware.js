const Listing = require("./models/listing");
const Review = require("./models/review");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to access this feature!");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isPropertyOwner = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to access this feature!");
        return res.redirect("/login");
    }
    if (req.user.userType !== 'property_owner') {
        req.flash("error", "Access denied. Property owners only.");
        return res.redirect("/listings");
    }
    next();
};

module.exports.isBroker = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to access this feature!");
        return res.redirect("/login");
    }
    if (req.user.userType !== 'broker') {
        req.flash("error", "Access denied. Brokers only.");
        return res.redirect("/listings");
    }
    next();
};

module.exports.isBuyer = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to access this feature!");
        return res.redirect("/login");
    }
    if (req.user.userType !== 'buyer') {
        req.flash("error", "Access denied. Buyers/renters only.");
        return res.redirect("/listings");
    }
    next();
};

module.exports.canManageListing = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to access this feature!");
        return res.redirect("/login");
    }
    
    const { id } = req.params;
    const listing = await Listing.findById(id);
    
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }
    
    // Normalize ids to strings to be robust whether fields are populated or not
    const ownerId = listing.owner && listing.owner._id ? listing.owner._id.toString() : (listing.owner ? listing.owner.toString() : null);
    const assignedBrokerId = listing.assignedBroker && listing.assignedBroker._id ? listing.assignedBroker._id.toString() : (listing.assignedBroker ? listing.assignedBroker.toString() : null);

    // Allow management when the current user is the owner (id match) regardless of stored userType
    if (ownerId === req.user._id.toString()) {
        return next();
    }

    // Allow management when the current user is the assigned broker (id match)
    if (assignedBrokerId && assignedBrokerId === req.user._id.toString()) {
        return next();
    }

    // Debug output to help diagnose permission issues
    console.warn(`canManageListing: permission denied for user=${req.user._id} (type=${req.user.userType}), listing=${id}, owner=${ownerId}, assignedBroker=${assignedBrokerId}`);

    req.flash("error", "You don't have permission to manage this listing!");
    return res.redirect(`/listings/${id}`);
};

module.exports.validateListing = (req, res, next) => {
    console.log('=== VALIDATION DEBUG ===');
    console.log('Request body:', req.body);
    
    let { error } = listingSchema.validate(req.body);
    if (error) {
        console.log('Validation errors:', error.details);
        let errMsg = error.details.map((el) => el.message).join(",");
        console.log('Error message:', errMsg);
        throw new ExpressError(400, errMsg);
    } else {
        console.log('Validation passed');
        next();
    }
};

module.exports.validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
        let errMsg = error.details.map((el) => el.message).join(",");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};

module.exports.isReviewAuthor = async (req, res, next) => {
    let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if (!review.author.equals(req.user._id)) {
        req.flash("error", "You are not the author of this review");
        return res.redirect(`/listings/${id}`);
    }
    next();
};

