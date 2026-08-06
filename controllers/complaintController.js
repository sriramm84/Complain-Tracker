// controllers/complaintController.js

var mongoose  = require('mongoose');
var Complaint = require('../models/Complaint');
var Category  = require('../models/Category');
var User      = require('../models/User');
var mailer    = require('../config/mailer');


// ── PRIORITY DETECTION ────────────────────────────────────────
function detectPriority(title, description) {
    var text   = ((title || '') + ' ' + (description || '')).toLowerCase();
    var high   = ['urgent','critical','fire','emergency','broken','not working',
                  'immediate','asap','crash','failure','severe','serious','downtime'];
    var medium = ['delay','slow','waiting','issue','problem','error',
                  'wrong','incorrect','missing','not received'];
    for (var i = 0; i < high.length;   i++) { if (text.indexOf(high[i])   !== -1) return 'High';   }
    for (var j = 0; j < medium.length; j++) { if (text.indexOf(medium[j]) !== -1) return 'Medium'; }
    return 'Low';
}


// ── GENERATE UNIQUE COMPLAINT ID ──────────────────────────────
async function generateComplaintId() {
    var all  = await Complaint.find({ complaintId: { $exists: true, $ne: null } }).select('complaintId').lean();
    var maxN = 0;
    all.forEach(function(c) {
        var m = c.complaintId && c.complaintId.match(/^CX(\d+)$/);
        if (m) { var n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
    });
    var nextN     = maxN + 1;
    var candidate = 'CX' + nextN;
    while (await Complaint.findOne({ complaintId: candidate })) { nextN++; candidate = 'CX' + nextN; }
    return candidate;
}


// ── SUBMIT COMPLAINT ──────────────────────────────────────────
async function submitComplaint(req, res) {
    try {
        var title       = (req.body.title       || '').trim();
        var categoryId  =  req.body.category    || '';
        var description = (req.body.description || '').trim();

        if (!title || !categoryId || !description)
            return res.status(400).json({ success: false, message: 'Title, category and description are required.' });
        if (title.length < 5)
            return res.status(400).json({ success: false, message: 'Title must be at least 5 characters.' });
        if (description.length < 10)
            return res.status(400).json({ success: false, message: 'Description must be at least 10 characters.' });
        if (!mongoose.Types.ObjectId.isValid(categoryId))
            return res.status(400).json({ success: false, message: 'Invalid category.' });

        var categoryDoc = await Category.findById(categoryId);
        if (!categoryDoc)
            return res.status(400).json({ success: false, message: 'Selected category does not exist.' });

        // Duplicate title check
        var escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var existing = await Complaint.findOne({
            submittedBy: req.session.userId,
            title: { $regex: new RegExp('^' + escapedTitle + '$', 'i') }
        });
        if (existing)
            return res.status(400).json({ success: false, message: 'You already have a complaint with this exact title.' });

        var autoPriority   = detectPriority(title, description);
        var newComplaintId = await generateComplaintId();
        var attachmentPath = req.file ? '/uploads/' + req.file.filename : null;
        var user           = await User.findById(req.session.userId).lean();

        var complaint = await Complaint.create({
            complaintId:   newComplaintId,
            title:         title,
            category:      categoryId,
            description:   description,
            priority:      autoPriority,
            submittedBy:   req.session.userId,
            attachment:    attachmentPath,
            status:        'Submitted',
            statusHistory: [{
                status:        'Submitted',
                changedBy:     user.name,
                changedByRole: 'user',
                note:          'Complaint submitted',
                date:          new Date()
            }]
        });

        await complaint.populate('category', 'name');

        try { await mailer.sendComplaintConfirmation(user.email, user.name, complaint); }
        catch (e) { console.log('Confirmation email error:', e.message); }

        return res.status(201).json({
            success:   true,
            message:   'Complaint submitted. ID: ' + newComplaintId + ' | Priority: ' + autoPriority,
            complaint: complaint
        });
    } catch (err) {
        console.error('submitComplaint error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── GET MY COMPLAINTS ─────────────────────────────────────────
async function getMyComplaints(req, res) {
    try {
        var filter = { submittedBy: req.session.userId };

        if (req.query.search && req.query.search.trim()) {
            filter.$or = [
                { title:       { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } },
                { complaintId: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        if (req.query.status   && req.query.status   !== '') filter.status   = req.query.status;
        if (req.query.priority && req.query.priority !== '') filter.priority = req.query.priority;

        if (req.query.dateFrom || req.query.dateTo) {
            filter.createdAt = {};
            if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) {
                var d = new Date(req.query.dateTo);
                d.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = d;
            }
        }

        var complaints = await Complaint.find(filter)
            .populate('category',   'name')
            .populate('assignedTo', 'name phone')
            .sort({ createdAt: -1 });

        return res.json({ success: true, complaints: complaints });
    } catch (err) {
        console.error('getMyComplaints error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── GET SINGLE COMPLAINT ──────────────────────────────────────
async function getComplaintById(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var complaint = await Complaint.findOne({ _id: req.params.id, submittedBy: req.session.userId })
            .populate('category',   'name')
            .populate('assignedTo', 'name email phone');
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        return res.json({ success: true, complaint: complaint });
    } catch (err) {
        console.error('getComplaintById error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── REQUEST OTP ───────────────────────────────────────────────
async function requestEditOtp(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var complaint = await Complaint.findOne({ _id: req.params.id, submittedBy: req.session.userId });
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        if (complaint.status !== 'Submitted')
            return res.status(400).json({ success: false, message: 'Only Submitted complaints can be edited.' });

        var otp    = Math.floor(100000 + Math.random() * 900000).toString();
        var expiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
        await User.findByIdAndUpdate(req.session.userId, { otp: otp, otpExpiry: expiry });

        var user = await User.findById(req.session.userId).lean();
        try {
            await mailer.sendOtpEmail(user.email, user.name, otp);
        } catch (e) {
            console.log('OTP email error:', e.message);
            return res.status(500).json({ success: false, message: 'Failed to send OTP email.' });
        }

        return res.json({ success: true, message: 'OTP sent to ' + user.email + '. Valid for 2 minutes.' });
    } catch (err) {
        console.error('requestEditOtp error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── UPDATE COMPLAINT WITH OTP ─────────────────────────────────
async function updateComplaintWithOtp(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var otpInput    = (req.body.otp         || '').trim();
        var title       = (req.body.title       || '').trim();
        var description = (req.body.description || '').trim();

        if (!otpInput)
            return res.status(400).json({ success: false, message: 'OTP is required to edit a complaint.' });

        var complaint = await Complaint.findOne({ _id: req.params.id, submittedBy: req.session.userId });
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        if (complaint.status !== 'Submitted')
            return res.status(400).json({ success: false, message: 'Only Submitted complaints can be edited.' });

        if (!complaint.complaintId)
            complaint.complaintId = await generateComplaintId();

        var user = await User.findById(req.session.userId);
        if (!user.otp || !user.otpExpiry)
            return res.status(400).json({ success: false, message: 'No OTP found. Request a new OTP first.' });
        if (new Date() > user.otpExpiry) {
            await User.findByIdAndUpdate(req.session.userId, { otp: null, otpExpiry: null });
            return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
        }
        if (user.otp !== otpInput)
            return res.status(400).json({ success: false, message: 'Incorrect OTP.' });

        await User.findByIdAndUpdate(req.session.userId, { otp: null, otpExpiry: null });

        if (title)       complaint.title       = title;
        if (description) complaint.description = description;
        complaint.priority = detectPriority(complaint.title, complaint.description);
        complaint.statusHistory.push({
            status: 'Edited', changedBy: user.name, changedByRole: 'user',
            note: 'User edited complaint details', date: new Date()
        });

        await complaint.save();
        await complaint.populate('category', 'name');

        // No email on user edits — avoid spamming for minor description/title tweaks

        return res.json({ success: true, message: 'Complaint updated. Priority: ' + complaint.priority, complaint: complaint });
    } catch (err) {
        console.error('updateComplaintWithOtp error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── DELETE COMPLAINT ──────────────────────────────────────────
async function deleteComplaint(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var complaint = await Complaint.findOne({ _id: req.params.id, submittedBy: req.session.userId });
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        if (complaint.status !== 'Submitted')
            return res.status(400).json({ success: false, message: 'Only Submitted complaints can be deleted.' });
        await complaint.deleteOne();
        return res.json({ success: true, message: 'Complaint deleted.' });
    } catch (err) {
        console.error('deleteComplaint error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}

module.exports = { submitComplaint, getMyComplaints, getComplaintById, requestEditOtp, updateComplaintWithOtp, deleteComplaint };
