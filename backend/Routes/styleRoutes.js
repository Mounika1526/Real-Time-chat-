const express = require("express");
const {
  analyzeUserStyle,
  createOrUpdateStyleProfile,
  summarizeUnread,
} = require("../Controllers/StyleController");
const { protect } = require("../Middleware/authMiddleware");

const router = express.Router();

router.post("/analyze", protect, analyzeUserStyle);
router.post("/create-profile", protect, createOrUpdateStyleProfile);
router.post("/summarize-unread", protect, summarizeUnread);

module.exports = router;
