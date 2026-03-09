import { useState } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

function GroupInfoEdit({ open, onClose, chatDetails, onChatUpdated }) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const lightTheme = useSelector((state) => state.themeKey);
  const [chatName, setChatName] = useState(chatDetails?.chatName || "");
  const [description, setDescription] = useState(chatDetails?.description || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!chatName.trim()) {
      setError("Group name cannot be empty.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("userData"))?.data?.token;
      const formData = new FormData();
      formData.append("chatName", chatName.trim());
      formData.append("description", description);
      if (avatarFile) formData.append("groupAvatar", avatarFile);

      const { data } = await axios.put(
        `${BACKEND_URL}/chat/${chatDetails._id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      onChatUpdated(data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update group info.");
    } finally {
      setLoading(false);
    }
  };

  const currentAvatar = avatarPreview
    ? avatarPreview
    : chatDetails?.groupAvatar
    ? `${BACKEND_URL}/${chatDetails.groupAvatar}`
    : `${BACKEND_URL}/uploads/avatars/group_default.png`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        className: "group-edit-dialog" + (lightTheme ? "" : " dark"),
      }}
    >
      <DialogTitle className={"group-edit-title" + (lightTheme ? "" : " dark")}>
        Edit Group Info
        <IconButton size="small" onClick={onClose} className="group-members-close-btn">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent className={"group-edit-content" + (lightTheme ? "" : " dark")}>
        <div className="group-avatar-edit-wrap">
          <img src={currentAvatar} alt="Group avatar" className="group-avatar-preview" />
          <label htmlFor="group-avatar-input" className="group-avatar-upload-btn">
            <PhotoCameraIcon fontSize="small" />
            <input
              id="group-avatar-input"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleAvatarChange}
            />
          </label>
        </div>
        <TextField
          label="Group Name"
          value={chatName}
          onChange={(e) => setChatName(e.target.value)}
          fullWidth
          margin="normal"
          size="small"
          InputProps={{ className: lightTheme ? "" : "dark-input" }}
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          margin="normal"
          size="small"
          multiline
          rows={2}
          InputProps={{ className: lightTheme ? "" : "dark-input" }}
        />
        {error && <p className="group-edit-error">{error}</p>}
      </DialogContent>
      <DialogActions className={"group-edit-actions" + (lightTheme ? "" : " dark")}>
        <Button onClick={onClose} disabled={loading} size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading}
          variant="contained"
          size="small"
        >
          {loading ? <CircularProgress size={16} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default GroupInfoEdit;
