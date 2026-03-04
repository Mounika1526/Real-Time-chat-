import { createSlice } from "@reduxjs/toolkit";
export const themeSlice = createSlice({
name: "themeSlice",
  initialState: JSON.parse(localStorage.getItem("themeKey")) ?? false,
  reducers: {
    toggleTheme: (state) => !state,
  },
});

export const { toggleTheme } = themeSlice.actions;

export default themeSlice.reducer;
