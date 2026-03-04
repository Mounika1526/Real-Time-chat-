const express = require("express");
const asyncHandler = require("express-async-handler");
const UserModel = require("../Models/UserModel");
const generateToken = require("../Config/generateToken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/avatars/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      req.user.id + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const loginController = asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    res.status(400);
    throw new Error("No required fields for Login...");
  }
  const user = await UserModel.findOne({ name });
  if (user && (await user.matchPassword(password))) {
    const resData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
      encryptedPrivateKey: user.encryptedPrivateKey,
      salt: user.salt,
      iv: user.iv,
    };
    res.status(200).json(resData);
  } else {
    res.status(400);
    throw new Error("User name or password not Matching...");
  }
});

const registerController = asyncHandler(async (req, res) => {
  const { name, email, password, publicKey, salt, iv, encryptedPrivateKey } =
    req.body;

  if (
    !name ||
    !email ||
    !password ||
    !publicKey ||
    !salt ||
    !iv ||
    !encryptedPrivateKey
  ) {
    res.send();
    throw Error("no required fields");
  }

  const emailExists = await UserModel.findOne({ email });
  if (emailExists) {
    res.status(405);
    throw new Error("user already exits");
  }
  const nameExists = await UserModel.findOne({ name });
  if (nameExists) {
    res.status(406);
    throw new Error("username already taken");
  }

  const user = await UserModel.create({
    name,
    email,
    password,
    publicKey,
    encryptedPrivateKey,
    salt,
    iv,
    avatar: "uploads/avatars/default.png",
  });
  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("User Registration fails while creating user");
  }
});

const fetchAllUsersController = asyncHandler(async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};
  const users = await UserModel.find(keyword)
    .find({
      _id: { $ne: req.user._id },
    })
    .select("-password");
  res.send(users);
});

const uploadAvatarController = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded");
    }
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }
    if (user.avatar) {
      const oldAvatarPath = user.avatar;
      if (
        oldAvatarPath !== "uploads/avatars/default.png" &&
        fs.existsSync(oldAvatarPath)
      ) {
        fs.unlinkSync(oldAvatarPath);
      }
    }
    user.avatar = `uploads/avatars/${req.file.filename}`;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      avatar: user.avatar,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    res.status(500);
    throw new Error("Server error during avatar upload");
  }
});

const getPublicKey = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.params.userId).select("publicKey");
  if (user) {
    res.json({ publicKey: user.publicKey });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});
const getPresence = async (req, res) => {
  try {
    const store = req.app.get("presenceStore");
    const ids = String(req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) return res.json({ presence: [] });
    const presence = ids.map((id) => ({
      userId: id,
      online: store.isOnline(id),
      lastSeen: store.lastSeen.get(String(id)) || null,
    }));
    res.json({ presence });
  } catch (e) {
    console.error("getPresence error", e);
    res.status(500).json({ presence: [] });
  }
};

module.exports = {
  loginController,
  registerController,
  fetchAllUsersController,
  uploadAvatarController,
  upload,
  getPublicKey,
  getPresence,
};
