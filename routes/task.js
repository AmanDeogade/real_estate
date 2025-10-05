const express = require("express");
const router = express.Router();
const Task = require("../models/task.js");
const mongoose = require("mongoose");
const Lead = require("../models/lead.js");
const { isLoggedIn, isBroker } = require("../middleware.js");
const wrapAsync = require("../utils/wrapAsync.js");

// Index - Show all tasks (brokers only)
router.get("/", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const { status, priority, type, assignedBroker } = req.query;
    let filter = {};
    
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (type) filter.type = type;
    if (assignedBroker) filter.assignedBroker = assignedBroker;
    
    // If not admin, only show assigned tasks
    if (req.user.userType === 'broker') {
        filter.assignedBroker = req.user._id;
    }
    
    const tasks = await Task.find(filter)
        .populate('assignedBroker', 'firstName lastName')
        .populate('relatedLead', 'firstName lastName email')
        .populate('relatedProperty', 'title address')
        .sort({ dueDate: 1 });
    
    res.render("tasks/index", { tasks });
}));

// New task form
router.get("/new", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    // Get leads for dropdown
    const leads = await Lead.find({ assignedBroker: req.user._id })
        .select('firstName lastName email');

    // Allow prefill via query params (e.g. ?leadId=...&type=property_viewing&dueDate=YYYY-MM-DD)
    const prefill = {};
    if (req.query.leadId && mongoose.Types.ObjectId.isValid(req.query.leadId)) {
        prefill.relatedLead = req.query.leadId;
    }
    if (req.query.type) {
        prefill.type = req.query.type;
    }
    if (req.query.dueDate) {
        // Basic validation of date string (YYYY-MM-DD)
        const d = new Date(req.query.dueDate);
        if (!isNaN(d.getTime())) {
            // normalize to YYYY-MM-DD
            prefill.dueDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().split('T')[0];
        }
    }

    res.render("tasks/new", { leads, prefill });
}));

// Create new task
router.post("/", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    try {
        // Basic required validation
        const { title, dueDate } = req.body;
        if (!title || !dueDate) {
            req.flash('error', 'Title and Due Date are required to create a task.');
            return res.redirect('/tasks/new');
        }

        // Parse and validate dueDate
        const parsedDue = new Date(dueDate);
        if (isNaN(parsedDue.getTime())) {
            req.flash('error', 'Invalid due date provided.');
            return res.redirect('/tasks/new');
        }

        // Build sanitized task data
        const taskData = {
            title: title.trim(),
            description: req.body.description ? req.body.description.trim() : undefined,
            type: req.body.type || undefined,
            priority: req.body.priority || undefined,
            status: 'pending',
            assignedBroker: req.user._id,
            createdBy: req.user._id,
            dueDate: parsedDue
        };

        // Validate optional ObjectId references before assigning
        if (req.body.relatedLead && mongoose.Types.ObjectId.isValid(req.body.relatedLead)) {
            taskData.relatedLead = req.body.relatedLead;
        }
        if (req.body.relatedProperty && mongoose.Types.ObjectId.isValid(req.body.relatedProperty)) {
            taskData.relatedProperty = req.body.relatedProperty;
        }
        if (req.body.relatedUser && mongoose.Types.ObjectId.isValid(req.body.relatedUser)) {
            taskData.relatedUser = req.body.relatedUser;
        }

        // Normalize notes: schema expects array of objects
        if (req.body.notes) {
            // If notes is a string, wrap it
            if (typeof req.body.notes === 'string') {
                const noteContent = req.body.notes.trim();
                if (noteContent.length > 0) {
                    taskData.notes = [{ content: noteContent, broker: req.user._id }];
                }
            } else if (Array.isArray(req.body.notes)) {
                // Map array of strings to objects
                taskData.notes = req.body.notes.map(n => ({ content: (n || '').toString().trim(), broker: req.user._id }));
            }
        }

        const task = new Task(taskData);
        await task.save();

        req.flash("success", "Task created successfully!");
        res.redirect(`/tasks/${task._id}`);
    } catch (err) {
        console.error('Error creating task:', err);
        req.flash('error', 'Error creating task. Please check input and try again.');
        return res.redirect('/tasks/new');
    }
}));

