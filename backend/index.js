const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const userRoutes = require("./Routes/UserRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const messageRoutes = require("./Routes/messageRoutes");
const styleRoutes = require("./Routes/styleRoutes");
const { notFound, errorHandler } = require("./Middleware/errorMiddleware");
const path = require("path");
const jwt = require("jsonwebtoken");
const UserModel = require("./Models/UserModel");
const presenceStore = {
  userSockets: new Map(),
  lastSeen: new Map(),
  isOnline(userId) {
    const set = this.userSockets.get(String(userId));
    return !!(set && set.size);
  },
  markOnline(userId, socketId) {
    userId = String(userId);
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId).add(socketId);
  },
  markOffline(userId, socketId) {
    userId = String(userId);
    const set = this.userSockets.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.userSockets.delete(userId);
      this.lastSeen.set(userId, Date.now());
      return true;
    }
    return false;
  },
};

const FRONTEND_URL = process.env.FRONTEND_URL;
const app = express();
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`listening at port ${PORT}...`);
});

const socketIO = require("socket.io");
const io = socketIO(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
  pingTimeout: 60000,
});
app.set("io", io);
app.set("presenceStore", presenceStore);
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = await UserModel.findById(decoded.id).select("-password");
    if(!socket.user) {
      return next(new Error("Authentication error: User not found"));
    }
    next();
  } catch (error) {
    next(new Error("Authentication error: Invalid token"));
  }
});

io.on("connection", (socket) => {
  console.log(
    `Connection from ${socket.handshake.address} at with id: ${socket.id}`
  );
  socket.on("setup", (user) => {
    
    socket.join(socket.user._id.toString());
    console.log("server :// joined user:", socket.user._id.toString());
    presenceStore.markOnline(socket.user._id.toString(), socket.id);
    io.emit("presence:update", { userId: socket.user._id.toString(), online: true, lastSeen: null });
    socket.emit("connected");
  });
  socket.on("join chat", (room) => {
    socket.join(room);
  });
  socket.on("typing", (room) => socket.in(room).emit("typing", room));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing", room));

  socket.on("newMessage", (newMessageStatus) => {
    console.log("[socket] got new message:", newMessageStatus);
    var chat = newMessageStatus.chat;
    if (!chat.users) {
      return console.log("chat.users not defined");
    }
    chat.users.forEach((user) => {
      if (user._id == newMessageStatus.sender._id) return;
      console.log(
        "[socket] emit message recieved to ",
        user._id,
        newMessageStatus
      );
      socket.in(user._id).emit("message recieved", newMessageStatus);
    });
  });
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.user, socket.id);
    const userId = socket?.user?._id?.toString() || null;
    if(!userId) return;
    const wentOffline = presenceStore.markOffline(userId, socket.id);
      if (wentOffline) {
        io.emit("presence:update", {
          userId,
          online: false,
          lastSeen: presenceStore.lastSeen.get(userId) || Date.now(),
        });
      }
  });
});

const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use("/user", userRoutes);
app.use("/chat", chatRoutes);
app.use("/message", messageRoutes);
app.use("/api/style", styleRoutes);
app.use(notFound);
app.use(errorHandler);
