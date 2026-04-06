/**
 * models/User.js
 * Mongoose schema and model for registered users.
 *
 * Fields:
 *   username   — display name shown in the chat UI
 *   email      — unique login identifier
 *   password   — bcrypt-hashed before saving
 *   profilePic — optional avatar URL
 *   timestamps — createdAt / updatedAt added automatically
 */

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type:     String,
      required: [true, "Username is required"],
      trim:     true,
    },

    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
    },

    password: {
      type:     String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },

    profilePic: {
      type:    String,
      default: "",
    },

    // ── Password reset ─────────────────────────────────────────────────────────
    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpire: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/* ── Pre-save middleware ────────────────────────────────────────────────────── */

/**
 * Hash password before persisting.
 * Only runs when the password field has been modified/created.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt    = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ── Instance methods ───────────────────────────────────────────────────────── */

/**
 * matchPassword — compare a plain-text password against the stored hash.
 * @param {string} enteredPassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/**
 * toSafeObject — return a plain object safe to send to the client
 * (password is excluded).
 */
userSchema.methods.toSafeObject = function () {
  return {
    id:         this._id.toString(),
    username:   this.username,
    email:      this.email,
    profilePic: this.profilePic,
    createdAt:  this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
