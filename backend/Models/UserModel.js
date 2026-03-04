const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userModel = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    publicKey: {
      type: String,
    },
    encryptedPrivateKey: { type: String },
    salt: { type: String },
    iv: { type: String },
    styleProfile: {
      type: Object,
    }
  },
  {
    timestamps: true,
  }
);

userModel.methods.matchPassword = async function (givenPassword) {
  return await bcrypt.compare(givenPassword, this.password);
};

userModel.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
const User = mongoose.model("User", userModel);
module.exports = User;
