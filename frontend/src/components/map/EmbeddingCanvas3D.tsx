import {
    Box,
    Button,
} from "@mui/material";

import {
    drag,
    extent,
    pointer,
    polygonHull,
    quadtree,
    scaleLinear,
    select,
    type D3DragEvent,
    type Quadtree,
} from "d3";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
} from "react";

import {
    useExplorer,
} from "../../context/ExplorerContext";

import type {
    ArtistEmbedding3D,
} from "../../types/embedding";

import {
    clusterColor,
} from "../../visualization/colors";

import {
    CanvasTooltip,
    type CanvasTooltipState,
} from "./CanvasTooltip";


type CanvasSize = {
    width: number;
    height: number;
};


type NormalizedPoint = {
    artist: ArtistEmbedding3D;
    x: number;
    y: number;
    z: number;
};


type ProjectedPoint = {
    artist: ArtistEmbedding3D;
    screenX: number;
    screenY: number;
    depth: number;
    perspective: number;
};


type ProjectedCoordinate = {
    screenX: number;
    screenY: number;
};


const DEFAULT_ROTATION = {
    x: -0.35,
    y: 0.65,
};


function safeDomain(
    values: number[],
): [number, number] {
    const [minimum, maximum] =
        extent(values);

    if (
        minimum === undefined
        || maximum === undefined
    ) {
        return [-1, 1];
    }

    if (minimum === maximum) {
        return [
            minimum - 1,
            maximum + 1,
        ];
    }

    return [minimum, maximum];
}


function prepareCanvas(
    canvas: HTMLCanvasElement,
    size: CanvasSize,
): CanvasRenderingContext2D | null {
    const pixelRatio =
        window.devicePixelRatio
        || 1;

    const pixelWidth =
        Math.max(
            1,
            Math.round(
                size.width
                * pixelRatio,
            ),
        );

    const pixelHeight =
        Math.max(
            1,
            Math.round(
                size.height
                * pixelRatio,
            ),
        );

    if (
        canvas.width !== pixelWidth
        || canvas.height !== pixelHeight
    ) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width =
            `${size.width}px`;
        canvas.style.height =
            `${size.height}px`;
    }

    const context =
        canvas.getContext(
            "2d",
            {
                alpha: true,
            },
        );

    if (!context) {
        return null;
    }

    context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0,
    );

    return context;
}


function projectPoint(
    point: NormalizedPoint,
    size: CanvasSize,
    rotation: {
        x: number;
        y: number;
    },
    zoom: number,
): ProjectedPoint {
    const cosX =
        Math.cos(rotation.x);

    const sinX =
        Math.sin(rotation.x);

    const cosY =
        Math.cos(rotation.y);

    const sinY =
        Math.sin(rotation.y);

    const rotatedX =
        point.x * cosY
        + point.z * sinY;

    const firstDepth =
        -point.x * sinY
        + point.z * cosY;

    const rotatedY =
        point.y * cosX
        - firstDepth * sinX;

    const depth =
        point.y * sinX
        + firstDepth * cosX;

    const perspective =
        1 / (1 + depth * 0.22);

    const baseScale =
        Math.min(
            size.width,
            size.height,
        )
        * 0.36
        * zoom;

    return {
        artist: point.artist,

        screenX:
            size.width / 2
            + rotatedX
            * baseScale
            * perspective,

        screenY:
            size.height / 2
            - rotatedY
            * baseScale
            * perspective,

        depth,
        perspective,
    };
}


function expandHull(
    hull: [number, number][],
    padding: number,
): [number, number][] {
    const centroidX =
        hull.reduce(
            (sum, point) =>
                sum + point[0],
            0,
        ) / hull.length;

    const centroidY =
        hull.reduce(
            (sum, point) =>
                sum + point[1],
            0,
        ) / hull.length;

    return hull.map(
        ([x, y]) => {
            const deltaX =
                x - centroidX;

            const deltaY =
                y - centroidY;

            const distance =
                Math.hypot(
                    deltaX,
                    deltaY,
                );

            if (distance < 0.001) {
                return [x, y];
            }

            const factor =
                (distance + padding)
                / distance;

            return [
                centroidX
                + deltaX * factor,

                centroidY
                + deltaY * factor,
            ];
        },
    );
}


