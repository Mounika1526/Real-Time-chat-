import React, { useContext } from "react";
import { IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import axios from "axios";
import { MobileContext, refreshChatSlideBarContext } from "./Main";

function Users() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { refresh, setRefresh } = useState(false);
  const { refreshChatSlideBar, setRefreshChatSlideBar } = useContext(
    refreshChatSlideBarContext
  );
  const { isMobile, showChatInMobile, setShowChatInMobile } =
    useContext(MobileContext);
  const lightTheme = useSelector((state) => state.themeKey);
  const [users, setUsers] = useState([]);
  const userData = JSON.parse(localStorage.getItem("userData"));
  const [searchTerm, setSearchTerm] = useState("");
  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const nav = useNavigate();
  const dispatch = useDispatch();
  if (!userData) {
    console.log("User not Authenticated");
    nav(-1);
  }
  const handleBackClick = () => {
    setShowChatInMobile(false);
  };
  useEffect(() => {
    const config = {
      headers: {
        Authorization: `Bearer ${userData.data.token}`,
      },
    };
    axios.get(`${BACKEND_URL}/user/fetchUsers`, config).then((data) => {
      setUsers(data.data);
    });
  }, [refresh]);
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
            Online Available Users
          </p>
          <IconButton
            onClick={() => {
              setRefresh(!refresh);
            }}
          >
            <RefreshIcon className={"icon" + (lightTheme ? "" : " dark")} />
          </IconButton>
        </div>
        <motion.div
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          className={"slide_bar-search " + (lightTheme ? "" : " dark")}
        >
          {/* need to see what to keep in onClick */}
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
          {filteredUsers.map((user, index) => {
            return (
              <motion.div
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.999 }}
                transition={{ duration: 0.05 }}
                className={"list-item" + (lightTheme ? "" : " dark")}
                key={index}
                onClick={() => {
                  const config = {
                    headers: {
                      Authorization: `Bearer ${userData.data.token}`,
                    },
                  };
                  axios
                    .post(
                      `${BACKEND_URL}/chat/`,
                      {
                        userId: user._id,
                      },
                      config
                    )
                    .then(() => {
                      setShowChatInMobile(false);
                      setRefreshChatSlideBar((prev) => !prev);
                    });
                }}
              >
                <img
                  src={
                    user.avatar
                      ? `${BACKEND_URL}/${user.avatar}`
                      : `${BACKEND_URL}/uploads/avatars/default.png`
                  }
                  alt="User Avatar"
                  className="conversation_item-avatar"
                />
                <p
                  className={
                    "conversation_item-name" + (lightTheme ? "" : " dark")
                  }
                >
                  {user.name}
                </p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default Users;
