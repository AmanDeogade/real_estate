const Task = require("../models/task.js");
const User = require("../models/user.js");
const Lead = require("../models/lead.js");
const Listing = require("../models/listing.js");
const NotificationService = require("./notificationService.js");

class TaskService {
    // Create a new task
    static async createTask(taskData) {
        try {
            const task = new Task(taskData);
            await task.save();

            // Create reminder notifications
            if (task.reminders && task.reminders.length > 0) {
                await this.scheduleReminders(task);
            }

            // Send notification to assigned broker
            await NotificationService.createNotification(
                task.assignedTo,
                'system_message',
                'New Task Assigned',
                `You have a new task: ${task.title}`,
                { priority: task.priority === 'urgent' ? 'high' : 'normal' }
            );

            return task;
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    }

    // Get tasks for a broker
    static async getBrokerTasks(brokerId, options = {}) {
        try {
            const { status, priority, dueDate, page = 1, limit = 20 } = options;
            const skip = (page - 1) * limit;

            let query = { assignedTo: brokerId };
            
            if (status) query.status = status;
            if (priority) query.priority = priority;
            if (dueDate) {
                const startOfDay = new Date(dueDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(dueDate);
                endOfDay.setHours(23, 59, 59, 999);
                query.dueDate = { $gte: startOfDay, $lte: endOfDay };
            }

            const tasks = await Task.find(query)
                .populate('relatedLead', 'firstName lastName email phone')
                .populate('relatedListing', 'title address')
                .populate('relatedUser', 'firstName lastName email phone')
                .populate('createdBy', 'firstName lastName')
                .sort({ dueDate: 1, priority: -1 })
                .skip(skip)
                .limit(limit);

            const total = await Task.countDocuments(query);
            const totalPages = Math.ceil(total / limit);

            return {
                tasks,
                pagination: {
                    currentPage: page,
                    totalPages,
                    total,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            console.error('Error getting broker tasks:', error);
            throw error;
        }
    }

    // Get dashboard summary for broker
    static async getBrokerDashboard(brokerId) {
        try {
            const today = new Date();
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            const [
                totalTasks,
                pendingTasks,
                overdueTasks,
                dueTodayTasks,
                completedTodayTasks,
                highPriorityTasks
            ] = await Promise.all([
                Task.countDocuments({ assignedTo: brokerId }),
                Task.countDocuments({ assignedTo: brokerId, status: 'pending' }),
                Task.countDocuments({ 
                    assignedTo: brokerId, 
                    status: { $in: ['pending', 'in_progress'] },
                    dueDate: { $lt: today }
                }),
                Task.countDocuments({ 
                    assignedTo: brokerId, 
                    status: { $in: ['pending', 'in_progress'] },
                    dueDate: { $gte: startOfDay, $lte: endOfDay }
                }),
                Task.countDocuments({ 
                    assignedTo: brokerId, 
                    status: 'completed',
                    completedAt: { $gte: startOfDay, $lte: endOfDay }
                }),
                Task.countDocuments({ 
                    assignedTo: brokerId, 
                    status: { $in: ['pending', 'in_progress'] },
                    priority: { $in: ['high', 'urgent'] }
                })
            ]);

            return {
                totalTasks,
                pendingTasks,
                overdueTasks,
                dueTodayTasks,
                completedTodayTasks,
                highPriorityTasks
            };
        } catch (error) {
            console.error('Error getting broker dashboard:', error);
            throw error;
        }
    }

    // Update task status
    static async updateTaskStatus(taskId, brokerId, status, options = {}) {
        try {
            const task = await Task.findOne({ _id: taskId, assignedTo: brokerId });
            if (!task) {
                throw new Error('Task not found or not assigned to you');
            }

            const oldStatus = task.status;
            task.status = status;

            if (status === 'completed') {
                task.completedAt = Date.now();
                task.completedBy = brokerId;
                if (options.completionNotes) {
                    task.completionNotes = options.completionNotes;
                }
            } else if (status === 'in_progress') {
                task.startTime = Date.now();
            }

            await task.save();

            // Send notification about status change
            await NotificationService.createNotification(
                task.createdBy,
                'system_message',
                'Task Status Updated',
                `Task "${task.title}" has been marked as ${status}`,
                { priority: 'normal' }
            );

            return task;
        } catch (error) {
            console.error('Error updating task status:', error);
            throw error;
        }
    }

    // Schedule reminders for a task
    static async scheduleReminders(task) {
        try {
            for (const reminder of task.reminders) {
                if (reminder.timeBefore && !reminder.sent) {
                    const reminderTime = new Date(task.dueDate.getTime() - reminder.timeBefore * 60 * 1000);
                    
                    if (reminderTime > Date.now()) {
                        // Schedule reminder
                        setTimeout(async () => {
                            await this.sendTaskReminder(task, reminder);
                        }, reminderTime.getTime() - Date.now());
                    }
                }
            }
        } catch (error) {
            console.error('Error scheduling reminders:', error);
        }
    }

    // Send task reminder
    static async sendTaskReminder(task, reminder) {
        try {
            const broker = await User.findById(task.assignedTo);
            if (!broker) return;

            // Update reminder status
            reminder.sent = true;
            reminder.sentAt = Date.now();
            await task.save();

            // Send notification
            await NotificationService.createNotification(
                task.assignedTo,
                'system_message',
                'Task Reminder',
                `Reminder: Task "${task.title}" is due ${this.formatDueDate(task.dueDate)}`,
                { priority: task.priority === 'urgent' ? 'high' : 'normal' }
            );

        } catch (error) {
            console.error('Error sending task reminder:', error);
        }
    }

    // Create follow-up task for a lead
    static async createFollowUpTask(leadId, brokerId, options = {}) {
        try {
            const lead = await Lead.findById(leadId);
            if (!lead) {
                throw new Error('Lead not found');
            }

            const defaultDueDate = new Date();
            defaultDueDate.setDate(defaultDueDate.getDate() + (options.daysFromNow || 3));

            const taskData = {
                title: options.title || `Follow up with ${lead.firstName} ${lead.lastName}`,
                description: options.description || `Follow up on lead: ${lead.interest} ${lead.propertyType.join(', ')}`,
                type: 'follow_up',
                priority: options.priority || 'medium',
                assignedTo: brokerId,
                createdBy: brokerId,
                relatedLead: leadId,
                dueDate: options.dueDate || defaultDueDate,
                reminders: [
                    {
                        type: 'email',
                        timeBefore: 1440, // 24 hours before
                        sent: false
                    },
                    {
                        type: 'in_app',
                        timeBefore: 60, // 1 hour before
                        sent: false
                    }
                ]
            };

            return await this.createTask(taskData);
        } catch (error) {
            console.error('Error creating follow-up task:', error);
            throw error;
        }
    }

    // Create property viewing task
    static async createPropertyViewingTask(listingId, leadId, brokerId, options = {}) {
        try {
            const listing = await Listing.findById(listingId);
            const lead = await Lead.findById(leadId);
            
            if (!listing || !lead) {
                throw new Error('Listing or lead not found');
            }

            const taskData = {
                title: `Property Viewing: ${listing.title}`,
                description: `Show property to ${lead.firstName} ${lead.lastName}`,
                type: 'property_viewing',
                priority: options.priority || 'high',
                assignedTo: brokerId,
                createdBy: brokerId,
                relatedListing: listingId,
                relatedLead: leadId,
                dueDate: options.dueDate || options.viewingDate,
                startTime: options.startTime,
                endTime: options.endTime,
                estimatedDuration: options.duration || 60,
                location: {
                    address: listing.address.street + ', ' + listing.address.city,
                    coordinates: listing.location.coordinates
                },
                reminders: [
                    {
                        type: 'email',
                        timeBefore: 1440, // 24 hours before
                        sent: false
                    },
                    {
                        type: 'sms',
                        timeBefore: 60, // 1 hour before
                        sent: false
                    }
                ]
            };

            return await this.createTask(taskData);
        } catch (error) {
            console.error('Error creating property viewing task:', error);
            throw error;
        }
    }

    // Get overdue tasks
    static async getOverdueTasks(brokerId) {
        try {
            const today = new Date();
            
            const overdueTasks = await Task.find({
                assignedTo: brokerId,
                status: { $in: ['pending', 'in_progress'] },
                dueDate: { $lt: today }
            })
            .populate('relatedLead', 'firstName lastName email phone')
            .populate('relatedListing', 'title address')
            .sort({ dueDate: 1, priority: -1 });

            return overdueTasks;
        } catch (error) {
            console.error('Error getting overdue tasks:', error);
            throw error;
        }
    }

    // Defer task
    static async deferTask(taskId, brokerId, newDueDate, reason) {
        try {
            const task = await Task.findOne({ _id: taskId, assignedTo: brokerId });
            if (!task) {
                throw new Error('Task not found or not assigned to you');
            }

            await task.defer(newDueDate);
            
            // Add completion notes with deferral reason
            if (reason) {
                task.completionNotes = `Task deferred: ${reason}`;
                await task.save();
            }

            // Send notification about deferral
            await NotificationService.createNotification(
                task.createdBy,
                'system_message',
                'Task Deferred',
                `Task "${task.title}" has been deferred to ${this.formatDueDate(newDueDate)}`,
                { priority: 'normal' }
            );

            return task;
        } catch (error) {
            console.error('Error deferring task:', error);
            throw error;
        }
    }

    // Helper method to format due date
    static formatDueDate(dueDate) {
        const now = new Date();
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'tomorrow';
        if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
        return `in ${diffDays} days`;
    }

    // Bulk task operations
    static async bulkUpdateTaskStatus(taskIds, brokerId, status, options = {}) {
        try {
            const result = await Task.updateMany(
                { _id: { $in: taskIds }, assignedTo: brokerId },
                { 
                    status,
                    ...(status === 'completed' && {
                        completedAt: Date.now(),
                        completedBy: brokerId
                    })
                }
            );

            return result;
        } catch (error) {
            console.error('Error bulk updating tasks:', error);
            throw error;
        }
    }

    // Get task statistics
    static async getTaskStatistics(brokerId, period = 'month') {
        try {
            const now = new Date();
            let startDate;

            switch (period) {
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'quarter':
                    startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }

            const [
                totalCreated,
                totalCompleted,
                totalOverdue,
                avgCompletionTime
            ] = await Promise.all([
                Task.countDocuments({ 
                    createdBy: brokerId, 
                    createdAt: { $gte: startDate } 
                }),
                Task.countDocuments({ 
                    assignedTo: brokerId, 
                    status: 'completed',
                    completedAt: { $gte: startDate }
                }),
                Task.countDocuments({ 
                    assignedTo: brokerId, 
                    status: { $in: ['pending', 'in_progress'] },
                    dueDate: { $lt: now }
                }),
                Task.aggregate([
                    {
                        $match: {
                            assignedTo: brokerId,
                            status: 'completed',
                            completedAt: { $gte: startDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            avgTime: {
                                $avg: {
                                    $subtract: ['$completedAt', '$createdAt']
                                }
                            }
                        }
                    }
                ])
            ]);

            const avgTimeHours = avgCompletionTime.length > 0 
                ? Math.round(avgCompletionTime[0].avgTime / (1000 * 60 * 60)) 
                : 0;

            return {
                totalCreated,
                totalCompleted,
                totalOverdue,
                avgCompletionTimeHours: avgTimeHours,
                completionRate: totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0
            };
        } catch (error) {
            console.error('Error getting task statistics:', error);
            throw error;
        }
    }
}

module.exports = TaskService;
