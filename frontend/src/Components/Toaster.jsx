import { Alert, Snackbar } from "@mui/material";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

export default function Toaster({
  message,
  severity = "info",
  open: controlledOpen,
  onClose,
  duration = 3000,
  placement = { vertical: "top", horizontal: "right" },
  variant,
}) {
  const lightTheme = useSelector((state) => state.themeKey);
  const [open, setOpen] = useState(controlledOpen ?? true);
  const resolvedVariant = variant ?? (lightTheme ? "standard" : "filled");

  useEffect(() => {
    if (controlledOpen !== undefined) setOpen(controlledOpen);
  }, [controlledOpen]);

  const handleClose = (event, reason) => {
    if (reason === "clickaway") return;
    setOpen(false);
    onClose?.();
  };

  return (
    <Snackbar
      anchorOrigin={placement}
      open={open}
      autoHideDuration={duration}
      onClose={handleClose}
      sx={{ zIndex: (t) => (t?.zIndex?.snackbar ?? 1400) + 10 }}
    >
      <Alert
        onClose={handleClose}
        severity={severity}
        variant={resolvedVariant}
        sx={{
          width: "100%",
          maxWidth: 420,
          boxShadow: 3,
          color: resolvedVariant === "filled" ? "#fff" : "inherit",
          "& .MuiAlert-icon": {
            color: resolvedVariant === "filled" ? "#fff" : "inherit",
          },
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
