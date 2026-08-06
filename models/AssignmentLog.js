// models/AssignmentLog.js
// Admin Tracking System — stores full history of every assignment action
// Admin can view, filter by status / date / staff / user

var mongoose = require('mongoose');

var assignmentLogSchema = new mongoose.Schema({

    // Human-readable complaint ID (e.g. CX12)
    complaintId: {
        type:     String,
        required: true
    },

    // Reference to Complaint document
    complaint: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'Complaint',
        required: true
    },

    // User who submitted the complaint
    user: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'User',
        required: true
    },

    // Admin who made the assignment
    assignedBy: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'User',
        required: true
    },

    // Staff member the complaint was assigned to
    assignedTo: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'User',
        required: true
    },

    assignedAt: {
        type:    Date,
        default: Date.now
    },

    // Tracks the lifecycle of this assignment
    status: {
        type:    String,
        enum:    ['Assigned', 'In Progress', 'Resolved', 'Closed'],
        default: 'Assigned'
    },

    completedAt: {
        type:    Date,
        default: null
    }

}, { timestamps: true });

module.exports = mongoose.model('AssignmentLog', assignmentLogSchema);
