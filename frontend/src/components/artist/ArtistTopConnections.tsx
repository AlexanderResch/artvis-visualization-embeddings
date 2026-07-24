import {
    Box,
    Typography,
} from "@mui/material";

import {
    max,
    pointer,
    scaleBand,
    scaleLinear,
    select,
} from "d3";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import type {
    ArtistTopConnection,
} from "../../types/artistInspection";

import {
    entityTypeColor,
} from "../../visualization/entityColors";


type HoveredConnection = {
    item: ArtistTopConnection;
    x: number;
    y: number;
} | null;


export function ArtistTopConnections({
                                         items,
                                         selectedNodeTypes,
                                         selectedRelationshipTypes,
                                         onSelectArtist,
                                     }: {
    items: ArtistTopConnection[];
    selectedNodeTypes: string[];
    selectedRelationshipTypes: string[];
    onSelectArtist: (
        artistId: string,
    ) => void;
}) {
    const containerRef =
        useRef<HTMLDivElement | null>(null);

    const canvasRef =
        useRef<HTMLCanvasElement | null>(null);

    const hoveredRef =
        useRef<ArtistTopConnection | null>(null);

    const [
        width,
        setWidth,
    ] = useState(420);

    const [
        hovered,
        setHovered,
    ] = useState<HoveredConnection>(null);

    const visibleItems =
        useMemo(
            () =>
                items
                    .filter(
                        (item) =>
                            selectedNodeTypes.includes(
                                item.type,
                            )
                            && item.relations.some(
                                (relation) =>
                                    selectedRelationshipTypes.includes(
                                        relation,
                                    ),
                            ),
                    )
                    .slice(0, 10),
            [
                items,
                selectedNodeTypes,
                selectedRelationshipTypes,
            ],
        );

    useEffect(
        () => {
            const container =
                containerRef.current;

            if (!container) {
                return;
            }

            const observer =
                new ResizeObserver(
                    (entries) => {
                        const entry =
                            entries[0];

                        if (entry) {
                            setWidth(
                                Math.max(
                                    260,
                                    entry.contentRect.width,
                                ),
                            );
                        }
                    },
                );

            observer.observe(container);

            return () =>
                observer.disconnect();
        },
        [],
    );

    useEffect(
        () => {
            const canvas =
                canvasRef.current;

            if (!canvas) {
                return;
            }

            const context =
                canvas.getContext("2d");

            if (!context) {
                return;
            }

            const drawingContext =
                context;

            const drawingCanvas =
                canvas;

            const height = 330;
            const dpr =
                window.devicePixelRatio
                || 1;

            drawingCanvas.width =
                Math.round(width * dpr);
            drawingCanvas.height =
                Math.round(height * dpr);
            drawingCanvas.style.width =
                `${width}px`;
            drawingCanvas.style.height =
                `${height}px`;

            drawingContext.setTransform(
                dpr,
                0,
                0,
                dpr,
                0,
                0,
            );

            drawingContext.clearRect(
                0,
                0,
                width,
                height,
            );

            if (visibleItems.length === 0) {
                return;
            }

            const margin = {
                top: 12,
                right: 44,
                bottom: 12,
                left: Math.min(
                    150,
                    Math.max(
                        96,
                        width * 0.38,
                    ),
                ),
            };

            const innerWidth =
                Math.max(
                    60,
                    width
                    - margin.left
                    - margin.right,
                );

            const innerHeight =
                height
                - margin.top
                - margin.bottom;

            const yScale =
                scaleBand<number>()
                    .domain(
                        visibleItems.map(
                            (_, index) =>
                                index,
                        ),
                    )
                    .range([
                        margin.top,
                        margin.top
                        + innerHeight,
                    ])
                    .padding(0.28);

            const maximum =
                max(
                    visibleItems,
                    (item) =>
                        item.connection_count,
                )
                ?? 1;

            const xScale =
                scaleLinear()
                    .domain([
                        0,
                        maximum,
                    ])
                    .range([
                        0,
                        innerWidth,
                    ]);

            drawingContext.font =
                "12px Inter, Segoe UI, sans-serif";
            drawingContext.textBaseline =
                "middle";

            visibleItems.forEach(
                (item, index) => {
                    const y =
                        yScale(index);

                    if (y === undefined) {
                        return;
                    }

                    const barHeight =
                        yScale.bandwidth();

                    const barWidth =
                        xScale(
                            item.connection_count,
                        );

                    drawingContext.fillStyle =
                        "rgba(148, 163, 184, 0.18)";
                    drawingContext.beginPath();
                    drawingContext.roundRect(
                        margin.left,
                        y,
                        innerWidth,
                        barHeight,
                        5,
                    );
                    drawingContext.fill();

                    drawingContext.fillStyle =
                        entityTypeColor(
                            item.type,
                        );
                    drawingContext.globalAlpha =
                        item.depth === 2
                            ? 0.72
                            : 0.92;
                    drawingContext.beginPath();
                    drawingContext.roundRect(
                        margin.left,
                        y,
                        Math.max(
                            3,
                            barWidth,
                        ),
                        barHeight,
                        5,
                    );
                    drawingContext.fill();
                    drawingContext.globalAlpha = 1;

                    const label =
                        item.label.length > 23
                            ? `${item.label.slice(0, 21)}…`
                            : item.label;

                    drawingContext.fillStyle =
                        "#111827";
                    drawingContext.textAlign =
                        "right";
                    drawingContext.fillText(
                        label,
                        margin.left - 8,
                        y + barHeight / 2,
                    );

                    drawingContext.fillStyle =
                        "#4B5563";
                    drawingContext.textAlign =
                        "left";
                    drawingContext.fillText(
                        String(
                            item.connection_count,
                        ),
                        margin.left
                        + barWidth
                        + 7,
                        y + barHeight / 2,
                    );
                },
            );

            const canvasSelection =
                select(drawingCanvas);

            function itemAt(
                event: PointerEvent,
            ) {
                const [
                    pointerX,
                    pointerY,
                ] = pointer(
                    event,
                    drawingCanvas,
                );

                const foundIndex =
                    visibleItems.findIndex(
                        (_, index) => {
                            const y =
                                yScale(index);

                            return y !== undefined
                                && pointerY >= y
                                && pointerY
                                <= y
                                + yScale.bandwidth();
                        },
                    );

                return {
                    item:
                        foundIndex >= 0
                            ? visibleItems[
                                foundIndex
                                ]
                            : null,
                    x: pointerX,
                    y: pointerY,
                };
            }

            function handlePointerMove(
                event: PointerEvent,
            ) {
                const result =
                    itemAt(event);

                hoveredRef.current =
                    result.item;

                if (!result.item) {
                    setHovered(null);
                    drawingCanvas.style.cursor =
                        "default";
                    return;
                }

                setHovered({
                    item: result.item,
                    x: result.x,
                    y: result.y,
                });

                drawingCanvas.style.cursor =
                    result.item.type === "Artist"
                        ? "pointer"
                        : "default";
            }

            function handlePointerLeave() {
                hoveredRef.current = null;
                setHovered(null);
            }

            function handleClick() {
                const item =
                    hoveredRef.current;

                if (
                    item
                    && item.type === "Artist"
                ) {
                    onSelectArtist(
                        item.entity_id,
                    );
                }
            }

            canvasSelection
                .on(
                    "pointermove",
                    handlePointerMove,
                )
                .on(
                    "pointerleave",
                    handlePointerLeave,
                )
                .on(
                    "click",
                    handleClick,
                );

            return () => {
                canvasSelection.on(
                    ".artist-top-connections",
                    null,
                );
                canvasSelection
                    .on(
                        "pointermove",
                        null,
                    )
                    .on(
                        "pointerleave",
                        null,
                    )
                    .on(
                        "click",
                        null,
                    );
            };
        },
        [
            onSelectArtist,
            visibleItems,
            width,
        ],
    );

    return (
        <Box
            ref={containerRef}
            sx={{
                position: "relative",
                height: 360,
            }}
        >
            {visibleItems.length === 0
                ? (
                    <Box
                        sx={{
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            p: 2,
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            No top connections match the selected entity types.
                        </Typography>
                    </Box>
                )
                : (
                    <canvas
                        ref={canvasRef}
                        aria-label="Top Artist graph connections"
                        style={{
                            display: "block",
                            width: "100%",
                            height: 330,
                        }}
                    />
                )}

            {hovered && (
                <Box
                    sx={{
                        position: "absolute",
                        left: Math.min(
                            hovered.x + 12,
                            width - 220,
                        ),
                        top: Math.max(
                            8,
                            hovered.y - 20,
                        ),
                        maxWidth: 210,
                        p: 1,
                        pointerEvents: "none",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        backgroundColor:
                            "background.paper",
                        boxShadow: 2,
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 700,
                        }}
                    >
                        {hovered.item.label}
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        {hovered.item.type}
                        {" · "}
                        {hovered.item.connection_count}
                        {" local connections · "}
                        {hovered.item.depth}
                        {hovered.item.depth === 1
                            ? " hop"
                            : " hops"}
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
