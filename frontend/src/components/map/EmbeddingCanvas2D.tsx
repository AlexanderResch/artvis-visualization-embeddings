import {
    Box,
    Button,
} from "@mui/material";

import {
    polygonHull,
    pointer,
    quadtree,
    scaleLinear,
    select,
    zoom,
    zoomIdentity,
    type D3ZoomEvent,
    type Quadtree,
    type ScaleLinear,
    type ZoomBehavior,
    type ZoomTransform,
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
    ArtistEmbedding2D,
} from "../../types/embedding";

import {
    clusterColor,
} from "../../visualization/colors";

import {
    CanvasTooltip,
    type CanvasTooltipState,
} from "./CanvasTooltip";


type ScreenPoint = {
    artist: ArtistEmbedding2D;
    screenX: number;
    screenY: number;
};


type CanvasSize = {
    width: number;
    height: number;
};


const PADDING = {
    top: 18,
    right: 18,
    bottom: 34,
    left: 44,
};


function safeDomain(
    values: number[],
): [number, number] {
    if (!values.length) {
        return [0, 1];
    }

    let minimum = values[0];
    let maximum = values[0];

    for (const value of values) {
        minimum = Math.min(
            minimum,
            value,
        );

        maximum = Math.max(
            maximum,
            value,
        );
    }

    if (minimum === maximum) {
        return [
            minimum - 1,
            maximum + 1,
        ];
    }

    return [
        minimum,
        maximum,
    ];
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


function drawAxes(
    context: CanvasRenderingContext2D,
    size: CanvasSize,
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
) {
    context.save();

    context.strokeStyle =
        "#e7eaee";

    context.lineWidth = 1;
    context.fillStyle =
        "#6b7280";

    context.font =
        "11px Inter, Segoe UI, Arial";

    xScale.ticks(7).forEach(
        (tick) => {
            const x = xScale(tick);

            if (
                x < PADDING.left
                || x
                > size.width
                - PADDING.right
            ) {
                return;
            }

            context.beginPath();
            context.moveTo(
                x,
                PADDING.top,
            );
            context.lineTo(
                x,
                size.height
                - PADDING.bottom,
            );
            context.stroke();

            context.textAlign =
                "center";
            context.textBaseline =
                "top";

            context.fillText(
                xScale.tickFormat(7)(
                    tick,
                ),
                x,
                size.height
                - PADDING.bottom
                + 7,
            );
        },
    );

    yScale.ticks(6).forEach(
        (tick) => {
            const y = yScale(tick);

            if (
                y < PADDING.top
                || y
                > size.height
                - PADDING.bottom
            ) {
                return;
            }

            context.beginPath();
            context.moveTo(
                PADDING.left,
                y,
            );
            context.lineTo(
                size.width
                - PADDING.right,
                y,
            );
            context.stroke();

            context.textAlign =
                "right";
            context.textBaseline =
                "middle";

            context.fillText(
                yScale.tickFormat(6)(
                    tick,
                ),
                PADDING.left - 7,
                y,
            );
        },
    );

    context.restore();
}


function expandHull(
    hull: [number, number][],
    factor = 1.06,
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
        (point) => [
            centroidX
            + (
                point[0]
                - centroidX
            )
            * factor,

            centroidY
            + (
                point[1]
                - centroidY
            )
            * factor,
        ],
    );
}


function drawClusterBoundary(
    context: CanvasRenderingContext2D,
    hull: [number, number][] | null,
    clusterId: number,
    size: CanvasSize,
    baseXScale: ScaleLinear<number, number>,
    baseYScale: ScaleLinear<number, number>,
    transform: ZoomTransform,
) {
    if (!hull || hull.length < 3) {
        return;
    }

    const screenHull =
        hull.map(
            ([x, y]) => [
                transform.applyX(
                    baseXScale(x),
                ),

                transform.applyY(
                    baseYScale(y),
                ),
            ] as [number, number],
        );

    const color =
        clusterColor(clusterId);

    context.save();

    context.beginPath();
    context.rect(
        PADDING.left,
        PADDING.top,
        size.width
        - PADDING.left
        - PADDING.right,
        size.height
        - PADDING.top
        - PADDING.bottom,
    );
    context.clip();

    context.beginPath();

    screenHull.forEach(
        (point, index) => {
            if (index === 0) {
                context.moveTo(
                    point[0],
                    point[1],
                );

                return;
            }

            context.lineTo(
                point[0],
                point[1],
            );
        },
    );

    context.closePath();

    context.fillStyle = color;
    context.globalAlpha = 0.07;
    context.fill();

    context.globalAlpha = 0.95;
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.setLineDash([
        8,
        6,
    ]);
    context.stroke();

    context.restore();

    const minimumX = Math.min(
        ...screenHull.map(
            (point) => point[0],
        ),
    );

    const maximumX = Math.max(
        ...screenHull.map(
            (point) => point[0],
        ),
    );

    const minimumY = Math.min(
        ...screenHull.map(
            (point) => point[1],
        ),
    );

    const label =
        `Cluster ${clusterId}`;

    context.save();
    context.font =
        "600 12px Inter, Segoe UI, Arial";

    const labelWidth =
        context.measureText(label).width;

    const labelX =
        Math.max(
            PADDING.left + 6,
            Math.min(
                size.width
                - PADDING.right
                - labelWidth
                - 14,
                (minimumX + maximumX) / 2
                - labelWidth / 2
                - 7,
            ),
        );

    const labelY =
        Math.max(
            PADDING.top + 6,
            minimumY - 30,
        );

    context.fillStyle =
        "rgba(255,255,255,0.95)";
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.setLineDash([]);

    context.beginPath();
    context.roundRect(
        labelX,
        labelY,
        labelWidth + 14,
        24,
        8,
    );
    context.fill();
    context.stroke();

    context.fillStyle = color;
    context.textAlign = "left";
    context.textBaseline =
        "middle";

    context.fillText(
        label,
        labelX + 7,
        labelY + 12,
    );

    context.restore();
}


