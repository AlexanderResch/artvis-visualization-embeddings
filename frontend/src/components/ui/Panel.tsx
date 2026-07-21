import { Box, Typography, type BoxProps } from "@mui/material";
import type { ReactNode } from "react";

export function Panel({
                          title,
                          action,
                          children,
                          ...boxProps
                      }: BoxProps & {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Box
            {...boxProps}
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                backgroundColor: "background.paper",
                minWidth: 0,
                ...boxProps.sx,
            }}
        >
            {title && (
                <Box
                    sx={{
                        px: 2,
                        py: 1.25,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                    }}
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {title}
                    </Typography>
                    {action}
                </Box>
            )}
            {children}
        </Box>
    );
}
