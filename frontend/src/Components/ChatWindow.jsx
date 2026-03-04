import React, { useContext, useRef, useState, useEffect } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import { IconButton, Skeleton, CircularProgress } from "@mui/material";
import Badge from "@mui/material/Badge";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@mui/material";
import MessageFromOther from "./MessageFromOther";
import MessageByMe from "./MessageByMe";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import axios from "axios";
import {
  refreshContext,
  refreshChatSlideBarContext,
  SocketContext,
  MobileContext,
} from "./Main";
import Lottie from "lottie-react";
import typingIndicator from "../assets/Typing_Indicator.json";
import typingIndicatorDark from "../assets/Typing_Indicator_dark.json";
import nacl from "tweetnacl";
import {
  encodeUTF8,
  decodeUTF8,
  encodeBase64,
  decodeBase64,
} from "tweetnacl-util";
import {
  decryptMessage as decryptUtil,
  decryptGroupMessage,
} from "../utils/crypto";
import StyleSuggestions from "./StyleSuggestions";

function ChatWindow() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { socket, recievedNewMessage, setRecievedNewMessage } =
    useContext(SocketContext);
  const lightTheme = useSelector((state) => state.themeKey);
  const [messageContent, setMessageContent] = useState("");
  const dyParams = useParams();
  const navigate = useNavigate();
  const [chat_id, chat_user] = dyParams._id.split("&");
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [allMessages, setAllMessages] = useState([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { refresh, setRefresh } = useContext(refreshContext);
  const { refreshChatSlideBar, setRefreshChatSlideBar } = useContext(
    refreshChatSlideBarContext
  );
  const { isMobile, showChatInMobile, setShowChatInMobile } =
    useContext(MobileContext);

  const [loaded, setLoaded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [firstUnreadIndex, setFirstUnreadIndex] = useState(-1);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const messagesEndRef = useRef(null);
  const firstUnreadRef = useRef(null);
  const [chatDetails, setChatDetails] = useState(null);
  const [canDelete, setCanDelete] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const chatContainerRef = useRef(null);
  const loadedPagesRef = useRef(new Set());
  const inFlightPagesRef = useRef(new Set());
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [groupKey, setGroupKey] = useState(null);
  const [recipientPublicKey, setRecipientPublicKey] = useState(null);
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const privateKey = new Uint8Array(
    JSON.parse(localStorage.getItem("privateKey"))
  );
  const activeChatIdRef = useRef(null);
  useEffect(() => { activeChatIdRef.current = chat_id; }, [chat_id]);

  const fetchMessages = (pageNum) => {
    if (loadingMore || pageNum > totalPages) return;
    if (
      loadedPagesRef.current.has(pageNum) ||
      inFlightPagesRef.current.has(pageNum)
    )
      return;
    inFlightPagesRef.current.add(pageNum);

    setLoadingMore(true);
    const config = {
      headers: {
        Authorization: `Bearer ${userData.data.token}`,
      },
      params: {
        page: pageNum,
        limit: 20,
      },
    };
    axios
      .get(`${BACKEND_URL}/message/${chat_id}`, config)
      .then(({ data }) => {
        setAllMessages((prev) => {
          const map = new Map(prev.map((m) => [m._id, m]));
          data.messages.forEach((m) => map.set(m._id, m));
          return Array.from(map.values());
        });
        setPage(data.currentPage);
        setTotalPages(data.totalPages);
        setLoaded(true);
        loadedPagesRef.current.add(pageNum);
      })
      .finally(() => {
        inFlightPagesRef.current.delete(pageNum);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    loadedPagesRef.current.clear();
    inFlightPagesRef.current.clear();
  }, [chat_id]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      if (
        scrollHeight - clientHeight - Math.abs(scrollTop) < 10 &&
        !loadingMore &&
        page < totalPages
      ) {
        console.log("Reached top, loading more messages...");
        fetchMessages(page + 1);
      }
    }
  };

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, [loadingMore, page, totalPages]);

  const handleTyping = (e) => {
    setMessageContent(e.target.value);

    if (!socket) return;

    if (!isTyping) {
      socket.emit("typing", chat_id);
    }

    if (typingTimeout) clearTimeout(typingTimeout);

    const timer = setTimeout(() => {
      socket.emit("stop typing", chat_id);
    }, 2000);
    setTypingTimeout(timer);
  };

  const sendMessage = () => {
    if (!messageContent.trim() || !socket) return;
    let finalMessageContent;

    if (isGroupChat) {
      if (!groupKey) {
        console.error("Group key not ready, cannot send message.");
        return;
      }
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      const encryptedMessage = nacl.secretbox(
        decodeUTF8(messageContent),
        nonce,
        groupKey
      );
      finalMessageContent = JSON.stringify({
        message: encodeBase64(encryptedMessage),
        nonce: encodeBase64(nonce),
      });
    } else {
      if (!recipientPublicKey) {
        console.error("Recipient public key not ready, cannot send message.");
        return;
      }
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const encryptedMessage = nacl.box(
        decodeUTF8(messageContent),
        nonce,
        recipientPublicKey,
        privateKey
      );
      finalMessageContent = JSON.stringify({
        message: encodeBase64(encryptedMessage),
        nonce: encodeBase64(nonce),
      });
    }

    socket.emit("stop typing", chat_id);
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      _id: tempId,
      content: messageContent,
      sender: {
        _id: userData.data._id,
        name: userData.data.name,
        avatar: userData.data.avatar,
      },
      chat: { _id: chat_id },
      readBy: [
        {
          user: {
            _id: userData.data._id,
            name: userData.data.name,
            email: userData.data.email,
          },
          readAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOptimistic: true,
    };
    setAllMessages((prev) => [optimisticMessage, ...prev]);
    const currentMessage = messageContent;
    setMessageContent("");

    const config = {
      headers: { Authorization: `Bearer ${userData.data.token}` },
    };
    axios
      .post(
        `${BACKEND_URL}/message`,
        {
          content: finalMessageContent,
          chatId: chat_id,
        },
        config
      )
      .then((res) => {
        setAllMessages((prev) =>
          prev.map((msg) => (msg._id === tempId ? res.data : msg))
        );
        socket.emit("newMessage", res.data);
        setRefreshChatSlideBar((prevState) => !prevState);
      })
      .catch((error) => {
        setAllMessages((prev) =>
          prev.filter((msg) => msg._id !== optimisticMessage._id)
        );
        setMessageContent(currentMessage);
        console.error("Failed to send message:", error);
      });
  };
  useEffect(() => {
    if (recievedNewMessage != null) {
      const newMessage = recievedNewMessage;

      if (chat_id === newMessage.chat._id) {
        setAllMessages((prev) => [newMessage, ...prev]);
      }
      setRefreshChatSlideBar((prev) => !prev);
      setRecievedNewMessage(null);
    }
  }, [chat_id, recievedNewMessage]);

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
  useEffect(() => {
    setAllMessages([]);
    setPage(1);
    setTotalPages(1);
    fetchMessages(1);

    if (socket) {
      socket.emit("join chat", chat_id);

      const typingHandler = (room) => {
        console.log("Received typing event for room:", room, chat_id);
        if (room === chat_id) {
          setIsTyping(true);
        }
      };

      const stopTypingHandler = (room) => {
        if (room === chat_id) {
          setIsTyping(false);
        }
      };

      socket.on("typing", typingHandler);
      socket.on("stop typing", stopTypingHandler);
      const presenceHandler = ({ userId, online, lastSeen }) => {
        setPresenceByUserId((prev) => ({
          ...prev,
          [String(userId)]: { online, lastSeen: online ? null : lastSeen },
        }));
      };
      socket.on("presence:update", presenceHandler);
      return () => {
        console.log("Cleaning up socket listeners...");
        socket.off("typing", typingHandler);
        socket.off("stop typing", stopTypingHandler);
        socket.off("presence:update", presenceHandler);
      };
    }
  }, [refresh, chat_id, userData.data.token, socket]);
  useEffect(() => {
    if (allMessages.length > 0 && userData.data._id) {
      const firstUnread = allMessages.findIndex((message) => {
        return (
          message.sender._id !== userData.data._id &&
          !message.readBy.some((read) => read.user._id === userData.data._id)
        );
      });
      setFirstUnreadIndex(firstUnread);
      if (firstUnread > -1) {
        setHasMarkedAsRead(false);
      }
    }
  }, [allMessages, userData.data._id, chat_id]);
  useEffect(() => {
    const container = chatContainerRef.current;
    const target = firstUnreadRef.current;
    if (firstUnreadIndex >= 0 && target && container) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
      const cRect = container.getBoundingClientRect();
      const tRect = target.getBoundingClientRect();
      const delta = tRect.top - cRect.top - cRect.height * 0.4;
      if (Math.abs(delta) > 2) {
        container.scrollBy({ top: delta, behavior: "smooth" });
      }
    } else if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [firstUnreadIndex]);
  useEffect(() => {
    if (
      chat_id &&
      userData.data.token &&
      !hasMarkedAsRead &&
      firstUnreadIndex !== -1
    ) {
      const timer = setTimeout(() => {
        const config = {
          headers: {
            Authorization: `Bearer ${userData.data.token}`,
          },
        };

        axios
          .put(`${BACKEND_URL}/message/mark-read/${chat_id}`, {}, config)
          .then(() => {
            setRefreshChatSlideBar((prev) => !prev);
            setHasMarkedAsRead(true);
            setFirstUnreadIndex(-1);
          })
          .catch((error) =>
            console.error("Error marking messages as read:", error)
          );
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [chat_id, userData.data.token, hasMarkedAsRead, firstUnreadIndex]);

  useEffect(() => {
    const fetchChatDetails = async () => {
      try {
        const config = {
          headers: { Authorization: `Bearer ${userData.data.token}` },
        };
        const { data: details } = await axios.get(
          `${BACKEND_URL}/chat/details/${chat_id}`,
          config
        );
        setChatDetails(details);
        setCanDelete(
          details.isGroupChat
            ? details.groupAdmin._id === userData.data._id
            : true
        );
        setIsGroupChat(details.isGroupChat);
        if (details.isGroupChat) {
          const myKeyData = (details.groupKeys || []).find((k) => {
            const id = k?.userId && k.userId._id ? k.userId._id : k.userId;
            return String(id) === String(userData.data._id);
          });
          if (!myKeyData) {
            console.error("No group key found for current user");
            return;
          }
          let keyInfo = myKeyData.key;
          if (typeof keyInfo === "string") {
            keyInfo = JSON.parse(keyInfo);
            if (typeof keyInfo === "string") keyInfo = JSON.parse(keyInfo);
          }
          if (!keyInfo?.key || !keyInfo?.nonce) {
            console.error("Malformed group key blob");
            return;
          }
          const nonce = decodeBase64(keyInfo.nonce);
          const encryptedKey = decodeBase64(keyInfo.key);
          let adminPublicKeyB64 = details.groupAdmin?.publicKey;
          if (!adminPublicKeyB64) {
            const { data } = await axios.get(
              `${BACKEND_URL}/user/publicKey/${details.groupAdmin._id}`,
              config
            );
            adminPublicKeyB64 = data?.publicKey;
          }
          if (!adminPublicKeyB64) {
            console.error("Group admin public key not available");
            return;
          }
          const adminPublicKey = decodeBase64(adminPublicKeyB64);
          const decryptedKey = nacl.box.open(
            encryptedKey,
            nonce,
            adminPublicKey,
            privateKey
          );
          if (!decryptedKey) {
            console.error("Failed to decrypt group key!");
            return;
          }
          setGroupKey(decryptedKey);
        } else {
          const otherUser = details.users.find(
            (u) => u._id !== userData.data._id
          );
          if (otherUser?.publicKey) {
            setRecipientPublicKey(decodeBase64(otherUser.publicKey));
          }
        }
        const ids = details.users
          .map((u) => u._id)
          .filter((id) => id !== userData.data._id);
        if (ids.length) {
          const cfg = {
            headers: { Authorization: `Bearer ${userData.data.token}` },
          };
          const q = ids.join(",");
          const pres = await axios.get(
            `${BACKEND_URL}/user/presence?ids=${encodeURIComponent(q)}`,
            cfg
          );
          const next = {};
          (pres.data.presence || []).forEach(
            (p) => (next[p.userId] = { online: p.online, lastSeen: p.lastSeen })
          );
          setPresenceByUserId(next);
        }
      } catch (error) {
        console.error("Error fetching chat details:", error);
      }
    };

    if (chat_id) {
      fetchChatDetails();
    }
  }, [chat_id, userData.data.token]);
  useEffect(() => {
    if (socket) {
      socket.on("conversationDeleted", ({ chatId, deletedBy }) => {
        if (chatId === chat_id) {
          setAllMessages([]);
          setRefreshChatSlideBar((prevState) => !prevState);
        }
      });
      return () => {
        socket.off("conversationDeleted");
      };
    }
  }, [socket, chat_id, setRefreshChatSlideBar]);

  const markAsReadAllMessagesLocally = () => {
    const myId = userData.data._id;
    setAllMessages((prev) =>
      prev.map((msg) => {
        const isMine = msg.sender._id === myId;
        const alreadyRead = (msg.readBy || []).some((r) => r.user._id === myId);
        if (isMine || alreadyRead) return msg;

        return {
          ...msg,
          readBy: [...(msg.readBy || []), { user: { _id: myId } }],
        };
      })
    );
  };
  const handleSendMessage = () => {
    sendMessage();
    if (!hasMarkedAsRead) {
      const config = {
        headers: {
          Authorization: `Bearer ${userData.data.token}`,
        },
      };

      axios
        .put(`${BACKEND_URL}/message/mark-read/${chat_id}`, {}, config)
        .then(() => {
          setRefreshChatSlideBar((prev) => !prev);
          setHasMarkedAsRead(true);
          markAsReadAllMessagesLocally();
          setFirstUnreadIndex(-1);
        })
        .catch((error) =>
          console.error("Error marking messages as read:", error)
        );
    }
    if (firstUnreadRef.current) {
      const firstDiv = firstUnreadRef.current?.children[0];
      if (firstDiv) {
        firstDiv.style.setProperty("display", "none", "important");
      }
    }
  };
  const handleBackClick = () => {
    setShowChatInMobile(false);
  };
  const handleDeleteConversation = async () => {
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${userData.data.token}`,
        },
      };

      await axios.delete(
        `${BACKEND_URL}/message/delete-all/${chat_id}`,
        config
      );
      setAllMessages([]);
      setRefreshChatSlideBar((prevState) => !prevState);
      setShowDeleteDialog(false);

    } catch (error) {
      console.error("Error deleting messages:", error);
    }
  };
  if (!loaded) {
    return (
      <div
        style={{
          border: "20px",
          padding: "10px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <Skeleton
          variant="rectangular"
          sx={{ width: "100%", borderRadius: "10px" }}
          height={60}
        />
        <Skeleton
          variant="rectangular"
          sx={{
            width: "100%",
            borderRadius: "10px",
            flexGrow: "1",
          }}
        />
        <Skeleton
          variant="rectangular"
          sx={{ width: "100%", borderRadius: "10px" }}
          height={60}
        />
      </div>
    );
  } else {
    return (
      <div
        className="chat_window-container"
        style={isMobile ? (showChatInMobile ? {} : { display: "none" }) : {}}
      >
        <div className={"chat_window-header" + (lightTheme ? "" : " dark")}>
          {isMobile && (
            <IconButton onClick={handleBackClick}>
              <ArrowBackIcon className={`icon ${lightTheme ? "" : "dark"}`} />
            </IconButton>
          )}
          {chatDetails &&
            (chatDetails.isGroupChat ? (
              <img
                src={`${BACKEND_URL}/uploads/avatars/group_default.png`}
                alt="Group Avatar"
                className="profile-avatar"
              />
            ) : (
              <img
                src={
                  chatDetails.users.find(
                    (user) => user._id !== userData.data._id
                  )?.avatar
                    ? `${BACKEND_URL}/${
                        chatDetails.users.find(
                          (user) => user._id !== userData.data._id
                        )?.avatar
                      }`
                    : `${BACKEND_URL}/uploads/avatars/default.png`
                }
                alt="User Avatar"
                className="profile-avatar"
              />
            ))}
          <div className="chat_window-header-text">
            <p
              className={"conversation_item-name" + (lightTheme ? "" : " dark")}
            >
              {chat_user}
            </p>
            {/* <p className="conversation_item-timeStamp">{timeStamp}</p> */}
            {chatDetails &&
              (chatDetails.isGroupChat ? (
                <p className="conversation_item-timeStamp">
                  {(() => {
                    const others = chatDetails.users.filter(
                      (u) => u._id !== userData.data._id
                    );
                    const on = others.reduce(
                      (a, u) =>
                        a+(presenceByUserId[String(u._id)]?.online ? 1 : 0),
                      0
                    );
                    return `${on}/${others.length} online`;
                  })()}
                </p>
              ) : (
                <p className="conversation_item-timeStamp">
                  {(() => {
                    const other = chatDetails.users.find(
                      (u) => u._id !== userData.data._id
                    );
                    const pres = presenceByUserId[String(other?._id)];
                    if (!pres) return "";
                    return pres.online
                      ? "Online"
                      : `Last seen ${lastSeenText(pres.lastSeen)}`;
                  })()}
                </p>
              ))}
          </div>
          {isGroupChat && canDelete && (
            <IconButton
              onClick={() => navigate(`/app/admin-requests/${chat_id}`)}
              title="Join requests"
            >
              <Badge
                badgeContent={chatDetails?.pendingMembers?.length || 0}
                color="warning"
              >
                <GroupAddIcon
                  className={"icon" + (lightTheme ? "" : " dark")}
                />
              </Badge>
            </IconButton>
          )}
          {canDelete && (
            <IconButton onClick={() => setShowDeleteDialog(true)}>
              <DeleteIcon className={"icon" + (lightTheme ? "" : " dark")} />
            </IconButton>
          )}
          <Dialog
            className={lightTheme ? "" : " dark"}
            open={showDeleteDialog}
            onClose={() => setShowDeleteDialog(false)}
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
          >
            <DialogTitle id="delete-dialog-title">
              Delete Conversation
            </DialogTitle>
            <DialogContent>
              <DialogContentText id="delete-dialog-description">
                Are you sure you want to delete the whole conversation? This
                action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setShowDeleteDialog(false)}
                color="primary"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConversation}
                color="error"
                autoFocus
              >
                Delete
              </Button>
            </DialogActions>
          </Dialog>
        </div>
        <div
          className={"chat_window-msg-container" + (lightTheme ? "" : " dark")}
          ref={chatContainerRef}
        >
          {isTyping && (
            <div className={"typing-indicator" + (lightTheme ? "" : " dark")}>
              <Lottie
                animationData={
                  lightTheme ? typingIndicator : typingIndicatorDark
                }
                loop
                autoplay
              />
            </div>
          )}
          <div ref={messagesEndRef} />
          {allMessages.map((message, index) => {
            const self_id = userData.data._id;
            const isFirstUnread = index === firstUnreadIndex;
            const decryptedContent = message.isOptimistic
              ? message.content
              : isGroupChat
              ? decryptGroupMessage({
                  messageContent: message.content,
                  groupKey: groupKey,
                })
              : decryptUtil({
                  messageContent: message.content,
                  sender: message.sender,
                  privateKey,
                  currentUserId: userData.data._id,
                  recipientPublicKey,
                });
            if (message.sender._id === self_id) {
              return (
                <div
                  key={message._id}
                  ref={isFirstUnread ? firstUnreadRef : null}
                  className={isFirstUnread ? "unread-anchor" : undefined}
                >
                  {isFirstUnread && (
                    <div
                      style={{
                        textAlign: "center",
                        margin: "10px 0",
                        padding: "5px",
                        backgroundColor: "#e3f2fd",
                        borderRadius: "15px",
                        fontSize: "12px",
                        color: "#1976d2",
                      }}
                    >
                      ── New Messages ──
                    </div>
                  )}
                  <MessageByMe
                    props={{ ...message, content: decryptedContent }}
                  />
                </div>
              );
            } else {
              return (
                <div
                  key={message._id}
                  ref={isFirstUnread ? firstUnreadRef : null}
                  className={isFirstUnread ? "unread-anchor" : undefined}
                >
                  {isFirstUnread && (
                    <div
                      style={{
                        textAlign: "center",
                        margin: "10px 0",
                        padding: "5px",
                        backgroundColor: "#e8f5e8",
                        borderRadius: "15px",
                        fontSize: "12px",
                        color: "#4caf50",
                      }}
                    >
                      ── New Messages ──
                    </div>
                  )}
                  <MessageFromOther
                    props={{ ...message, content: decryptedContent }}
                  />
                </div>
              );
            }
          })}
          {loadingMore && (
            <div
              className="loading-indicator"
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "10px",
              }}
            >
              <CircularProgress size={24} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className={"chat_window-msg-inp" + (lightTheme ? "" : " dark")}>
          <input
            placeholder="Type a Message"
            className={"search-box" + (lightTheme ? "" : " dark")}
            value={messageContent}
            onChange={handleTyping}
            onKeyDown={(event) => {
              if (event.code === "Enter") sendMessage();
            }}
          />
          <StyleSuggestions
            chatId={chat_id}
            allMessages={allMessages}
            onSuggestionSelect={setMessageContent}
            recipientPublicKey={recipientPublicKey}
            privateKey={privateKey}
            isGroupChat={isGroupChat}
            groupKey={groupKey}
          />
          <IconButton
            className={"icon" + (lightTheme ? "" : " dark")}
            onClick={sendMessage}
          >
            <SendIcon />
          </IconButton>
        </div>
      </div>
    );
  }
}

export default ChatWindow;
