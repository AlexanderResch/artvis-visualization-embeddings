import { Box, Checkbox, FormControlLabel, Typography } from "@mui/material";
import { scaleLinear } from "d3";

export type ScentedListItem = {
    id: string;
    label: string;
    count: number;
    color?: string;
};

export function ScentedList({
                                items,
                                selectedIds,
                                onToggle,
                                maxVisibleHeight = 220,
                            }: {
    items: ScentedListItem[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    maxVisibleHeight?: number;
}) {
    const maximum = Math.max(1, ...items.map((item) => item.count));
    const widthScale = scaleLinear().domain([0, maximum]).range([4, 100]).clamp(true);

    return (
        <Box sx={{ maxHeight: maxVisibleHeight, overflowY: "auto", pr: 0.5 }}>
            {items.map((item) => {
                const selected = selectedIds.includes(item.id);
                const width = `${widthScale(item.count)}%`;

                return (
                    <Box key={item.id} sx={{ position: "relative", mb: 0.25 }}>
                        <Box
                            aria-hidden
                            sx={{
                                position: "absolute",
                                inset: "5px 0 5px 36px",
                                borderRadius: 1,
                                overflow: "hidden",
                                backgroundColor: "action.hover",
                            }}
                        >
                            <Box
                                sx={{
                                    width,
                                    height: "100%",
                                    backgroundColor: item.color ?? "primary.light",
                                    opacity: selected ? 0.42 : 0.22,
                                    transition: "width 180ms ease, opacity 180ms ease",
                                }}
                            />
                        </Box>

                        <FormControlLabel
                            sx={{
                                width: "100%",
                                m: 0,
                                position: "relative",
                                zIndex: 1,
                                ".MuiFormControlLabel-label": { width: "100%", minWidth: 0 },
                            }}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={selected}
                                    onChange={() => onToggle(item.id)}
                                />
                            }
                            label={
                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                                    <Typography variant="body2" noWrap title={item.label}>
                                        {item.label}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {item.count.toLocaleString()}
                                    </Typography>
                                </Box>
                            }
                        />
                    </Box>
                );
            })}
        </Box>
    );
}
