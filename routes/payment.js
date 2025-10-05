const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync.js');
const { isLoggedIn, isPropertyOwner } = require('../middleware.js');
const paymentController = require('../controllers/payment.js');

// Special owner payment routes
router.get('/special-owner', isLoggedIn, isPropertyOwner, paymentController.renderSpecialOwnerPayment);
router.post('/create-order', isLoggedIn, isPropertyOwner, wrapAsync(paymentController.createOrder));
router.post('/verify-payment', isLoggedIn, isPropertyOwner, wrapAsync(paymentController.verifyPayment));
router.get('/success', isLoggedIn, paymentController.paymentSuccess);
router.get('/failure', isLoggedIn, paymentController.paymentFailure);

// Debug route for testing payment verification
router.post('/test-verification', isLoggedIn, (req, res) => {
    console.log('🧪 Test verification endpoint hit');
    console.log('📝 Request body:', req.body);
    console.log('👤 User:', req.user._id);
    res.json({
        success: true,
        message: 'Test endpoint working',
        body: req.body,
        user: req.user._id
    });
});

module.exports = router;
