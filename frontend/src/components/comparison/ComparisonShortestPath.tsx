import {
    Alert,
    Box,
    Typography,
} from "@mui/material";

import {
    scalePoint,
} from "d3";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import type {
    ComparisonPathNode,
    ComparisonShortestPath,
} from "../../types/comparison";

import {
    entityTypeColor,
} from "../../visualization/entityColors";


type CanvasSize = {
    width: number;
    height: number;
};


type DrawnNode = {
    node: ComparisonPathNode;
    x: number;
    y: number;
    radius: number;
};


function prepareCanvas(
    canvas: HTMLCanvasElement,
    size: CanvasSize,
): CanvasRenderingContext2D | null {
    const ratio =
        window.devicePixelRatio
        || 1;

    canvas.width = Math.max(
        1,
        Math.round(
            size.width * ratio,
        ),
    );

    canvas.height = Math.max(
        1,
        Math.round(
            size.height * ratio,
        ),
    );

    canvas.style.width =
        `${size.width}px`;
    canvas.style.height =
        `${size.height}px`;

    const context =
        canvas.getContext("2d");

    if (!context) {
        return null;
    }

    context.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0,
    );

    return context;
}


function shortLabel(
    value: string,
    maximumLength = 22,
): string {
    if (value.length <= maximumLength) {
        return value;
    }

    return `${value.slice(0, maximumLength - 1)}…`;
}


