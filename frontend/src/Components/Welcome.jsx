import React from "react";
import Lottie from "lottie-react";
import handWaveAnimation  from "../assets/hand_wave.json";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
function Welcome() {
  const lightTheme = useSelector((state) => state.themeKey);
  const userData = JSON.parse(localStorage.getItem("userData"));
  const nav = useNavigate();
  if (!userData) {
    console.log("User not Authenticated");
    nav("/");
  }
  return (
    <div className={"welcome-container" + (lightTheme ? "" : " dark")}>
      <Lottie 
        animationData={handWaveAnimation}
        style={{ 
          height: "300px", 
          width: "300px" 
        }}
        loop={true}
        autoplay={true}
      />
      <b>Hi , {userData.data.name}</b>
      <p>View and text directly to people present in the char Rooms.</p>
    </div>
  );
}

export default Welcome;
