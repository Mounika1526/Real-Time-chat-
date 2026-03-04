const asyncHandler = require("express-async-handler");
const MessageModel = require("../Models/messageModel");
const UserModel = require("../Models/UserModel");
const ChatModel = require("../Models/chatModel");
const allMessages = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const messages = await MessageModel.find({ chat: req.params.chatId })
      .populate("sender", "_id name avatar publicKey")
      .populate("receiver")
      .populate("readBy.user", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const count = await MessageModel.countDocuments({
      chat: req.params.chatId,
    });

    res.json({
      messages: messages,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const markMessagesAsRead = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    await MessageModel.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;
  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
    readBy: [{ user: req.user.id, readAt: new Date() }],
  };
  try {
    var message = await MessageModel.create(newMessage);
    message = await message.populate("sender", "name avatar publicKey");
    message = await message.populate("chat");
    message = await message.populate("receiver");
    message = await UserModel.populate(message, {
      path: "chat.users",
      select: "name email",
    });
    const cm = await ChatModel.findByIdAndUpdate(req.body.chatId, {
      latestMessage: message,
    });
    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const deleteAllMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  try {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    const isUserInChat = chat.users.some((user) => user.toString() === userId);
    if (!isUserInChat) {
      return res.status(403).json({
        message: "You don't have permission to delete messages in this chat",
      });
    }

    if (chat.isGroupChat) {
      const isGroupAdmin =
        chat.groupAdmin && chat.groupAdmin._id.toString() === userId;
      if (!isGroupAdmin) {
        return res
          .status(403)
          .json({ message: "Only group admin can delete group conversations" });
      }
    }
    await MessageModel.deleteMany({ chat: chatId });
    await ChatModel.findByIdAndUpdate(chatId, {
      latestMessage: null,
    });

    const io = req.app.get("io");
    if (io) {
      io.to(chatId).emit("conversationDeleted", {
        chatId,
        deletedBy: userId,
      });
      console.log(`Emitted 'conversationDeleted' event to room: ${chatId}`);
    }

    res.json({ message: "All messages deleted successfully" });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});
const getLatestUserMessages = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await MessageModel.find({ sender: userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({
        path: "chat",
        select: "users",
      })
      .populate("sender", "_id name avatar");

    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const getUnreadMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const userId = req.user._id;
  const msgs = await MessageModel.find({
    chat: chatId,
    sender: { $ne: userId },
    "readBy.user": { $ne: userId },
  })
    .populate("sender", "name avatar publicKey")
    .sort({ createdAt: 1 })
    .limit(parseInt(req.query.limit || 50, 10));

  res.status(200).json({ messages: msgs });
});


module.exports = {
  allMessages,
  sendMessage,
  markMessagesAsRead,
  deleteAllMessages,
  getLatestUserMessages,
  getUnreadMessages,
};
