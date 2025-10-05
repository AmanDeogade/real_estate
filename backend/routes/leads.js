const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Broker = require('../models/Broker'); // Assuming a Broker model exists
const Buyer = require('../models/Buyer'); // <-- existing
const User = require('../models/User'); // <-- added: fallback to users collection

// Route to fetch the list of brokers
router.get('/brokers', async (req, res) => {
    try {
        const brokers = await Broker.find(); // Fetch all brokers
        res.status(200).json(brokers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching brokers', error });
    }
});

// New route: fetch the list of buyers so frontend can show "All buyers" in Add Lead form
router.get('/buyers', async (req, res) => {
    try {
        // Try the dedicated Buyer collection first
        let buyers = await Buyer.find();

        // If no documents in buyers collection, fall back to users collection (role 'buyer' or mis-saved 'property_owner')
        if (!buyers || buyers.length === 0) {
            buyers = await User.find({
                role: { $in: [/^buyer$/i, /^property_owner$/i] }
            })
            .select('firstName lastName name email role') // return useful fields
            .lean();

            // Normalize shape so frontend can display a label easily
            buyers = buyers.map(u => ({
                _id: u._id,
                name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Unknown',
                email: u.email || '',
                role: u.role || ''
            }));
        } else {
            // If we returned from Buyer collection, normalize its shape similarly
            buyers = buyers.map(b => ({
                _id: b._id,
                name: b.name || `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.email || 'Unknown',
                email: b.email || '',
                role: b.role || 'buyer'
            }));
        }

        res.status(200).json(buyers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching buyers', error });
    }
});

router.post('/add', async (req, res) => {
    const { leadDetails, brokerId } = req.body;

    try {
        // Create a new lead instance
        const lead = new Lead(leadDetails);

        if (brokerId) {
            // Assign broker to the lead
            lead.brokerId = brokerId;
        }
        await lead.save();
        res.status(201).json({ message: 'Lead added successfully', lead });
    } catch (error) {
        res.status(500).json({ message: 'Error adding lead', error });
    }
});

router.post('/create', async (req, res) => {
    const { buyerInfo, leadDetails, brokerId } = req.body;

    try {
        const lead = new Lead({
            buyerInfo,
            leadDetails,
            brokerId, // Assign broker to the lead
        });
        await lead.save();
        res.status(201).json({ message: 'Lead created successfully', lead });
    } catch (error) {
        res.status(500).json({ message: 'Error creating lead', error });
    }
});

router.put('/assign-broker/:leadId', async (req, res) => {
    const { leadId } = req.params;
    const { brokerId } = req.body;

    try {
        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        lead.brokerId = brokerId; // Assign the new broker
        await lead.save();
        res.status(200).json({ message: 'Broker assigned successfully', lead });
    } catch (error) {
        res.status(500).json({ message: 'Error assigning broker', error });
    }
});

// ...existing routes...

module.exports = router;