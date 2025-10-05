const Listing = require("../models/listing");
const Lead = require("../models/lead.js");
const ExpressError = require("../utils/ExpressError.js");
const { listingSchema } = require("../schema.js");
const propertyScoreService = require("../services/propertyScoreService.js");

module.exports.index = async (req, res) => {
    const { page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;
    
    // Get featured listings first (prioritize special owners)
    const featuredListings = await Listing.find({ featured: true, status: 'active' })
        .populate({
            path: 'owner',
            select: 'firstName lastName companyName isSpecialOwner'
        })
        .limit(6);
    
    // Get all active listings with pagination (prioritize special owners)
    const allListings = await Listing.find({ status: 'active' })
        .populate({
            path: 'owner',
            select: 'firstName lastName companyName isSpecialOwner'
        })
        .skip(skip)
        .limit(parseInt(limit));
    
    // Sort listings by priority: Special Owners first, then featured, then by date
    allListings.sort((a, b) => {
        // Check if owners are special owners
        const aIsSpecial = a.owner && a.owner.isSpecialOwner;
        const bIsSpecial = b.owner && b.owner.isSpecialOwner;
        
        // If both are special owners, sort by date
        if (aIsSpecial && bIsSpecial) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        }
        
        // If only one is special owner, prioritize them
        if (aIsSpecial && !bIsSpecial) return -1;
        if (!aIsSpecial && bIsSpecial) return 1;
        
        // If both have same special status, sort by featured then date
        if (a.featured !== b.featured) {
            return b.featured - a.featured; // Featured first
        }
        
        return new Date(b.createdAt) - new Date(a.createdAt); // Newer first
    });
    
    // Sort featured listings similarly
    featuredListings.sort((a, b) => {
        const aIsSpecial = a.owner && a.owner.isSpecialOwner;
        const bIsSpecial = b.owner && b.owner.isSpecialOwner;
        
        if (aIsSpecial && !bIsSpecial) return -1;
        if (!aIsSpecial && bIsSpecial) return 1;
        
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    const total = await Listing.countDocuments({ status: 'active' });
    const totalPages = Math.ceil(total / limit);
    
    res.render("listings/index.ejs", {
        listings: allListings,
        featuredListings,
        currentPage: parseInt(page),
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
    });
}

module.exports.searchListings = async (req, res) => {
    const { 
        q, 
        location, 
        propertyType, 
        listingType, 
        minPrice, 
        maxPrice,
        bedrooms,
        bathrooms,
        minArea,
        maxArea,
        furnishing,
        minYearBuilt,
        maxYearBuilt,
        features
    } = req.query;
    
    let searchQuery = { status: 'active' };
    
    // Text search
    if (q) {
        searchQuery.$text = { $search: q };
    }
    
    // Location filter - search in multiple address fields
    if (location) {
        searchQuery.$or = [
            { 'address.city': { $regex: location, $options: 'i' } },
            { 'address.street': { $regex: location, $options: 'i' } },
            { 'address.state': { $regex: location, $options: 'i' } },
            { 'address.pincode': { $regex: location, $options: 'i' } }
        ];
        
        console.log('🔍 Location search for:', location);
        console.log('📝 Search query:', JSON.stringify(searchQuery.$or, null, 2));
    }
    
    // Property type filter
    if (propertyType) {
        searchQuery.propertyType = propertyType;
    }
    
    // Listing type filter
    if (listingType) {
        searchQuery.listingType = listingType;
    }
    
    // Price filter
    if (minPrice || maxPrice) {
        searchQuery['price.amount'] = {};
        if (minPrice) searchQuery['price.amount'].$gte = parseInt(minPrice);
        if (maxPrice) searchQuery['price.amount'].$lte = parseInt(maxPrice);
    }
    
    // Bedrooms filter
    if (bedrooms) {
        if (bedrooms.includes('+')) {
            const minBedrooms = parseInt(bedrooms.replace('+', ''));
            searchQuery.bedrooms = { $gte: minBedrooms };
        } else {
            searchQuery.bedrooms = parseInt(bedrooms);
        }
    }
    
    // Bathrooms filter
    if (bathrooms) {
        if (bathrooms.includes('+')) {
            const minBathrooms = parseInt(bathrooms.replace('+', ''));
            searchQuery.bathrooms = { $gte: minBathrooms };
        } else {
            searchQuery.bathrooms = parseInt(bathrooms);
        }
    }
    
    // Area filter
    if (minArea || maxArea) {
        searchQuery['area.size'] = {};
        if (minArea) searchQuery['area.size'].$gte = parseInt(minArea);
        if (maxArea) searchQuery['area.size'].$lte = parseInt(maxArea);
    }
    
    // Furnishing filter
    if (furnishing) {
        searchQuery.furnishing = furnishing;
    }
    
    // Year built filter
    if (minYearBuilt || maxYearBuilt) {
        searchQuery.yearBuilt = {};
        if (minYearBuilt) searchQuery.yearBuilt.$gte = parseInt(minYearBuilt);
        if (maxYearBuilt) searchQuery.yearBuilt.$lte = parseInt(maxYearBuilt);
    }
    
    // Features filter (if implemented)
    if (features && Array.isArray(features)) {
        // This would require adding a features field to the listing model
        // searchQuery.features = { $all: features };
    }
    
    // Get listings with owner info
    console.log('🔍 Final search query:', JSON.stringify(searchQuery, null, 2));
    const listings = await Listing.find(searchQuery)
        .populate({
            path: 'owner',
            select: 'firstName lastName companyName isSpecialOwner'
        });
    
    console.log('📊 Found listings:', listings.length);
    
    // Sort listings by priority: Special Owners first, then featured, then by date
    listings.sort((a, b) => {
        // Check if owners are special owners
        const aIsSpecial = a.owner && a.owner.isSpecialOwner;
        const bIsSpecial = b.owner && b.owner.isSpecialOwner;
        
        // If both are special owners, sort by date
        if (aIsSpecial && bIsSpecial) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        }
        
        // If only one is special owner, prioritize them
        if (aIsSpecial && !bIsSpecial) return -1;
        if (!aIsSpecial && bIsSpecial) return 1;
        
        // If both have same special status, sort by featured then date
        if (a.featured !== b.featured) {
            return b.featured - a.featured; // Featured first
        }
        
        return new Date(b.createdAt) - new Date(a.createdAt); // Newer first
    });
    
    // Expose the incoming query to templates via res.locals so templates can prefill filter fields
    res.locals.query = req.query;

    // Render the main listings/index page instead of a separate 'Explore Properties' page
    // This keeps search results on the same screen (no dedicated explore/search page)
    res.render("listings/index.ejs", { 
        listings, 
        featuredListings: [],
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
    });
}

module.exports.filterListings = async (req, res) => {
    const { bedrooms, bathrooms, minArea, maxArea, furnishing, location } = req.query;
    
    let filterQuery = { status: 'active' };
    
    // Location filter - search in multiple address fields
    if (location) {
        filterQuery.$or = [
            { 'address.city': { $regex: location, $options: 'i' } },
            { 'address.street': { $regex: location, $options: 'i' } },
            { 'address.state': { $regex: location, $options: 'i' } },
            { 'address.pincode': { $regex: location, $options: 'i' } }
        ];
        
        console.log('🔍 Filter location search for:', location);
        console.log('📝 Filter query:', JSON.stringify(filterQuery.$or, null, 2));
    }
    
    if (bedrooms) filterQuery.bedrooms = { $gte: parseInt(bedrooms) };
    if (bathrooms) filterQuery.bathrooms = { $gte: parseInt(bathrooms) };
    if (minArea || maxArea) {
        filterQuery['area.size'] = {};
        if (minArea) filterQuery['area.size'].$gte = parseInt(minArea);
        if (maxArea) filterQuery['area.size'].$lte = parseInt(maxArea);
    }
    if (furnishing) filterQuery.furnishing = furnishing;
    
    const listings = await Listing.find(filterQuery)
        .populate({
            path: 'owner',
            select: 'firstName lastName companyName isSpecialOwner'
        });
    
    // Sort listings by priority: Special Owners first, then by date
    listings.sort((a, b) => {
        const aIsSpecial = a.owner && a.owner.isSpecialOwner;
        const bIsSpecial = b.owner && b.owner.isSpecialOwner;
        
        if (aIsSpecial && !bIsSpecial) return -1;
        if (!aIsSpecial && bIsSpecial) return 1;
        
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    res.render("listings/index.ejs", { 
        listings, 
        filterParams: req.query,
        featuredListings: [],
        currentPage: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
    });
}

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs");
}

module.exports.showListing = async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner")
        .populate("assignedBroker", "firstName lastName phone email");
    
    if(!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    
    // Increment view count
    listing.views += 1;
    await listing.save();
    
    res.render("listings/show.ejs", {listing});
}

module.exports.createListing = async (req, res, next) => {
    try {
        console.log('=== LISTING CREATION DEBUG ===');
        console.log('User:', req.user._id);
        console.log('Body:', req.body);
        console.log('Files:', req.files);
        
        // Validate required fields
        const { title, description, propertyType, listingType, price, address } = req.body.listing;
        
        if (!title || !description || !propertyType || !listingType || !price || !address) {
            console.error('Missing required fields');
            req.flash("error", "Please fill in all required fields: Title, Description, Property Type, Listing Type, Price, City, and State");
            return res.redirect("/listings/new");
        }
        
        // Create listing object with proper structure
        const listingData = {
            title: title.trim(),
            description: description.trim(),
            propertyType: propertyType,
            listingType: listingType,
            price: {
                amount: parseFloat(price.amount) || 0,
                currency: price.currency || 'INR',
                negotiable: price.negotiable === 'true'
            },
            address: {
                street: address.street || '',
                city: address.city || '',
                state: address.state || '',
                pincode: address.pincode || '',
                country: address.country || 'India'
            },
            status: req.body.listing.status || 'active',
            owner: req.user._id
        };
        
        // Add optional fields if provided
        if (req.body.listing.bedrooms) listingData.bedrooms = parseInt(req.body.listing.bedrooms);
        if (req.body.listing.bathrooms) listingData.bathrooms = parseInt(req.body.listing.bathrooms);
        if (req.body.listing.area && req.body.listing.area.size) {
            listingData.area = {
                size: parseInt(req.body.listing.area.size),
                unit: req.body.listing.area.unit || 'sqft'
            };
        }
        if (req.body.listing.floor) listingData.floor = parseInt(req.body.listing.floor);
        if (req.body.listing.totalFloors) listingData.totalFloors = parseInt(req.body.listing.totalFloors);
        if (req.body.listing.yearBuilt) listingData.yearBuilt = parseInt(req.body.listing.yearBuilt);
        if (req.body.listing.furnishing) listingData.furnishing = req.body.listing.furnishing;

        // Handle location coordinates and scores
        if (req.body.listing.location && req.body.listing.location.coordinates) {
            const coords = req.body.listing.location.coordinates.split(',').map(c => parseFloat(c.trim()));
            if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                listingData.location = {
                    type: 'Point',
                    coordinates: [coords[0], coords[1]] // [longitude, latitude]
                };
                
                // Calculate location scores if coordinates are provided
                try {
                    console.log('Calculating location scores for new listing...');
                    const scores = await propertyScoreService.calculateAllScores(coords[1], coords[0]);
                    listingData.locationScores = scores;
                    console.log('Location scores calculated and added to listing');
                } catch (scoreError) {
                    console.error('Error calculating location scores:', scoreError);
                    // Continue without scores rather than failing the listing creation
                }
            }
        }
        
        console.log('Processed listing data:', listingData);
        
        const newListing = new Listing(listingData);
        
        // Handle images
        console.log('=== IMAGE HANDLING DEBUG ===');
        console.log('req.files:', req.files);
        console.log('req.files length:', req.files ? req.files.length : 'undefined');
        
        if (req.files && req.files.length > 0) {
            console.log('Processing uploaded files...');
            newListing.images = req.files.map(file => {
                console.log('Processing file:', file);
                return {
                    url: file.path,
                    filename: file.filename
                };
            });
            console.log('Images added:', newListing.images);
        } else {
            console.log('No files uploaded, creating placeholder...');
            // Create a placeholder image object (you can add a default image later)
            newListing.images = [{
                url: 'https://via.placeholder.com/400x300?text=No+Image',
                filename: 'placeholder.jpg'
            }];
            console.log('Placeholder image added');
        }
        
        console.log('Final listing object before save:', newListing);
        
        // Save the listing
        const savedListing = await newListing.save();
        console.log('Listing saved successfully with ID:', savedListing._id);
        
        req.flash("success", "New Property Listing Created Successfully!");
        res.redirect("/listings");
        
    } catch (error) {
        console.error('=== LISTING CREATION ERROR ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        let errorMessage = "Failed to create listing. Please try again.";
        
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            errorMessage = `Validation errors: ${validationErrors.join(', ')}`;
        } else if (error.code === 11000) {
            errorMessage = "A listing with this title already exists. Please use a different title.";
        }
        
        req.flash("error", errorMessage);
        res.redirect("/listings/new");
    }
}

module.exports.renderEditForm = async (req, res) => {
    let {id} = req.params;
    const listing = await Listing.findById(id);
    if(!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    
    res.render("listings/edit.ejs", { listing });
}

module.exports.updateListing = async (req, res) => {
    let {id} = req.params;
    let listing = await Listing.findByIdAndUpdate(id, {...req.body.listing});

    // Handle multiple images
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => ({
            url: file.path,
            filename: file.filename
        }));
        
        if (req.body.keepImages) {
            // Keep existing images and add new ones
            listing.images = [...listing.images, ...newImages];
        } else {
            // Replace all images
            listing.images = newImages;
        }
        
        await listing.save();
    }

    req.flash("success", "Property Listing Updated Successfully!");
    res.redirect(`/listings/${id}`);
}

