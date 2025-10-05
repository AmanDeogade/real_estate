const express = require("express");
const router = express.Router();
const Communication = require("../models/communication.js");
const User = require("../models/user.js");
const BuyerAssignment = require("../models/buyerAssignment.js");
const { isLoggedIn, isBroker } = require("../middleware.js");
const wrapAsync = require("../utils/wrapAsync.js");
const NotificationService = require("../services/notificationService.js");

// Show all communications for a broker
router.get("/", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get communications where broker is sender or receiver
        const communications = await Communication.find({
            $or: [
                { sender: userId },
                { receiver: userId }
            ]
        })
        .populate('sender', 'firstName lastName email')
        .populate('receiver', 'firstName lastName email')
        .populate('relatedProperty', 'title address')
        .populate('relatedAssignment')
        .sort({ createdAt: -1 });

        // Get buyer assignments for this broker
        const assignments = await BuyerAssignment.find({
            broker: userId,
            status: { $in: ['pending', 'accepted'] }
        })
        .populate('buyer', 'firstName lastName email phone')
        .populate('propertyOwner', 'firstName lastName companyName')
        .populate('relatedProperty', 'title address');

        res.render("communication/index", { communications, assignments });
    } catch (error) {
        console.error('Error loading communications:', error);
        req.flash("error", "Error loading communications");
        res.redirect("/listings/dashboard");
    }
}));

// Show communication with a specific buyer
router.get("/buyer/:buyerId", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    try {
        const { buyerId } = req.params;
        const brokerId = req.user._id;

        // Check if broker is assigned to this buyer
        const assignment = await BuyerAssignment.findOne({
            buyer: buyerId,
            broker: brokerId,
            status: { $in: ['pending', 'accepted'] }
        });

        if (!assignment) {
            req.flash("error", "You are not assigned to this buyer");
            return res.redirect("/communication");
        }

        // Get buyer details
        const buyer = await User.findById(buyerId);
        if (!buyer) {
            req.flash("error", "Buyer not found");
            return res.redirect("/communication");
        }

        // Get communication history
        const communications = await Communication.find({
            $or: [
                { sender: brokerId, receiver: buyerId },
                { sender: buyerId, receiver: brokerId }
            ]
        })
        .populate('sender', 'firstName lastName email')
        .populate('receiver', 'firstName lastName email')
        .populate('relatedProperty', 'title address')
        .sort({ createdAt: 1 });

        // Get buyer's favorite properties
        const favorites = await require("../models/favorite.js").find({
            user: buyerId,
            assignedBroker: brokerId
        })
        .populate('property', 'title address price propertyType images')
        .sort({ addedAt: -1 });

        res.render("communication/buyer", { 
            buyer, 
            communications, 
            favorites, 
            assignment 
        });
    } catch (error) {
        console.error('Error loading buyer communication:', error);
        req.flash("error", "Error loading buyer communication");
        res.redirect("/communication");
    }
}));

// Send new communication to buyer
router.post("/buyer/:buyerId/send", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    try {
        const { buyerId } = req.params;
        const { type, subject, message, relatedProperty, priority } = req.body;
        const brokerId = req.user._id;

        // Check if broker is assigned to this buyer
        const assignment = await BuyerAssignment.findOne({
            buyer: buyerId,
            broker: brokerId,
            status: { $in: ['pending', 'accepted'] }
        });

        if (!assignment) {
            req.flash("error", "You are not assigned to this buyer");
            return res.redirect(`/communication/buyer/${buyerId}`);
        }

        // Create communication record
        const communication = new Communication({
            sender: brokerId,
            receiver: buyerId,
            type,
            subject: subject || 'Message from your broker',
            message,
            relatedProperty: relatedProperty || null,
            relatedAssignment: assignment._id,
            priority: priority || 'normal'
        });

        await communication.save();

        // Send notification to buyer
        try {
            await NotificationService.createNotification(
                buyerId,
                'broker_message',
                subject || 'New message from your broker',
                message,
                {
                    relatedListing: relatedProperty,
                    priority: priority || 'normal'
                }
            );
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
        }

        req.flash("success", "Message sent successfully");
        res.redirect(`/communication/buyer/${buyerId}`);
    } catch (error) {
        console.error('Error sending message:', error);
        req.flash("error", "Error sending message");
        res.redirect(`/communication/buyer/${buyerId}`);
    }
}));

