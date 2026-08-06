// controllers/staffController.js

var mongoose      = require('mongoose');
var Complaint     = require('../models/Complaint');
var AssignmentLog = require('../models/AssignmentLog');
var User          = require('../models/User');
var mailer        = require('../config/mailer');


async function getAssignedComplaints(req, res) {
    try {
        var filter = { assignedTo: req.session.userId };
        if (req.query.status   && req.query.status   !== 'All') filter.status   = req.query.status;
        if (req.query.priority && req.query.priority !== 'All') filter.priority = req.query.priority;
        if (req.query.search && req.query.search.trim()) {
            filter.$or = [
                { title:       { $regex: req.query.search, $options: 'i' } },
                { complaintId: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        var complaints = await Complaint.find(filter)
            .populate('submittedBy', 'name email phone')
            .populate('category',   'name')
            .sort({ createdAt: -1 });
        return res.json({ success: true, complaints: complaints });
    } catch (err) {
        console.error('getAssignedComplaints error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function updateComplaintStatus(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var status  = req.body.status || '';
        var note    = (req.body.note  || '').trim();
        var allowed = ['In Progress', 'Resolved'];

        if (!status || !allowed.includes(status))
            return res.status(400).json({ success: false, message: 'Status must be "In Progress" or "Resolved".' });

        var complaint = await Complaint.findOne({ _id: req.params.id, assignedTo: req.session.userId })
            .populate('submittedBy', 'name email phone');
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found or not assigned to you.' });

        var staffMember = await User.findById(req.session.userId);
        var staffName   = staffMember ? staffMember.name : 'Staff';

        complaint.statusHistory.push({
            status:        status,
            changedBy:     staffName,
            changedByRole: 'staff',
            note:          note || 'Status updated by staff',
            date:          new Date()
        });
        complaint.status = status;

        if (status === 'Resolved') {
            complaint.completedAt = new Date();
            // Update AssignmentLog
            await AssignmentLog.findOneAndUpdate(
                { complaint: complaint._id },
                { status: 'Resolved', completedAt: complaint.completedAt },
                { sort: { assignedAt: -1 }, new: true }
            );
            // Email only the admin who assigned this complaint (not all admins)
            try {
                if (complaint.assignedBy) {
                    var assigningAdmin = await User.findById(complaint.assignedBy).select('name email').lean();
                    if (assigningAdmin) {
                        await mailer.sendCompletionAlertToAdmin(
                            assigningAdmin.email, assigningAdmin.name, complaint, staffMember
                        );
                    }
                }
            } catch (e) { console.log('Admin alert email failed:', e.message); }
        }

        await complaint.save();
        return res.json({ success: true, message: 'Status updated to ' + status + '.', complaint: complaint });
    } catch (err) {
        console.error('updateComplaintStatus error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function getComplaintById(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var complaint = await Complaint.findOne({ _id: req.params.id, assignedTo: req.session.userId })
            .populate('submittedBy', 'name email phone')
            .populate('category',   'name');
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        return res.json({ success: true, complaint: complaint });
    } catch (err) {
        console.error('getComplaintById error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}

module.exports = { getAssignedComplaints, updateComplaintStatus, getComplaintById };
