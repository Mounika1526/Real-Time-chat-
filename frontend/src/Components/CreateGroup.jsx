import React, { useState, useEffect, useContext } from "react";
import { refreshChatSlideBarContext, refreshContext } from "./Main";
import {
  IconButton,
  Button,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Typography,
  Chip,
  Box,
} from "@mui/material";
import DoneOutlineIcon from "@mui/icons-material/DoneOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { MobileContext } from "./Main";
import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

function CreateGroup() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const lightTheme = useSelector((state) => state.themeKey);
  const userData = JSON.parse(localStorage.getItem("userData"));
  const { isMobile, setShowChatInMobile } = useContext(MobileContext);
  const { setRefreshChatSlideBar } = useContext(refreshChatSlideBarContext);
  const { setRefresh } = useContext(refreshContext);
  const nav = useNavigate();

  const [groupName, setGroupName] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userData) {
      nav("/");
      return;
    }
    const config = {
      headers: { Authorization: `Bearer ${userData.data.token}` },
    };
    axios.get(`${BACKEND_URL}/user/fetchUsers`, config).then((response) => {
      setAllUsers(response.data);
    });
  }, [userData, nav]);

  const handleUserToggle = (user) => {
    setSelectedUsers((prevSelected) => {
      if (prevSelected.find((u) => u._id === user._id)) {
        return prevSelected.filter((u) => u._id !== user._id);
      } else {
        return [...prevSelected, user];
      }
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) {
      alert("Please enter a group name and select at least one member.");
      return;
    }
    setLoading(true);

    try {
      const privateKey = new Uint8Array(
        JSON.parse(localStorage.getItem("privateKey"))
      );
      const creator = userData.data;
      const groupKey = nacl.randomBytes(nacl.secretbox.keyLength);
      const allMembersForKeys = [
        ...selectedUsers,
        { _id: creator._id, name: creator.name },
      ];

      const config = { headers: { Authorization: `Bearer ${creator.token}` } };
      const memberPublicKeys = await Promise.all(
        allMembersForKeys.map(async (member) => {
          const { data } = await axios.get(
            `${BACKEND_URL}/user/publicKey/${member._id}`,
            config
          );
          return {
            userId: member._id,
            publicKey: decodeBase64(data.publicKey),
          };
        })
      );
      const encryptedGroupKeys = memberPublicKeys.map(
        ({ userId, publicKey }) => {
          const nonce = nacl.randomBytes(nacl.box.nonceLength);
          const encryptedKey = nacl.box(groupKey, nonce, publicKey, privateKey);

          return {
            userId: userId,
            key: JSON.stringify({
              key: encodeBase64(encryptedKey),
              nonce: encodeBase64(nonce),
            }),
          };
        }
      );
      const { data: newGroup } = await axios.post(
        `${BACKEND_URL}/chat/createGroup`,
        {
          name: groupName,
          groupKeys: JSON.stringify(encryptedGroupKeys),
        },
        config
      );
      setRefreshChatSlideBar((prev) => !prev);
      setRefresh?.((prev) => !prev);
      nav(`/app/chat/${newGroup._id}&${newGroup.chatName}`);
    } catch (error) {
      console.error("Failed to create group:", error);
      alert("Error creating group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    setShowChatInMobile(false);
  };

  return (
    <div
      className={"createGroup-container" + (lightTheme ? "" : " dark")}
      style={{
        flex: 0.7,
        flexDirection: "column",
        alignItems: "stretch",
        gap: "20px",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {isMobile && (
          <IconButton onClick={handleBackClick}>
            <ArrowBackIcon className={`icon ${lightTheme ? "" : "dark"}`} />
          </IconButton>
        )}
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Create a New Group
        </Typography>
      </Box>

      <TextField
        label="Enter Group Name"
        variant="outlined"
        className={"search-box" + (lightTheme ? "" : " dark")}
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />

      <Typography>Select Members</Typography>
      <List
        sx={{
          maxHeight: "40vh",
          overflowY: "auto",
          backgroundColor: lightTheme ? "#f1f2f6" : "#262626",
          borderRadius: "15px",
        }}
      >
        {allUsers.map((user) => (
          <ListItem
            button
            key={user._id}
            onClick={() => handleUserToggle(user)}
            sx={{ cursor: "pointer" }}
            selected={selectedUsers.some((u) => u._id === user._id)}
          >
            <ListItemAvatar>
              <Avatar src={`${BACKEND_URL}/${user.avatar}`} />
            </ListItemAvatar>
            <ListItemText primary={user.name} />
          </ListItem>
        ))}
      </List>

      <Box>
        <Typography variant="subtitle2">Selected:</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
          {selectedUsers.map((user) => (
            <Chip
              key={user._id}
              label={user.name}
              onDelete={() => handleUserToggle(user)}
            />
          ))}
        </Box>
      </Box>

      <Button
        variant="contained"
        color="primary"
        endIcon={<DoneOutlineIcon />}
        onClick={handleCreateGroup}
        disabled={loading || !groupName.trim() || selectedUsers.length === 0}
      >
        {loading ? "Creating..." : "Create Group"}
      </Button>
    </div>
  );
}

export default CreateGroup;
