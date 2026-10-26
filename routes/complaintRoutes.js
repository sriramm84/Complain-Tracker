// Complaint routes for regular users

var express = require('express');
var router = express.Router();
var complaintController = require('../controllers/complaintController');
var authMiddleware = require('../middleware/authMiddleware');
var isAuthenticated = authMiddleware.isAuthenticated;
var multer = require('multer');
var path = require('path');
var fs = require('fs');

// FEATURE 4: Multer storage config — saves files to uploads/ (outside public/,
// served only to permitted users by routes/uploadRoutes.js)
var uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

var storage = multer.diskStorage({
    destination: function(req, file, cb) { cb(null, uploadDir); },
    filename: function(req, file, cb) {
        var ext = path.extname(file.originalname);
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    }
});

var upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: function(req, file, cb) {
        var allowed = /jpeg|jpg|png|gif|pdf|doc|docx/;
        var ok = allowed.test(path.extname(file.originalname).toLowerCase());
        if (ok) return cb(null, true);
        cb(new Error('Only images and documents are allowed'));
    }
});

// POST /api/complaints — submit new complaint (with optional file)
router.post('/', isAuthenticated, upload.single('attachment'), complaintController.submitComplaint);

// GET /api/complaints/my — get my complaints (search + filter)
router.get('/my', isAuthenticated, complaintController.getMyComplaints);

// POST /api/complaints/:id/request-otp — FEATURE 8: request OTP before editing
router.post('/:id/request-otp', isAuthenticated, complaintController.requestEditOtp);

// PUT /api/complaints/:id — FEATURE 8: update complaint after OTP verification
router.put('/:id', isAuthenticated, complaintController.updateComplaintWithOtp);

// GET /api/complaints/:id — get single complaint detail
router.get('/:id', isAuthenticated, complaintController.getComplaintById);

// DELETE /api/complaints/:id — delete my pending complaint
router.delete('/:id', isAuthenticated, complaintController.deleteComplaint);

module.exports = router;
