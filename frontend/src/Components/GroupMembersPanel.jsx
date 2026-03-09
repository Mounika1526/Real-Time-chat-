import { useState, useContext } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import StarIcon from "@mui/icons-material/Star";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import { SocketContext } from "./Main";

function GroupMembersPanel({ open, onClose, chatDetails, currentUser, onChatUpdated }) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const lightTheme = useSelector((state) => state.themeKey);
  const { socket } = useContext(SocketContext);
  const [loadingId, setLoadingId] = useState(null);

  const isAdmin =
    chatDetails?.groupAdmin?._id === currentUser?._id ||
    chatDetails?.groupAdmin === currentUser?._id;

  const adminId =
    typeof chatDetails?.groupAdmin === "object"
      ? chatDetails?.groupAdmin?._id
      : chatDetails?.groupAdmin;

  const handleRemove = async (userId) => {
    setLoadingId(userId + "_remove");
    try {
      const token = JSON.parse(localStorage.getItem("userData"))?.data?.token;
      const { data } = await axios.put(
        `${BACKEND_URL}/chat/remove-member`,
        { chatId: chatDetails._id, userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onChatUpdated(data);
    } catch (err) {
      console.error("Remove member failed:", err);
    } finally {
      setLoadingId(null);
    }
  };

  const handlePromote = async (userId) => {
    setLoadingId(userId + "_promote");
    try {
      const token = JSON.parse(localStorage.getItem("userData"))?.data?.token;
      const { data } = await axios.put(
        `${BACKEND_URL}/chat/promote-admin`,
        { chatId: chatDetails._id, userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onChatUpdated(data);
    } catch (err) {
      console.error("Promote admin failed:", err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        className: "group-members-dialog" + (lightTheme ? "" : " dark"),
      }}
    >
      <DialogTitle className={"group-members-title" + (lightTheme ? "" : " dark")}>
        Group Members ({chatDetails?.users?.length || 0})
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          className="group-members-close-btn"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className={"group-members-content" + (lightTheme ? "" : " dark")}>
        {chatDetails?.users?.map((user) => {
          const uid = user._id;
          const isThisAdmin = uid === adminId;
          const isMe = uid === currentUser?._id;
          return (
            <div
              key={uid}
              className={"group-member-row" + (lightTheme ? "" : " dark")}
            >
              {user.avatar ? (
                <img
                  src={`${BACKEND_URL}/${user.avatar}`}
                  alt={user.name}
                  className="group-member-avatar"
                />
              ) : (
                <img
                  src={`${BACKEND_URL}/uploads/avatars/default.png`}
                  alt={user.name}
                  className="group-member-avatar"
                />
              )}
              <div className="group-member-info">
                <span className={"group-member-name" + (lightTheme ? "" : " dark")}>
                  {user.name} {isMe && "(You)"}
                </span>
                {isThisAdmin && (
                  <span className="group-admin-badge">Admin</span>
                )}
              </div>
              {isAdmin && !isMe && !isThisAdmin && (
                <div className="group-member-actions">
                  <Tooltip title="Make Admin">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handlePromote(uid)}
                        disabled={!!loadingId}
                        className="group-action-btn"
                        aria-label="Promote to admin"
                      >
                        {loadingId === uid + "_promote" ? (
                          <CircularProgress size={14} />
                        ) : (
                          <StarIcon fontSize="inherit" style={{ color: "#f9a825" }} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleRemove(uid)}
                        disabled={!!loadingId}
                        className="group-action-btn"
                        aria-label="Remove member"
                      >
                        {loadingId === uid + "_remove" ? (
                          <CircularProgress size={14} />
                        ) : (
                          <PersonRemoveIcon fontSize="inherit" style={{ color: "#f44336" }} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </div>
              )}
            </div>
          );
        })}
      </DialogContent>
    </Dialog>
  );
}

export default GroupMembersPanel;
