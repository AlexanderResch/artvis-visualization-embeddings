import {
    Box,
    Typography,
} from "@mui/material";

import {
    forceCenter,
    forceCollide,
    forceLink,
    forceManyBody,
    forceSimulation,
    pointer,
    quadtree,
    select,
    zoom,
    zoomIdentity,
    type SimulationLinkDatum,
    type SimulationNodeDatum,
    type ZoomTransform,
} from "d3";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import type {
    ArtistInspectionLink,
    ArtistInspectionNode,
} from "../../types/artistInspection";

import {
    entityTypeColor,
} from "../../visualization/entityColors";


type LayoutNode =
    SimulationNodeDatum & {
    key: string;
    data: ArtistInspectionNode;
};


type LayoutLink =
    SimulationLinkDatum<LayoutNode> & {
    source: string | LayoutNode;
    target: string | LayoutNode;
    relation: string;
};


type TooltipState = {
    x: number;
    y: number;
    node: ArtistInspectionNode;
} | null;


function nodeRadius(
    node: ArtistInspectionNode,
): number {
    if (node.depth === 0) {
        return 9;
    }

    if (node.type === "Artist") {
        return 6;
    }

    if (node.type === "Exhibition") {
        return 5.5;
    }

    return 4.5;
}


export function ArtistEgoNetwork({
                                     nodes,
                                     links,
                                     selectedNodeTypes,
                                     onSelectArtist,
                                 }: {
    nodes: ArtistInspectionNode[];
    links: ArtistInspectionLink[];
    selectedNodeTypes: string[];
    onSelectArtist: (
        artistId: string,
    ) => void;
}) {
    const containerRef =
        useRef<HTMLDivElement | null>(null);

    const canvasRef =
        useRef<HTMLCanvasElement | null>(null);

    const transformRef =
        useRef<ZoomTransform>(
            zoomIdentity,
        );

    const hoveredNodeRef =
        useRef<ArtistInspectionNode | null>(null);

    const [
        size,
        setSize,
    ] = useState({
        width: 640,
        height: 320,
    });

    const [
        tooltip,
        setTooltip,
    ] = useState<TooltipState>(null);

    const filteredData =
        useMemo(
            () => {
                const visibleNodes =
                    nodes.filter(
                        (node) =>
                            node.depth === 0
                            || selectedNodeTypes.includes(
                                node.type,
                            ),
                    );

                const visibleKeys =
                    new Set(
                        visibleNodes.map(
                            (node) =>
                                node.key,
                        ),
                    );

                const visibleLinks =
                    links.filter(
                        (link) =>
                            visibleKeys.has(
                                link.source,
                            )
                            && visibleKeys.has(
                                link.target,
                            ),
                    );

                return {
                    nodes: visibleNodes,
                    links: visibleLinks,
                };
            },
            [
                links,
                nodes,
                selectedNodeTypes,
            ],
        );

    const legendTypes =
        useMemo(
            () =>
                Array.from(
                    new Set(
                        filteredData.nodes
                            .filter(
                                (node) =>
                                    node.depth > 0,
                            )
                            .map(
                                (node) =>
                                    node.type,
                            ),
                    ),
                ).sort(),
            [filteredData.nodes],
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

                        if (!entry) {
                            return;
                        }

                        setSize({
                            width: Math.max(
                                240,
                                entry.contentRect.width,
                            ),
                            height: Math.max(
                                260,
                                entry.contentRect.height,
                            ),
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
            const canvas =
                canvasRef.current;

            if (
                !canvas
                || filteredData.nodes.length === 0
            ) {
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

            const devicePixelRatio =
                window.devicePixelRatio
                || 1;

            drawingCanvas.width =
                Math.round(
                    size.width
                    * devicePixelRatio,
                );

            drawingCanvas.height =
                Math.round(
                    size.height
                    * devicePixelRatio,
                );

            drawingCanvas.style.width =
                `${size.width}px`;

            drawingCanvas.style.height =
                `${size.height}px`;

            drawingContext.setTransform(
                devicePixelRatio,
                0,
                0,
                devicePixelRatio,
                0,
                0,
            );

            const layoutNodes:
                LayoutNode[] =
                filteredData.nodes.map(
                    (node, index) => ({
                        key: node.key,
                        data: node,
                        x:
                            size.width / 2
                            + Math.cos(index)
                            * 20,
                        y:
                            size.height / 2
                            + Math.sin(index)
                            * 20,
                    }),
                );

            const root =
                layoutNodes.find(
                    (node) =>
                        node.data.depth === 0,
                );

            if (root) {
                root.fx =
                    size.width / 2;
                root.fy =
                    size.height / 2;
            }

            const layoutLinks:
                LayoutLink[] =
                filteredData.links.map(
                    (link) => ({
                        source: link.source,
                        target: link.target,
                        relation: link.relation,
                    }),
                );

            function draw() {
                drawingContext.save();

                drawingContext.setTransform(
                    devicePixelRatio,
                    0,
                    0,
                    devicePixelRatio,
                    0,
                    0,
                );

                drawingContext.clearRect(
                    0,
                    0,
                    size.width,
                    size.height,
                );

                const transform =
                    transformRef.current;

                drawingContext.translate(
                    transform.x,
                    transform.y,
                );

                drawingContext.scale(
                    transform.k,
                    transform.k,
                );

                drawingContext.lineCap =
                    "round";

                for (
                    const link
                    of layoutLinks
                    ) {
                    const source =
                        link.source as LayoutNode;
                    const target =
                        link.target as LayoutNode;

                    if (
                        source.x === undefined
                        || source.y === undefined
                        || target.x === undefined
                        || target.y === undefined
                    ) {
                        continue;
                    }

                    drawingContext.beginPath();
                    drawingContext.moveTo(
                        source.x,
                        source.y,
                    );
                    drawingContext.lineTo(
                        target.x,
                        target.y,
                    );
                    drawingContext.strokeStyle =
                        "rgba(75, 85, 99, 0.28)";
                    drawingContext.lineWidth =
                        1 / transform.k;
                    drawingContext.stroke();
                }

                for (
                    const node
                    of layoutNodes
                    ) {
                    if (
                        node.x === undefined
                        || node.y === undefined
                    ) {
                        continue;
                    }

                    const radius =
                        nodeRadius(
                            node.data,
                        );

                    drawingContext.beginPath();
                    drawingContext.arc(
                        node.x,
                        node.y,
                        radius,
                        0,
                        Math.PI * 2,
                    );
                    drawingContext.fillStyle =
                        entityTypeColor(
                            node.data.type,
                        );
                    drawingContext.globalAlpha =
                        node.data.depth === 2
                            ? 0.72
                            : 0.95;
                    drawingContext.fill();

                    drawingContext.globalAlpha = 1;
                    drawingContext.strokeStyle =
                        node.data.depth === 0
                            ? "#FFFFFF"
                            : "rgba(255,255,255,0.9)";
                    drawingContext.lineWidth =
                        node.data.depth === 0
                            ? 2.5 / transform.k
                            : 1 / transform.k;
                    drawingContext.stroke();
                }

                if (
                    root
                    && root.x !== undefined
                    && root.y !== undefined
                ) {
                    drawingContext.globalAlpha = 1;
                    drawingContext.font =
                        `${12 / transform.k}px Inter, Segoe UI, sans-serif`;
                    drawingContext.textAlign =
                        "center";
                    drawingContext.textBaseline =
                        "bottom";
                    drawingContext.fillStyle =
                        "#111827";
                    drawingContext.fillText(
                        root.data.label,
                        root.x,
                        root.y
                        - nodeRadius(
                            root.data,
                        )
                        - 5 / transform.k,
                    );
                }

                drawingContext.restore();
            }

            const simulation =
                forceSimulation<LayoutNode>(
                    layoutNodes,
                )
                    .force(
                        "link",
                        forceLink<
                            LayoutNode,
                            LayoutLink
                        >(layoutLinks)
                            .id(
                                (node) =>
                                    node.key,
                            )
                            .distance(
                                (link) => {
                                    const target =
                                        link.target as LayoutNode;

                                    return target.data.depth === 2
                                        ? 52
                                        : 82;
                                },
                            )
                            .strength(0.45),
                    )
                    .force(
                        "charge",
                        forceManyBody()
                            .strength(-90),
                    )
                    .force(
                        "collision",
                        forceCollide<LayoutNode>()
                            .radius(
                                (node) =>
                                    nodeRadius(
                                        node.data,
                                    )
                                    + 4,
                            ),
                    )
                    .force(
                        "center",
                        forceCenter(
                            size.width / 2,
                            size.height / 2,
                        ),
                    )
                    .alphaDecay(0.045)
                    .on(
                        "tick",
                        draw,
                    );

            const zoomBehavior =
                zoom<HTMLCanvasElement, unknown>()
                    .scaleExtent([
                        0.5,
                        5,
                    ])
                    .on(
                        "zoom",
                        (event) => {
                            transformRef.current =
                                event.transform;
                            draw();
                        },
                    );

            select(drawingCanvas)
                .call(zoomBehavior);

            function handlePointerMove(
                event: PointerEvent,
            ) {
                const [
                    screenX,
                    screenY,
                ] = pointer(
                    event,
                    drawingCanvas,
                );

                const transform =
                    transformRef.current;

                const [
                    worldX,
                    worldY,
                ] = transform.invert([
                    screenX,
                    screenY,
                ]);

                const tree =
                    quadtree<LayoutNode>()
                        .x(
                            (node) =>
                                node.x ?? 0,
                        )
                        .y(
                            (node) =>
                                node.y ?? 0,
                        )
                        .addAll(
                            layoutNodes,
                        );

                const found =
                    tree.find(
                        worldX,
                        worldY,
                        12 / transform.k,
                    );

                if (!found) {
                    hoveredNodeRef.current = null;
                    setTooltip(null);
                    drawingCanvas.style.cursor =
                        "grab";
                    return;
                }

                hoveredNodeRef.current =
                    found.data;

                setTooltip({
                    x: screenX,
                    y: screenY,
                    node: found.data,
                });

                drawingCanvas.style.cursor =
                    found.data.type === "Artist"
                    && found.data.depth > 0
                        ? "pointer"
                        : "default";
            }

            function handlePointerLeave() {
                hoveredNodeRef.current = null;
                setTooltip(null);
                drawingCanvas.style.cursor =
                    "grab";
            }

            function handleClick() {
                const node =
                    hoveredNodeRef.current;

                if (
                    node
                    && node.type === "Artist"
                    && node.depth > 0
                ) {
                    onSelectArtist(
                        node.entity_id,
                    );
                }
            }

            drawingCanvas.addEventListener(
                "pointermove",
                handlePointerMove,
            );

            drawingCanvas.addEventListener(
                "pointerleave",
                handlePointerLeave,
            );

            drawingCanvas.addEventListener(
                "click",
                handleClick,
            );

            draw();

            return () => {
                simulation.stop();
                select(drawingCanvas).on(
                    ".zoom",
                    null,
                );
                drawingCanvas.removeEventListener(
                    "pointermove",
                    handlePointerMove,
                );
                drawingCanvas.removeEventListener(
                    "pointerleave",
                    handlePointerLeave,
                );
                drawingCanvas.removeEventListener(
                    "click",
                    handleClick,
                );
            };
        },
        [
            filteredData.links,
            filteredData.nodes,
            onSelectArtist,
            size.height,
            size.width,
        ],
    );

    if (
        filteredData.nodes.length <= 1
    ) {
        return (
            <Box
                sx={{
                    minHeight: 280,
                    display: "grid",
                    placeItems: "center",
                    p: 2,
                }}
            >
                <Typography
                    variant="body2"
                    color="text.secondary"
                >
                    No ego-network entities match the current type selection.
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                height: 360,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <Box
                ref={containerRef}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    position: "relative",
                }}
            >
                <canvas
                    ref={canvasRef}
                    aria-label="Interactive Artist ego network"
                    style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        touchAction: "none",
                    }}
                />

                {tooltip && (
                    <Box
                        sx={{
                            position: "absolute",
                            left: Math.min(
                                tooltip.x + 12,
                                size.width - 210,
                            ),
                            top: Math.max(
                                8,
                                tooltip.y - 12,
                            ),
                            maxWidth: 200,
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
                            {tooltip.node.label}
                        </Typography>

                        <Typography
                            variant="caption"
                            color="text.secondary"
                        >
                            {tooltip.node.type}
                            {" · "}
                            {tooltip.node.depth}
                            {tooltip.node.depth === 1
                                ? " hop"
                                : " hops"}
                        </Typography>
                    </Box>
                )}
            </Box>

            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    px: 1.25,
                    py: 0.75,
                    borderTop: "1px solid",
                    borderColor: "divider",
                }}
            >
                {legendTypes.map(
                    (entityType) => (
                        <Box
                            key={entityType}
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
                                            entityType,
                                        ),
                                }}
                            />

                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {entityType}
                            </Typography>
                        </Box>
                    ),
                )}
            </Box>
        </Box>
    );
}
