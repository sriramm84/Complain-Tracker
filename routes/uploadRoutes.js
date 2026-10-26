// routes/uploadRoutes.js
// Serves complaint attachments only to the submitter, the assigned staff member, or an admin.
// Files live in uploads/ (not public/) so they cannot be fetched without these checks.

var express         = require('express');
var router          = express.Router();
var path            = require('path');
var Complaint       = require('../models/Complaint');
var authMiddleware  = require('../middleware/authMiddleware');
var isAuthenticated = authMiddleware.isAuthenticated;

var uploadDir = path.join(__dirname, '../uploads');

// GET /uploads/:file — attachment path stored on the complaint is '/uploads/<file>'
router.get('/:file', isAuthenticated, async function(req, res) {
    try {
        var file = path.basename(req.params.file);
        var complaint = await Complaint.findOne({ attachment: '/uploads/' + file })
            .select('submittedBy assignedTo').lean();
        if (!complaint)
            return res.status(404).json({ success: false, message: 'File not found.' });

        var userId  = String(req.session.userId);
        var allowed = req.session.role === 'admin'
            || String(complaint.submittedBy) === userId
            || (complaint.assignedTo && String(complaint.assignedTo) === userId);
        if (!allowed)
            return res.status(403).json({ success: false, message: 'You do not have access to this file.' });

        return res.sendFile(file, { root: uploadDir }, function(err) {
            if (err && !res.headersSent)
                res.status(404).json({ success: false, message: 'File not found.' });
        });
    } catch (err) {
        console.error('serve upload error:', err.message);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
