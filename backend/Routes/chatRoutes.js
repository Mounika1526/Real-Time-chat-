const express = require("express");
const {
  accessChat,
  fetchChats,
  createGroupChat,
  fetchGroups,
  groupExit,
  getChatDetails,
  requestToJoinGroup,
  approveJoinRequest,
  getAdminPending,
  declineJoinRequest,
} = require("../Controllers/ChatController");
const { protect } = require("../Middleware/authMiddleware");

const router = express.Router();

router.route("/").post(protect, accessChat);
router.route("/").get(protect, fetchChats);
router.route("/createGroup").post(protect, createGroupChat);
router.route("/fetchGroups").get(protect, fetchGroups);
router.route("/groupExit").put(protect, groupExit);
router.route("/details/:chatId").get(protect, getChatDetails);
router.route("/request-join").post(protect, requestToJoinGroup);
router.route("/approve-join").post(protect, approveJoinRequest);
router.route("/decline-join").post(protect, declineJoinRequest);
router.route("/admin/pending").get(protect, getAdminPending);

module.exports = router;