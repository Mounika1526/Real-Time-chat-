import React, { useState, useCallback } from "react";
import {
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  Typography,
  CircularProgress,
  Chip,
  Alert,
  Box,
} from "@mui/material";
import { AutoAwesome, Refresh } from "@mui/icons-material";
import axios from "axios";
import { useSelector } from "react-redux";
import { decryptMessage, decryptGroupMessage } from "../utils/crypto";

function StyleSuggestions({
  chatId,
  allMessages,
  onSuggestionSelect,
  recipientPublicKey,
  privateKey,
  isGroupChat,
  groupKey,
}) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [anchorEl, setAnchorEl] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [decryptedCount, setDecryptedCount] = useState(0);
  const lightTheme = useSelector((state) => state.themeKey);
  const userData = JSON.parse(localStorage.getItem("userData"));

  const generateSuggestions = useCallback(async () => {
    if (!allMessages?.length) {
      setError("No messages available for analysis");
      return;
    }
    if (isGroupChat && !groupKey) {
      setError("Decrypting group… try again in a moment");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const messagesToAnalyze = allMessages.slice(0, 20);
      const currentUserId = userData.data._id;

      const decryptedMessages = messagesToAnalyze
        .reverse()
        .map((message, index) => {
          try {
            const isCurrentUser = message.sender._id === currentUserId;

            const decryptedContent = message.isOptimistic
              ? message.content
              : isGroupChat
              ? decryptGroupMessage({
                  messageContent: message.content,
                  groupKey,
                })
              : decryptMessage({
                  messageContent: message.content,
                  sender: message.sender,
                  privateKey,
                  currentUserId,
                  recipientPublicKey,
                });
            if (
              !decryptedContent ||
              decryptedContent === "Unable to decrypt message" ||
              decryptedContent === "Could not decrypt message." ||
              decryptedContent === "Decrypting..."
            ) {
              return null;
            }

            const senderName = isCurrentUser
              ? "currentUser"
              : message.sender.name || "Other User";

            return {
              sender: senderName,
              content: decryptedContent,
              timestamp: message.createdAt,
              isCurrentUser: isCurrentUser,
            };
          } catch (decryptError) {
            console.warn("Failed to decrypt message:", decryptError, message);
            return null;
          }
        })
        .filter(Boolean);
      setDecryptedCount(decryptedMessages.length);

      if (decryptedMessages.length === 0) {
        throw new Error("No messages could be decrypted for analysis");
      }
      const currentUserMessages = decryptedMessages.filter(
        (msg) => msg.isCurrentUser
      );
      if (currentUserMessages.length === 0) {
        throw new Error(
          "No messages from current user found for style analysis"
        );
      }

      const config = {
        headers: {
          Authorization: `Bearer ${userData.data.token}`,
          "Content-Type": "application/json",
        },
      };

      const response = await axios.post(
        `${BACKEND_URL}/api/style/analyze`,
        {
          chatId,
          decryptedMessages,
        },
        config
      );

      if (response.data.success) {
        setSuggestions(response.data.suggestions);
      } else {
        throw new Error(
          response.data.error || "Failed to generate suggestions"
        );
      }
    } catch (error) {
      console.error("Error getting style suggestions:", error);
      setError(
        error.response?.data?.error ||
          error.message ||
          "Failed to generate suggestions"
      );
      setSuggestions([
        "That sounds interesting!",
        "I'd like to know more about that.",
        "What are your thoughts on this?",
      ]);
    } finally {
      setLoading(false);
    }
  }, [
    allMessages,
    chatId,
    userData.data._id,
    userData.data.token,
    recipientPublicKey,
    privateKey,
    isGroupChat,
    groupKey,
  ]);

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
    if (suggestions.length === 0) {
      await generateSuggestions();
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    setError(null);
  };

  const handleSuggestionClick = (suggestion) => {
    onSuggestionSelect(suggestion);
    handleClose();
  };

  const handleRefresh = () => {
    generateSuggestions();
  };

  const open = Boolean(anchorEl);
  const hasMinimumMessages = (decryptedCount || allMessages?.length) >= 3;

  return (
    <>
      <IconButton
        onClick={handleClick}
        className={`icon ${lightTheme ? "" : "dark"}`}
        title={
          isGroupChat && !groupKey
            ? "Decrypting group…"
            : hasMinimumMessages
            ? "AI Style Suggestions"
            : "Need at least 3 messages for suggestions"
        }
        disabled={(isGroupChat && !groupKey) || !hasMinimumMessages}
        style={{
          opacity: (isGroupChat && !groupKey) || !hasMinimumMessages ? 0.5 : 1,
        }}
      >
        <AutoAwesome />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        className={lightTheme ? "" : "dark"}
      >
        <Box
          style={{
            padding: "16px",
            minWidth: "320px",
            maxWidth: "400px",
            backgroundColor: lightTheme ? "#ffffff" : "#2c2c3e",
            color: lightTheme ? "#000000" : "#ffffff",
          }}
        >
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            mb={2}
          >
            <Typography
              variant="h6"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <AutoAwesome
                style={{ color: lightTheme ? "#4ecca3" : "#63d7b0" }}
              />
              Style Suggestions
            </Typography>

            {suggestions.length > 0 && (
              <IconButton
                size="small"
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh suggestions"
              >
                <Refresh />
              </IconButton>
            )}
          </Box>

          {error && (
            <Alert
              severity="warning"
              style={{ marginBottom: "16px", fontSize: "0.85rem" }}
            >
              {error}
            </Alert>
          )}

          {loading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              padding="32px"
            >
              <CircularProgress size={24} />
              <Typography variant="body2" style={{ marginLeft: "12px" }}>
                Analyzing your style...
              </Typography>
            </Box>
          ) : (
            <List style={{ padding: 0 }}>
              {suggestions.map((suggestion, index) => (
                <ListItem
                  key={index}
                  button
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    borderRadius: "12px",
                    marginBottom: "8px",
                    backgroundColor: lightTheme ? "#f5f5f5" : "#44446a",
                    padding: "12px",
                  }}
                >
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="flex-start" gap="8px">
                        <Chip
                          label={index + 1}
                          size="small"
                          style={{
                            backgroundColor: lightTheme ? "#4ecca3" : "#63d7b0",
                            color: "white",
                            minWidth: "24px",
                            height: "24px",
                          }}
                        />
                        <Typography variant="body2" style={{ lineHeight: 1.4 }}>
                          {suggestion}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}

              {suggestions.length === 0 && !loading && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  style={{ textAlign: "center", padding: "20px" }}
                >
                  No suggestions available. Try sending a few more messages
                  first.
                </Typography>
              )}
            </List>
          )}
        </Box>
      </Popover>
    </>
  );
}

export default StyleSuggestions;
