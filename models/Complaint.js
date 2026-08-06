// models/Complaint.js

var mongoose = require('mongoose');

var complaintSchema = new mongoose.Schema({

    // Unique human-readable ID: CX1, CX2 ...
    // sparse:true is REQUIRED — allows multiple documents without a complaintId
    // (old complaints before this field was added) without unique index conflicts
    complaintId: {
        type:   String,
        unique: true,
        sparse: true    // <-- CRITICAL: without this, all null values collide on the unique index
    },

    title: {
        type:      String,
        required:  [true, 'Title is required'],
        trim:      true,
        minlength: [5,   'Title must be at least 5 characters'],
        maxlength: [100, 'Title cannot exceed 100 characters']
    },

    category: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'Category',
        required: [true, 'Category is required']
    },

    description: {
        type:      String,
        required:  [true, 'Description is required'],
        minlength: [10, 'Description must be at least 10 characters']
    },

    // Workflow: Submitted → Under Review → Assigned → In Progress → Resolved → Closed
    status: {
        type:    String,
        enum:    ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
        default: 'Submitted'
    },

    // Auto-detected from keywords — user does NOT choose priority
    priority: {
        type:    String,
        enum:    ['Low', 'Medium', 'High'],
        default: 'Low'
    },

    submittedBy: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'User',
        required: [true, 'Submitted by is required']
    },

    adminNote: {
        type:    String,
        default: ''
    },

    assignedTo: {
        type:    mongoose.Schema.Types.ObjectId,
        ref:     'User',
        default: null
    },

    assignedBy: {
        type:    mongoose.Schema.Types.ObjectId,
        ref:     'User',
        default: null
    },

    assignedAt: {
        type:    Date,
        default: null
    },

    completedAt: {
        type:    Date,
        default: null
    },

    completionConfirmed: {
        type:    Boolean,
        default: false
    },

    completionConfirmedAt: {
        type:    Date,
        default: null
    },

    attachment: {
        type:    String,
        default: null
    },

    statusHistory: [{
        status:        { type: String },
        changedBy:     { type: String, default: 'System' },
        changedByRole: { type: String, default: '' },
        note:          { type: String, default: '' },
        date:          { type: Date,   default: Date.now }
    }]

}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
