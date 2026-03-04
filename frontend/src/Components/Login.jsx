import React, { useState } from "react";
import Lottie from "lottie-react";
import messageAnimation from "../assets/message.json";
import axios from "axios";
import {
  Backdrop,
  CircularProgress,
  Button,
  TextField,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import Toaster from "./Toaster";
import { useSelector } from "react-redux";
import nacl from "tweetnacl";
import { flushSync } from "react-dom";
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from "tweetnacl-util";
import { decryptMessage } from "../utils/crypto";

function Login() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
  const [mode, setMode] = useState("login");
  const [data, setData] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const lightTheme = useSelector((state) => state.themeKey);
  const changeHandler = (e) => {
    setData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const loginHandler = async (creds) => {
    setLoading(true);
    try {
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      const payload = creds ?? { name: data.name, password: data.password };

      const res = await axios.post(`${BACKEND_URL}/user/login`, payload, config);
      const salt = decodeBase64(res.data.salt);
      const iv = decodeBase64(res.data.iv);
      const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(payload.password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );
      const derivedKey = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const encryptedKey = decodeBase64(res.data.encryptedPrivateKey);
      const decryptedKeyArrayBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        derivedKey,
        encryptedKey
      );

      const secretKey = new Uint8Array(decryptedKeyArrayBuffer);
      localStorage.setItem("privateKey", JSON.stringify(Array.from(secretKey)));
      localStorage.setItem("userData", JSON.stringify(res));

      setToast({ msg: "Welcome back!", key: Math.random() });
      navigate("/app/welcome");
      updateStyleProfile();
    } catch (err) {
      console.error("Error during login", err);
      setToast({ msg: "Invalid User Name or Password", key: Math.random() });
    } finally {
      setLoading(false);
    }
  };
  const quickDemoLogin = (who) => {
    const creds =
      who === "alice"
        ? { name: "alice", password: "demo123!" }
        : { name: "bob", password: "demo123!" };
    setMode("login");
    setData((prev) => ({ ...prev, ...creds }));
    loginHandler(creds);
  };
  const updateStyleProfile = async () => {
    const userData = JSON.parse(localStorage.getItem("userData"));
    if (!userData) return;

    const privateKey = new Uint8Array(
      JSON.parse(localStorage.getItem("privateKey"))
    );
    const currentUserId = userData.data._id;
    const token = userData.data.token;

    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data: messages } = await axios.get(
        `${BACKEND_URL}/message/latest-user-messages`,
        config
      );

      if (messages.length === 0) {
        console.log("No messages found to create a style profile.");
        return;
      }

      const decryptedMessages = [];
      const publicKeysCache = {};
      for (const message of messages) {
        const recipient = message.chat.users.find(
          (id) => id.toString() !== currentUserId
        );
        if (!recipient) continue;
        if (!publicKeysCache[recipient]) {
          const { data: pkData } = await axios.get(
            `${BACKEND_URL}/user/publicKey/${recipient}`,
            config
          );
          publicKeysCache[recipient] = decodeBase64(pkData.publicKey);
        }

        const decryptedContent = decryptMessage({
          messageContent: message.content,
          sender: message.sender,
          privateKey,
          currentUserId,
          recipientPublicKey: publicKeysCache[recipient],
        });

        decryptedMessages.push({
          content: decryptedContent,
          isCurrentUser: true,
          sender: "currentUser",
          timestamp: message.createdAt,
        });
      }
      if (decryptedMessages.length > 0) {
        await axios.post(
          `${BACKEND_URL}/api/style/create-profile`,
          { decryptedMessages },
          config
        );
        console.log(
          "Successfully triggered style profile update in the background."
        );
      }
    } catch (error) {
      console.error("Failed to update style profile:", error);
    }
  };
  const signUpHandler = async () => {
    setLoading(true);
    try {
      const keyPair = nacl.box.keyPair();
      const secretKey = keyPair.secretKey;
      const publicKey = keyPair.publicKey;
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(data.password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );
      const derivedKey = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encryptedSecretKey = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        derivedKey,
        secretKey
      );
      localStorage.setItem("privateKey", JSON.stringify(Array.from(secretKey)));

      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      const res = await axios.post(
        `${BACKEND_URL}/user/register`,
        {
          ...data,
          publicKey: encodeBase64(publicKey),
          encryptedPrivateKey: encodeBase64(new Uint8Array(encryptedSecretKey)),
          salt: encodeBase64(salt),
          iv: encodeBase64(iv),
        },
        config
      );

      localStorage.setItem("userData", JSON.stringify(res));
      setToast({ msg: "Account created 🎉", key: Math.random() });
      navigate("/app/welcome");
    } catch (err) {
      console.error("Error while signing up", err);
      const code = err?.response?.status;
      let msg = "Something went wrong";
      if (code === 405) msg = "User with this email ID already exists";
      if (code === 406) msg = "User name already taken. Please try another";
      setToast({ msg, key: Math.random() });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    mode === "login" ? loginHandler() : signUpHandler();
  };

  return (
    <>
      <Backdrop
        sx={(theme) => ({ color: "#fff", zIndex: theme.zIndex.drawer + 1 })}
        open={loading}
      >
        <CircularProgress color="secondary" />
      </Backdrop>

      <div className={"auth-page" + (lightTheme ? "" : " dark")}>
        {/* animated background blobs */}
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />

        <div
          className={"auth-card" + (lightTheme ? "" : " dark")}
          data-mode={mode}
        >
          {/* Left: Lottie + tagline */}
          <div className={"auth-left" + (lightTheme ? "" : " dark")}>
            <div className={"lottie-wrap" + (lightTheme ? "" : " dark")}>
              <Lottie animationData={messageAnimation} loop autoplay />
            </div>
            <h1>Chat. Connect. Create.</h1>
            <p>Fast, secure messaging for teams and friends.</p>
          </div>

          {/* Right: Tabs + Form */}
          <div className={"auth-right" + (lightTheme ? "" : " dark")}>
            <div
              className={"auth-tabs" + (lightTheme ? "" : " dark")}
              role="tablist"
              aria-label="Auth tabs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`tab ${mode === "login" ? "active" : ""}`}
                onClick={() => setMode("login")}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={`tab ${mode === "signup" ? "active" : ""}`}
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
              <span className="pill" aria-hidden />
            </div>

            <form
              className={"auth-form" + (lightTheme ? "" : " dark")}
              onSubmit={onSubmit}
            >
              {/* username field (used in both flows per your backend) */}
              <TextField
                fullWidth
                label="User Name"
                variant="outlined"
                onChange={changeHandler}
                color="secondary"
                name="name"
                className={"auth-textfield" + (lightTheme ? "" : " dark")}
                value={data.name}
              />

              {/* email only for sign up */}
              {mode === "signup" && (
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  variant="outlined"
                  onChange={changeHandler}
                  color="secondary"
                  name="email"
                  className={"auth-textfield" + (lightTheme ? "" : " dark")}
                  value={data.email}
                />
              )}

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                onChange={changeHandler}
                color="secondary"
                name="password"
                className={"auth-textfield" + (lightTheme ? "" : " dark")}
                value={data.password}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((s) => !s)}
                        edge="end"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                onKeyDown={(e) => {
                  if (e.code === "Enter") onSubmit(e);
                }}
              />

              <Button
                variant="contained"
                color="secondary"
                size="large"
                className="cta"
                type="submit"
                disabled={loading}
              >
                {mode === "login" ? "Log in" : "Create account"}
              </Button>
              {DEMO_MODE && (
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  <div style={{ textAlign: "center", opacity: 0.8 }}>
                    For demo: log in as <b>Alice</b> or <b>Bob</b>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                    }}
                  >
                    <Button
                      variant="outlined"
                      onClick={() => quickDemoLogin("alice")}
                      disabled={loading}
                    >
                      Log in as Alice
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => quickDemoLogin("bob")}
                      disabled={loading}
                    >
                      Log in as Bob
                    </Button>
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      opacity: 0.7,
                      fontSize: 13,
                      marginBottom: 10,
                    }}
                  >
                    Tip: open an incognito window and log in as the other user
                    to show presence, typing, and unread.
                  </div>
                </div>
              )}

              <p className={"switcher" + (lightTheme ? "" : " dark")}>
                {mode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}{" "}
                <span
                  className="hyper"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setMode((m) => (m === "login" ? "signup" : "login"))
                  }
                >
                  {mode === "login" ? "Sign up" : "Log in"}
                </span>
              </p>
            </form>

            {toast ? (
              <Toaster key={toast.key} message={toast.msg} severity="error" />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
