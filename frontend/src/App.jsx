
import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./Components/Login";
import Main from "./Components/Main";
import Welcome from "./Components/Welcome";
import ChatWindow from "./Components/ChatWindow";
import Groups from "./Components/Groups";
import CreateGroup from "./Components/CreateGroup";
import Users from "./Components/Users";
import AdminGroupRequests from "./Components/AdminGroupRequests";
import { useDispatch, useSelector } from "react-redux";

function App() {
  const dispatch = useDispatch();
  const lightTheme = useSelector((state) => state.themeKey);
  return (
    <div className={"app-container" + (lightTheme ? "" : " dark")}>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      {/* <Main/> */}
      {/* <Login/> */}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="app" element={<Main />}>
          <Route path="welcome" element={<Welcome />}></Route>
          <Route path="chat/:_id" element={<ChatWindow />}></Route>
          <Route path="users" element={<Users />}></Route>
          <Route path="groups" element={<Groups />}></Route>
          <Route path="create-groups" element={<CreateGroup />}></Route>
          <Route path="admin-requests/:chatId" element={<AdminGroupRequests />}></Route>
        </Route>
      </Routes>
    </div>
  );
}

export default App;
