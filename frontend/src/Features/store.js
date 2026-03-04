import { configureStore } from "@reduxjs/toolkit";
import themeSliceReducer from "./ThemeSlice";
import { refreshSidebar } from "./refreshSidebar";

export const store = configureStore({
  reducer: {
    themeKey: themeSliceReducer,
    refreshKey: refreshSidebar.reducer,
  },
});
store.subscribe(() => {
  const themeState = store.getState().themeKey;
  localStorage.setItem("themeKey", JSON.stringify(themeState));
});