export function ComparisonShortestPath({
                                           path,
                                           showEdgeLabels,
                                           onSelectArtist,
                                       }: {
    path: ComparisonShortestPath;
    showEdgeLabels: boolean;
    onSelectArtist?: (
        artistId: string,
    ) => void;
}) {
    const containerRef =
        useRef<HTMLDivElement | null>(null);

    const canvasRef =
        useRef<HTMLCanvasElement | null>(null);

    const drawnNodesRef =
        useRef<DrawnNode[]>([]);

    const [size, setSize] =
        useState<CanvasSize>({
            width: 0,
            height: 330,
        });

    const [hoveredNode, setHoveredNode] =
        useState<DrawnNode | null>(null);

    const legendTypes =
        useMemo(
            () =>
                Array.from(
                    new Set(
                        path.nodes.map(
                            (node) => node.type,
                        ),
                    ),
                ),
            [path.nodes],
        );

    const draw =
        useCallback(
            () => {
                const canvas =
                    canvasRef.current;

                if (
                    !canvas
                    || size.width <= 0
                ) {
                    return;
                }

                const context =
                    prepareCanvas(
                        canvas,
                        size,
                    );

                if (!context) {
                    return;
                }

                context.clearRect(
                    0,
                    0,
                    size.width,
                    size.height,
                );

                context.fillStyle =
                    "#ffffff";
                context.fillRect(
                    0,
                    0,
                    size.width,
                    size.height,
                );

                const nodeKeys =
                    path.nodes.map(
                        (node) => node.key,
                    );

                const xScale =
                    scalePoint<string>()
                        .domain(nodeKeys)
                        .range([
                            54,
                            Math.max(
                                54,
                                size.width - 54,
                            ),
                        ])
                        .padding(0.35);

                const centerY =
                    Math.min(
                        175,
                        size.height * 0.5,
                    );

                const drawnNodes:
                    DrawnNode[] =
                    path.nodes.map(
                        (node, index) => ({
                            node,
                            x:
                                xScale(node.key)
                                ?? 54,
                            y:
                                centerY
                                + (
                                    index % 2 === 0
                                        ? -30
                                        : 30
                                ),
                            radius:
                                node.type === "Artist"
                                    ? 15
                                    : 12,
                        }),
                    );

                const byKey =
                    new Map(
                        drawnNodes.map(
                            (item) => [
                                item.node.key,
                                item,
                            ],
                        ),
                    );

                for (
                    const [index, link]
                    of path.links.entries()
                    ) {
                    const source =
                        byKey.get(link.source);
                    const target =
                        byKey.get(link.target);

                    if (!source || !target) {
                        continue;
                    }

                    context.save();
                    context.beginPath();
                    context.moveTo(
                        source.x,
                        source.y,
                    );
                    context.lineTo(
                        target.x,
                        target.y,
                    );
                    context.strokeStyle =
                        "#64748B";
                    context.lineWidth = 2;
                    context.stroke();

                    if (showEdgeLabels) {
                        const middleX =
                            (source.x + target.x)
                            / 2;
                        const middleY =
                            (source.y + target.y)
                            / 2;
                        const label =
                            shortLabel(
                                link.type,
                                18,
                            );

                        context.font =
                            "600 10px Inter, Segoe UI, Arial";
                        const width =
                            context.measureText(
                                label,
                            ).width
                            + 10;

                        context.fillStyle =
                            "rgba(255,255,255,0.94)";
                        context.fillRect(
                            middleX - width / 2,
                            middleY - 9,
                            width,
                            18,
                        );

                        context.fillStyle =
                            "#475569";
                        context.textAlign =
                            "center";
                        context.textBaseline =
                            "middle";
                        context.fillText(
                            label,
                            middleX,
                            middleY,
                        );
                    }

                    if (index === path.links.length - 1) {
                        context.restore();
                    } else {
                        context.restore();
                    }
                }

                for (const item of drawnNodes) {
                    const color =
                        entityTypeColor(
                            item.node.type,
                        );

                    context.beginPath();
                    context.arc(
                        item.x,
                        item.y,
                        item.radius,
                        0,
                        Math.PI * 2,
                    );
                    context.fillStyle = color;
                    context.fill();
                    context.strokeStyle =
                        "#ffffff";
                    context.lineWidth = 2;
                    context.stroke();

                    context.fillStyle =
                        "#111827";
                    context.font =
                        "600 11px Inter, Segoe UI, Arial";
                    context.textAlign =
                        "center";
                    context.textBaseline =
                        "top";
                    context.fillText(
                        shortLabel(
                            item.node.label,
                            20,
                        ),
                        item.x,
                        item.y
                        + item.radius
                        + 7,
                    );
                }

                drawnNodesRef.current =
                    drawnNodes;
            },
            [
                path.links,
                path.nodes,
                showEdgeLabels,
                size,
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
                    ([entry]) => {
                        if (!entry) {
                            return;
                        }

                        setSize({
                            width: Math.max(
                                1,
                                entry.contentRect.width,
                            ),
                            height: 330,
                        });
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
            draw();
        },
        [draw],
    );

    function findNode(
        event: {
            currentTarget: HTMLCanvasElement;
            clientX: number;
            clientY: number;
        },
    ): DrawnNode | null {
        const bounds =
            event.currentTarget
                .getBoundingClientRect();

        const x =
            event.clientX - bounds.left;
        const y =
            event.clientY - bounds.top;

        return drawnNodesRef.current.find(
                (item) =>
                    Math.hypot(
                        item.x - x,
                        item.y - y,
                    )
                    <= item.radius + 5,
            )
            ?? null;
    }

    if (!path.found) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info">
                    No connecting path was found within the selected maximum number of hops.
                </Alert>
            </Box>
        );
    }

    return (
        <Box
            ref={containerRef}
            sx={{
                position: "relative",
                minHeight: 330,
            }}
        >
            <canvas
                ref={canvasRef}
                onPointerMove={
                    (event) => {
                        const node =
                            findNode(event);

                        setHoveredNode(node);
                        event.currentTarget.style.cursor =
                            node?.node.type === "Artist"
                            && onSelectArtist
                                ? "pointer"
                                : node
                                    ? "default"
                                    : "default";
                    }
                }
                onPointerLeave={() =>
                    setHoveredNode(null)
                }
                onClick={
                    (event) => {
                        const node =
                            findNode(event);

                        if (
                            node?.node.type
                            === "Artist"
                            && onSelectArtist
                        ) {
                            onSelectArtist(
                                node.node.id,
                            );
                        }
                    }
                }
                aria-label="Shortest connecting path between the compared Artists"
            />

            {hoveredNode && (
                <Box
                    sx={{
                        position: "absolute",
                        left: 12,
                        top: 12,
                        maxWidth: 260,
                        p: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        backgroundColor:
                            "rgba(255,255,255,0.96)",
                        pointerEvents: "none",
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{ fontWeight: 700 }}
                    >
                        {hoveredNode.node.label}
                    </Typography>

                    <Typography
                        variant="caption"
                        color="text.secondary"
                    >
                        {hoveredNode.node.type}
                    </Typography>
                </Box>
            )}

            <Box
                sx={{
                    position: "absolute",
                    left: 12,
                    right: 12,
                    bottom: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1.25,
                }}
            >
                {legendTypes.map(
                    (nodeType) => (
                        <Box
                            key={nodeType}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    backgroundColor:
                                        entityTypeColor(
                                            nodeType,
                                        ),
                                }}
                            />

                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {nodeType}
                            </Typography>
                        </Box>
                    ),
                )}
            </Box>
        </Box>
    );
}
