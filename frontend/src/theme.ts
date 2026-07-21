import { createTheme } from "@mui/material";

export const theme = createTheme({
    palette: {
        mode: "light",
        primary: { main: "#315f7d" },
        secondary: { main: "#9c5f36" },
        background: { default: "#f3f5f7", paper: "#ffffff" },
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
        h5: { letterSpacing: "-0.02em" },
    },
    components: {
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiTableCell: { styleOverrides: { root: { borderColor: "#e6e9ed" } } },
    },
});
