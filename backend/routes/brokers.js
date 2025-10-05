const express = require('express');
const router = express.Router();
const Broker = require('../models/Broker'); // Assuming a Broker model exists

router.get('/', async (req, res) => {
    try {
        const brokers = await Broker.find();
        res.status(200).json(brokers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching brokers', error });
    }
});

module.exports = router;
