// routes/adminRoutes.js

var express         = require('express');
var router          = express.Router();
var adminController = require('../controllers/adminController');
var authMiddleware  = require('../middleware/authMiddleware');
var isAdmin         = authMiddleware.isAdmin;

// Complaints
router.get('/complaints',                     isAdmin, adminController.getAllComplaints);
router.put('/complaints/:id',                 isAdmin, adminController.updateComplaint);
router.delete('/complaints/:id',              isAdmin, adminController.deleteComplaint);
router.post('/complaints/:id/assign',         isAdmin, adminController.assignComplaint);
router.post('/complaints/:id/confirm-resolution', isAdmin, adminController.confirmResolution);

// Assignment tracking log
router.get('/assignment-logs',                isAdmin, adminController.getAssignmentLogs);

// Staff, stats, CSV
router.get('/staff',                          isAdmin, adminController.getAllStaff);
router.get('/stats',                          isAdmin, adminController.getStats);
router.get('/export-csv',                     isAdmin, adminController.exportCSV);

// Users
router.get('/users',                          isAdmin, adminController.getAllUsers);
router.put('/users/:id/role',                 isAdmin, adminController.changeUserRole);

// Categories
router.get('/categories',                     isAdmin, adminController.getCategories);
router.post('/categories',                    isAdmin, adminController.addCategory);
router.delete('/categories/:id',              isAdmin, adminController.deleteCategory);

module.exports = router;
