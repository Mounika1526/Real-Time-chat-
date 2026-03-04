import React, { useEffect, useState, useContext } from "react";
import {
  IconButton,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
} from "@mui/material";
import Toaster from "./Toaster";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
import { MobileContext, refreshChatSlideBarContext } from "./Main";

function AdminGroupRequests() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const lightTheme = useSelector((state) => state.themeKey);
  const { isMobile, setShowChatInMobile } = useContext(MobileContext);
  const { setRefreshChatSlideBar } = useContext(refreshChatSlideBarContext);

  const { chatId } = useParams();
  const nav = useNavigate();

  const userData = JSON.parse(localStorage.getItem("userData"));
  const privateKey = new Uint8Array(
    JSON.parse(localStorage.getItem("privateKey"))
  );

  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState(null);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const config = {
    headers: { Authorization: `Bearer ${userData?.data?.token}` },
  };

  const loadChat = () => {
    if (!chatId) return;
    setLoading(true);
    axios
      .get(`${BACKEND_URL}/chat/details/${chatId}`, config)
      .then(({ data }) => setChat(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!userData) {
      nav("/");
      return;
    }
    loadChat();
  }, [chatId]);

  const handleBack = () => {
    setShowChatInMobile(false);
    nav(`/app/chat/${chatId}&${chat?.chatName ?? ""}`);
  };
  const approveUser = async (user) => {
    try {
      const { data: details } = await axios.get(
        `${BACKEND_URL}/chat/details/${chatId}`,
        config
      );
      const adminId = userData.data._id;
      const myKeyData = (details.groupKeys || []).find((k) => {
        const id = k?.userId?._id ?? k?.userId;
        return String(id) === String(adminId);
      });
      if (!myKeyData) throw new Error("Admin's group key not found.");
      let keyInfo = myKeyData.key;
      if (typeof keyInfo === "string") {
        try {
          keyInfo = JSON.parse(keyInfo);
        } catch {}
        if (typeof keyInfo === "string") {
          try {
            keyInfo = JSON.parse(keyInfo);
          } catch {}
        }
      }
      if (!keyInfo?.key || !keyInfo?.nonce)
        throw new Error("Malformed key blob.");

      const nonce = decodeBase64(keyInfo.nonce);
      const encryptedKey = decodeBase64(keyInfo.key);

      let adminPubB64 = details.groupAdmin?.publicKey;
      if (!adminPubB64) {
        const { data } = await axios.get(
          `${BACKEND_URL}/user/publicKey/${adminId}`,
          config
        );
        adminPubB64 = data.publicKey;
      }
      const adminPublicKey = decodeBase64(adminPubB64);

      const groupKey = nacl.box.open(
        encryptedKey,
        nonce,
        adminPublicKey,
        privateKey
      );
      if (!groupKey) throw new Error("Failed to decrypt group key.");
      const { data: pubResp } = await axios.get(
        `${BACKEND_URL}/user/publicKey/${user._id}`,
        config
      );
      const requesterPub = decodeBase64(pubResp.publicKey);
      const wrapNonce = nacl.randomBytes(nacl.box.nonceLength);
      const wrapped = nacl.box(groupKey, wrapNonce, requesterPub, privateKey);

      const payload = JSON.stringify({
        key: encodeBase64(wrapped),
        nonce: encodeBase64(wrapNonce),
      });

      await axios.post(
        `${BACKEND_URL}/chat/approve-join`,
        { chatId, newUserId: user._id, encryptedKey: payload },
        config
      );
      setChat((c) => ({
        ...c,
        pendingMembers: (c.pendingMembers || []).filter(
          (u) => u._id !== user._id
        ),
      }));
      setRefreshChatSlideBar((p) => !p);
      setToast({
        open: true,
        message: `Approved ${user.name}`,
        severity: "success",
      });
    } catch (e) {
      console.error(e);
      setToast({
        open: true,
        message: e.message || "Approval failed",
        severity: "error",
      });
    }
  };

  const declineUser = async (user) => {
    try {
      await axios.post(
        `${BACKEND_URL}/chat/decline-join`,
        { chatId, userId: user._id },
        config
      );
      setChat((c) => ({
        ...c,
        pendingMembers: (c.pendingMembers || []).filter(
          (u) => u._id !== user._id
        ),
      }));
      setToast({
        open: true,
        message: `Declined ${user.name}`,
        severity: "info",
      });
    } catch (e) {
      console.error(e);
      setToast({ open: true, message: "Decline failed", severity: "error" });
    }
  };

  const isAdmin =
    chat?.isGroupChat &&
    chat?.groupAdmin &&
    String(chat.groupAdmin._id || chat.groupAdmin) ===
      String(userData?.data?._id);

  return (
    <div className={"list-container" + (lightTheme ? "" : " dark")}>
      <div className={"list-header" + (lightTheme ? "" : " dark")}>
        <IconButton onClick={handleBack}>
          <ArrowBackIcon className={`icon ${lightTheme ? "" : "dark"}`} />
        </IconButton>
        <p className={"list-title" + (lightTheme ? "" : " dark")}>
          Requests — {chat?.chatName || ""}
        </p>
        <IconButton onClick={loadChat} title="Refresh">
          <RefreshIcon className={"icon" + (lightTheme ? "" : " dark")} />
        </IconButton>
      </div>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }} className={lightTheme ? "" : " dark"}>
          <CircularProgress />
        </Box>
      ) : !isAdmin ? (
        <Typography sx={{ p: 2 }} color="text.secondary" className={"request-text" + (lightTheme ? "" : " dark")}>
          You are not the admin of this group.
        </Typography>
      ) : (chat?.pendingMembers?.length ?? 0) === 0 ? (
        <Typography sx={{ p: 2 }} color="text.secondary" className={"request-text" + (lightTheme ? "" : " dark")}>
          No pending join requests for this group.
        </Typography>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 1,
            backgroundColor: lightTheme ? "#f1f2f6" : "#262626",
            borderRadius: "15px",
          }}
        >
          <List dense>
            {chat.pendingMembers.map((u) => (
              <ListItem
                key={u._id}
                secondaryAction={
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<CheckIcon />}
                      onClick={() => approveUser(u)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<CloseIcon />}
                      onClick={() => declineUser(u)}
                    >
                      Reject
                    </Button>
                  </Box>
                }
              >
                <ListItemAvatar>
                  <Avatar
                    src={
                      u.avatar
                        ? `${BACKEND_URL}/${u.avatar}`
                        : `${BACKEND_URL}/uploads/avatars/default.png`
                    }
                  />
                </ListItemAvatar>
                <ListItemText primary={u.name} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {toast.open && (
        <Toaster
          open={toast.open}
          message={toast.message}
          severity={toast.severity}
          duration={3500}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        />
      )}
    </div>
  );
}

export default AdminGroupRequests;
