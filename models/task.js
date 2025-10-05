const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const taskSchema = new Schema({
    // Task details
    title: {
        type: String,
        required: true,
    },
    description: String,
    type: {
        type: String,
        enum: [
            'call',
            'email',
            'meeting',
            'follow_up',
            'property_viewing',
            'documentation',
            'other'
        ],
        default: 'follow_up'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled', 'deferred'],
        default: 'pending'
    },
    // Assignment and ownership
    assignedBroker: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // Related entities
    relatedLead: {
        type: Schema.Types.ObjectId,
        ref: "Lead",
    },
    relatedProperty: {
        type: Schema.Types.ObjectId,
        ref: "Listing",
    },
    relatedUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    // Scheduling
    dueDate: {
        type: Date,
        required: true,
    },
    startTime: Date,
    endTime: Date,
    estimatedDuration: Number, // in minutes
    estimatedHours: Number, // in hours
    // Location (for property viewings, meetings)
    location: {
        address: String,
        coordinates: [Number], // [longitude, latitude]
        type: {
            type: String,
            default: 'Point'
        }
    },
    // Reminders and notifications
    reminders: [{
        type: {
            type: String,
            enum: ['email', 'sms', 'push', 'in_app'],
            default: 'in_app'
        },
        timeBefore: Number, // minutes before due date
        sent: {
            type: Boolean,
            default: false
        },
        sentAt: Date
    }],
    // Task completion
    completedAt: Date,
    completedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    completionNotes: String,
    // Notes
    notes: [{
        content: String,
        broker: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Time tracking logs
    timeLogs: [{
        duration: Number, // in hours
        description: String,
        broker: {
            type: Schema.Types.ObjectId,
            ref: "User"
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Attachments and links
    attachments: [{
        name: String,
        url: String,
        type: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Tags for organization
    tags: [String],
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Indexes for efficient queries
taskSchema.index({ assignedBroker: 1, status: 1, dueDate: 1 });
taskSchema.index({ dueDate: 1, status: 'pending' });
taskSchema.index({ relatedLead: 1, status: 1 });
taskSchema.index({ relatedProperty: 1, status: 1 });
taskSchema.index({ tags: 1, status: 1 });

// Update timestamp on save
taskSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
    if (this.status === 'completed' || this.status === 'cancelled') return false;
    return Date.now() > this.dueDate;
});

// Virtual for due soon status (within 24 hours)
taskSchema.virtual('isDueSoon').get(function() {
    if (this.status === 'completed' || this.status === 'cancelled') return false;
    const oneDay = 24 * 60 * 60 * 1000;
    return Date.now() > (this.dueDate - oneDay) && Date.now() <= this.dueDate;
});

// Mark as completed
taskSchema.methods.markAsCompleted = function(completedBy, notes) {
    this.status = 'completed';
    this.completedAt = Date.now();
    this.completedBy = completedBy;
    if (notes) this.completionNotes = notes;
    return this.save();
};

// Mark as in progress
taskSchema.methods.markAsInProgress = function() {
    this.status = 'in_progress';
    return this.save();
};

// Defer task
taskSchema.methods.defer = function(newDueDate) {
    this.status = 'deferred';
    this.dueDate = newDueDate;
    return this.save();
};

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;
