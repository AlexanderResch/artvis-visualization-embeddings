import {
    Box,
    Button,
    Typography,
} from "@mui/material";

import {
    forceCenter,
    forceCollide,
    forceLink,
    forceManyBody,
    forceRadial,
    forceSimulation,
    pointer,
    quadtree,
    select,
    zoom,
    zoomIdentity,
    type SimulationLinkDatum,
    type SimulationNodeDatum,
    type ZoomBehavior,
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
        return 11;
    }

    if (node.type === "Artist") {
        return 7;
    }

    if (
        node.type === "Exhibition"
        || node.type === "Item"
        || node.type === "Artwork"
    ) {
        return 6;
    }

    return 5;
}


function relationOffset(
    relation: string,
): number {
    let hash = 0;

    for (
        let index = 0;
        index < relation.length;
        index += 1
    ) {
        hash =
            (
                hash * 31
                + relation.charCodeAt(index)
            ) >>> 0;
    }

    const magnitude =
        6 + hash % 10;

    return hash % 2 === 0
        ? magnitude
        : -magnitude;
}


function shortLabel(
    value: string,
    maximumLength = 26,
): string {
    if (value.length <= maximumLength) {
        return value;
    }

    return `${value.slice(
        0,
        maximumLength - 1,
    )}…`;
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
        useRef<HTMLDivElement | null>(
            null,
        );

    const canvasRef =
        useRef<HTMLCanvasElement | null>(
            null,
        );

    const transformRef =
        useRef<ZoomTransform>(
            zoomIdentity,
        );

    const zoomBehaviorRef =
        useRef<
            ZoomBehavior<
                HTMLCanvasElement,
                unknown
            >
            | null
        >(null);

    const hoveredNodeRef =
        useRef<ArtistInspectionNode | null>(
            null,
        );

    const [
        size,
        setSize,
    ] = useState({
        width: 640,
        height: 420,
    });

    const [
        tooltip,
        setTooltip,
    ] = useState<TooltipState>(
        null,
    );

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
                                280,
                                entry.contentRect.width,
                            ),
                            height: Math.max(
                                340,
                                entry.contentRect.height,
                            ),
                        });
                    },
                );

            observer.observe(
                container,
            );

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

            const maybeContext =
                canvas.getContext(
                    "2d",
                );

            if (!maybeContext) {
                return;
            }

            const context:
                CanvasRenderingContext2D =
                maybeContext;

            const drawingCanvas:
                HTMLCanvasElement =
                canvas;

            const pixelRatio =
                window.devicePixelRatio
                || 1;

            drawingCanvas.width =
                Math.round(
                    size.width
                    * pixelRatio,
                );

            drawingCanvas.height =
                Math.round(
                    size.height
                    * pixelRatio,
                );

            drawingCanvas.style.width =
                `${size.width}px`;

            drawingCanvas.style.height =
                `${size.height}px`;

            const orderedNodes =
                [...filteredData.nodes]
                    .sort(
                        (
                            first,
                            second,
                        ) =>
                            first.depth
                            - second.depth
                            || first.type.localeCompare(
                                second.type,
                            )
                            || first.label.localeCompare(
                                second.label,
                            ),
                    );

            const depthGroups =
                new Map<
                    number,
                    ArtistInspectionNode[]
                >();

            for (
                const node
                of orderedNodes
                ) {
                const group =
                    depthGroups.get(
                        node.depth,
                    )
                    ?? [];

                group.push(node);

                depthGroups.set(
                    node.depth,
                    group,
                );
            }

            const minimumDimension =
                Math.min(
                    size.width,
                    size.height,
                );

            const ringRadius = (
                depth: number,
            ) => {
                if (depth === 0) {
                    return 0;
                }

                if (depth === 1) {
                    return Math.max(
                        90,
                        minimumDimension * 0.25,
                    );
                }

                return Math.max(
                    150,
                    minimumDimension * 0.42,
                );
            };

            const layoutNodes:
                LayoutNode[] = [];

            for (
                const [
                    depth,
                    depthNodes,
                ]
                of depthGroups
                ) {
                const count =
                    Math.max(
                        1,
                        depthNodes.length,
                    );

                depthNodes.forEach(
                    (
                        node,
                        index,
                    ) => {
                        const angle =
                            -Math.PI / 2
                            + (
                                index
                                / count
                            )
                            * Math.PI
                            * 2;

                        const radius =
                            ringRadius(
                                depth,
                            );

                        layoutNodes.push({
                            key: node.key,
                            data: node,
                            x:
                                size.width / 2
                                + Math.cos(
                                    angle,
                                )
                                * radius,
                            y:
                                size.height / 2
                                + Math.sin(
                                    angle,
                                )
                                * radius,
                        });
                    },
                );
            }

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
                        relation:
                        link.relation,
                    }),
                );

            function draw() {
                context.save();

                context.setTransform(
                    pixelRatio,
                    0,
                    0,
                    pixelRatio,
                    0,
                    0,
                );

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

                const transform =
                    transformRef.current;

                const hoveredKey =
                    hoveredNodeRef.current
                        ?.key
                    ?? null;

                context.translate(
                    transform.x,
                    transform.y,
                );

                context.scale(
                    transform.k,
                    transform.k,
                );

                context.lineCap =
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

                    const incident =
                        hoveredKey === null
                        || source.key
                        === hoveredKey
                        || target.key
                        === hoveredKey;

                    const deltaX =
                        target.x
                        - source.x;

                    const deltaY =
                        target.y
                        - source.y;

                    const distance =
                        Math.max(
                            1,
                            Math.hypot(
                                deltaX,
                                deltaY,
                            ),
                        );

                    const offset =
                        Math.min(
                            18,
                            distance * 0.1,
                        )
                        * Math.sign(
                            relationOffset(
                                link.relation,
                            ),
                        );

                    const controlX =
                        (
                            source.x
                            + target.x
                        ) / 2
                        - deltaY
                        / distance
                        * offset;

                    const controlY =
                        (
                            source.y
                            + target.y
                        ) / 2
                        + deltaX
                        / distance
                        * offset;

                    context.beginPath();
                    context.moveTo(
                        source.x,
                        source.y,
                    );
                    context.quadraticCurveTo(
                        controlX,
                        controlY,
                        target.x,
                        target.y,
                    );

                    context.strokeStyle =
                        incident
                            ? "rgba(55, 65, 81, 0.42)"
                            : "rgba(107, 114, 128, 0.07)";

                    context.lineWidth =
                        (
                            hoveredKey !== null
                            && incident
                                ? 1.8
                                : 0.9
                        )
                        / transform.k;

                    context.stroke();
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

                    const relatedToHover =
                        hoveredKey === null
                        || node.key
                        === hoveredKey
                        || layoutLinks.some(
                            (link) => {
                                const source =
                                    link.source as LayoutNode;

                                const target =
                                    link.target as LayoutNode;

                                return (
                                        source.key
                                        === hoveredKey
                                        && target.key
                                        === node.key
                                    )
                                    || (
                                        target.key
                                        === hoveredKey
                                        && source.key
                                        === node.key
                                    );
                            },
                        );

                    const radius =
                        nodeRadius(
                            node.data,
                        );

                    context.beginPath();
                    context.arc(
                        node.x,
                        node.y,
                        radius,
                        0,
                        Math.PI * 2,
                    );

                    context.fillStyle =
                        entityTypeColor(
                            node.data.type,
                        );

                    context.globalAlpha =
                        relatedToHover
                            ? node.data.depth === 2
                                ? 0.78
                                : 0.98
                            : 0.2;

                    context.fill();

                    context.globalAlpha = 1;
                    context.strokeStyle =
                        node.data.depth === 0
                            ? "#111827"
                            : "#ffffff";

                    context.lineWidth =
                        (
                            node.data.depth === 0
                                ? 2.5
                                : 1.4
                        )
                        / transform.k;

                    context.stroke();

                    if (
                        node.key
                        === hoveredKey
                    ) {
                        context.beginPath();
                        context.arc(
                            node.x,
                            node.y,
                            radius
                            + 5
                            / transform.k,
                            0,
                            Math.PI * 2,
                        );

                        context.strokeStyle =
                            "#111827";

                        context.lineWidth =
                            2.5
                            / transform.k;

                        context.stroke();
                    }

                    const showLabel =
                        node.data.depth === 0
                        || (
                            node.data.depth === 1
                            && layoutNodes.length <= 24
                            && transform.k >= 1.25
                        );

                    if (showLabel) {
                        context.globalAlpha =
                            relatedToHover
                                ? 1
                                : 0.35;

                        context.font =
                            `${
                                node.data.depth === 0
                                    ? 700
                                    : 500
                            } ${
                                (
                                    node.data.depth === 0
                                        ? 12
                                        : 10
                                )
                                / transform.k
                            }px Inter, Segoe UI, sans-serif`;

                        context.textAlign =
                            "center";

                        context.textBaseline =
                            "bottom";

                        context.fillStyle =
                            "#111827";

                        context.fillText(
                            shortLabel(
                                node.data.label,
                            ),
                            node.x,
                            node.y
                            - radius
                            - 4
                            / transform.k,
                        );
                    }
                }

                context.globalAlpha = 1;
                context.restore();
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
                                    const source =
                                        link.source as LayoutNode;

                                    const target =
                                        link.target as LayoutNode;

                                    return (
                                        Math.max(
                                            source.data.depth,
                                            target.data.depth,
                                        ) === 2
                                            ? 82
                                            : 125
                                    );
                                },
                            )
                            .strength(0.14),
                    )
                    .force(
                        "charge",
                        forceManyBody<LayoutNode>()
                            .strength(
                                (node) =>
                                    node.data.depth === 0
                                        ? -520
                                        : node.data.type
                                        === "Artist"
                                            ? -260
                                            : -170,
                            ),
                    )
                    .force(
                        "collision",
                        forceCollide<LayoutNode>()
                            .radius(
                                (node) =>
                                    nodeRadius(
                                        node.data,
                                    )
                                    + 10,
                            )
                            .strength(0.95),
                    )
                    .force(
                        "radial",
                        forceRadial<LayoutNode>(
                            (node) =>
                                ringRadius(
                                    node.data.depth,
                                ),
                            size.width / 2,
                            size.height / 2,
                        ).strength(
                            (node) =>
                                node.data.depth === 0
                                    ? 1
                                    : 0.82,
                        ),
                    )
                    .force(
                        "center",
                        forceCenter(
                            size.width / 2,
                            size.height / 2,
                        ).strength(0.08),
                    )
                    .alpha(1)
                    .alphaDecay(0.032)
                    .velocityDecay(0.34)
                    .on(
                        "tick",
                        draw,
                    );

            const zoomBehavior =
                zoom<
                    HTMLCanvasElement,
                    unknown
                >()
                    .scaleExtent([
                        0.35,
                        6,
                    ])
                    .on(
                        "zoom",
                        (event) => {
                            transformRef.current =
                                event.transform;

                            setTooltip(null);
                            draw();
                        },
                    );

            zoomBehaviorRef.current =
                zoomBehavior;

            select(drawingCanvas).call(
                zoomBehavior,
            );

            function findNode(
                event: PointerEvent,
            ): {
                node:
                    LayoutNode
                    | undefined;
                screenX: number;
                screenY: number;
            } {
                const [
                    screenX,
                    screenY,
                ] = pointer(
                    event,
                    drawingCanvas,
                );

                const [
                    worldX,
                    worldY,
                ] =
                    transformRef.current
                        .invert([
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
                        14
                        / transformRef.current.k,
                    );

                return {
                    node: found,
                    screenX,
                    screenY,
                };
            }

            function handlePointerMove(
                event: PointerEvent,
            ) {
                const result =
                    findNode(
                        event,
                    );

                if (!result.node) {
                    hoveredNodeRef.current =
                        null;

                    setTooltip(null);

                    drawingCanvas.style.cursor =
                        "grab";

                    draw();
                    return;
                }

                hoveredNodeRef.current =
                    result.node.data;

                setTooltip({
                    x: result.screenX,
                    y: result.screenY,
                    node: result.node.data,
                });

                drawingCanvas.style.cursor =
                    result.node.data.type
                    === "Artist"
                    && result.node.data.depth
                    > 0
                        ? "pointer"
                        : "default";

                draw();
            }

            function handlePointerLeave() {
                hoveredNodeRef.current =
                    null;

                setTooltip(null);

                drawingCanvas.style.cursor =
                    "grab";

                draw();
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

                if (
                    zoomBehaviorRef.current
                    === zoomBehavior
                ) {
                    zoomBehaviorRef.current =
                        null;
                }

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

    function resetNetworkView() {
        const canvas =
            canvasRef.current;

        const behavior =
            zoomBehaviorRef.current;

        setTooltip(null);

        if (
            !canvas
            || !behavior
        ) {
            transformRef.current =
                zoomIdentity;

            return;
        }

        select(canvas).call(
            behavior.transform,
            zoomIdentity,
        );
    }

    if (
        filteredData.nodes.length <= 1
    ) {
        return (
            <Box
                sx={{
                    minHeight: 340,
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
                height: 460,
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
                    overflow: "hidden",
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

                <Button
                    type="button"
                    size="small"
                    variant="outlined"
                    onClick={
                        resetNetworkView
                    }
                    sx={{
                        position: "absolute",
                        right: 10,
                        bottom: 10,
                        zIndex: 2,
                        backgroundColor:
                            "rgba(255,255,255,0.94)",
                    }}
                >
                    Reset network
                </Button>

                {tooltip && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            width: 220,
                            maxWidth:
                                "calc(100% - 20px)",
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

                        {tooltip.node.type
                            === "Artist"
                            && tooltip.node.depth > 0 && (
                                <Typography
                                    variant="caption"
                                    color="primary.main"
                                    sx={{
                                        display: "block",
                                        mt: 0.25,
                                    }}
                                >
                                    Click to inspect Artist
                                </Typography>
                            )}
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