module.exports.destroyListing = async (req, res) => {
    let {id} = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    req.flash("success", "Property Listing Deleted Successfully!");
    res.redirect("/listings");
}

// New methods for real estate functionality
module.exports.createInquiry = async (req, res) => {
    const { id } = req.params;
    const { message, contactPreference, interest, propertyType } = req.body;
    
    // Create lead from inquiry
    const lead = new Lead({
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
        interest: interest || 'buy',
        propertyType: [propertyType || 'apartment'],
        source: 'property_inquiry',
        relatedProperty: id,
        notes: [{
            content: message || 'Property inquiry',
            broker: req.user.userType === 'broker' ? req.user._id : null,
            addedBy: req.user._id,
            userType: req.user.userType
        }],
        createdBy: req.user._id
    });
    
    await lead.save();
    
    // Update property inquiry
    await Listing.findByIdAndUpdate(id, {
        $push: {
            inquiries: {
                user: req.user._id,
                message: message || 'Property inquiry',
                contactPreference: contactPreference || 'email'
            }
        }
    });
    
    req.flash("success", "Your inquiry has been submitted successfully! A broker will contact you soon.");
    res.redirect(`/listings/${id}`);
}

module.exports.assignBroker = async (req, res) => {
    try {
        const { listingId, brokerId, notes } = req.body;
        
        if (!listingId || !brokerId) {
            return res.status(400).json({ 
                success: false, 
                message: "Listing ID and broker ID are required" 
            });
        }
        
        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ 
                success: false, 
                message: "Listing not found" 
            });
        }
        
        // Check if user can manage this listing
        if (listing.owner.toString() !== req.user._id.toString() && 
            req.user.userType !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: "You don't have permission to assign brokers to this listing" 
            });
        }
        
        // Update listing with broker assignment
        listing.assignedBroker = brokerId;
        if (notes) {
            listing.brokerNotes = notes;
        }
        
        await listing.save();
        
        res.json({ 
            success: true, 
            message: "Broker assigned successfully" 
        });
    } catch (error) {
        console.error('Error assigning broker:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error assigning broker" 
        });
    }
}

