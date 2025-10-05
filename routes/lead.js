const express = require("express");
const router = express.Router();
const Lead = require("../models/lead.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isBroker, isPropertyOwner } = require("../middleware.js");
const wrapAsync = require("../utils/wrapAsync.js");

// New lead form
router.get("/new", isLoggedIn, wrapAsync(async (req, res) => {
    if (req.user.userType === 'broker') {
        res.render("leads/new");
    } else if (req.user.userType === 'property_owner') {
        // Get list of buyers for property owners to select from
        const User = require("../models/user.js");
        const buyers = await User.find({ userType: 'buyer' })
            .select('firstName lastName email phone createdAt')
            .sort({ createdAt: -1 });

        // Also fetch available brokers to allow owner to assign a broker when creating a lead
        const brokers = await User.find({ userType: 'broker' })
            .select('firstName lastName email')
            .sort({ firstName: 1, lastName: 1 });

        res.render("leads/new-owner", { buyers, brokers });
    } else {
        req.flash("error", "Access denied. Only brokers and property owners can add leads.");
        res.redirect("/leads");
    }
}));

// Index - Show all leads (brokers and property owners)
router.get("/", isLoggedIn, wrapAsync(async (req, res) => {
    console.log('Lead index route accessed by user:', req.user.userType, req.user._id);
    
    const { status, priority, assignedBroker } = req.query;
    let filter = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedBroker) filter.assignedBroker = assignedBroker;
    
    let leads;
    
    if (req.user.userType === 'broker') {
        console.log('Broker accessing leads');
        // Brokers see their assigned leads
        filter.assignedBroker = req.user._id;
        leads = await Lead.find(filter)
            .populate('assignedBroker', 'firstName lastName')
            .populate('relatedProperty', 'title address')
            .sort({ createdAt: -1 });
    } else if (req.user.userType === 'property_owner') {
        console.log('Property owner accessing leads');
        // Property owners should see leads for their properties OR leads they created (notes.addedBy)
        const userListings = await Listing.find({ owner: req.user._id });
        const listingIds = userListings.map(listing => listing._id);
        console.log('Property owner has listings:', listingIds);

        // Build a query that matches leads related to owner's listings OR leads where owner added the note
    const ownerRelatedQuery = { relatedProperty: { $in: listingIds } };
    const ownerCreatedQuery = { createdBy: req.user._id };

        leads = await Lead.find({
            $and: [ { ...filter }, { $or: [ownerRelatedQuery, ownerCreatedQuery] } ]
        })
        .populate('assignedBroker', 'firstName lastName')
        .populate('relatedProperty', 'title address')
        .sort({ createdAt: -1 });
    } else {
        console.log('Buyer accessing leads');
        // Buyers see their own leads
        filter.email = req.user.email;
        leads = await Lead.find(filter)
            .populate('assignedBroker', 'firstName lastName')
            .populate('relatedProperty', 'title address')
            .sort({ createdAt: -1 });
    }
    
    console.log('Found leads:', leads.length);
    res.render("leads/index", { leads, userType: req.user.userType, query: req.query });
}));

// Show lead details
router.get("/:id", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const lead = await Lead.findById(id)
        .populate('assignedBroker', 'firstName lastName email phone')
        .populate('relatedProperty', 'title address images')
        .populate('notes.broker', 'firstName lastName')
        .populate('tasks.broker', 'firstName lastName');
    
    if (!lead) {
        req.flash("error", "Lead not found!");
        return res.redirect("/leads");
    }
    
    // Check if user has access to this lead
    let hasAccess = false;
    
    if (req.user.userType === 'broker') {
        // Brokers can see their assigned leads
        hasAccess = lead.assignedBroker && lead.assignedBroker._id.toString() === req.user._id.toString();
    } else if (req.user.userType === 'property_owner') {
        // Property owners can see leads for their properties
        // Also allow property owners to view leads they created/added (notes.addedBy)
        const ownerMatch = lead.relatedProperty && lead.relatedProperty.owner && lead.relatedProperty.owner.toString() === req.user._id.toString();
        const createdByMatch = lead.notes && lead.notes.some(n => n.addedBy && n.addedBy.toString() === req.user._id.toString());
        hasAccess = ownerMatch || createdByMatch;
    } else {
        // Buyers can see their own leads
        hasAccess = lead.email === req.user.email;
    }
    
    if (!hasAccess) {
        req.flash("error", "Access denied. You can only view leads you have access to.");
        return res.redirect("/leads");
    }
    
    res.render("leads/show", { lead, userType: req.user.userType });
}));

