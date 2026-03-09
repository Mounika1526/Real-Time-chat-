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
  removeMember,
  promoteAdmin,
  updateGroupInfo,
  pinMessage,
  unpinMessage,
  groupAvatarUpload,
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
router.route("/remove-member").put(protect, removeMember);
router.route("/promote-admin").put(protect, promoteAdmin);
router.route("/:chatId").put(protect, groupAvatarUpload.single("groupAvatar"), updateGroupInfo);
router.route("/:chatId/pin/:messageId").post(protect, pinMessage);
router.route("/:chatId/pin/:messageId").delete(protect, unpinMessage);

module.exports = router;