function roundedRectangle(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    const safeRadius =
        Math.min(
            radius,
            width / 2,
            height / 2,
        );

    context.beginPath();
    context.moveTo(
        x + safeRadius,
        y,
    );
    context.lineTo(
        x + width - safeRadius,
        y,
    );
    context.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + safeRadius,
    );
    context.lineTo(
        x + width,
        y + height - safeRadius,
    );
    context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - safeRadius,
        y + height,
    );
    context.lineTo(
        x + safeRadius,
        y + height,
    );
    context.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - safeRadius,
    );
    context.lineTo(
        x,
        y + safeRadius,
    );
    context.quadraticCurveTo(
        x,
        y,
        x + safeRadius,
        y,
    );
    context.closePath();
}


function drawClusterBoundary(
    context: CanvasRenderingContext2D,
    boundaryPoints: ProjectedCoordinate[],
    clusterId: number,
) {
    if (boundaryPoints.length < 3) {
        return;
    }

    const hull =
        polygonHull(
            boundaryPoints.map(
                (point) => [
                    point.screenX,
                    point.screenY,
                ] as [number, number],
            ),
        );

    if (!hull) {
        return;
    }

    const expandedHull =
        expandHull(
            hull,
            12,
        );

    const color =
        clusterColor(clusterId);

    context.save();

    context.beginPath();
    context.moveTo(
        expandedHull[0][0],
        expandedHull[0][1],
    );

    for (
        let index = 1;
        index < expandedHull.length;
        index += 1
    ) {
        context.lineTo(
            expandedHull[index][0],
            expandedHull[index][1],
        );
    }

    context.closePath();

    context.globalAlpha = 0.08;
    context.fillStyle = color;
    context.fill();

    context.globalAlpha = 0.95;
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.setLineDash([
        8,
        5,
    ]);
    context.stroke();
    context.setLineDash([]);

    const topPoint =
        expandedHull.reduce(
            (currentTop, point) =>
                point[1] < currentTop[1]
                    ? point
                    : currentTop,
            expandedHull[0],
        );

    const label =
        `Cluster ${clusterId}`;

    context.font =
        "600 12px Inter, Segoe UI, Arial";

    const labelWidth =
        context.measureText(label).width;

    const labelX =
        topPoint[0]
        - labelWidth / 2
        - 7;

    const labelY =
        topPoint[1]
        - 31;

    context.globalAlpha = 0.96;
    context.fillStyle =
        "rgba(255,255,255,0.96)";
    context.strokeStyle = color;
    context.lineWidth = 1.5;

    roundedRectangle(
        context,
        labelX,
        labelY,
        labelWidth + 14,
        24,
        7,
    );

    context.fill();
    context.stroke();

    context.fillStyle = color;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(
        label,
        labelX + 7,
        labelY + 12,
    );

    context.restore();
}


