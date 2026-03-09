import { useState } from "react";
import { useSelector } from "react-redux";
import { IconButton, Tooltip } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ReplayIcon from "@mui/icons-material/Replay";

function MessageByMe({ props, onRetry }) {
  const { content, createdAt, isOptimistic, isFailed } = props;
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
      className={"msg-self-container" + (lightTheme ? "" : " dark")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && !isOptimistic && !isFailed && (
        <Tooltip title={copied ? "Copied!" : "Copy"} placement="left">
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
      <div className={"msgBox" + (lightTheme ? "" : " dark")}>
        <p className={"self-msg" + (lightTheme ? "" : " dark")}>{content}</p>
        {isFailed ? (
          <div className="message-failed-row">
            <span className="message-failed-label">Failed to send</span>
            {onRetry && (
              <Tooltip title="Retry">
                <IconButton
                  size="small"
                  onClick={onRetry}
                  aria-label="Retry sending message"
                  style={{ padding: "2px" }}
                >
                  <ReplayIcon fontSize="inherit" style={{ color: "#f44336" }} />
                </IconButton>
              </Tooltip>
            )}
          </div>
        ) : isOptimistic ? (
          <div
            className={
              "message-sending-indicator" + (lightTheme ? "" : " dark")
            }
          >
            Sending...
          </div>
        ) : (
          <div className={"self-timeStamp" + (lightTheme ? "" : " dark")}>
            {formatTime(createdAt)}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageByMe;