// Create new lead (manual entry)
router.post("/", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        console.log('Creating new lead with data:', req.body);
        
        // Check if user is authorized to create leads
        if (req.user.userType !== 'broker' && req.user.userType !== 'property_owner') {
            req.flash("error", "Access denied. Only brokers and property owners can create leads.");
            return res.redirect("/leads");
        }
        
        // Check if this is a manual lead creation or property inquiry
        if (req.body.propertyId) {
            // This is a property inquiry - handle with existing logic
            const { propertyId, message, contactPreference } = req.body;
            
            // Create lead from inquiry
            const lead = new Lead({
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
                phone: req.user.phone,
                interest: req.body.interest || 'buy',
                propertyType: [req.body.propertyType || 'apartment'],
                source: 'property_inquiry',
                relatedProperty: propertyId,
                notes: [{
                    content: message || 'Property inquiry',
                    broker: null
                }]
            });
            
            await lead.save();
            
            // Update property inquiry
            if (propertyId) {
                await Listing.findByIdAndUpdate(propertyId, {
                    $push: {
                        inquiries: {
                            user: req.user._id,
                            message: message || 'Property inquiry',
                            contactPreference: contactPreference || 'email'
                        }
                    }
                });
            }
            
            req.flash("success", "Your inquiry has been submitted successfully!");
            return res.redirect(`/listings/${propertyId}`);
        } else {
            // This is a manual lead creation
            const {
                firstName,
                lastName,
                email,
                phone,
                interest,
                propertyType,
                budget,
                budgetMin,
                budgetMax,
                preferredLocation,
                priority,
                status,
                notes,
                source,
                timeline,
                buyerId
            } = req.body;

            // Handle property owner creating lead from buyer
            let buyerData = {};
            if (buyerId && req.user.userType === 'property_owner') {
                const User = require("../models/user.js");
                const buyer = await User.findById(buyerId);
                if (!buyer) {
                    req.flash("error", "Buyer not found.");
                    return res.redirect("/leads/new");
                }
                buyerData = {
                    firstName: buyer.firstName,
                    lastName: buyer.lastName,
                    email: buyer.email,
                    phone: buyer.phone
                };
            }

            // Use buyer data if available, otherwise use form data
            const finalFirstName = buyerData.firstName || firstName;
            const finalLastName = buyerData.lastName || lastName;
            const finalEmail = buyerData.email || email;
            const finalPhone = buyerData.phone || phone;

            // Validate required fields
            if (!finalFirstName || !finalLastName || !finalEmail) {
                req.flash("error", "First name, last name, and email are required.");
                return res.redirect("/leads/new");
            }

            // Convert budget range to min/max values
            let budgetMinValue = budgetMin ? parseInt(budgetMin) : null;
            let budgetMaxValue = budgetMax ? parseInt(budgetMax) : null;
            
            if (budget && !budgetMinValue && !budgetMaxValue) {
                // Convert budget range to min/max
                switch (budget) {
                    case 'under_100k':
                        budgetMinValue = null;
                        budgetMaxValue = 100000;
                        break;
                    case '100k_200k':
                        budgetMinValue = 100000;
                        budgetMaxValue = 200000;
                        break;
                    case '200k_300k':
                        budgetMinValue = 200000;
                        budgetMaxValue = 300000;
                        break;
                    case '300k_500k':
                        budgetMinValue = 300000;
                        budgetMaxValue = 500000;
                        break;
                    case '500k_750k':
                        budgetMinValue = 500000;
                        budgetMaxValue = 750000;
                        break;
                    case '750k_1m':
                        budgetMinValue = 750000;
                        budgetMaxValue = 1000000;
                        break;
                    case 'over_1m':
                        budgetMinValue = 1000000;
                        budgetMaxValue = null;
                        break;
                }
            }

            // Create new lead
            const assignedBrokerId = req.body.assignedBroker || (req.user.userType === 'broker' ? req.user._id : null);

            // Validate assignedBroker if provided
            if (assignedBrokerId) {
                const User = require("../models/user.js");
                const brokerExists = await User.exists({ _id: assignedBrokerId, userType: 'broker' });
                if (!brokerExists) {
                    req.flash("error", "Selected broker not found.");
                    return res.redirect("/leads/new");
                }
            }

            // Always include an initial note so the creator (owner) is recorded and can see the lead
            const initialNote = {
                content: notes && notes.trim().length > 0 ? notes : `Lead created by ${req.user.firstName} ${req.user.lastName}`,
                broker: req.user.userType === 'broker' ? req.user._id : null,
                addedBy: req.user._id,
                userType: req.user.userType
            };

            const lead = new Lead({
                firstName: finalFirstName.trim(),
                lastName: finalLastName.trim(),
                email: finalEmail.trim(),
                phone: finalPhone || null,
                interest: interest || 'buy',
                propertyType: Array.isArray(propertyType) ? propertyType : [propertyType || 'apartment'],
                budget: {
                    min: budgetMinValue,
                    max: budgetMaxValue,
                    currency: 'INR'
                },
                location: preferredLocation || null,
                timeline: timeline || 'flexible',
                priority: priority || 'medium',
                status: status || 'new',
                source: source || 'manual_entry',
                assignedBroker: assignedBrokerId, // Assign to broker if provided, or to current broker user
                notes: [ initialNote ],
                createdBy: req.user._id
            });

            await lead.save();
            console.log('Lead created successfully:', lead._id);

            req.flash("success", "New lead created successfully!");
            res.redirect(`/leads/${lead._id}`);
        }
    } catch (error) {
        console.error('Error creating lead:', error);
        req.flash("error", "Error creating lead. Please try again.");
        res.redirect("/leads/new");
    }
}));

