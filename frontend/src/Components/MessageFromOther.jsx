import { useState } from "react";
import { useSelector } from "react-redux";
import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

function MessageFromOther({ props }) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { content, sender, createdAt } = props;
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const lightTheme = useSelector((state) => state.themeKey);
  return (
    <div
      className={"msg-other-container" + (lightTheme ? "" : " dark")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={"msg-other-item-container" + (lightTheme ? "" : " dark")}>
        {sender?.avatar ? (
          <img
            src={`${BACKEND_URL}/${sender.avatar}`}
            alt="User Avatar"
            className={`conversation_item-avatar ${lightTheme ? "" : "dark"}`}
          />
        ) : (
          <img
            src={`${BACKEND_URL}/uploads/avatars/default.png`}
            alt="User Avatar"
            className={`conversation_item-avatar ${lightTheme ? "" : "dark"}`}
          />
        )}
        <div className={"other-text-content" + (lightTheme ? "" : " dark")}>
          <p className={"msg-other-name" + (lightTheme ? "" : " dark")}>
            {sender?.name}
          </p>
          <p className={"msg-other-msg" + (lightTheme ? "" : " dark")}>
            {content}
          </p>
          <div className="msg-other-time">{formatTime(createdAt)}</div>
        </div>
        {hovered && (
          <Tooltip title={copied ? "Copied!" : "Copy"} placement="right">
            <IconButton
              size="small"
              onClick={handleCopy}
              className={"msg-action-btn" + (lightTheme ? "" : " dark")}
              aria-label="Copy message"
            >
              {copied ? (
                <CheckIcon fontSize="inherit" style={{ color: "#4caf50" }} />
              ) : (
                <ContentCopyIcon fontSize="inherit" />
              )}
            </IconButton>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default MessageFromOther;