export default function EmbeddingCanvas3D({
                                              data,
                                              highlightBoundaryData,
                                              highlightClusterId = null,
                                              dimNonHighlighted = false,
                                              onArtistClick,
                                          }: {
    data: ArtistEmbedding3D[];
    highlightBoundaryData?:
        ArtistEmbedding3D[];
    highlightClusterId?:
        number | null;
    dimNonHighlighted?: boolean;
    onArtistClick?:
        (artist: ArtistEmbedding3D) => void;
}) {
    const explorer =
        useExplorer();

    const containerRef =
        useRef<HTMLDivElement | null>(
            null,
        );

    const canvasRef =
        useRef<HTMLCanvasElement | null>(
            null,
        );

    const sizeRef =
        useRef<CanvasSize>({
            width: 0,
            height: 0,
        });

    const rotationRef =
        useRef({
            ...DEFAULT_ROTATION,
        });

    const zoomRef =
        useRef(1);

    const quadtreeRef =
        useRef<
            Quadtree<ProjectedPoint>
            | null
        >(null);

    const animationFrameRef =
        useRef<number | null>(
            null,
        );

    const [
        size,
        setSize,
    ] = useState<CanvasSize>({
        width: 0,
        height: 0,
    });

    const [
        tooltip,
        setTooltip,
    ] = useState<
        CanvasTooltipState | null
    >(null);

    const normalizedData =
        useMemo(
            () => {
                const boundarySource =
                    highlightBoundaryData
                    ?? [];

                const scaleSource =
                    boundarySource.length
                        ? [
                            ...data,
                            ...boundarySource,
                        ]
                        : data;

                const xScale =
                    scaleLinear()
                        .domain(
                            safeDomain(
                                scaleSource.map(
                                    (point) =>
                                        point.x,
                                ),
                            ),
                        )
                        .range([-1, 1]);

                const yScale =
                    scaleLinear()
                        .domain(
                            safeDomain(
                                scaleSource.map(
                                    (point) =>
                                        point.y,
                                ),
                            ),
                        )
                        .range([-1, 1]);

                const zScale =
                    scaleLinear()
                        .domain(
                            safeDomain(
                                scaleSource.map(
                                    (point) =>
                                        point.z,
                                ),
                            ),
                        )
                        .range([-1, 1]);

                const normalize =
                    (
                        artist: ArtistEmbedding3D,
                    ): NormalizedPoint => ({
                        artist,
                        x: xScale(artist.x),
                        y: yScale(artist.y),
                        z: zScale(artist.z),
                    });

                return {
                    points:
                        data.map(normalize),

                    boundaryPoints:
                        boundarySource
                            .filter(
                                (artist) =>
                                    highlightClusterId
                                    === null
                                    || artist.cluster
                                    === highlightClusterId,
                            )
                            .map(normalize),
                };
            },
            [
                data,
                highlightBoundaryData,
                highlightClusterId,
            ],
        );

    const draw =
        useCallback(
            () => {
                const canvas =
                    canvasRef.current;

                const currentSize =
                    sizeRef.current;

                if (
                    !canvas
                    || currentSize.width <= 0
                    || currentSize.height <= 0
                ) {
                    return;
                }

                const context =
                    prepareCanvas(
                        canvas,
                        currentSize,
                    );

                if (!context) {
                    return;
                }

                context.clearRect(
                    0,
                    0,
                    currentSize.width,
                    currentSize.height,
                );

                context.fillStyle = "#ffffff";
                context.fillRect(
                    0,
                    0,
                    currentSize.width,
                    currentSize.height,
                );

                const rotation =
                    rotationRef.current;

                const zoom =
                    zoomRef.current;

                const projected =
                    normalizedData.points.map(
                        (point) =>
                            projectPoint(
                                point,
                                currentSize,
                                rotation,
                                zoom,
                            ),
                    );

                const projectedBoundary =
                    normalizedData.boundaryPoints.map(
                        (point) => {
                            const projectedPoint =
                                projectPoint(
                                    point,
                                    currentSize,
                                    rotation,
                                    zoom,
                                );

                            return {
                                screenX:
                                projectedPoint.screenX,
                                screenY:
                                projectedPoint.screenY,
                            };
                        },
                    );

                if (
                    highlightClusterId !== null
                ) {
                    drawClusterBoundary(
                        context,
                        projectedBoundary,
                        highlightClusterId,
                    );
                }

                projected.sort(
                    (first, second) => {
                        const firstHighlighted =
                            highlightClusterId !== null
                            && first.artist.cluster
                            === highlightClusterId;

                        const secondHighlighted =
                            highlightClusterId !== null
                            && second.artist.cluster
                            === highlightClusterId;

                        if (
                            firstHighlighted
                            !== secondHighlighted
                        ) {
                            return firstHighlighted
                                ? 1
                                : -1;
                        }

                        return (
                            first.depth
                            - second.depth
                        );
                    },
                );

                for (const point of projected) {
                    const selected =
                        point.artist.id
                        === explorer.selectedArtistId;

                    const highlighted =
                        highlightClusterId !== null
                        && point.artist.cluster
                        === highlightClusterId;

                    const dimmed =
                        dimNonHighlighted
                        && highlightClusterId !== null
                        && !highlighted;

                    const baseRadius =
                        highlighted
                            ? 3.5
                            : dimmed
                                ? point.artist.is_noise
                                    ? 1.4
                                    : 2.25
                                : point.artist.is_noise
                                    ? 1.5
                                    : 2.5;

                    const radius =
                        selected
                            ? 7
                            : Math.max(
                                1.5,
                                baseRadius
                                * point.perspective,
                            );

                    context.beginPath();
                    context.arc(
                        point.screenX,
                        point.screenY,
                        radius,
                        0,
                        Math.PI * 2,
                    );

                    context.fillStyle =
                        clusterColor(
                            point.artist.cluster,
                        );

                    context.globalAlpha =
                        selected
                            ? 1
                            : highlighted
                                ? 0.95
                                : dimmed
                                    ? point.artist.is_noise
                                        ? 0.08
                                        : 0.38
                                    : point.artist.is_noise
                                        ? 0.18
                                        : 0.68;

                    context.fill();

                    if (selected) {
                        context.globalAlpha = 1;
                        context.strokeStyle =
                            "#111827";
                        context.lineWidth = 2;
                        context.stroke();

                        context.beginPath();
                        context.arc(
                            point.screenX,
                            point.screenY,
                            radius + 3,
                            0,
                            Math.PI * 2,
                        );
                        context.strokeStyle =
                            "#ffffff";
                        context.lineWidth = 2;
                        context.stroke();
                    }
                }

                context.globalAlpha = 1;
                context.fillStyle =
                    "#6b7280";
                context.font =
                    "11px Inter, Segoe UI, Arial, sans-serif";

                context.fillText(
                    "Drag to rotate · Wheel to zoom",
                    12,
                    currentSize.height - 12,
                );

                quadtreeRef.current =
                    quadtree<ProjectedPoint>()
                        .x(
                            (point) =>
                                point.screenX,
                        )
                        .y(
                            (point) =>
                                point.screenY,
                        )
                        .addAll(projected);
            },
            [
                dimNonHighlighted,
                explorer.selectedArtistId,
                highlightClusterId,
                normalizedData,
            ],
        );

    const scheduleDraw =
        useCallback(
            () => {
                if (
                    animationFrameRef.current
                    !== null
                ) {
                    cancelAnimationFrame(
                        animationFrameRef.current,
                    );
                }

                animationFrameRef.current =
                    requestAnimationFrame(
                        () => {
                            animationFrameRef.current =
                                null;
                            draw();
                        },
                    );
            },
            [draw],
        );

    useEffect(
        () => {
            sizeRef.current = size;
            scheduleDraw();
        },
        [
            scheduleDraw,
            size,
        ],
    );

    useEffect(
        () => {
            scheduleDraw();
        },
        [
            data,
            explorer.selectedArtistId,
            highlightClusterId,
            scheduleDraw,
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
                        const entry = entries[0];

                        if (!entry) {
                            return;
                        }

                        setSize({
                            width:
                                Math.max(
                                    1,
                                    entry.contentRect.width,
                                ),

                            height:
                                Math.max(
                                    1,
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

            if (!canvas) {
                return;
            }

            const dragBehavior =
                drag<
                    HTMLCanvasElement,
                    unknown
                >()
                    .on(
                        "start",
                        () => {
                            canvas.style.cursor =
                                "grabbing";
                            setTooltip(null);
                        },
                    )
                    .on(
                        "drag",
                        (
                            event:
                            D3DragEvent<
                                HTMLCanvasElement,
                                unknown,
                                unknown
                            >,
                        ) => {
                            rotationRef.current = {
                                x:
                                    rotationRef.current.x
                                    + event.dy * 0.008,

                                y:
                                    rotationRef.current.y
                                    + event.dx * 0.008,
                            };

                            scheduleDraw();
                        },
                    )
                    .on(
                        "end",
                        () => {
                            canvas.style.cursor =
                                "grab";
                        },
                    );

            select(canvas)
                .call(dragBehavior);

            const handleWheel =
                (event: WheelEvent) => {
                    event.preventDefault();

                    zoomRef.current =
                        Math.min(
                            4.5,
                            Math.max(
                                0.45,
                                zoomRef.current
                                * Math.exp(
                                    -event.deltaY
                                    * 0.0012,
                                ),
                            ),
                        );

                    setTooltip(null);
                    scheduleDraw();
                };

            canvas.addEventListener(
                "wheel",
                handleWheel,
                {
                    passive: false,
                },
            );

            return () => {
                select(canvas)
                    .on(".drag", null);

                canvas.removeEventListener(
                    "wheel",
                    handleWheel,
                );
            };
        },
        [scheduleDraw],
    );

    useEffect(
        () =>
            () => {
                if (
                    animationFrameRef.current
                    !== null
                ) {
                    cancelAnimationFrame(
                        animationFrameRef.current,
                    );
                }
            },
        [],
    );

    function findPoint(
        event:
        ReactPointerEvent<
            HTMLCanvasElement
        >,
    ): ProjectedPoint | undefined {
        const canvas =
            canvasRef.current;

        if (!canvas) {
            return undefined;
        }

        const [x, y] =
            pointer(
                event.nativeEvent,
                canvas,
            );

        return quadtreeRef.current
            ?.find(
                x,
                y,
                10,
            );
    }

    function handlePointerMove(
        event:
        ReactPointerEvent<
            HTMLCanvasElement
        >,
    ) {
        const found =
            findPoint(event);

        const canvas =
            canvasRef.current;

        if (!found || !canvas) {
            setTooltip(null);
            return;
        }

        const rectangle =
            canvas.getBoundingClientRect();

        setTooltip({
            left:
                event.clientX
                - rectangle.left,

            top:
                event.clientY
                - rectangle.top,

            artist:
            found.artist,
        });
    }

    function handleClick(
        event:
        ReactPointerEvent<
            HTMLCanvasElement
        >,
    ) {
        const found =
            findPoint(event);

        if (!found) {
            return;
        }

        if (onArtistClick) {
            onArtistClick(
                found.artist,
            );
            return;
        }

        explorer
            .setSelectedArtistId(
                found.artist.id,
            );

        explorer
            .setSelectedClusterId(
                found.artist.cluster,
            );
    }

    function resetView() {
        rotationRef.current = {
            ...DEFAULT_ROTATION,
        };

        zoomRef.current = 1;
        setTooltip(null);
        scheduleDraw();
    }

    return (
        <Box
            ref={containerRef}
            sx={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 420,
            }}
        >
            <canvas
                ref={canvasRef}
                aria-label={
                    "Interactive 3D Artist embedding map rendered on Canvas"
                }
                onPointerMove={
                    handlePointerMove
                }
                onPointerLeave={() =>
                    setTooltip(null)
                }
                onClick={handleClick}
                style={{
                    display: "block",
                    cursor: "grab",
                    touchAction: "none",
                }}
            />

            <Button
                type="button"
                size="small"
                variant="outlined"
                onClick={resetView}
                sx={{
                    position: "absolute",
                    right: 10,
                    bottom: 10,
                    zIndex: 3,
                    backgroundColor:
                        "rgba(255,255,255,0.94)",
                    "&:hover": {
                        backgroundColor:
                            "#ffffff",
                    },
                }}
            >
                Reset view
            </Button>

            <CanvasTooltip
                tooltip={tooltip}
            />
        </Box>
    );
}