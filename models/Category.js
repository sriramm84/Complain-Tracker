// models/Category.js
// Separate Category model — admin can add/delete categories
// Complaint stores category as ObjectId reference to this model

var mongoose = require('mongoose');

var categorySchema = new mongoose.Schema({

    // Category name — must be unique
    name: {
        type:      String,
        required:  [true, 'Category name is required'],
        trim:      true,
        unique:    true,
        minlength: [2, 'Category name must be at least 2 characters'],
        maxlength: [50, 'Category name cannot exceed 50 characters']
    },

    // Optional description of what this category covers
    description: {
        type:    String,
        default: ''
    }

}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
