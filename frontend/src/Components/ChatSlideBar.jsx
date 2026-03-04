import React, { useContext, useState, useRef, useEffect } from "react";
import NightlightIcon from "@mui/icons-material/Nightlight";
import SearchIcon from "@mui/icons-material/Search";
import {
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import SummarizeIcon from "../assets/Document.json";
import Lottie from "lottie-react";
import Toaster from "./Toaster";
import LightModeIcon from "@mui/icons-material/LightMode";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import Badge from "@mui/material/Badge";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../Features/ThemeSlice";
import axios from "axios";
import {
  refreshContext,
  refreshChatSlideBarContext,
  SocketContext,
  MobileContext,
} from "./Main";
import {
  decryptMessage as decryptUtil,
  decryptGroupMessage,
} from "../utils/crypto";
import nacl from "tweetnacl";
import { decodeBase64 } from "tweetnacl-util";
function ChatSlideBar() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { socket } = useContext(SocketContext);
  const [conversations, setConversations] = useState([]);
  const navigate = useNavigate();
  const lightTheme = useSelector((state) => state.themeKey);
  const dispatch = useDispatch();
  const userData = JSON.parse(localStorage.getItem("userData"));
  const { refresh, setRefresh } = useContext(refreshContext);
  const { refreshChatSlideBar, setRefreshChatSlideBar } = useContext(
    refreshChatSlideBarContext
  );
  const { isMobile, showChatInMobile, setShowChatInMobile } =
    useContext(MobileContext);

  const [unreadCounts, setUnreadCounts] = useState({});
  const [showDropdown, setShowDropdown] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userImage, setUserImage] = useState(null);
  const fileInputRef = useRef(null);

  const [publicKeys, setPublicKeys] = useState({});
  const [groupKeysByChatId, setGroupKeysByChatId] = useState({});
  const [presenceByUserId, setPresenceByUserId] = useState({});

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [summaryChat, setSummaryChat] = useState(null);

  const privateKey = new Uint8Array(
    JSON.parse(localStorage.getItem("privateKey"))
  );

  const filteredConversations = conversations.filter((conversation) => {
    let chatName = "";
    let lastMessage = "";
    if (conversation.isGroupChat) {
      chatName = conversation.chatName;
    } else {
      const other = conversation.users.find((u) => u._id !== userData.data._id);
      chatName = other?.name || "";
    }

    if (conversation.latestMessage) {
      if (conversation.isGroupChat) {
        const gk = groupKeysByChatId[conversation._id];
        lastMessage = gk
          ? decryptGroupMessage({
              messageContent: conversation.latestMessage.content,
              groupKey: gk,
            })
          : "";
      } else {
        lastMessage = conversation.latestMessage.content || "";
      }
    }
    return (
      chatName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (!userData) {
    console.log("User not Authenticated");
    navigate("/");
  }
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
    const reader = new FileReader();
      reader.onload = (e) => {
        setUserImage(e.target.result);
        uploadImageToServer(file);
      };
    reader.readAsDataURL(file);
    }
  };
  const uploadImageToServer = async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "multipart/form-data",
        },
      };

      const response = await axios.post(
        `${BACKEND_URL}/user/upload-avatar`,
        formData,
        config
      );
      console.log("Avatar uploaded successfully:", response.data);
      const updatedUserData = {
        ...userData,
        data: {
          ...userData.data,
          avatar: response.data.avatar,
        },
      };
      localStorage.setItem("userData", JSON.stringify(updatedUserData));
    } catch (error) {
      console.error("Error uploading avatar:", error);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("userData");
    navigate("/");
    setShowUserDropdown(false);
  };

  const user = userData.data;

  const handleConversationClick = (conversationId, chatName) => {
    if (isMobile) {
      setShowChatInMobile(true);
    }
    navigate(`chat/${conversationId}&${chatName}`);
  };

  useEffect(() => {
    const config = {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    };
    axios.get(`${BACKEND_URL}/chat/`, config).then((res) => {
      setConversations(res.data);
      const counts = {};
      res.data.forEach((c) => {
        if (c.unreadCount > 0) counts[c._id] = c.unreadCount;
      });
      setUnreadCounts(counts);
    });
  }, [refresh, refreshChatSlideBar]);
  useEffect(() => {
    if (!conversations.length) return;
    const ids = new Set();
    conversations.forEach((c) => {
      c.users.forEach((u) => {
        if (u._id !== userData.data._id) ids.add(String(u._id));
      });
    });
    if (!ids.size) return;
    const config = { headers: { Authorization: `Bearer ${user.token}` } };
    const query = Array.from(ids).join(",");
    axios
      .get(
        `${BACKEND_URL}/user/presence?ids=${encodeURIComponent(query)}`,
        config
      )
      .then(({ data }) => {
        const next = {};
        (data.presence || []).forEach(
          (p) => (next[p.userId] = { online: p.online, lastSeen: p.lastSeen })
        );
        setPresenceByUserId(next);
      })
      .catch((e) => console.error("presence fetch failed", e));
  }, [conversations, user.token, userData.data._id]);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ userId, online, lastSeen }) => {
      setPresenceByUserId((prev) => ({
        ...prev,
        [String(userId)]: { online, lastSeen: online ? null : lastSeen },
      }));
    };
    socket.on("presence:update", handler);
    return () => socket.off("presence:update", handler);
  }, [socket]);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showUserDropdown &&
        !event.target.closest(".user-dropdown-menu") &&
        !event.target.closest(".user-icon-button")
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserDropdown]);
  useEffect(() => {
    const fetchPublicKeys = async () => {
      const userIds = new Set();
      conversations.forEach((conv) => {
        if (!conv.isGroupChat) {
          conv.users.forEach((user) => {
            if (user._id !== userData.data._id) {
              userIds.add(user._id);
            }
          });
        }
      });
      const idsToFetch = Array.from(userIds).filter((id) => !publicKeys[id]);
      if (idsToFetch.length === 0) {
        return;
      }

      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
      };

      try {
        const requests = idsToFetch.map((userId) =>
          axios.get(`${BACKEND_URL}/user/publicKey/${userId}`, config)
        );
        const responses = await Promise.all(requests);
        const newPublicKeys = {};
        responses.forEach((res, index) => {
          const userId = idsToFetch[index];
          newPublicKeys[userId] = decodeBase64(res.data.publicKey);
        });

        setPublicKeys((prev) => ({ ...prev, ...newPublicKeys }));
      } catch (error) {
        console.error("Failed to fetch public keys for sidebar", error);
      }
    };

    if (conversations.length > 0) {
      fetchPublicKeys();
    }
  }, [conversations, user.token]);
  useEffect(() => {
    if (!conversations.length) return;
    const config = { headers: { Authorization: `Bearer ${user.token}` } };
    const myId = userData.data._id;
    const needing = conversations.filter(
      (c) => c.isGroupChat && !groupKeysByChatId[c._id]
    );
    if (!needing.length) return;

    (async () => {
      try {
        const results = await Promise.all(
          needing.map(async (conv) => {
            try {
              const { data } = await axios.get(
                `${BACKEND_URL}/chat/details/${conv._id}`,
                config
              );
              const myKeyData = (data.groupKeys || []).find((k) => {
                const id = k?.userId?._id ?? k?.userId;
                return String(id) === String(myId);
              });
              if (!myKeyData) return null;
              let keyInfo = myKeyData.key;
              if (typeof keyInfo === "string") {
                try {
                  keyInfo = JSON.parse(keyInfo);
                } catch {}
                if (typeof keyInfo === "string") {
                  try {
                    keyInfo = JSON.parse(keyInfo);
                  } catch {}
                }
              }
              if (!keyInfo?.nonce || !keyInfo?.key) return null;

              const nonce = decodeBase64(keyInfo.nonce);
              const encryptedKey = decodeBase64(keyInfo.key);
              let adminPubB64 = data.groupAdmin?.publicKey;
              if (!adminPubB64) {
                const resp = await axios.get(
                  `${BACKEND_URL}/user/publicKey/${data.groupAdmin._id}`,
                  config
                );
                adminPubB64 = resp.data?.publicKey;
              }
              if (!adminPubB64) return null;

              const adminPublicKey = decodeBase64(adminPubB64);
              const decryptedKey = nacl.box.open(
                encryptedKey,
                nonce,
                adminPublicKey,
                privateKey
              );
              if (!decryptedKey) return null;

              return { chatId: conv._id, key: decryptedKey };
            } catch (e) {
              console.error("Group key fetch/decrypt failed for", conv._id, e);
              return null;
            }
          })
        );

        const updates = {};
        results.forEach((r) => {
          if (r) updates[r.chatId] = r.key;
        });
        if (Object.keys(updates).length) {
          setGroupKeysByChatId((prev) => ({ ...prev, ...updates }));
        }
      } catch (e) {
        console.error("Group key batching failed", e);
      }
    })();
  }, [conversations, user.token]);
  const ensureGroupKey = async (chatId, adminId) => {
    if (groupKeysByChatId[chatId]) return groupKeysByChatId[chatId];

    const config = { headers: { Authorization: `Bearer ${user.token}` } };
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/chat/details/${chatId}`,
        config
      );
      const myKeyData = (data.groupKeys || []).find((k) => {
        const id = k?.userId?._id ?? k?.userId;
        return String(id) === String(userData.data._id);
      });
      if (!myKeyData) return null;

      let keyInfo = myKeyData.key;
      if (typeof keyInfo === "string") {
        try {
          keyInfo = JSON.parse(keyInfo);
        } catch {}
        if (typeof keyInfo === "string") {
          try {
            keyInfo = JSON.parse(keyInfo);
          } catch {}
        }
      }
      if (!keyInfo?.nonce || !keyInfo?.key) return null;

      const nonce = decodeBase64(keyInfo.nonce);
      const encryptedKey = decodeBase64(keyInfo.key);

      let adminPubB64 = data.groupAdmin?.publicKey;
      if (!adminPubB64) {
        const resp = await axios.get(
          `${BACKEND_URL}/user/publicKey/${data.groupAdmin._id}`,
          config
        );
        adminPubB64 = resp.data?.publicKey;
      }
      if (!adminPubB64) return null;

      const adminPublicKey = decodeBase64(adminPubB64);
      const decryptedKey = nacl.box.open(
        encryptedKey,
        nonce,
        adminPublicKey,
        privateKey
      );
      if (!decryptedKey) return null;

      setGroupKeysByChatId((prev) => ({ ...prev, [chatId]: decryptedKey }));
      return decryptedKey;
    } catch (e) {
      console.error("ensureGroupKey failed", e);
      return null;
    }
  };

  const lastSeenText = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return (
      d.toLocaleDateString() +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handleSummarizeUnread = async (conversation, ev) => {
    ev.stopPropagation();
    try {
      setSummaryChat(conversation);
      setSummaryOpen(true);
      setSummaryLoading(true);
      setSummaryError(null);
      setSummaryData(null);

      const cfg = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(
        `${BACKEND_URL}/message/unread/${conversation._id}?limit=50`,
        cfg
      );
      const msgs = data.messages || [];
      if (!msgs.length) {
        setSummaryError("No unread messages.");
        setSummaryLoading(false);
        return;
      }
      let decrypted = [];
      if (conversation.isGroupChat) {
        const gk = await ensureGroupKey(
          conversation._id,
          conversation.groupAdmin?._id
        );
        if (!gk) {
          setSummaryError(
            "Could not access group key yet. Open the chat once and try again."
          );
          setSummaryLoading(false);
          return;
        }
        decrypted = msgs
          .map((m) => {
            const content = decryptGroupMessage({
              messageContent: m.content,
              groupKey: gk,
            });
            if (!content || /Unable to decrypt|Could not decrypt/.test(content))
              return null;
            return {
              sender: m.sender?.name || "Member",
              content,
              timestamp: m.createdAt,
            };
          })
          .filter(Boolean);
      } else {
        decrypted = msgs
          .map((m) => {
            const content = decryptUtil({
              messageContent: m.content,
              sender: m.sender,
              privateKey,
              currentUserId: userData.data._id,
              recipientPublicKey: null,
            });
            if (
              !content ||
              /Unable to decrypt|Could not decrypt|Decrypting/.test(content)
            )
              return null;
            return {
              sender: m.sender?.name || "User",
              content,
              timestamp: m.createdAt,
            };
          })
          .filter(Boolean);
      }

      if (!decrypted.length) {
        setSummaryError("Could not decrypt unread messages.");
        setSummaryLoading(false);
        return;
      }
      const resp = await axios.post(
        `${BACKEND_URL}/api/style/summarize-unread`,
        { chatName: conversation.chatName, messages: decrypted },
        cfg
      );

      if (resp.data?.success) {
        setSummaryData(resp.data);
      } else {
        setSummaryError(resp.data?.error || "Failed to summarize.");
      }
    } catch (e) {
      console.error("summarize click failed", e);
      setSummaryError("Something went wrong while summarizing.");
      setToast({ open: true, message: "Summarize failed", severity: "error" });
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div
      className={"char_slide_bar-container" + (lightTheme ? "" : " dark")}
      style={isMobile ? (showChatInMobile ? { flex: 0 } : { flex: 1 }) : {}}
    >
      <div className={"slide_bar-header" + (lightTheme ? "" : " dark")}>
        <div className="user-profile-container">
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            className="user-icon-button"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
          >
            {userData?.data?.avatar ? (
              <img
                src={`${BACKEND_URL}/${userData.data.avatar}`}
                alt="User Avatar"
                className="conversation_item-avatar"
              />
            ) : (
              <img
                src={`${BACKEND_URL}/uploads/avatars/default.png`}
                alt="User Avatar"
                className="conversation_item-avatar"
              />
            )}
          </button>

          {showUserDropdown && (
            <div className={`user-dropdown-menu ${lightTheme ? "" : "dark"}`}>
              <div
                className={`user-dropdown-header ${lightTheme ? "" : "dark"}`}
              >
                <IconButton
                  className="close-dropdown"
                  onClick={() => setShowUserDropdown(false)}
                >
                  <CloseIcon className={`icon ${lightTheme ? "" : "dark"}`} />
                </IconButton>
              </div>

              <div className="user-image-container">
                <div className="edit-image-container">
                  <img
                    src={
                      userImage ||
                      (userData.data.avatar
                        ? `${BACKEND_URL}/${userData.data.avatar}`
                        : `${BACKEND_URL}/uploads/avatars/default.png`)
                    }
                    alt="User Avatar"
                    className="user-avatar-preview"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
                  <div
                    className="edit-btn"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <EditIcon />
                  </div>
                </div>
              </div>

              <div className={`username-section ${lightTheme ? "" : "dark"}`}>
                <p className={`username ${lightTheme ? "" : "dark"}`}>
                  {userData.data.name}
                </p>
              </div>

              <div className="logout-section">
                <button
                  className={`logout-btn ${lightTheme ? "" : "dark"}`}
                  onClick={handleLogout}
                >
                  <ExitToAppIcon className="icon" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="other-icons">
          {/* <IconButton
            onClick={() => {
              navigate("users");
            }}
          >
            <PersonAddIcon className={"icon" + (lightTheme ? "" : " dark")} />
          </IconButton>
          <IconButton
            onClick={() => {
              navigate("groups");
            }}
          >
            <GroupAddIcon className={"icon" + (lightTheme ? "" : " dark")} />
          </IconButton>
          <IconButton
            onClick={() => {
              navigate("create-groups");
            }}
          >
            <AddCircleIcon className={"icon" + (lightTheme ? "" : " dark")} />
          </IconButton> */}
          <IconButton
            onClick={() => {
              dispatch(toggleTheme());
            }}
          >
            {lightTheme ? (
              <NightlightIcon className="icon" />
            ) : (
              <LightModeIcon className="icon dark" />
            )}
          </IconButton>
        </div>
      </div>

      {/* Conversations */}
      <div
        className={
          "slide_bar_conversations-container" + (lightTheme ? "" : " dark")
        }
        style={isMobile ? (showChatInMobile ? { display: "none" } : {}) : {}}
      >
        <div className={"slide_bar_header" + (lightTheme ? "" : " dark")}>
          <p className={"slide_bar_title" + (lightTheme ? "" : " dark")}>
            Chats
          </p>
          <div className="dropdown-container">
            <IconButton onClick={() => setShowDropdown(!showDropdown)}>
              <AddCircleOutlineIcon
                className={"icon" + (lightTheme ? "" : " dark")}
              />
            </IconButton>
            {showDropdown && (
              <div className={"dropdown-menu" + (lightTheme ? "" : " dark")}>
                <div
                  className={"dropdown-item" + (lightTheme ? "" : " dark")}
                  onClick={() => {
                    if (isMobile) {
                      setShowChatInMobile(true);
                    }
                    navigate("users");
                    setShowDropdown(false);
                  }}
                >
                  Add User
                </div>
                <div
                  className={"dropdown-item" + (lightTheme ? "" : " dark")}
                  onClick={() => {
                    if (isMobile) {
                      setShowChatInMobile(true);
                    }
                    navigate("groups");
                    setShowDropdown(false);
                  }}
                >
                  Add Group
                </div>
                <div
                  className={"dropdown-item" + (lightTheme ? "" : " dark")}
                  onClick={() => {
                    if (isMobile) {
                      setShowChatInMobile(true);
                    }
                    navigate("create-groups");
                    setShowDropdown(false);
                  }}
                >
                  Create Group
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={"slide_bar-search" + (lightTheme ? "" : " dark")}>
          <IconButton>
            <SearchIcon className={"icon" + (lightTheme ? "" : " dark")} />
          </IconButton>
          <input
            placeholder="Search"
            className={"search-box" + (lightTheme ? "" : " dark")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={"slide_bar-conversation" + (lightTheme ? "" : " dark")}>
          {filteredConversations.map((conversation, index) => {
            let chatName = "";
            let avatarSrc = "";
            let isDM = !conversation.isGroupChat;
            let isOnline = false;

            if (conversation.isGroupChat) {
              chatName = conversation.chatName;
              avatarSrc = `${BACKEND_URL}/uploads/avatars/group_default.png`;
            } else {
              const otherUser = conversation.users.find(
                (u) => u._id !== userData.data._id
              );
              chatName = otherUser?.name || "Chat";
              avatarSrc = otherUser?.avatar
                ? `${BACKEND_URL}/${otherUser.avatar}`
                : `${BACKEND_URL}/uploads/avatars/default.png`;
              const pres = presenceByUserId[String(otherUser?._id)];
              isOnline = !!pres?.online;
            }

            const hasUnread = unreadCounts[conversation._id] > 0;
            const containerClass =
              "conversation_item-container" +
              (lightTheme ? "" : " dark");

            const avatarClass =
              "conversation_item-avatar" + (isDM && isOnline ? " online" : "");

            const onClick = () =>
              handleConversationClick(conversation._id, chatName);
            if (!conversation.latestMessage) {
              return (
                <div key={index} onClick={() => setRefresh(!refresh)}>
                  <div
                    className={containerClass}
                    onClick={onClick}
                    style={{ position: "relative" }}
                  >
                    {hasUnread && (
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          width: "12px",
                          height: "12px",
                          backgroundColor: "#4caf50",
                          borderRadius: "50%",
                          zIndex: 1,
                        }}
                      />
                    )}

                    <img
                      src={avatarSrc}
                      alt={
                        conversation.isGroupChat
                          ? "Group Avatar"
                          : "User Avatar"
                      }
                      className={avatarClass}
                      title={
                        isDM
                          ? isOnline
                            ? "Online"
                            : presenceByUserId[
                                String(
                                  conversation.users.find(
                                    (u) => u._id !== userData.data._id
                                  )?._id
                                )
                              ]?.lastSeen
                            ? `Last seen ${lastSeenText(
                                presenceByUserId[
                                  String(
                                    conversation.users.find(
                                      (u) => u._id !== userData.data._id
                                    )?._id
                                  )
                                ]?.lastSeen
                              )}`
                            : "Offline"
                          : undefined
                      }
                    />

                    <p
                      className={
                        "conversation_item-name" + (lightTheme ? "" : " dark")
                      }
                    >
                      {chatName}
                      {/* group online counter removed */}
                    </p>
                    <p className="conversation_item-lastMsg">
                      No previous Messages, click here to start a new chat
                    </p>
                    <p
                      className={`conversation_item-timeStamp${
                        lightTheme ? "" : "dark"
                      }`}
                    ></p>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={index}
                className={containerClass}
                onClick={onClick}
                style={{ position: "relative" }}
              >
                {hasUnread && (
                  <Badge
                    badgeContent={unreadCounts[conversation._id]}
                    color="success"
                    sx={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: "#4caf50",
                        borderRadius: "50%",
                      }}
                    />
                  </Badge>
                )}

                <img
                  src={avatarSrc}
                  alt={
                    conversation.isGroupChat ? "Group Avatar" : "User Avatar"
                  }
                  className={avatarClass}
                  title={
                    isDM
                      ? isOnline
                        ? "Online"
                        : presenceByUserId[
                            String(
                              conversation.users.find(
                                (u) => u._id !== userData.data._id
                              )?._id
                            )
                          ]?.lastSeen
                        ? `Last seen ${lastSeenText(
                            presenceByUserId[
                              String(
                                conversation.users.find(
                                  (u) => u._id !== userData.data._id
                                )?._id
                              )
                            ]?.lastSeen
                          )}`
                        : "Offline"
                      : undefined
                  }
                />

                <p
                  className={
                    "conversation_item-name" + (lightTheme ? "" : " dark")
                  }
                >
                  {chatName}
                  {/* group online counter removed */}
                </p>

                <p className="conversation_item-lastMsg">
                  {conversation.isGroupChat
                    ? groupKeysByChatId[conversation._id]
                      ? decryptGroupMessage({
                          messageContent: conversation.latestMessage.content,
                          groupKey: groupKeysByChatId[conversation._id],
                        })
                      : "Decrypting…"
                    : decryptUtil({
                        messageContent: conversation.latestMessage.content,
                        sender: conversation.latestMessage.sender,
                        privateKey,
                        currentUserId: userData.data._id,
                        recipientPublicKey:
                          publicKeys[
                            conversation.users.find(
                              (u) => u._id !== userData.data._id
                            )?._id
                          ],
                      })}
                </p>

                {hasUnread && (
                  <Tooltip title="Summarize unread">
                    <IconButton
                      size="small"
                      onClick={(e) => handleSummarizeUnread(conversation, e)}
                      sx={{
                        position: "absolute",
                        top: "0px",
                        right: "0px",
                        zIndex: 2,
                      }}
                    >
                      <Lottie
                        animationData={SummarizeIcon}
                        className={
                          "summarize-icon" + (lightTheme ? "" : " dark")
                        }
                        loop
                        autoplay
                      />
                    </IconButton>
                  </Tooltip>
                )}

                <p
                  className={`conversation_item-timeStamp${
                    lightTheme ? "" : " dark"
                  }`}
                >
                  {formatTimestamp(conversation.latestMessage.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        className={lightTheme ? "" : "dark"}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Unread Summary —{" "}
          {summaryChat?.isGroupChat ? summaryChat?.chatName : "Chat"}
        </DialogTitle>
        <DialogContent dividers>
          {summaryLoading ? (
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: 12,
              }}
            >
              <CircularProgress size={20} />
              <span>Summarizing…</span>
            </div>
          ) : summaryError ? (
            <div style={{ opacity: 0.8 }}>{summaryError}</div>
          ) : summaryData ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ whiteSpace: "pre-line" }}>
                {summaryData.summary}
              </div>
              {summaryData.action_items?.length ? (
                <div>
                  <strong>Action items</strong>
                  <ul style={{ margin: "6px 0 0 16px" }}>
                    {summaryData.action_items.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {summaryData.participants_mentioned?.length ? (
                <div>
                  <strong>Participants mentioned:</strong>{" "}
                  {summaryData.participants_mentioned.join(", ")}
                </div>
              ) : null}
              {summaryData.time_range ? (
                <div>
                  <strong>Time range:</strong> {summaryData.time_range}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {toast.open && (
        <Toaster
          open={toast.open}
          severity={toast.severity}
          message={toast.message}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        />
      )}
    </div>
  );
}

export default ChatSlideBar;