// Create new lead from property inquiry (legacy route)
router.post("/inquiry", isLoggedIn, wrapAsync(async (req, res) => {
    const { propertyId, message, contactPreference } = req.body;
    
    // Create lead from inquiry
    const lead = new Lead({
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
        interest: req.body.interest || 'buy',
        propertyType: [req.body.propertyType || 'apartment'],
        source: 'property_inquiry',
        relatedProperty: propertyId,
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
    if (propertyId) {
        await Listing.findByIdAndUpdate(propertyId, {
            $push: {
                inquiries: {
                    user: req.user._id,
                    message: message || 'Property inquiry',
                    contactPreference: contactPreference || 'email'
                }
            }
        });
    }
    
    req.flash("success", "Your inquiry has been submitted successfully!");
    res.redirect(`/listings/${propertyId}`);
}));

// Update lead status
router.patch("/:id/status", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { status, priority, assignedBroker } = req.body;
    
    // Check if user has access to update this lead
    const lead = await Lead.findById(id).populate('relatedProperty', 'owner');
    if (!lead) {
        // respond appropriately for AJAX or normal requests
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }
        req.flash("error", "Lead not found!");
        return res.redirect("/leads");
    }
    
    let hasAccess = false;
    
    if (req.user.userType === 'broker') {
        // Brokers can update their assigned leads
        hasAccess = lead.assignedBroker && lead.assignedBroker.toString() === req.user._id.toString();
    } else if (req.user.userType === 'property_owner') {
        // Property owners can update leads for their properties
        // Also allow owners who created the lead to update it
        const ownerMatch = lead.relatedProperty && lead.relatedProperty.owner && lead.relatedProperty.owner.toString() === req.user._id.toString();
        const createdByMatch = lead.createdBy && lead.createdBy.toString() === req.user._id.toString();
        hasAccess = ownerMatch || createdByMatch;
    }
    
    if (!hasAccess) {
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        req.flash("error", "Access denied. You can only update leads you have access to.");
        return res.redirect("/leads");
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedBroker) updateData.assignedBroker = assignedBroker;
    
    await Lead.findByIdAndUpdate(id, updateData);
    
    // Respond with JSON for AJAX; otherwise flash & redirect
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1)) {
        return res.json({ success: true });
    }
    req.flash("success", "Lead updated successfully!");
    res.redirect(`/leads/${id}`);
}));

