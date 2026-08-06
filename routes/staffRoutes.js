// Staff routes — only accessible by users with role 'staff'

var express = require('express');
var router = express.Router();
var staffController = require('../controllers/staffController');
var authMiddleware = require('../middleware/authMiddleware');
var isStaff = authMiddleware.isStaff;

// GET /api/staff/complaints — view complaints assigned to this staff member
router.get('/complaints', isStaff, staffController.getAssignedComplaints);

// GET /api/staff/complaints/:id — view single assigned complaint
router.get('/complaints/:id', isStaff, staffController.getComplaintById);

// PUT /api/staff/complaints/:id/status — update status (In Progress | Resolved only)
router.put('/complaints/:id/status', isStaff, staffController.updateComplaintStatus);

module.exports = router;
