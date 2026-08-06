// routes/authRoutes.js

var express        = require('express');
var router         = express.Router();
var authController  = require('../controllers/authController');
var Category        = require('../models/Category');
var authMiddleware  = require('../middleware/authMiddleware');
var isAuthenticated = authMiddleware.isAuthenticated;

// Public routes
router.post('/register', authController.register);
router.post('/login',    authController.login);
router.post('/logout',   authController.logout);
router.get('/session',   authController.getSession);

// Public: get categories for the complaint form dropdown
// Any logged-in user needs this
router.get('/categories', isAuthenticated, async function(req, res) {
    try {
        var categories = await Category.find({}).sort({ name: 1 });
        return res.json({ success: true, categories: categories });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Could not load categories.' });
    }
});

// Protected routes
router.get('/profile',         isAuthenticated, authController.getProfile);
router.put('/profile',         isAuthenticated, authController.updateProfile);
router.put('/change-password', isAuthenticated, authController.changePassword);

module.exports = router;