// Send bulk communication to multiple buyers
router.post("/bulk-send", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    try {
        const { buyerIds, type, subject, message, priority } = req.body;
        const brokerId = req.user._id;

        if (!buyerIds || !Array.isArray(buyerIds) || buyerIds.length === 0) {
            req.flash("error", "Please select at least one buyer");
            return res.redirect("/communication");
        }

        // Check if broker is assigned to all buyers
        const assignments = await BuyerAssignment.find({
            buyer: { $in: buyerIds },
            broker: brokerId,
            status: { $in: ['pending', 'accepted'] }
        });

        if (assignments.length !== buyerIds.length) {
            req.flash("error", "You are not assigned to all selected buyers");
            return res.redirect("/communication");
        }

        // Create communications for each buyer
        const communications = [];
        for (const buyerId of buyerIds) {
            const communication = new Communication({
                sender: brokerId,
                receiver: buyerId,
                type,
                subject: subject || 'Message from your broker',
                message,
                priority: priority || 'normal'
            });
            communications.push(communication);
        }

        await Communication.insertMany(communications);

        // Send notifications to all buyers
        try {
            await NotificationService.sendBulkNotifications(
                buyerIds,
                'broker_message',
                subject || 'New message from your broker',
                message,
                { priority: priority || 'normal' }
            );
        } catch (notifError) {
            console.error('Error sending bulk notifications:', notifError);
        }

        req.flash("success", `Message sent to ${buyerIds.length} buyers successfully`);
        res.redirect("/communication");
    } catch (error) {
        console.error('Error sending bulk message:', error);
        req.flash("error", "Error sending bulk message");
        res.redirect("/communication");
    }
}));

// Mark communication as read
router.patch("/:communicationId/read", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const { communicationId } = req.params;
        const userId = req.user._id;

        const communication = await Communication.findById(communicationId);
        if (!communication) {
            return res.status(404).json({ success: false, message: "Communication not found" });
        }

        // Check if user is sender or receiver
        if (communication.sender.toString() !== userId.toString() && 
            communication.receiver.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        // Mark as read
        communication.status = 'read';
        communication.deliveryDetails.readAt = new Date();
        await communication.save();

        res.json({ success: true, message: "Communication marked as read" });
    } catch (error) {
        console.error('Error marking communication as read:', error);
        res.status(500).json({ success: false, message: "Error updating communication" });
    }
}));

// Get communication statistics for broker
router.get("/stats", isLoggedIn, isBroker, wrapAsync(async (req, res) => {
    try {
        const brokerId = req.user._id;

        // Get communication statistics
        const totalCommunications = await Communication.countDocuments({
            $or: [
                { sender: brokerId },
                { receiver: brokerId }
            ]
        });

        const sentCommunications = await Communication.countDocuments({
            sender: brokerId
        });

        const receivedCommunications = await Communication.countDocuments({
            receiver: brokerId
        });

        const unreadCommunications = await Communication.countDocuments({
            receiver: brokerId,
            status: 'sent'
        });

        // Get buyer assignment statistics
        const totalAssignments = await BuyerAssignment.countDocuments({
            broker: brokerId,
            status: { $in: ['pending', 'accepted'] }
        });

        const activeBuyers = await BuyerAssignment.distinct('buyer', {
            broker: brokerId,
            status: { $in: ['pending', 'accepted'] }
        });

        res.json({
            success: true,
            stats: {
                totalCommunications,
                sentCommunications,
                receivedCommunications,
                unreadCommunications,
                totalAssignments,
                activeBuyers: activeBuyers.length
            }
        });
    } catch (error) {
        console.error('Error getting communication stats:', error);
        res.status(500).json({ success: false, message: "Error getting statistics" });
    }
}));

module.exports = router;


