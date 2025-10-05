# Special Owner Feature Setup Guide

## Overview
This feature allows property owners to upgrade to "Special Owner" status by paying ₹10 through Razorpay. Special owners get priority listing and enhanced features.

## Features
- **Priority Listing**: Special owner properties appear first in search results
- **Enhanced Visibility**: Better placement and marketing tools
- **Premium Support**: Dedicated customer support
- **Analytics Dashboard**: Advanced property performance metrics

## Setup Instructions

### 1. Install Dependencies
```bash
npm install razorpay
```

### 2. Environment Variables
Add these to your `.env` file:
```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 3. Get Razorpay Keys
1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Go to Settings → API Keys
3. Generate new API keys
4. Copy Key ID and Key Secret to your `.env` file

### 4. Test Mode
- Use test mode keys for development
- Test card: 4111 1111 1111 1111
- Test expiry: Any future date
- Test CVV: Any 3 digits

## How It Works

### 1. User Flow
1. Property owner visits profile page
2. Sees "Special Owner Status" section
3. Clicks "Upgrade Now" button
4. Redirected to payment page
5. Completes ₹10 payment via Razorpay
6. Account upgraded to Special Owner

### 2. Payment Process
1. **Create Order**: Server creates Razorpay order
2. **Payment**: User completes payment on Razorpay
3. **Verification**: Server verifies payment signature
4. **Upgrade**: User account upgraded to Special Owner

### 3. Database Changes
- Added `isSpecialOwner` boolean field to User model
- Added `specialOwnerSince` date field to User model

## Files Created/Modified

### New Files
- `controllers/payment.js` - Payment logic
- `routes/payment.js` - Payment routes
- `views/payment/special-owner-payment.ejs` - Payment page
- `SPECIAL_OWNER_SETUP.md` - This guide

### Modified Files
- `models/user.js` - Added special owner fields
- `app.js` - Added payment routes
- `views/users/profile.ejs` - Added special owner status display
- `package.json` - Added Razorpay dependency

## Routes

### Payment Routes
- `GET /payment/special-owner` - Payment page
- `POST /payment/create-order` - Create payment order
- `POST /payment/verify-payment` - Verify payment
- `GET /payment/success` - Payment success page
- `GET /payment/failure` - Payment failure page

## Security Features

### Payment Verification
- Server-side signature verification using HMAC SHA256
- Prevents payment tampering
- Secure order creation and verification

### Access Control
- Only property owners can access payment
- Requires user authentication
- Proper middleware protection

## Testing

### 1. Test Payment Flow
1. Login as property owner
2. Go to profile page
3. Click "Upgrade Now"
4. Complete test payment
5. Verify account upgrade

### 2. Test Error Handling
- Invalid payment signatures
- Network failures
- Payment cancellations

## Production Considerations

### 1. Environment
- Use production Razorpay keys
- Enable webhook notifications
- Monitor payment logs

### 2. Security
- Keep API keys secure
- Use HTTPS in production
- Implement rate limiting

### 3. Monitoring
- Track payment success rates
- Monitor failed payments
- Log payment activities

## Support

For issues or questions:
1. Check Razorpay documentation
2. Verify environment variables
3. Check server logs for errors
4. Test with Razorpay test mode first

## Future Enhancements

- Subscription renewal system
- Multiple payment plans
- Payment history tracking
- Admin dashboard for special owners
- Automated payment reminders

