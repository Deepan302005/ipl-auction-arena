const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      select: false
    },
    isGuest: {
      type: Boolean,
      default: false
    },
    guestId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    sessionSecret: {
      type: String,
      select: false
    },
    favoriteTeam: {
      type: String,
      default: 'CSK',
      enum: ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'SRH', 'GT', 'LSG', 'PBKS']
    },
    avatar: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
