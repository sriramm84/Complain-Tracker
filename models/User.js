// models/User.js

var mongoose = require('mongoose');
var bcrypt   = require('bcryptjs');

var userSchema = new mongoose.Schema({

    name: {
        type:      String,
        required:  [true, 'Name is required'],
        trim:      true,
        minlength: [2, 'Name must be at least 2 characters'],
        match:     [/^[a-zA-Z\s]+$/, 'Name must contain only letters']
    },

    email: {
        type:      String,
        required:  [true, 'Email is required'],
        unique:    true,
        lowercase: true,
        match:     [/^\S+@\S+\.\S+$/, 'Enter a valid email']
    },

    password: {
        type:      String,
        required:  [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },

    // Phone is collected at registration and profile update (validated at API level).
    // NOT required at schema level so existing users without phone are not broken.
    phone: {
        type:    String,
        default: ''
    },

    role: {
        type:    String,
        enum:    ['user', 'admin', 'staff'],
        default: 'user'
    },

    otp: {
        type:    String,
        default: null
    },

    otpExpiry: {
        type:    Date,
        default: null
    }

}, { timestamps: true });


userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function(candidate) {
    return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
