const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/user.js');

// Initialize Razorpay conditionally
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('✅ Razorpay initialized successfully');
} else {
    console.log('⚠️ Razorpay not initialized - missing environment variables');
}

// Render special owner payment page
module.exports.renderSpecialOwnerPayment = (req, res) => {
    if (!razorpay) {
        return res.render('payment/special-owner-payment.ejs', { 
            user: req.user, 
            error: 'Payment service not available. Please contact support to enable Special Owner upgrades.' 
        });
    }
    res.render('payment/special-owner-payment.ejs', { user: req.user });
};

// Create payment order
module.exports.createOrder = async (req, res) => {
    try {
        // Check if Razorpay is initialized
        if (!razorpay) {
            return res.status(500).json({
                success: false,
                message: 'Payment service not available. Please contact support.'
            });
        }
        
        console.log('💰 Creating payment order for user:', req.user._id);
        
        // Check if user is already a special owner
        const user = await User.findById(req.user._id);
        if (user.isSpecialOwner) {
            console.log('⚠️ User already a special owner, preventing duplicate payment:', req.user._id);
            return res.status(400).json({
                success: false,
                message: 'You are already a Special Owner! No need to pay again.'
            });
        }
        
        const options = {
            amount: 1000, // Amount in paise (₹10 = 1000 paise)
            currency: 'INR',
            receipt: `sp_${Date.now()}`, // Shortened receipt (max 40 chars)
            notes: {
                userId: req.user._id.toString(),
                purpose: 'Special Owner Upgrade'
            }
        };

        console.log('📋 Creating Razorpay order with options:', options);
        const order = await razorpay.orders.create(options);
        
        console.log('✅ Order created successfully:', order.id);
        
        res.json({
            success: true,
            order: order
        });
    } catch (error) {
        console.error('💥 Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
};

// Verify payment and upgrade user
module.exports.verifyPayment = async (req, res) => {
    try {
        // Check if Razorpay is initialized
        if (!razorpay) {
            return res.status(500).json({
                success: false,
                message: 'Payment service not available. Please contact support.'
            });
        }
        
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        console.log('🔐 Verifying payment for user:', req.user._id);
        console.log('📋 Order ID:', razorpay_order_id);
        console.log('💳 Payment ID:', razorpay_payment_id);
        console.log('🔑 Signature:', razorpay_signature);
        console.log('📝 Full request body:', req.body);
        
        // Check if required fields are present
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.log('❌ Missing required payment fields');
            return res.status(400).json({
                success: false,
                message: 'Missing payment verification data'
            });
        }
        
        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        console.log('🔍 Signature verification:', expectedSignature === razorpay_signature ? '✅ PASSED' : '❌ FAILED');
        console.log('🔐 Expected signature:', expectedSignature);
        console.log('🔐 Received signature:', razorpay_signature);

        if (expectedSignature === razorpay_signature) {
            // Check if user is already a special owner
            const user = await User.findById(req.user._id);
            
            if (user.isSpecialOwner) {
                console.log('⚠️ User already a special owner:', req.user._id);
                return res.json({
                    success: true,
                    message: 'You are already a Special Owner!'
                });
            }
            
            // Payment verified - upgrade user to special owner
            console.log('🚀 Upgrading user to special owner:', req.user._id);
            
            user.isSpecialOwner = true;
            user.specialOwnerSince = new Date();
            
            await user.save();
            
            console.log('✅ User successfully upgraded to special owner:', req.user._id);
            console.log('📅 Upgrade date:', user.specialOwnerSince);

            res.json({
                success: true,
                message: 'Payment verified! You are now a Special Owner.',
                upgradeDate: user.specialOwnerSince
            });
        } else {
            console.log('❌ Invalid payment signature for user:', req.user._id);
            res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }
    } catch (error) {
        console.error('💥 Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment'
        });
    }
};

// Payment success page
module.exports.paymentSuccess = (req, res) => {
    console.log('🎉 Payment success for user:', req.user._id);
    req.flash('success', '🎉 Payment successful! You are now a Special Owner with priority listing and enhanced features!');
    res.redirect('/profile');
};

// Payment failure page
module.exports.paymentFailure = (req, res) => {
    console.log('❌ Payment failure for user:', req.user._id);
    res.redirect('/profile');
};
