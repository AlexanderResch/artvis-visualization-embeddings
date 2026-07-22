import {
    Box,
    Typography,
} from "@mui/material";

import {
    scaleLinear,
} from "d3";

import type {
    ClusterEvidenceItem,
} from "../../types/cluster";


export function ScentedMetricList({
                                      items,
                                      maximumItems,
                                      color = "primary.main",
                                      emptyText = "No data available",
                                  }: {
    items: ClusterEvidenceItem[];
    maximumItems?: number;
    color?: string;
    emptyText?: string;
}) {
    const visibleItems =
        maximumItems === undefined
            ? items
            : items.slice(
                0,
                maximumItems,
            );

    const maximumPercentage =
        Math.max(
            1,
            ...visibleItems.map(
                (item) =>
                    item.percentage,
            ),
        );

    const widthScale =
        scaleLinear()
            .domain([
                0,
                maximumPercentage,
            ])
            .range([
                2,
                100,
            ])
            .clamp(true);

    if (!visibleItems.length) {
        return (
            <Typography
                variant="body2"
                color="text.secondary"
            >
                {emptyText}
            </Typography>
        );
    }

    return (
        <Box>
            {visibleItems.map(
                (item) => (
                    <Box
                        key={item.id}
                        sx={{
                            mb: 1,
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent:
                                    "space-between",
                                gap: 1,
                                mb: 0.35,
                            }}
                        >
                            <Typography
                                variant="body2"
                                noWrap
                                title={item.name}
                                sx={{
                                    minWidth: 0,
                                }}
                            >
                                {item.name}
                            </Typography>

                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {item.artist_count.toLocaleString()}
                                {" · "}
                                {item.percentage.toFixed(1)}%
                            </Typography>
                        </Box>

                        <Box
                            sx={{
                                height: 7,
                                borderRadius: 999,
                                overflow: "hidden",
                                backgroundColor:
                                    "action.hover",
                            }}
                        >
                            <Box
                                sx={{
                                    width:
                                        `${widthScale(
                                            item.percentage,
                                        )}%`,
                                    height: "100%",
                                    borderRadius: 999,
                                    backgroundColor: color,
                                }}
                            />
                        </Box>
                    </Box>
                ),
            )}
        </Box>
    );
}
