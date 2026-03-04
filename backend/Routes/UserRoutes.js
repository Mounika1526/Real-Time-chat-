const express = require("express");
const {
  loginController,
  registerController,
  fetchAllUsersController,
  uploadAvatarController,
  upload,
  getPublicKey,
  getPresence,
} = require("../Controllers/UserController");
const { protect } = require("../Middleware/authMiddleware");

const Router = express.Router();

Router.post("/login", loginController);
Router.post("/register", registerController);
Router.get("/fetchUsers", protect, fetchAllUsersController);
Router.post(
  "/upload-avatar",
  protect,
  upload.single("avatar"),
  uploadAvatarController
);
Router.get("/publicKey/:userId", protect, getPublicKey);
Router.get("/presence", protect, getPresence);
module.exports = Router;
