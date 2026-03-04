import React from "react";
import { useDispatch, useSelector } from "react-redux";

function MessageFromOther({ props }) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { content, sender, createdAt } = props;
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const lightTheme = useSelector((state) => state.themeKey);
  return (
    <div className={"msg-other-container" + (lightTheme ? "" : " dark")}>
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
            {" "}
            {content}
          </p>
          <div className="msg-other-time">{formatTime(createdAt)}</div>
        </div>
      </div>
    </div>
  );
}

export default MessageFromOther;
