const asyncHandler = require("express-async-handler");
const ChatModel = require("../Models/chatModel");
const UserModel = require("../Models/UserModel");
const MessageModel = require("../Models/messageModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const groupAvatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, req.params.chatId + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const groupAvatarUpload = multer({
  storage: groupAvatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }
  var isChat = await ChatModel.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await UserModel.populate(isChat, {
    path: "latestMessage.sender",
    select: "name email",
  });
  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };
    try {
      const createdChat = await ChatModel.create(chatData);
      const FullChat = await ChatModel.findOne({
        _id: createdChat._id,
      }).populate("users", "-password");
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

const fetchChats = asyncHandler(async (req, res) => {
  try {
    const results = await ChatModel.find({
      users: { $elemMatch: { $eq: req.user._id } },
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 });

    const populatedResults = await UserModel.populate(results, {
      path: "latestMessage.sender",
      select: "name email publicKey",
    });
    const chatsWithUnread = await Promise.all(
      populatedResults.map(async (chat) => {
        const unreadCount = await MessageModel.countDocuments({
          chat: chat._id,
          sender: { $ne: req.user.id },
          "readBy.user": { $ne: req.user.id },
        });

        return {
          ...chat.toObject(),
          unreadCount,
        };
      })
    );

    res.status(200).send(chatsWithUnread);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const fetchGroups = asyncHandler(async (req, res) => {
  try {
    const allGroups = await ChatModel.where("isGroupChat").equals(true);
    res.status(200).send(allGroups);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const createGroupChat = asyncHandler(async (req, res) => {
  const { name, groupKeys } = req.body;

  if (!name || !groupKeys) {
    return res
      .status(400)
      .send({ message: "Group name and keys are required" });
  }

  try {
    const parsedGroupKeys = JSON.parse(groupKeys);

    if (!Array.isArray(parsedGroupKeys) || parsedGroupKeys.length === 0) {
      return res.status(400).send({ message: "Invalid groupKeys format" });
    }

    const users = parsedGroupKeys.map((keyData) => keyData.userId);

    const groupChat = await ChatModel.create({
      chatName: name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
      groupKeys: parsedGroupKeys,
    });

    const fullGroupChat = await ChatModel.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const groupExit = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  const removed = await ChatModel.findByIdAndUpdate(
    chatId,
    {
      $pull: {
        users: userId,
        groupKeys: { userId: userId },
      },
    },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removed);
  }
});

const requestToJoinGroup = asyncHandler(async (req, res) => {
  const { chatId } = req.body;
  const userId = req.user._id;

  const updatedChat = await ChatModel.findByIdAndUpdate(
    chatId,
    { $addToSet: { pendingMembers: userId } },
    { new: true }
  );

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat not found");
  }
  res.status(200).send({ message: "Join request sent successfully." });
});

const approveJoinRequest = asyncHandler(async (req, res) => {
  const { chatId, newUserId, encryptedKey } = req.body;
  const adminId = req.user._id;

  const chat = await ChatModel.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }

  if (chat.groupAdmin.toString() !== adminId.toString()) {
    res.status(403);
    throw new Error("Only the group admin can approve requests.");
  }

  const updatedChat = await ChatModel.findByIdAndUpdate(
    chatId,
    {
      $pull: { pendingMembers: newUserId },
      $push: {
        users: newUserId,
        groupKeys: { userId: newUserId, key: encryptedKey },
      },
    },
    { new: true }
  ).populate("users", "-password");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat update failed");
  }
  res.status(200).json(updatedChat);
});

const getChatDetails = asyncHandler(async (req, res) => {
  try {
    const chat = await ChatModel.findById(req.params.chatId)
      .populate("users", "name avatar publicKey")
      .populate("groupAdmin", "publicKey _id")
      .populate("pendingMembers", "name avatar publicKey")
      .populate("latestMessage")
      .populate({ path: "pinnedMessages", populate: { path: "sender", select: "name" } });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error fetching chat details:", error);
    res.status(500).json({ message: "Server error" });
  }
});

const getAdminPending = asyncHandler(async (req, res) => {
  const groups = await ChatModel.find({ groupAdmin: req.user._id })
    .populate("pendingMembers", "name avatar publicKey")
    .select("chatName pendingMembers users groupAdmin");
  res.status(200).json(groups);
});

const declineJoinRequest = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  const adminId = req.user._id;

  const chat = await ChatModel.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }
  if (chat.groupAdmin.toString() !== adminId.toString()) {
    res.status(403);
    throw new Error("Only the group admin can decline requests.");
  }

  const updated = await ChatModel.findByIdAndUpdate(
    chatId,
    { $pull: { pendingMembers: userId } },
    { new: true }
  ).populate("pendingMembers", "name avatar publicKey");

  res.status(200).json(updated);
});


const removeMember = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  const adminId = req.user._id;

  const chat = await ChatModel.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }
  if (chat.groupAdmin.toString() !== adminId.toString()) {
    res.status(403);
    throw new Error("Only the group admin can remove members.");
  }
  if (userId === adminId.toString()) {
    res.status(400);
    throw new Error("Admin cannot remove themselves. Use group exit.");
  }

  const updated = await ChatModel.findByIdAndUpdate(
    chatId,
    { $pull: { users: userId, groupKeys: { userId } } },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  const io = req.app.get("io");
  if (io) {
    io.to(userId).emit("removed:fromGroup", { chatId });
  }

  res.status(200).json(updated);
});

