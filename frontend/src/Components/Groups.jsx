import React, { useContext, useState, useEffect } from "react";
import { IconButton} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useSelector } from "react-redux";
import { MobileContext } from "./Main";
import Toaster from "./Toaster";

function Groups() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [refresh, setRefresh] = useState(false);
  const { isMobile, setShowChatInMobile } = useContext(MobileContext);
  const lightTheme = useSelector((state) => state.themeKey);

  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState({ open: false, message: "" });

  const userData = JSON.parse(localStorage.getItem("userData"));
  const nav = useNavigate();

  useEffect(() => {
    if (!userData) {
      console.log("User not Authenticated");
      nav("/");
      return;
    }

    const config = {
      headers: {
        Authorization: `Bearer ${userData.data.token}`,
      },
    };
    axios.get(`${BACKEND_URL}/chat/fetchGroups`, config).then((res) => {
      setGroups(res.data);
    });
  }, [refresh, nav]);

  const handleBackClick = () => {
    setShowChatInMobile(false);
  };

  const handleRequestToJoin = (group) => {
    const config = {
      headers: {
        Authorization: `Bearer ${userData.data.token}`,
      },
    };
    axios
      .post(
        `${BACKEND_URL}/chat/request-join`,
        {
          chatId: group._id,
        },
        config
      )
      .then(() => {
        setToast({
          open: true,
          message: `Request to join '${group.chatName}' sent!`,
        });
      })
      .catch((error) => {
        console.error("Failed to send join request", error);
        setToast({ open: true, message: "Failed to send join request." });
      });
  };

  const handleToastClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setToast({ open: false, message: "" });
  };

  const filteredGroups = groups.filter((group) =>
    group.chatName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="list-container"
        style={isMobile ? (showChatInMobile ? {} : { display: "none" }) : {}}
      >
        <div className={"list-header" + (lightTheme ? "" : " dark")}>
          {isMobile && (
            <IconButton onClick={handleBackClick}>
              <ArrowBackIcon className={`icon ${lightTheme ? "" : "dark"}`} />
            </IconButton>
          )}
          <p className={"list-title" + (lightTheme ? "" : " dark")}>
            Available Groups
          </p>
          <IconButton
            className={"icon" + (lightTheme ? "" : " dark")}
            onClick={() => {
              setRefresh(!refresh);
            }}
          >
            <RefreshIcon />
          </IconButton>
        </div>
        <motion.div
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          className={"slide_bar-search " + (lightTheme ? "" : " dark")}
        >
          <IconButton>
            <SearchIcon className={"icon" + (lightTheme ? "" : " dark")} />
          </IconButton>
          <input
            placeholder="Search"
            className={"search-box" + (lightTheme ? "" : " dark")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </motion.div>
        <div className={"group-list" + (lightTheme ? "" : " dark")}>
          {filteredGroups.map((group, index) => {
            const isMember = group.users.includes(userData.data._id);
            return (
              <motion.div
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.999 }}
                transition={{ duration: 0.05 }}
                className={"list-item" + (lightTheme ? "" : " dark")}
                key={index}
                onClick={() => {
                  if (!isMember) {
                    handleRequestToJoin(group);
                  }
                }}
                style={{
                  cursor: isMember ? "not-allowed" : "pointer",
                  opacity: isMember ? 0.6 : 1,
                }}
              >
                <img
                  src={`${BACKEND_URL}/uploads/avatars/group_default.png`}
                  alt="Group"
                  className="conversation_item-avatar"
                />
                <p
                  className={
                    "conversation_item-name" + (lightTheme ? "" : " dark")
                  }
                >
                  {group.chatName} {isMember && "(Joined)"}
                </p>
              </motion.div>
            );
          })}
        </div>
        {toast.open && (
          <Toaster
            open={toast.open}
            message={toast.message}
            severity="info"
            duration={4000}
            onClose={handleToastClose}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default Groups;