module.exports.updateStatus = async (req, res) => {
    try {
        const { listingId, status, notes } = req.body;
        
        if (!listingId || !status) {
            return res.status(400).json({ 
                success: false, 
                message: "Listing ID and status are required" 
            });
        }
        
        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ 
                success: false, 
                message: "Listing not found" 
            });
        }
        
        // Check if user can manage this listing
        if (listing.owner.toString() !== req.user._id.toString() && 
            req.user.userType !== 'admin' && 
            listing.assignedBroker?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "You don't have permission to update this listing" 
            });
        }
        
        // Update listing status
        listing.status = status;
        if (notes) {
            if (!listing.statusHistory) {
                listing.statusHistory = [];
            }
            listing.statusHistory.push({
                status: status,
                changedBy: req.user._id,
                changedAt: new Date(),
                notes: notes
            });
        }
        
        await listing.save();
        
        res.json({ 
            success: true, 
            message: "Status updated successfully" 
        });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error updating status" 
        });
    }
}

module.exports.showAnalytics = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
        .populate('inquiries.user', 'firstName lastName email phone');
    
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }
    
    // Calculate analytics
    const totalViews = listing.views;
    const totalInquiries = listing.inquiries.length;
    const recentInquiries = listing.inquiries
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
    
    res.render("listings/analytics.ejs", { 
        listing, 
        totalViews, 
        totalInquiries, 
        recentInquiries 
    });
}