// Add note to lead
router.post("/:id/notes", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    
    // Check if user has access to add notes to this lead
    const lead = await Lead.findById(id).populate('relatedProperty', 'owner');
    if (!lead) {
        req.flash("error", "Lead not found!");
        return res.redirect("/leads");
    }
    
    let hasAccess = false;
    
    if (req.user.userType === 'broker') {
        // Brokers can add notes to their assigned leads
        hasAccess = lead.assignedBroker && lead.assignedBroker.toString() === req.user._id.toString();
    } else if (req.user.userType === 'property_owner') {
        // Property owners can add notes to leads for their properties
        hasAccess = lead.relatedProperty && lead.relatedProperty.owner.toString() === req.user._id.toString();
    }
    
    if (!hasAccess) {
        req.flash("error", "Access denied. You can only add notes to leads you have access to.");
        return res.redirect("/leads");
    }
    
    await Lead.findByIdAndUpdate(id, {
        $push: {
            notes: {
                content,
                broker: req.user.userType === 'broker' ? req.user._id : null,
                addedBy: req.user._id,
                userType: req.user.userType
            }
        },
        lastContacted: new Date()
    });
    
    req.flash("success", "Note added successfully!");
    res.redirect(`/leads/${id}`);
}));

// Add task to lead
router.post("/:id/tasks", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { title, description, dueDate } = req.body;
    
    // Check if user has access to add tasks to this lead
    const lead = await Lead.findById(id).populate('relatedProperty', 'owner');
    if (!lead) {
        req.flash("error", "Lead not found!");
        return res.redirect("/leads");
    }
    
    let hasAccess = false;
    
    if (req.user.userType === 'broker') {
        // Brokers can add tasks to their assigned leads
        hasAccess = lead.assignedBroker && lead.assignedBroker.toString() === req.user._id.toString();
    } else if (req.user.userType === 'property_owner') {
        // Property owners can add tasks to leads for their properties
        hasAccess = lead.relatedProperty && lead.relatedProperty.owner.toString() === req.user._id.toString();
    }
    
    if (!hasAccess) {
        req.flash("error", "Access denied. You can only add tasks to leads you have access to.");
        return res.redirect("/leads");
    }
    
    await Lead.findByIdAndUpdate(id, {
        $push: {
            tasks: {
                title,
                description,
                dueDate,
                broker: req.user.userType === 'broker' ? req.user._id : null,
                addedBy: req.user._id,
                userType: req.user.userType
            }
        }
    });
    
    req.flash("success", "Task added successfully!");
    res.redirect(`/leads/${id}`);
}));

// Complete task
router.patch("/:id/tasks/:taskId", isLoggedIn, wrapAsync(async (req, res) => {
    const { id, taskId } = req.params;
    
    // Check if user has access to complete tasks for this lead
    const lead = await Lead.findById(id).populate('relatedProperty', 'owner');
    if (!lead) {
        req.flash("error", "Lead not found!");
        return res.redirect("/leads");
    }
    
    let hasAccess = false;
    
    if (req.user.userType === 'broker') {
        // Brokers can complete tasks for their assigned leads
        hasAccess = lead.assignedBroker && lead.assignedBroker.toString() === req.user._id.toString();
    } else if (req.user.userType === 'property_owner') {
        // Property owners can complete tasks for leads on their properties
        hasAccess = lead.relatedProperty && lead.relatedProperty.owner.toString() === req.user._id.toString();
    }
    
    if (!hasAccess) {
        req.flash("error", "Access denied. You can only complete tasks for leads you have access to.");
        return res.redirect("/leads");
    }
    
    await Lead.updateOne(
        { _id: id, "tasks._id": taskId },
        { $set: { "tasks.$.completed": true } }
    );
    
    req.flash("success", "Task completed!");
    res.redirect(`/leads/${id}`);
}));

