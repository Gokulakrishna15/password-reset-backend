const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true,
    trim: true,
    minlength: 3
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8
  },
  resetToken: {
    type: String,
    default: undefined
  },
  resetTokenExpiry: {
    type: Date,
    default: undefined
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);