module.exports.showDashboard = async (req, res) => {
    try {
        const User = require("../models/user.js"); // Re-require User model
        let listingsQuery = {};
        
        // Filter listings based on user type
        if (req.user.userType === 'admin') {
            // Admin can see all listings
        } else if (req.user.userType === 'broker') {
            // Broker can see assigned listings
            listingsQuery.assignedBroker = req.user._id;
        } else if (req.user.userType === 'property_owner') {
            // Property owner can see their own listings
            listingsQuery.owner = req.user._id;
        }

        const listings = await Listing.find(listingsQuery)
            .populate('owner', 'firstName lastName companyName')
            .populate('assignedBroker', 'firstName lastName email')
            .populate('inquiries.user', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        // Calculate statistics
        const totalListings = listings.length;
        const activeListings = listings.filter(l => l.status === 'active').length;
        const totalViews = listings.reduce((sum, l) => sum + (l.views || 0), 0);
        const totalInquiries = listings.reduce((sum, l) => sum + (l.inquiries?.length || 0), 0);

        // Get recent inquiries from all listings
        let allInquiries = [];
        listings.forEach(listing => {
            if (listing.inquiries && listing.inquiries.length > 0) {
                listing.inquiries.forEach(inquiry => {
                    allInquiries.push({
                        ...inquiry.toObject(),
                        listing: {
                            _id: listing._id,
                            title: listing.title,
                            address: listing.address
                        }
                    });
                });
            }
        });

        // Sort by inquiry date (most recent first)
        allInquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        // Count new inquiries (status === 'new') for the stats card
        const newInquiries = allInquiries.filter(i => i.status === 'new').length;

        // Provide safe defaults for broker-specific sections (so template won't crash if missing)
        const recentLeads = [];
        const recentTasks = [];
        const recentMessages = [];

        res.render("listings/dashboard.ejs", {
            listings,
            totalListings,
            activeListings,
            totalViews,
            totalInquiries,
            newInquiries,
            recentInquiries: allInquiries,
            recentLeads,
            recentTasks,
            recentMessages,
            currUser: req.user
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        req.flash("error", "Error loading dashboard");
        res.redirect("/listings");
    }
};

module.exports.showBrokerDashboard = async (req, res) => {
    try {
        const Task = require("../models/task.js");
        const userId = req.user._id;
        
        // Get lead statistics
        const totalLeads = await Lead.countDocuments({ assignedBroker: userId });
        const newLeads = await Lead.countDocuments({ 
            assignedBroker: userId, 
            status: 'new' 
        });
        const activeLeads = await Lead.countDocuments({ 
            assignedBroker: userId, 
            status: { $in: ['contacted', 'qualified', 'proposal_sent', 'negotiation'] } 
        });
        const closedLeads = await Lead.countDocuments({ 
            assignedBroker: userId, 
            status: 'closed' 
        });
        
        // Get task statistics
        const totalTasks = await Task.countDocuments({ assignedBroker: userId });
        const pendingTasks = await Task.countDocuments({ 
            assignedBroker: userId, 
            status: 'pending' 
        });
        const overdueTasks = await Task.countDocuments({ 
            assignedBroker: userId, 
            status: 'pending',
            dueDate: { $lt: new Date() }
        });
        
        // Calculate conversion rate
        const conversionRate = totalLeads > 0 ? ((closedLeads / totalLeads) * 100).toFixed(1) : 0;
        
        // Get recent leads
        const recentLeads = await Lead.find({ assignedBroker: userId })
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('relatedProperty', 'title address');
        
        // Get recent tasks
        const recentTasks = await Task.find({ assignedBroker: userId })
            .sort({ dueDate: 1 })
            .limit(5)
            .populate('relatedLead', 'firstName lastName')
            .populate('relatedProperty', 'title');
        
        // Get recent messages (placeholder for now)
        const recentMessages = [];
        
        // Build a stats object expected by the template
        const stats = {
            totalBuyers: totalLeads || 0,
            assignedBuyers: newLeads || 0, // approximate mapping
            pendingAssignments: activeLeads || 0,
            totalFavorites: 0 // will be calculated below if needed
        };

        // Buyers list - derive from recent leads' related user info where possible
        // For now, provide a lightweight buyers list so template can render
        const buyers = recentLeads.map(lead => ({
            _id: lead._id,
            firstName: lead.firstName || 'Buyer',
            lastName: lead.lastName || '',
            email: lead.email || '',
            phone: lead.phone || '',
            propertyPreferences: lead.propertyPreferences || {},
            assignedBroker: lead.assignedBroker || null,
            favorites: []
        }));

        // Provide available brokers for assignment actions
        const User = require('../models/user');
        const brokers = await User.find({ userType: 'broker' })
            .select('firstName lastName specialization agency')
            .sort({ firstName: 1 });

        res.render("listings/broker-dashboard.ejs", {
            stats,
            buyers,
            brokers,
            totalLeads,
            newLeads,
            activeLeads,
            closedLeads,
            totalTasks,
            pendingTasks,
            overdueTasks,
            conversionRate,
            recentLeads,
            recentTasks,
            recentMessages,
            currUser: req.user
        });
    } catch (error) {
        console.error('Error loading broker dashboard:', error);
        req.flash("error", "Error loading broker dashboard");
        res.redirect("/listings");
    }
};

module.exports.updateInquiryStatus = async (req, res) => {
    try {
        const { listingId, userId, status } = req.body;
        
        if (!listingId || !userId || !status) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required fields" 
            });
        }

        // Validate status
        const validStatuses = ['new', 'contacted', 'visited', 'closed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid status" 
            });
        }

        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ 
                success: false, 
                message: "Listing not found" 
            });
        }

        // Check if user can manage this listing
        if (req.user.userType === 'property_owner' && listing.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "Not authorized to manage this listing" 
            });
        }

        if (req.user.userType === 'broker' && listing.assignedBroker?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: "Not authorized to manage this listing" 
            });
        }

        // Find and update the inquiry
        const inquiry = listing.inquiries.find(i => i.user.toString() === userId);
        if (!inquiry) {
            return res.status(404).json({ 
                success: false, 
                message: "Inquiry not found" 
            });
        }

        inquiry.status = status;
        inquiry.updatedAt = new Date();
        
        await listing.save();

        res.json({ 
            success: true, 
            message: "Inquiry status updated successfully" 
        });

    } catch (error) {
        console.error('Error updating inquiry status:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error updating inquiry status" 
        });
    }
};

module.exports.getBrokers = async (req, res) => {
    try {
        const User = require("../models/user.js");
        
        // Get all users with broker role
        const brokers = await User.find({ userType: 'broker' })
            .select('firstName lastName email phone companyName')
            .sort({ firstName: 1, lastName: 1 });
        
        res.json({ 
            success: true, 
            brokers: brokers 
        });
    } catch (error) {
        console.error('Error fetching brokers:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error fetching brokers" 
        });
    }
}

// Calculate property location scores
module.exports.calculateLocationScores = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required"
            });
        }

        // Validate coordinates
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({
                success: false,
                message: "Invalid coordinates provided"
            });
        }

        console.log(`Calculating location scores for: ${lat}, ${lng}`);
        
        const scores = await propertyScoreService.calculateAllScores(lat, lng);
        
        res.json({
            success: true,
            scores: scores
        });
        
    } catch (error) {
        console.error('Error calculating location scores:', error);
        res.status(500).json({
            success: false,
            message: "Error calculating location scores. Please try again."
        });
    }
}