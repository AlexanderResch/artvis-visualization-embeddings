import {
    Box,
    Chip,
    Typography,
} from "@mui/material";

import type {
    ComparisonExhibition,
    ComparisonNamedEntity,
} from "../../types/comparison";


export function CommonEntityList({
                                     items,
                                     emptyText,
                                 }: {
    items: Array<
        ComparisonNamedEntity
        | ComparisonExhibition
    >;
    emptyText: string;
}) {
    if (items.length === 0) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography
                    variant="body2"
                    color="text.secondary"
                >
                    {emptyText}
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                maxHeight: 360,
                overflowY: "auto",
                p: 1.25,
                display: "grid",
                gap: 0.75,
            }}
        >
            {items.map(
                (item) => {
                    const year =
                        "year" in item
                            ? item.year
                            : null;

                    return (
                        <Box
                            key={item.id}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent:
                                    "space-between",
                                gap: 1,
                                p: 1,
                                border: "1px solid",
                                borderColor:
                                    "divider",
                                borderRadius: 1.5,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    minWidth: 0,
                                    fontWeight: 700,
                                }}
                                noWrap
                                title={item.name}
                            >
                                {item.name}
                            </Typography>

                            {year !== null && (
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={year}
                                />
                            )}
                        </Box>
                    );
                },
            )}
        </Box>
    );
}
