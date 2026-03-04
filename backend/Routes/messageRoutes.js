const express = require("express");
const {
  allMessages,
  sendMessage,
  markMessagesAsRead,
  deleteAllMessages,
  getLatestUserMessages,
} = require("../Controllers/messageController");
const { protect } = require("../Middleware/authMiddleware");
const { getUnreadMessages } = require("../Controllers/messageController");
const router = express.Router();
router.route("/latest-user-messages").get(protect, getLatestUserMessages);
router.route("/:chatId").get(protect, allMessages);
router.route("/").post(protect, sendMessage);
router.route("/mark-read/:chatId").put(protect, markMessagesAsRead);
router.route("/delete-all/:chatId").delete(protect, deleteAllMessages);
router.route("/unread/:chatId").get(protect, getUnreadMessages);
module.exports = router;
