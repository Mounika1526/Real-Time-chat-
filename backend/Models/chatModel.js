const mongoose = require("mongoose");

const chatModel = mongoose.Schema(
  {
    chatName: { type: String },
    isGroupChat: { type: Boolean },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupKeys: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        key: { type: String },
      },
    ],
    pendingMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Chart = mongoose.model("Chat", chatModel);
module.exports = Chart;