// Dashboard for tasks
router.get("/dashboard", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const userId = req.user._id;
    
    // Get task statistics
    const totalTasks = await Task.countDocuments({ assignedBroker: userId });
    const pendingTasks = await Task.countDocuments({ 
        assignedBroker: userId, 
        status: 'pending' 
    });
    const completedTasks = await Task.countDocuments({ 
        assignedBroker: userId, 
        status: 'completed' 
    });
    const overdueTasks = await Task.countDocuments({ 
        assignedBroker: userId, 
        status: 'pending',
        dueDate: { $lt: new Date() }
    });
    
    // Get recent tasks
    const recentTasks = await Task.find({ assignedBroker: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('relatedLead', 'firstName lastName')
        .populate('relatedProperty', 'title');
    
    // Get upcoming tasks
    const upcomingTasks = await Task.find({ 
        assignedBroker: userId,
        status: 'pending',
        dueDate: { $gte: new Date() }
    })
    .sort({ dueDate: 1 })
    .limit(10)
    .populate('relatedLead', 'firstName lastName')
    .populate('relatedProperty', 'title');
    
    res.render("tasks/dashboard", { 
        totalTasks, 
        pendingTasks, 
        completedTasks, 
        overdueTasks,
        recentTasks, 
        upcomingTasks 
    });
}));

// Show task details
router.get("/:id", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const task = await Task.findById(id)
        .populate('assignedBroker', 'firstName lastName email phone')
        .populate('relatedLead', 'firstName lastName email phone')
        .populate('relatedProperty', 'title address images');
    
    if (!task) {
        req.flash("error", "Task not found!");
        return res.redirect("/tasks");
    }
    
    res.render("tasks/show", { task });
}));

// Edit task form
router.get("/:id/edit", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const task = await Task.findById(id);
    
    if (!task) {
        req.flash("error", "Task not found!");
        return res.redirect("/tasks");
    }
    
    // Get leads for dropdown
    const leads = await Lead.find({ assignedBroker: req.user._id })
        .select('firstName lastName email');
    
    // Also provide list of users (possible assignees) and properties for the related selects
    // Limit to brokers and relevant users to keep dropdowns manageable
    const User = require('../models/user');
    const Listing = require('../models/listing');

    const users = await User.find({})
        .select('firstName lastName userType')
        .sort({ firstName: 1, lastName: 1 });

    // Provide properties - for brokers show assigned properties, for owners show their listings
    let properties = [];
    if (req.user.userType === 'broker') {
        properties = await Listing.find({ assignedBroker: req.user._id })
            .select('title address');
    } else if (req.user.userType === 'property_owner') {
        properties = await Listing.find({ owner: req.user._id })
            .select('title address');
    } else {
        // default: small recent set to avoid empty dropdowns
        properties = await Listing.find({})
            .limit(20)
            .select('title address');
    }

    res.render("tasks/edit", { task, leads, users, properties });
}));

// Update task
router.put("/:id", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const task = await Task.findByIdAndUpdate(id, req.body, { runValidators: true });
    
    req.flash("success", "Task updated successfully!");
    res.redirect(`/tasks/${task._id}`);
}));

// Update task status
router.patch("/:id/status", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    await Task.findByIdAndUpdate(id, { 
        status,
        completedAt: status === 'completed' ? new Date() : null
    });
    
    req.flash("success", "Task status updated successfully!");
    res.redirect(`/tasks/${id}`);
}));

// Complete task
router.patch("/:id/complete", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const { id } = req.params;
    
    await Task.findByIdAndUpdate(id, { 
        status: 'completed',
        completedAt: new Date()
    });
    
    req.flash("success", "Task completed successfully!");
    res.redirect(`/tasks/${id}`);
}));

// Delete task
router.delete("/:id", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const { id } = req.params;
    await Task.findByIdAndDelete(id);
    
    req.flash("success", "Task deleted successfully!");
    res.redirect("/tasks");
}));

// Dashboard for tasks
router.get("/dashboard", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    const userId = req.user._id;
    
    // Get task statistics
    const totalTasks = await Task.countDocuments({ assignedBroker: userId });
    const pendingTasks = await Task.countDocuments({ 
        assignedBroker: userId, 
        status: 'pending' 
    });
    const completedTasks = await Task.countDocuments({ 
        assignedBroker: userId, 
        status: 'completed' 
    });
    const overdueTasks = await Task.countDocuments({ 
        assignedBroker: userId, 
        status: 'pending',
        dueDate: { $lt: new Date() }
    });
    
    // Get recent tasks
    const recentTasks = await Task.find({ assignedBroker: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('relatedLead', 'firstName lastName')
        .populate('relatedProperty', 'title');
    
    // Get upcoming tasks
    const upcomingTasks = await Task.find({ 
        assignedBroker: userId,
        status: 'pending',
        dueDate: { $gte: new Date() }
    })
    .sort({ dueDate: 1 })
    .limit(10)
    .populate('relatedLead', 'firstName lastName')
    .populate('relatedProperty', 'title');
    
    res.render("tasks/dashboard", { 
        totalTasks, 
        pendingTasks, 
        completedTasks, 
        overdueTasks,
        recentTasks, 
        upcomingTasks 
    });
}));

module.exports = router;
