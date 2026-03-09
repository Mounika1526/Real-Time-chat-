import React, { useEffect } from "react";
import ChatSlideBar from "./ChatSlideBar";
import { Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useState } from "react";
import { createContext } from "react";
import io from "socket.io-client";
import axios from "axios";

export const refreshContext = createContext();
export const refreshChatSlideBarContext = createContext();
export const SocketContext = createContext();
export const MobileContext = createContext();

function Main() {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const lightTheme = useSelector((state) => state.themeKey);
  const [refresh, setRefresh] = useState(true);
  const [recievedNewMessage, setRecievedNewMessage] = useState(null);
  const [refreshChatSlideBar, setRefreshChatSlideBar] = useState(true);
  const [socket, setSocket] = useState(null);
  const userDataString = localStorage.getItem("userData");
  const userData = JSON.parse(userDataString);
  const [isMobile, setIsMobile] = useState(false);
  const [showChatInMobile, setShowChatInMobile] = useState(false);

  // Auto logout on any 401 Unauthorized response
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("userData");
          localStorage.removeItem("privateKey");
          navigate("/");
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (userData) {
      const newSocket = io(BACKEND_URL, {
        auth: {
          token: userData.data.token,
        },
      });
      newSocket.emit("setup", userData);
      newSocket.on("message recieved", (newMessage) => {
        setRefreshChatSlideBar((prev) => !prev);
        setRecievedNewMessage(newMessage);
      });

      setSocket(newSocket);

      return () => {
        return newSocket.close();
      };
    }
  }, [userDataString]);
  return (
    <div className={"main-container" + (lightTheme ? "" : " dark")}>
      <refreshContext.Provider
        value={{ refresh: refresh, setRefresh: setRefresh }}
      >
        <refreshChatSlideBarContext.Provider
          value={{
            refreshChatSlideBar: refreshChatSlideBar,
            setRefreshChatSlideBar: setRefreshChatSlideBar,
          }}
        >
          <MobileContext.Provider
            value={{
              isMobile,
              showChatInMobile,
              setShowChatInMobile,
            }}
          >
            <SocketContext.Provider
              value={{
                socket: socket,
                recievedNewMessage: recievedNewMessage,
                setRecievedNewMessage: setRecievedNewMessage,
              }}
            >
              <ChatSlideBar />
              <Outlet />
            </SocketContext.Provider>
          </MobileContext.Provider>
        </refreshChatSlideBarContext.Provider>
      </refreshContext.Provider>
      {/* <Welcome/> */}
      {/* <CreateGroup/> */}
      {/* <Groups/> */}
      {/* <ChatWindow props={props}/> */}
    </div>
  );
}

export default Main;
