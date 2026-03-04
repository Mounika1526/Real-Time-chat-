import React from "react";
import { useSelector } from "react-redux";

function MessageByMe({ props }) {
  const { content, createdAt, isOptimistic } = props;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const lightTheme = useSelector((state) => state.themeKey);
  return (
    <div className={"msg-self-container" + (lightTheme ? "" : " dark")}>
      <div className={"msgBox" + (lightTheme ? "" : " dark")}>
        <p className={"self-msg" + (lightTheme ? "" : " dark")}>{content}</p>
        {isOptimistic ? (
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
