import React from "react";
import { useNavigate } from "react-router-dom";

function ConversationItem({ props }) {
  const { name, lastMessage, timeStamp } = props;
  const navigate = useNavigate();
  return (
    <div
      className="conversation_item-container"
      onClick={() => {
        navigate("chat");
      }}
    >
      <div className="conversation_item-icon">{name[0]}</div>
      <div className="conversation_item-name">{name}</div>
      <div className="conversation_item-lastMsg">{lastMessage}</div>
      <div className="conversation_item-timeStamp">{timeStamp}</div>
    </div>
  );
}

export default ConversationItem;
