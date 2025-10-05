# Special Owner Feature - Implementation Guide

## Overview
The Special Owner feature allows property owners to purchase subscription plans that give their properties priority placement in search results. This increases visibility and leads to higher inquiry rates.

## Features Implemented

### 1. Subscription Plans
- **3 Plan Tiers**: Basic, Premium, Enterprise
- **3 Duration Options**: Monthly, 6 months, 1 year
- **Priority Boost**: 1.5x (Basic), 2.5x (Premium), 4.0x (Enterprise)
- **Max Listings**: 5 (Basic), 15 (Premium), Unlimited (Enterprise)

### 2. User Model Updates
- Added `subscription` field with:
  - `isSpecialOwner`: Boolean flag
  - `currentPlan`: Reference to subscription plan
  - `priorityBoost`: Priority multiplier
  - `subscriptionExpiry`: Expiration date

### 3. Search Result Prioritization
- Special Owner properties appear at the top of search results
- Priority based on subscription tier (Basic < Premium < Enterprise)
- Automatic sorting in all listing queries

### 4. Payment Integration
- Razorpay payment gateway integration
- Secure UPI payments
- Automatic subscription activation upon successful payment

### 5. Subscription Management
- View subscription status and details
- Cancel subscription functionality
- Automatic expiry checking
- Renewal reminders

## Database Models

### User Model
```javascript
subscription: {
    isSpecialOwner: Boolean,
    currentPlan: ObjectId,
    priorityBoost: Number,
    subscriptionExpiry: Date
}
```

### SubscriptionPlan Model
```javascript
{
    name: String, // Basic, Premium, Enterprise
    duration: String, // monthly, 6months, 1year
    price: Number,
    priorityBoost: Number,
    maxListings: Number,
    features: [String]
}
```

### UserSubscription Model
```javascript
{
    user: ObjectId,
    plan: ObjectId,
    status: String, // active, expired, cancelled, pending
    startDate: Date,
    endDate: Date,
    paymentStatus: String,
    amount: Number
}
```

## API Endpoints

### Subscription Routes
- `GET /subscription/plans` - View available plans
- `GET /subscription/status` - Check subscription status
- `POST /subscription/create-order` - Create payment order
- `POST /subscription/verify-payment` - Verify payment and activate
- `POST /subscription/cancel` - Cancel subscription
- `GET /subscription/check-expiry` - Check if subscription expired
- `GET /subscription/benefits` - View benefits page
- `GET /subscription/admin/check-all-expired` - Admin route for bulk expiry check

## Search Result Prioritization Logic

The system automatically sorts search results with the following priority:

1. **Special Owners** (highest priority)
   - Enterprise subscribers (4.0x boost)
   - Premium subscribers (2.5x boost)
   - Basic subscribers (1.5x boost)

2. **Featured Properties** (medium priority)
3. **Regular Properties** (lowest priority, sorted by date)

## Implementation Details

### 1. Search Controller Updates
All listing queries now include owner subscription information and apply priority sorting:

```javascript
// Populate owner subscription info
.populate({
    path: 'owner',
    select: 'firstName lastName companyName subscription',
    populate: {
        path: 'subscription.currentPlan',
        select: 'plan priorityBoost',
        populate: {
            path: 'plan',
            select: 'name priorityBoost'
        }
    }
})

// Sort by priority
listings.sort((a, b) => {
    const aIsSpecial = a.owner.subscription && a.owner.subscription.isSpecialOwner;
    const bIsSpecial = b.owner.subscription && b.owner.subscription.isSpecialOwner;
    
    if (aIsSpecial && !bIsSpecial) return -1;
    if (!aIsSpecial && bIsSpecial) return 1;
    
    // Sort by priority boost if both are special
    if (aIsSpecial && bIsSpecial) {
        return (b.owner.subscription.priorityBoost || 1) - (a.owner.subscription.priorityBoost || 1);
    }
    
    return new Date(b.createdAt) - new Date(a.createdAt);
});
```

### 2. Subscription Verification
Upon successful payment:
1. Verify Razorpay signature
2. Get subscription plan details
3. Calculate expiry date based on duration
4. Update user subscription status
5. Create UserSubscription record

### 3. Automatic Expiry Checking
- Middleware checks subscription status on protected routes
- Cron job script for bulk expiry processing
- Admin endpoint for manual expiry checks

## Usage Instructions

### For Property Owners
1. Navigate to `/subscription/plans`
2. Choose a plan (Basic, Premium, or Enterprise)
3. Select duration (monthly, 6 months, or 1 year)
4. Complete payment via UPI
5. Properties automatically get priority placement

### For Developers
1. Run `npm run init-subscriptions` to initialize subscription plans
2. Run `npm run check-subscriptions` to check expired subscriptions
3. Use `isSpecialOwner` middleware for protected features

## Cron Job Setup

To automatically check expired subscriptions, set up a cron job:

```bash
# Check every day at 2 AM
0 2 * * * cd /path/to/project && npm run check-subscriptions

# Or use the admin endpoint
0 2 * * * curl -X GET "http://your-domain/subscription/admin/check-all-expired"
```

## Testing

### Test Subscription Flow
1. Create a property owner account
2. Navigate to subscription plans
3. Select a plan and complete payment
4. Verify properties appear in priority order
5. Check subscription status page

### Test Expiry
1. Manually set subscription expiry to past date
2. Run expiry check script
3. Verify user loses special owner status
4. Check properties no longer have priority

## Security Considerations

1. **Payment Verification**: Razorpay signature verification
2. **Route Protection**: Authentication and authorization middleware
3. **Data Validation**: Input validation and sanitization
4. **Subscription Limits**: Respect max listings per plan

## Future Enhancements

1. **Auto-renewal**: Automatic subscription renewal
2. **Email Notifications**: Expiry reminders and status updates
3. **Analytics Dashboard**: Subscription performance metrics
4. **Bulk Operations**: Admin tools for managing multiple subscriptions
5. **Payment History**: Detailed payment and subscription history

## Troubleshooting

### Common Issues
1. **Payment Failed**: Check Razorpay credentials and network
2. **Subscription Not Active**: Verify payment verification logic
3. **Priority Not Working**: Check database indexes and query optimization
4. **Expiry Not Working**: Verify cron job setup and script execution

### Debug Commands
```bash
# Check subscription status
npm run check-subscriptions

# View subscription plans
npm run init-subscriptions

# Check logs for payment issues
tail -f logs/app.log
```

## Support

For technical support or feature requests, please contact the development team or create an issue in the project repository.