export function EmbeddingCanvas2D({
                                      data,
                                      highlightClusterId = null,
                                      highlightBoundaryData,
                                      dimNonHighlighted = false,
                                      onArtistClick,
                                  }: {
    data: ArtistEmbedding2D[];
    highlightBoundaryData?:
        ArtistEmbedding2D[];
    highlightClusterId?:
        number | null;
    dimNonHighlighted?: boolean;
    onArtistClick?:
        (artist: ArtistEmbedding2D) => void;
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

    const quadtreeRef =
        useRef<
            Quadtree<ScreenPoint>
            | null
        >(null);

    const animationFrameRef =
        useRef<number | null>(
            null,
        );

    const [
        tooltip,
        setTooltip,
    ] = useState<
        CanvasTooltipState | null
    >(null);

    const [
        size,
        setSize,
    ] = useState<CanvasSize>({
        width: 0,
        height: 0,
    });

    const scaleData =
        useMemo(
            () => {
                if (
                    !highlightBoundaryData
                    || highlightBoundaryData.length === 0
                ) {
                    return data;
                }

                return [
                    ...data,
                    ...highlightBoundaryData,
                ];
            },
            [
                data,
                highlightBoundaryData,
            ],
        );


    const clusterHull =
        useMemo(
            () => {
                if (highlightClusterId === null) {
                    return null;
                }

                const boundarySource =
                    highlightBoundaryData
                    ?? data;

                const coordinates =
                    boundarySource
                        .filter(
                            (artist) =>
                                artist.cluster
                                === highlightClusterId,
                        )
                        .map(
                            (artist) => [
                                artist.x,
                                artist.y,
                            ] as [number, number],
                        );

                const hull =
                    polygonHull(coordinates);

                if (!hull) {
                    return null;
                }

                return expandHull(
                    hull,
                );
            },
            [
                data,
                highlightBoundaryData,
                highlightClusterId,
            ],
        );


    const xScale = useMemo(
        () =>
            scaleLinear()
                .domain(
                    safeDomain(
                        scaleData.map(
                            (point) =>
                                point.x,
                        ),
                    ),
                )
                .nice(),

        [scaleData],
    );

    const yScale = useMemo(
        () =>
            scaleLinear()
                .domain(
                    safeDomain(
                        scaleData.map(
                            (point) =>
                                point.y,
                        ),
                    ),
                )
                .nice(),

        [scaleData],
    );

    const draw = useCallback(
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

            const transform =
                transformRef.current;

            const baseXScale =
                xScale.copy().range([
                    PADDING.left,
                    currentSize.width
                    - PADDING.right,
                ]);

            const baseYScale =
                yScale.copy().range([
                    currentSize.height
                    - PADDING.bottom,
                    PADDING.top,
                ]);

            const visibleXScale =
                transform.rescaleX(
                    baseXScale,
                );

            const visibleYScale =
                transform.rescaleY(
                    baseYScale,
                );

            context.clearRect(
                0,
                0,
                currentSize.width,
                currentSize.height,
            );

            context.fillStyle =
                "#ffffff";

            context.fillRect(
                0,
                0,
                currentSize.width,
                currentSize.height,
            );

            drawAxes(
                context,
                currentSize,
                visibleXScale,
                visibleYScale,
            );

            const screenPoints:
                ScreenPoint[] = [];

            for (const artist of data) {
                const screenX =
                    transform.applyX(
                        baseXScale(
                            artist.x,
                        ),
                    );

                const screenY =
                    transform.applyY(
                        baseYScale(
                            artist.y,
                        ),
                    );

                const outsideCanvas =
                    screenX
                    < PADDING.left - 8
                    || screenX
                    > currentSize.width
                    - PADDING.right
                    + 8
                    || screenY
                    < PADDING.top - 8
                    || screenY
                    > currentSize.height
                    - PADDING.bottom
                    + 8;

                if (outsideCanvas) {
                    continue;
                }

                screenPoints.push({
                    artist,
                    screenX,
                    screenY,
                });
            }

            if (
                highlightClusterId !== null
            ) {
                drawClusterBoundary(
                    context,
                    clusterHull,
                    highlightClusterId,
                    currentSize,
                    baseXScale,
                    baseYScale,
                    transform,
                );
            }

            screenPoints.sort(
                (
                    firstPoint,
                    secondPoint,
                ) => {
                    const firstHighlighted =
                        highlightClusterId !== null
                        && firstPoint.artist.cluster
                        === highlightClusterId;

                    const secondHighlighted =
                        highlightClusterId !== null
                        && secondPoint.artist.cluster
                        === highlightClusterId;

                    if (
                        firstHighlighted
                        !== secondHighlighted
                    ) {
                        return firstHighlighted
                            ? 1
                            : -1;
                    }

                    if (
                        firstPoint.artist.is_noise
                        !== secondPoint.artist.is_noise
                    ) {
                        return firstPoint.artist.is_noise
                            ? -1
                            : 1;
                    }

                    return (
                        firstPoint.artist.cluster
                        - secondPoint.artist.cluster
                    );
                },
            );

            for (const point of screenPoints) {
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

                const radius =
                    selected
                        ? 6.5
                        : highlighted
                            ? 3.2
                            : dimmed
                                ? point.artist.is_noise
                                    ? 1.4
                                    : 2.1
                                : point.artist.is_noise
                                    ? 1.5
                                    : 2.3;

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
                                    ? 0.1
                                    : 0.42
                                : point.artist.is_noise
                                    ? 0.2
                                    : 0.72;

                context.fill();

                if (selected) {
                    context.globalAlpha = 1;
                    context.lineWidth = 2;
                    context.strokeStyle =
                        "#111827";
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

            quadtreeRef.current =
                quadtree<ScreenPoint>()
                    .x(
                        (point) =>
                            point.screenX,
                    )
                    .y(
                        (point) =>
                            point.screenY,
                    )
                    .addAll(screenPoints);
        },
        [
            clusterHull,
            data,
            dimNonHighlighted,
            explorer.selectedArtistId,
            highlightClusterId,
            xScale,
            yScale,
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
                            width: Math.max(
                                1,
                                entry.contentRect.width,
                            ),
                            height: Math.max(
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

            const zoomBehavior =
                zoom<
                    HTMLCanvasElement,
                    unknown
                >()
                    .scaleExtent([
                        0.35,
                        40,
                    ])
                    .on(
                        "zoom",
                        (
                            event:
                            D3ZoomEvent<
                                HTMLCanvasElement,
                                unknown
                            >,
                        ) => {
                            transformRef.current =
                                event.transform;
                            setTooltip(null);
                            scheduleDraw();
                        },
                    );

            zoomBehaviorRef.current =
                zoomBehavior;

            select(canvas).call(
                zoomBehavior,
            );

            return () => {
                select(canvas).on(
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
            };
        },
        [scheduleDraw],
    );

    useEffect(
        () => () => {
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
    ): ScreenPoint | undefined {
        const canvas =
            canvasRef.current;

        if (!canvas) {
            return undefined;
        }

        const [
            pointerX,
            pointerY,
        ] = pointer(
            event.nativeEvent,
            canvas,
        );

        return quadtreeRef.current
            ?.find(
                pointerX,
                pointerY,
                10,
            );
    }

    function handlePointerMove(
        event:
        ReactPointerEvent<
            HTMLCanvasElement
        >,
    ) {
        const foundPoint =
            findPoint(event);

        const canvas =
            canvasRef.current;

        if (!foundPoint || !canvas) {
            setTooltip(null);

            if (canvas) {
                canvas.style.cursor =
                    "grab";
            }

            return;
        }

        const rectangle =
            canvas.getBoundingClientRect();

        canvas.style.cursor =
            "pointer";

        setTooltip({
            left:
                event.clientX
                - rectangle.left,
            top:
                event.clientY
                - rectangle.top,
            artist: foundPoint.artist,
        });
    }

    function handleClick(
        event:
        ReactPointerEvent<
            HTMLCanvasElement
        >,
    ) {
        const foundPoint =
            findPoint(event);

        if (!foundPoint) {
            return;
        }

        if (onArtistClick) {
            onArtistClick(
                foundPoint.artist,
            );
            return;
        }

        explorer.setSelectedArtistId(
            String(
                foundPoint.artist.id,
            ),
        );

        explorer.setSelectedClusterId(
            foundPoint.artist.cluster,
        );
    }

    function resetView() {
        const canvas =
            canvasRef.current;

        const zoomBehavior =
            zoomBehaviorRef.current;

        setTooltip(null);

        if (!canvas || !zoomBehavior) {
            transformRef.current =
                zoomIdentity;
            scheduleDraw();
            return;
        }

        select(canvas).call(
            zoomBehavior.transform,
            zoomIdentity,
        );
    }

    return (
        <Box
            ref={containerRef}
            sx={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 420,
                overflow: "hidden",
            }}
        >
            <canvas
                ref={canvasRef}
                aria-label="Interactive 2D Artist embedding map"
                onPointerMove={
                    handlePointerMove
                }
                onPointerLeave={
                    () =>
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