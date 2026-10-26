// controllers/adminController.js

var mongoose      = require('mongoose');
var Complaint     = require('../models/Complaint');
var AssignmentLog = require('../models/AssignmentLog');
var Category      = require('../models/Category');
var User          = require('../models/User');
var mailer        = require('../config/mailer');
var escapeRegex   = require('../utils/escapeRegex');


// ── Backfill complaintId for old complaints ───────────────────
async function ensureComplaintId(complaint) {
    if (complaint.complaintId) return;
    var all  = await Complaint.find({ complaintId: { $exists: true, $ne: null } }).select('complaintId').lean();
    var maxN = 0;
    all.forEach(function(c) {
        var m = c.complaintId && c.complaintId.match(/^CX(\d+)$/);
        if (m) { var n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
    });
    var nextN = maxN + 1;
    var id    = 'CX' + nextN;
    while (await Complaint.findOne({ complaintId: id })) { nextN++; id = 'CX' + nextN; }
    complaint.complaintId = id;
}


// ── GET ALL COMPLAINTS ─────────────────────────────────────────
async function getAllComplaints(req, res) {
    try {
        var filter = {};

        if (req.query.status && req.query.status !== '')
            filter.status = req.query.status;
        if (req.query.priority && req.query.priority !== '')
            filter.priority = req.query.priority;
        if (req.query.complaintId && req.query.complaintId.trim())
            filter.complaintId = { $regex: escapeRegex(req.query.complaintId.trim()), $options: 'i' };

        // category is always sent as a 24-char ObjectId hex string from ng-value
        if (req.query.category && req.query.category !== '') {
            if (mongoose.Types.ObjectId.isValid(req.query.category)) {
                filter.category = req.query.category;
            } else {
                // Fallback: search by name
                var catDoc = await Category.findOne({ name: { $regex: new RegExp('^' + escapeRegex(req.query.category) + '$', 'i') } });
                if (catDoc) filter.category = catDoc._id;
                else        return res.json({ success: true, complaints: [] });
            }
        }

        if (req.query.userName && req.query.userName.trim()) {
            var uList = await User.find({ name: { $regex: escapeRegex(req.query.userName.trim()), $options: 'i' } }).select('_id').lean();
            filter.submittedBy = { $in: uList.map(function(u) { return u._id; }) };
        }

        if (req.query.staffName && req.query.staffName.trim()) {
            var sList = await User.find({ name: { $regex: escapeRegex(req.query.staffName.trim()), $options: 'i' }, role: 'staff' }).select('_id').lean();
            filter.assignedTo = { $in: sList.map(function(s) { return s._id; }) };
        }

        if (req.query.search && req.query.search.trim()) {
            filter.$or = [
                { title:       { $regex: escapeRegex(req.query.search), $options: 'i' } },
                { description: { $regex: escapeRegex(req.query.search), $options: 'i' } },
                { complaintId: { $regex: escapeRegex(req.query.search), $options: 'i' } }
            ];
        }

        if (req.query.dateFrom || req.query.dateTo) {
            filter.createdAt = {};
            if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) {
                var d = new Date(req.query.dateTo); d.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = d;
            }
        }

        var complaints = await Complaint.find(filter)
            .populate('submittedBy', 'name email phone')
            .populate('assignedTo',  'name email phone')
            .populate('assignedBy',  'name email')
            .populate('category',    'name')
            .sort({ createdAt: -1 });

        return res.json({ success: true, complaints: complaints });
    } catch (err) {
        console.error('getAllComplaints error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── UPDATE COMPLAINT ───────────────────────────────────────────
async function updateComplaint(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var status    = req.body.status    || '';
        var adminNote = req.body.adminNote;   // undefined means not sent
        var priority  = req.body.priority  || '';

        var complaint = await Complaint.findById(req.params.id)
            .populate('submittedBy', 'name email phone')
            .populate('category',   'name');
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });

        await ensureComplaintId(complaint);

        var adminName     = req.session.name || 'Admin';
        var adminAllowed  = ['Under Review', 'Rejected']; // 'Assigned' only set via /assign route which sends proper emails
        var statusChanged = false;

        if (status && status !== complaint.status) {
            if (!adminAllowed.includes(status))
                return res.status(400).json({ success: false, message: 'Admin can only set: Under Review, Rejected. Use the Assign button to assign to staff.' });
            complaint.statusHistory.push({
                status:        status,
                changedBy:     adminName,
                changedByRole: 'admin',
                note:          (typeof adminNote === 'string' && adminNote.trim()) ? adminNote.trim() : 'Status updated by admin',
                date:          new Date()
            });
            complaint.status = status;
            statusChanged    = true;
        }

        if (typeof adminNote === 'string') complaint.adminNote = adminNote;
        if (priority)                      complaint.priority  = priority;

        await complaint.save();

        // Email ONLY when status changed — note-only saves are silent
        if (statusChanged) {
            try {
                await mailer.sendStatusUpdate(
                    complaint.submittedBy.email,
                    complaint.submittedBy.name,
                    complaint
                );
            } catch (e) { console.log('Status email failed:', e.message); }
        }

        return res.json({ success: true, message: 'Complaint updated.', complaint: complaint });
    } catch (err) {
        console.error('updateComplaint error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── DELETE COMPLAINT ───────────────────────────────────────────
async function deleteComplaint(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var c = await Complaint.findByIdAndDelete(req.params.id);
        if (!c) return res.status(404).json({ success: false, message: 'Complaint not found.' });
        await AssignmentLog.deleteMany({ complaint: c._id });
        return res.json({ success: true, message: 'Complaint deleted.' });
    } catch (err) {
        console.error('deleteComplaint error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── ASSIGN COMPLAINT TO STAFF ──────────────────────────────────
async function assignComplaint(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var staffId = req.body.staffId;
        if (!staffId || !mongoose.Types.ObjectId.isValid(staffId))
            return res.status(400).json({ success: false, message: 'Invalid staff ID. Select a staff member from the dropdown.' });

        var staffMember = await User.findOne({ _id: staffId, role: 'staff' });
        if (!staffMember)
            return res.status(404).json({ success: false, message: 'Staff member not found. Their role may have changed.' });

        var complaint = await Complaint.findById(req.params.id)
            .populate('submittedBy', 'name email phone')
            .populate('category',   'name');
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });

        // Guard: block re-assigning to the same staff member to prevent duplicate emails
        if (complaint.assignedTo && String(complaint.assignedTo) === String(staffId))
            return res.status(400).json({ success: false, message: 'Already assigned to this staff member.' });

        await ensureComplaintId(complaint);

        // Save populated user data NOW — before complaint.save() which replaces
        // populated objects with raw ObjectIDs, losing name/email/phone
        var submittedByUser = {
            _id:   complaint.submittedBy._id,
            name:  complaint.submittedBy.name,
            email: complaint.submittedBy.email,
            phone: complaint.submittedBy.phone
        };

        var adminId   = req.session.userId;
        var adminName = req.session.name || 'Admin';
        var now       = new Date();

        complaint.assignedTo  = staffId;
        complaint.assignedBy  = adminId;
        complaint.assignedAt  = now;
        complaint.status      = 'Assigned';
        complaint.statusHistory.push({
            status:        'Assigned',
            changedBy:     adminName,
            changedByRole: 'admin',
            note:          'Assigned to ' + staffMember.name + (staffMember.phone ? ' | Contact: ' + staffMember.phone : ''),
            date:          now
        });
        await complaint.save();

        await AssignmentLog.create({
            complaintId: complaint.complaintId,
            complaint:   complaint._id,
            user:        submittedByUser._id,
            assignedBy:  adminId,
            assignedTo:  staffId,
            assignedAt:  now,
            status:      'Assigned'
        });

        try { await mailer.sendAssignmentToUser(submittedByUser.email, submittedByUser.name, complaint, staffMember); }
        catch (e) { console.log('User email failed:', e.message); }

        try { await mailer.sendAssignmentToStaff(staffMember.email, staffMember.name, complaint, submittedByUser); }
        catch (e) { console.log('Staff email failed:', e.message); }

        await complaint.populate('assignedTo', 'name email phone');

        return res.json({ success: true, message: 'Assigned to ' + staffMember.name + '.', complaint: complaint });
    } catch (err) {
        console.error('assignComplaint error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── CONFIRM RESOLUTION ─────────────────────────────────────────
async function confirmResolution(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid complaint ID.' });

        var complaint = await Complaint.findById(req.params.id)
            .populate('submittedBy', 'name email phone')
            .populate('category',   'name');
        if (!complaint)
            return res.status(404).json({ success: false, message: 'Complaint not found.' });
        if (complaint.status !== 'Resolved')
            return res.status(400).json({ success: false, message: 'Complaint must be Resolved before confirming.' });

        var now = new Date();
        complaint.status                = 'Closed';
        complaint.completionConfirmed   = true;
        complaint.completionConfirmedAt = now;
        complaint.statusHistory.push({
            status: 'Closed', changedBy: req.session.name || 'Admin', changedByRole: 'admin',
            note: 'Admin confirmed resolution — case closed', date: now
        });
        await complaint.save();

        await AssignmentLog.findOneAndUpdate(
            { complaint: complaint._id },
            { status: 'Closed', completedAt: now },
            { sort: { assignedAt: -1 }, new: true }
        );

        try { await mailer.sendResolutionConfirmation(complaint.submittedBy.email, complaint.submittedBy.name, complaint); }
        catch (e) { console.log('Resolution email failed:', e.message); }

        return res.json({ success: true, message: 'Confirmed. Case closed. User notified.', complaint: complaint });
    } catch (err) {
        console.error('confirmResolution error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


// ── ASSIGNMENT LOGS ────────────────────────────────────────────
async function getAssignmentLogs(req, res) {
    try {
        var filter = {};
        if (req.query.status && req.query.status !== '') filter.status = req.query.status;
        if (req.query.staffId && mongoose.Types.ObjectId.isValid(req.query.staffId)) filter.assignedTo = req.query.staffId;
        if (req.query.userId  && mongoose.Types.ObjectId.isValid(req.query.userId))  filter.user       = req.query.userId;
        if (req.query.dateFrom || req.query.dateTo) {
            filter.assignedAt = {};
            if (req.query.dateFrom) filter.assignedAt.$gte = new Date(req.query.dateFrom);
            if (req.query.dateTo) {
                var d = new Date(req.query.dateTo); d.setHours(23, 59, 59, 999);
                filter.assignedAt.$lte = d;
            }
        }
        var logs = await AssignmentLog.find(filter)
            .populate('complaint',  'title complaintId priority status')
            .populate('user',       'name email phone')
            .populate('assignedBy', 'name email')
            .populate('assignedTo', 'name email phone')
            .sort({ assignedAt: -1 });
        return res.json({ success: true, logs: logs });
    } catch (err) {
        console.error('getAssignmentLogs error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function getAllStaff(req, res) {
    try {
        var staff = await User.find({ role: 'staff' }).select('name email phone').lean();
        return res.json({ success: true, staff: staff });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function getStats(req, res) {
    try {
        var r = await Promise.all([
            Complaint.countDocuments(),
            Complaint.countDocuments({ status: 'Submitted' }),
            Complaint.countDocuments({ status: 'Under Review' }),
            Complaint.countDocuments({ status: 'Assigned' }),
            Complaint.countDocuments({ status: 'In Progress' }),
            Complaint.countDocuments({ status: 'Resolved' }),
            Complaint.countDocuments({ status: 'Closed' }),
            User.countDocuments({ role: 'user' }),
            User.countDocuments({ role: 'staff' })
        ]);
        return res.json({ success: true, stats: {
            total: r[0], submitted: r[1], underReview: r[2], assigned: r[3],
            inProgress: r[4], resolved: r[5], closed: r[6], totalUsers: r[7], totalStaff: r[8]
        }});
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function exportCSV(req, res) {
    try {
        var filter = {};
        if (req.query.status   && req.query.status   !== '') filter.status   = req.query.status;
        if (req.query.priority && req.query.priority !== '') filter.priority = req.query.priority;
        if (req.query.category && req.query.category !== '') {
            if (mongoose.Types.ObjectId.isValid(req.query.category)) filter.category = req.query.category;
        }
        var list = await Complaint.find(filter)
            .populate('submittedBy', 'name email phone')
            .populate('assignedTo',  'name phone')
            .populate('category',    'name')
            .sort({ createdAt: -1 });

        function cv(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
        function fd(dt) {
            if (!dt) return '';
            var ist = new Date(dt.getTime() + 19800000);
            var p   = function(n) { return n < 10 ? '0' + n : '' + n; };
            return ist.getUTCFullYear() + '-' + p(ist.getUTCMonth()+1) + '-' + p(ist.getUTCDate()) +
                   ' ' + p(ist.getUTCHours()) + ':' + p(ist.getUTCMinutes());
        }
        var header = ['Complaint ID','Title','Category','Priority','Status',
                      'Submitted By','Email','Phone','Assigned To','Staff Phone','Note','Created At'];
        var rows = list.map(function(x) {
            return [cv(x.complaintId), cv(x.title), cv(x.category ? x.category.name : ''),
                    cv(x.priority), cv(x.status),
                    cv(x.submittedBy ? x.submittedBy.name  : ''),
                    cv(x.submittedBy ? x.submittedBy.email : ''),
                    cv(x.submittedBy ? x.submittedBy.phone : ''),
                    cv(x.assignedTo  ? x.assignedTo.name  : 'Unassigned'),
                    cv(x.assignedTo  ? x.assignedTo.phone : ''),
                    cv(x.adminNote || ''), cv(fd(x.createdAt))].join(',');
        });
        var csv = [header.map(cv).join(',')].concat(rows).join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="complaints.csv"');
        return res.send(csv);
    } catch (err) {
        console.error('exportCSV error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function getAllUsers(req, res) {
    try {
        var users = await User.find({}).select('name email role createdAt phone').sort({ createdAt: -1 }).lean();
        return res.json({ success: true, users: users });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function changeUserRole(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });

        var newRole = req.body.role;
        if (!['user', 'admin', 'staff'].includes(newRole))
            return res.status(400).json({ success: false, message: 'Invalid role.' });
        if (String(req.params.id) === String(req.session.userId))
            return res.status(400).json({ success: false, message: 'You cannot change your own role.' });

        var user = await User.findByIdAndUpdate(
            req.params.id, { role: newRole }, { new: true }
        ).select('name email role phone');
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        return res.json({
            success: true,
            message: user.name + ' is now "' + newRole + '". They can log in to the ' + newRole + ' portal now.',
            user:    user
        });
    } catch (err) {
        console.error('changeUserRole error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}


async function getCategories(req, res) {
    try {
        var cats = await Category.find({}).sort({ name: 1 });
        return res.json({ success: true, categories: cats });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}

async function addCategory(req, res) {
    try {
        var name        = (req.body.name        || '').trim();
        var description = (req.body.description || '').trim();
        if (!name || name.length < 2)
            return res.status(400).json({ success: false, message: 'Category name must be at least 2 characters.' });
        var ex = await Category.findOne({ name: { $regex: new RegExp('^' + escapeRegex(name) + '$', 'i') } });
        if (ex) return res.status(400).json({ success: false, message: 'Category already exists.' });
        var cat = await Category.create({ name: name, description: description });
        return res.status(201).json({ success: true, message: 'Category added.', category: cat });
    } catch (err) {
        console.error('addCategory error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}

async function deleteCategory(req, res) {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ success: false, message: 'Invalid category ID.' });
        var inUse = await Complaint.findOne({ category: req.params.id });
        if (inUse) return res.status(400).json({ success: false, message: 'Cannot delete: used by existing complaints.' });
        var cat = await Category.findByIdAndDelete(req.params.id);
        if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
        return res.json({ success: true, message: 'Category deleted.' });
    } catch (err) {
        console.error('deleteCategory error:', err.message);
        return res.status(500).json({ success: false, message: err.message || 'Server error.' });
    }
}

module.exports = {
    getAllComplaints, updateComplaint, deleteComplaint,
    assignComplaint,  confirmResolution, getAssignmentLogs,
    getAllStaff, getStats, exportCSV,
    getAllUsers, changeUserRole,
    getCategories, addCategory, deleteCategory
};
