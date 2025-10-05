const Notification = require("../models/notification.js");
const User = require("../models/user.js");
const nodemailer = require("nodemailer");

class NotificationService {
    // Create a new notification
    static async createNotification(userId, type, title, message, options = {}) {
        try {
            const notification = new Notification({
                user: userId,
                type,
                title,
                message,
                priority: options.priority || 'normal',
                relatedListing: options.relatedListing,
                relatedLead: options.relatedLead,
                scheduledFor: options.scheduledFor,
                expiresAt: options.expiresAt
            });

            await notification.save();

            // Send immediate notification if not scheduled
            if (!options.scheduledFor) {
                await this.sendNotification(notification);
            }

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Send notification through appropriate channels
    static async sendNotification(notification) {
        try {
            const user = await User.findById(notification.user);
            if (!user) return;

            const { notificationPreferences } = user;
            const deliveryPromises = [];

            // Email notifications
            if (notificationPreferences.email) {
                deliveryPromises.push(this.sendEmailNotification(notification, user));
            }

            // SMS notifications (placeholder for SMS service integration)
            if (notificationPreferences.sms) {
                deliveryPromises.push(this.sendSMSNotification(notification, user));
            }

            // Push notifications (placeholder for push service integration)
            if (notificationPreferences.push) {
                deliveryPromises.push(this.sendPushNotification(notification, user));
            }

            // Wait for all delivery attempts
            await Promise.allSettled(deliveryPromises);

            // Mark as delivered
            await notification.markAsDelivered();

        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    // Send email notification
    static async sendEmailNotification(notification, user) {
        try {
            // Update delivery attempt
            notification.deliveryAttempts.email.attempted = true;
            await notification.save();

            // Create email transporter (configure with your email service)
            const transporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            // Email content
            const mailOptions = {
                from: process.env.SMTP_FROM || 'noreply@karnavatassociates.com',
                to: user.email,
                subject: notification.title,
                html: this.generateEmailTemplate(notification, user)
            };

            // Send email
            const info = await transporter.sendMail(mailOptions);
            
            // Mark as delivered
            notification.deliveryAttempts.email.delivered = true;
            notification.deliveryAttempts.email.deliveredAt = Date.now();
            await notification.save();

            console.log('Email sent:', info.messageId);
            return true;

        } catch (error) {
            console.error('Error sending email notification:', error);
            return false;
        }
    }

    // Send SMS notification (placeholder - integrate with SMS service)
    static async sendSMSNotification(notification, user) {
        try {
            // Update delivery attempt
            notification.deliveryAttempts.sms.attempted = true;
            await notification.save();

            // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
            console.log(`SMS notification for ${user.phone}: ${notification.message}`);
            
            // Mark as delivered (for now)
            notification.deliveryAttempts.sms.delivered = true;
            notification.deliveryAttempts.sms.deliveredAt = Date.now();
            await notification.save();

            return true;

        } catch (error) {
            console.error('Error sending SMS notification:', error);
            return false;
        }
    }

    // Send push notification (placeholder - integrate with push service)
    static async sendPushNotification(notification, user) {
        try {
            // Update delivery attempt
            notification.deliveryAttempts.push.attempted = true;
            await notification.save();

            // TODO: Integrate with push notification service (Firebase, OneSignal, etc.)
            console.log(`Push notification for user ${user._id}: ${notification.message}`);
            
            // Mark as delivered (for now)
            notification.deliveryAttempts.push.delivered = true;
            notification.deliveryAttempts.push.deliveredAt = Date.now();
            await notification.save();

            return true;

        } catch (error) {
            console.error('Error sending push notification:', error);
            return false;
        }
    }

    // Generate email HTML template
    static generateEmailTemplate(notification, user) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:8080';
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${notification.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                    .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Karnavat&Associates</h1>
                    </div>
                    <div class="content">
                        <h2>${notification.title}</h2>
                        <p>Hello ${user.firstName},</p>
                        <p>${notification.message}</p>
                        <p style="text-align: center;">
                            <a href="${baseUrl}" class="btn">View Details</a>
                        </p>
                    </div>
                    <div class="footer">
                        <p>You're receiving this email because you have notifications enabled.</p>
                        <p><a href="${baseUrl}/profile">Manage Preferences</a></p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Get user's notifications
    static async getUserNotifications(userId, options = {}) {
        try {
            const { page = 1, limit = 20, unreadOnly = false } = options;
            const skip = (page - 1) * limit;

            let query = { user: userId };
            if (unreadOnly) {
                query.isRead = false;
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Notification.countDocuments(query);
            const totalPages = Math.ceil(total / limit);

            return {
                notifications,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            console.error('Error getting user notifications:', error);
            throw error;
        }
    }

    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOne({
                _id: notificationId,
                user: userId
            });

            if (notification) {
                await notification.markAsRead();
            }

            return notification;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    // Mark all notifications as read for a user
    static async markAllAsRead(userId) {
        try {
            await Notification.updateMany(
                { user: userId, isRead: false },
                { isRead: true, readAt: Date.now() }
            );

            return true;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    // Delete old notifications
    static async cleanupOldNotifications(daysOld = 90) {
        try {
            const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
            
            const result = await Notification.deleteMany({
                createdAt: { $lt: cutoffDate },
                isRead: true
            });

            console.log(`Cleaned up ${result.deletedCount} old notifications`);
            return result.deletedCount;
        } catch (error) {
            console.error('Error cleaning up old notifications:', error);
            throw error;
        }
    }

    // Send bulk notifications to multiple users
    static async sendBulkNotifications(userIds, type, title, message, options = {}) {
        try {
            const notifications = [];
            const deliveryPromises = [];

            for (const userId of userIds) {
                const notification = await this.createNotification(
                    userId, type, title, message, options
                );
                notifications.push(notification);
            }

            return notifications;
        } catch (error) {
            console.error('Error sending bulk notifications:', error);
            throw error;
        }
    }

    // Send property-specific notifications
    static async sendPropertyNotification(userId, property, type, options = {}) {
        let title, message;

        switch (type) {
            case 'new_listing':
                title = 'New Property Available';
                message = `A new ${property.propertyType} is now available in ${property.address.city}!`;
                break;
            case 'price_change':
                title = 'Property Price Updated';
                message = `The price for ${property.title} has been updated.`;
                break;
            case 'status_change':
                title = 'Property Status Updated';
                message = `The status of ${property.title} has changed to ${property.status}.`;
                break;
            default:
                title = 'Property Update';
                message = `There's an update for ${property.title}.`;
        }

        return await this.createNotification(userId, type, title, message, {
            relatedListing: property._id,
            ...options
        });
    }

    // NEW: Send area-based notifications for new properties
    static async sendAreaBasedNotifications(property, radius = 10) {
        try {
            // Find users within the specified radius of the new property
            const nearbyUsers = await User.find({
                'location.coordinates': {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: property.location.coordinates
                        },
                        $maxDistance: radius * 1000 // Convert km to meters
                    }
                },
                'communicationPreferences.email': true,
                userType: 'buyer'
            });

            if (nearbyUsers.length === 0) {
                console.log('No nearby users found for area-based notifications');
                return [];
            }

            const notifications = [];
            const propertyCity = property.address.city;
            const propertyType = property.propertyType;

            for (const user of nearbyUsers) {
                // Check if user has preferences that match this property
                const shouldNotify = this.shouldNotifyUser(user, property);
                
                if (shouldNotify) {
                    const title = `New ${propertyType} in ${propertyCity}`;
                    const message = `A new ${propertyType} matching your preferences is now available in ${propertyCity}! Check it out now.`;
                    
                    const notification = await this.createNotification(
                        user._id,
                        'new_listing',
                        title,
                        message,
                        {
                            relatedListing: property._id,
                            priority: 'high',
                            scheduledFor: new Date(Date.now() + 1000 * 60 * 5) // Send after 5 minutes
                        }
                    );
                    
                    notifications.push(notification);
                }
            }

            console.log(`Sent ${notifications.length} area-based notifications for new property in ${propertyCity}`);
            return notifications;

        } catch (error) {
            console.error('Error sending area-based notifications:', error);
            return [];
        }
    }

    // NEW: Check if user should be notified about a property
    static shouldNotifyUser(user, property) {
        if (!user.propertyPreferences) return false;

        const prefs = user.propertyPreferences;
        
        // Check property type preference
        if (prefs.preferredTypes && prefs.preferredTypes.length > 0) {
            if (!prefs.preferredTypes.includes(property.propertyType)) {
                return false;
            }
        }

        // Check location preference
        if (prefs.preferredLocations && prefs.preferredLocations.length > 0) {
            if (!prefs.preferredLocations.includes(property.address.city)) {
                return false;
            }
        }

        // Check budget range
        if (prefs.budgetRange) {
            const propertyPrice = property.price.amount;
            if (prefs.budgetRange.min > 0 && propertyPrice < prefs.budgetRange.min) {
                return false;
            }
            if (prefs.budgetRange.max > 0 && propertyPrice > prefs.budgetRange.max) {
                return false;
            }
        }

        // Check bedroom preference
        if (prefs.bedrooms && property.bedrooms) {
            if (prefs.bedrooms.min > 0 && property.bedrooms < prefs.bedrooms.min) {
                return false;
            }
            if (prefs.bedrooms.max > 0 && property.bedrooms > prefs.bedrooms.max) {
                return false;
            }
        }

        // Check bathroom preference
        if (prefs.bathrooms && property.bathrooms) {
            if (prefs.bathrooms.min > 0 && property.bathrooms < prefs.bathrooms.min) {
                return false;
            }
            if (prefs.bathrooms.max > 0 && property.bathrooms > prefs.bathrooms.max) {
                return false;
            }
        }

        return true;
    }

    // NEW: Send personalized property recommendations
    static async sendRecommendationNotifications(userId, recommendations, type = 'daily') {
        try {
            if (recommendations.length === 0) return null;

            let title, message;
            
            switch (type) {
                case 'daily':
                    title = 'Your Daily Property Recommendations';
                    message = `We found ${recommendations.length} new properties that match your preferences!`;
                    break;
                case 'weekly':
                    title = 'Weekly Property Digest';
                    message = `Here are ${recommendations.length} properties you might have missed this week.`;
                    break;
                case 'instant':
                    title = 'New Properties for You';
                    message = `Check out these ${recommendations.length} properties that just became available!`;
                    break;
                default:
                    title = 'Property Recommendations';
                    message = `We found ${recommendations.length} properties for you!`;
            }

            const notification = await this.createNotification(
                userId,
                'recommendation',
                title,
                message,
                {
                    priority: 'normal',
                    scheduledFor: type === 'instant' ? new Date() : undefined
                }
            );

            return notification;

        } catch (error) {
            console.error('Error sending recommendation notifications:', error);
            return null;
        }
    }

    // NEW: Send market update notifications
    static async sendMarketUpdateNotifications(userId, marketData) {
        try {
            const title = 'Market Update';
            const message = `The real estate market in your area has been updated. Check out the latest trends and opportunities!`;

            const notification = await this.createNotification(
                userId,
                'system_message',
                title,
                message,
                {
                    priority: 'normal',
                    scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 2) // Send after 2 hours
                }
            );

            return notification;

        } catch (error) {
            console.error('Error sending market update notifications:', error);
            return null;
        }
    }

    // NEW: Send price drop alerts
    static async sendPriceDropNotifications(property, oldPrice, newPrice) {
        try {
            // Find users who have favorited this property or similar properties
            const interestedUsers = await User.find({
                $or: [
                    { 'favorites.property': property._id },
                    { 'propertyPreferences.preferredTypes': property.propertyType },
                    { 'propertyPreferences.preferredLocations': property.address.city }
                ],
                'communicationPreferences.email': true
            });

            const notifications = [];
            const priceDrop = oldPrice - newPrice;
            const priceDropPercent = ((priceDrop / oldPrice) * 100).toFixed(1);

            for (const user of interestedUsers) {
                const title = `Price Drop Alert - ${property.title}`;
                const message = `The price for ${property.title} has dropped by ₹${priceDrop.toLocaleString()} (${priceDropPercent}%)! This could be your opportunity.`;

                const notification = await this.createNotification(
                    user._id,
                    'price_change',
                    title,
                    message,
                    {
                        relatedListing: property._id,
                        priority: 'high',
                        scheduledFor: new Date(Date.now() + 1000 * 60 * 10) // Send after 10 minutes
                    }
                );

                notifications.push(notification);
            }

            console.log(`Sent ${notifications.length} price drop notifications`);
            return notifications;

        } catch (error) {
            console.error('Error sending price drop notifications:', error);
            return [];
        }
    }

    // NEW: Send viewing reminder notifications
    static async sendViewingReminders(viewingDate, userId, propertyId) {
        try {
            const title = 'Property Viewing Reminder';
            const message = `Don't forget! You have a property viewing scheduled for tomorrow. Make sure to prepare your questions and documents.`;

            const notification = await this.createNotification(
                userId,
                'system_message',
                title,
                message,
                {
                    relatedListing: propertyId,
                    priority: 'high',
                    scheduledFor: new Date(viewingDate.getTime() - 1000 * 60 * 60 * 24) // Send 1 day before
                }
            );

            return notification;

        } catch (error) {
            console.error('Error sending viewing reminder notifications:', error);
            return null;
        }
    }

    // NEW: Send follow-up notifications
    static async sendFollowUpNotifications(userId, propertyId, daysSinceInquiry = 3) {
        try {
            const title = 'Property Follow-up';
            const message = `It's been ${daysSinceInquiry} days since you inquired about this property. Would you like to schedule a viewing or get more information?`;

            const notification = await this.createNotification(
                userId,
                'inquiry_update',
                title,
                message,
                {
                    relatedListing: propertyId,
                    priority: 'normal',
                    scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 2) // Send after 2 hours
                }
            );

            return notification;

        } catch (error) {
            console.error('Error sending follow-up notifications:', error);
            return null;
        }
    }

    // NEW: Batch notification processing for better performance
    static async processBatchNotifications(notifications, batchSize = 50) {
        try {
            const batches = [];
            for (let i = 0; i < notifications.length; i += batchSize) {
                batches.push(notifications.slice(i, i + batchSize));
            }

            const results = [];
            for (const batch of batches) {
                const batchPromises = batch.map(notification => 
                    this.sendNotification(notification)
                );
                
                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults);
                
                // Small delay between batches to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            return results;

        } catch (error) {
            console.error('Error processing batch notifications:', error);
            return [];
        }
    }

    // NEW: Get notification analytics
    static async getNotificationAnalytics(userId, days = 30) {
        try {
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            
            const analytics = await Notification.aggregate([
                {
                    $match: {
                        user: userId,
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                        readCount: {
                            $sum: { $cond: ['$isRead', 1, 0] }
                        },
                        deliveredCount: {
                            $sum: { $cond: ['$isDelivered', 1, 0] }
                        }
                    }
                }
            ]);

            const totalNotifications = await Notification.countDocuments({
                user: userId,
                createdAt: { $gte: startDate }
            });

            const readNotifications = await Notification.countDocuments({
                user: userId,
                createdAt: { $gte: startDate },
                isRead: true
            });

            return {
                totalNotifications,
                readNotifications,
                unreadNotifications: totalNotifications - readNotifications,
                readRate: totalNotifications > 0 ? (readNotifications / totalNotifications) * 100 : 0,
                byType: analytics
            };

        } catch (error) {
            console.error('Error getting notification analytics:', error);
            return null;
        }
    }
}

module.exports = NotificationService;