// Dashboard for brokers and property owners
router.get("/dashboard", isLoggedIn, wrapAsync(async (req, res) => {
    let totalLeads, newLeads, activeLeads, recentLeads, upcomingTasks;
    
    if (req.user.userType === 'broker') {
        // Broker dashboard
        const userId = req.user._id;
        
        // Get lead statistics
        totalLeads = await Lead.countDocuments({ assignedBroker: userId });
        newLeads = await Lead.countDocuments({ 
            assignedBroker: userId, 
            status: 'new' 
        });
        activeLeads = await Lead.countDocuments({ 
            assignedBroker: userId, 
            status: { $in: ['contacted', 'qualified', 'proposal_sent', 'negotiation'] } 
        });
        
        // Get recent leads
        recentLeads = await Lead.find({ assignedBroker: userId })
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('relatedProperty', 'title address');
        
        // Get upcoming tasks
        upcomingTasks = await Lead.aggregate([
            { $match: { assignedBroker: userId } },
            { $unwind: '$tasks' },
            { $match: { 
                'tasks.completed': false,
                'tasks.dueDate': { $gte: new Date() }
            }},
            { $sort: { 'tasks.dueDate': 1 } },
            { $limit: 10 }
        ]);
        
    } else if (req.user.userType === 'property_owner') {
        // Property owner dashboard
        const userListings = await Listing.find({ owner: req.user._id });
        const listingIds = userListings.map(listing => listing._id);
        
        // Get lead statistics
        totalLeads = await Lead.countDocuments({ relatedProperty: { $in: listingIds } });
        newLeads = await Lead.countDocuments({ 
            relatedProperty: { $in: listingIds }, 
            status: 'new' 
        });
        activeLeads = await Lead.countDocuments({ 
            relatedProperty: { $in: listingIds }, 
            status: { $in: ['contacted', 'qualified', 'proposal_sent', 'negotiation'] } 
        });
        
        // Get recent leads
        recentLeads = await Lead.find({ relatedProperty: { $in: listingIds } })
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate('relatedProperty', 'title address')
            .populate('assignedBroker', 'firstName lastName');
        
        // Get upcoming tasks
        upcomingTasks = await Lead.aggregate([
            { $match: { relatedProperty: { $in: listingIds } } },
            { $unwind: '$tasks' },
            { $match: { 
                'tasks.completed': false,
                'tasks.dueDate': { $gte: new Date() }
            }},
            { $sort: { 'tasks.dueDate': 1 } },
            { $limit: 10 }
        ]);
        
    } else {
        // Buyer dashboard (if needed)
        req.flash("error", "Dashboard not available for buyers");
        return res.redirect("/leads");
    }
    
    res.render("leads/dashboard", { 
        totalLeads, 
        newLeads, 
        activeLeads, 
        recentLeads, 
        upcomingTasks,
        userType: req.user.userType
    });
}));

// Bulk create leads from buyers (Property Owners only)
router.post("/bulk", isLoggedIn, isPropertyOwner, wrapAsync(async (req, res) => {
    try {
        const { buyerIds } = req.body;
        const User = require("../models/user.js");
        
        if (!buyerIds || !Array.isArray(buyerIds)) {
            req.flash("error", "No buyers selected.");
            return res.redirect("/leads/new");
        }

        const buyers = await User.find({ _id: { $in: buyerIds }, userType: 'buyer' });
        
        if (buyers.length === 0) {
            req.flash("error", "No valid buyers found.");
            return res.redirect("/leads/new");
        }

        // Create leads for each buyer with default values
        const leads = [];
        for (const buyer of buyers) {
            const lead = new Lead({
                firstName: buyer.firstName,
                lastName: buyer.lastName,
                email: buyer.email,
                phone: buyer.phone || null,
                interest: 'buy',
                propertyType: ['apartment'],
                budget: {
                    min: null,
                    max: null,
                    currency: 'INR'
                },
                location: null,
                timeline: 'flexible',
                priority: 'medium',
                status: 'new',
                source: 'manual_entry',
                assignedBroker: req.user._id, // Property owner as broker for their own leads
                notes: [{
                    content: `Lead created from buyer registration by ${req.user.firstName} ${req.user.lastName}`,
                    broker: req.user._id,
                    addedBy: req.user._id,
                    userType: req.user.userType
                }]
            });
            leads.push(lead);
        }

        await Lead.insertMany(leads);
        
        req.flash("success", `Successfully created ${leads.length} leads from buyers.`);
        res.redirect("/leads");
        
    } catch (error) {
        console.error('Error creating bulk leads:', error);
        req.flash("error", "Error creating leads. Please try again.");
        res.redirect("/leads/new");
    }
}));

module.exports = router;