const promoteAdmin = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  const adminId = req.user._id;

  const chat = await ChatModel.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }
  if (chat.groupAdmin.toString() !== adminId.toString()) {
    res.status(403);
    throw new Error("Only the current admin can promote members.");
  }

  const updated = await ChatModel.findByIdAndUpdate(
    chatId,
    { groupAdmin: userId },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  const io = req.app.get("io");
  if (io) {
    io.to(chatId).emit("admin:changed", { chatId, newAdminId: userId });
  }

  res.status(200).json(updated);
});

const updateGroupInfo = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const adminId = req.user._id;

  const chat = await ChatModel.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }
  if (chat.groupAdmin.toString() !== adminId.toString()) {
    res.status(403);
    throw new Error("Only the group admin can update group info.");
  }

  const update = {};
  if (req.body.chatName) update.chatName = req.body.chatName;
  if (req.body.description !== undefined) update.description = req.body.description;
  if (req.file) update.groupAvatar = "uploads/avatars/" + req.file.filename;

  const updated = await ChatModel.findByIdAndUpdate(chatId, update, { new: true })
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  const io = req.app.get("io");
  if (io) {
    io.to(chatId).emit("group:updated", updated);
  }

  res.status(200).json(updated);
});

const pinMessage = asyncHandler(async (req, res) => {
  const { chatId, messageId } = req.params;
  const adminId = req.user._id;

  const chat = await ChatModel.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }
  if (chat.groupAdmin.toString() !== adminId.toString()) {
    res.status(403);
    throw new Error("Only the group admin can pin messages.");
  }

  const updated = await ChatModel.findByIdAndUpdate(
    chatId,
    { $addToSet: { pinnedMessages: messageId } },
    { new: true }
  ).populate("pinnedMessages");

  const io = req.app.get("io");
  if (io) {
    io.to(chatId).emit("message:pinned", { chatId, messageId });
  }

  res.status(200).json(updated);
});

const unpinMessage = asyncHandler(async (req, res) => {
  const { chatId, messageId } = req.params;
  const adminId = req.user._id;

  const chat = await ChatModel.findById(chatId);
  if (!chat) {
    res.status(404);
    throw new Error("Chat not found");
  }
  if (chat.groupAdmin.toString() !== adminId.toString()) {
    res.status(403);
    throw new Error("Only the group admin can unpin messages.");
  }

  const updated = await ChatModel.findByIdAndUpdate(
    chatId,
    { $pull: { pinnedMessages: messageId } },
    { new: true }
  ).populate("pinnedMessages");

  const io = req.app.get("io");
  if (io) {
    io.to(chatId).emit("message:unpinned", { chatId, messageId });
  }

  res.status(200).json(updated);
});

module.exports = {
  accessChat,
  fetchChats,
  fetchGroups,
  createGroupChat,
  groupExit,
  requestToJoinGroup,
  approveJoinRequest,
  getChatDetails,
  getAdminPending,
  declineJoinRequest,
  removeMember,
  promoteAdmin,
  updateGroupInfo,
  pinMessage,
  unpinMessage,
  groupAvatarUpload,
};
