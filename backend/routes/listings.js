const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // <-- added to validate ObjectId
const Listing = require('../models/Listing');

// Ensure dashboard route is defined BEFORE any ':id' param
router.get('/dashboard', async (req, res) => {
    try {
        // put real dashboard logic here or call existing function
        const stats = { message: 'dashboard data placeholder' };
        res.status(200).json(stats);
    } catch (err) {
        console.error('Dashboard error', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Safe param route: validate id before querying
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    // Validate ObjectId to avoid CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid listing id' });
    }

    try {
        const listing = await Listing.findById(id);
        if (!listing) return res.status(404).json({ message: 'Listing not found' });
        res.status(200).json(listing);
    } catch (error) {
        console.error('Error fetching listing', error);
        res.status(500).json({ message: 'Error fetching listing', error });
    }
});

// ...existing routes...

module.exports = router;