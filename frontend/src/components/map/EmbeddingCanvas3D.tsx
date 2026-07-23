import {
    Box,
    Button,
    ButtonGroup,
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
    clusterPointOutlineColor,
} from "../../visualization/colors";

import {
    CanvasTooltip,
    type CanvasTooltipState,
} from "./CanvasTooltip";


type CanvasSize = {
    width: number;
    height: number;
};


type PanOffset = {
    x: number;
    y: number;
};


type InteractionMode =
    | "rotate"
    | "pan";


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
    pan: PanOffset,
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
            + pan.x
            + rotatedX
            * baseScale
            * perspective,

        screenY:
            size.height / 2
            + pan.y
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

    context.restore();
}


export default function EmbeddingCanvas3D({
                                              data,
                                              highlightBoundaryData,
                                              highlightClusterId = null,
                                              dimNonHighlighted = false,
                                              comparisonArtistIds = null,
                                              dimNonCompared = false,
                                              focusData,
                                              fitRequestKey = 0,
                                              pointScale = 1,
                                              onArtistClick,
                                          }: {
    data: ArtistEmbedding3D[];
    highlightBoundaryData?:
        ArtistEmbedding3D[];
    highlightClusterId?:
        number | null;
    dimNonHighlighted?: boolean;
    comparisonArtistIds?:
        [string, string] | null;
    dimNonCompared?: boolean;
    focusData?: ArtistEmbedding3D[];
    fitRequestKey?: number;
    pointScale?: number;
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

    const panRef =
        useRef<PanOffset>({
            x: 0,
            y: 0,
        });

    const quadtreeRef =
        useRef<
            Quadtree<ProjectedPoint>
            | null
        >(null);

    const animationFrameRef =
        useRef<number | null>(
            null,
        );

    const drawRef =
        useRef<() => void>(
            () => undefined,
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

    const [
        interactionMode,
        setInteractionMode,
    ] = useState<InteractionMode>(
        "rotate",
    );

    const normalizedData =
        useMemo(
            () => {
                const boundarySource =
                    highlightBoundaryData
                    ?? [];

                const focusSource =
                    focusData
                    ?? [];

                const scaleSource = [
                    ...data,
                    ...boundarySource,
                    ...focusSource,
                ];

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

                    focusPoints:
                        focusSource.map(
                            normalize,
                        ),
                };
            },
            [
                data,
                focusData,
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

                const pan =
                    panRef.current;

                const projected =
                    normalizedData.points.map(
                        (point) =>
                            projectPoint(
                                point,
                                currentSize,
                                rotation,
                                zoom,
                                pan,
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
                                    pan,
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

                if (comparisonArtistIds) {
                    const firstComparisonPoint =
                        projected.find(
                            (point) =>
                                point.artist.id
                                === comparisonArtistIds[0],
                        );

                    const secondComparisonPoint =
                        projected.find(
                            (point) =>
                                point.artist.id
                                === comparisonArtistIds[1],
                        );

                    if (
                        firstComparisonPoint
                        && secondComparisonPoint
                    ) {
                        context.save();
                        context.beginPath();
                        context.moveTo(
                            firstComparisonPoint.screenX,
                            firstComparisonPoint.screenY,
                        );
                        context.lineTo(
                            secondComparisonPoint.screenX,
                            secondComparisonPoint.screenY,
                        );
                        context.strokeStyle =
                            "#111827";
                        context.globalAlpha = 0.8;
                        context.lineWidth = 2.25;
                        context.setLineDash([
                            8,
                            6,
                        ]);
                        context.stroke();
                        context.restore();
                    }
                }

                projected.sort(
                    (first, second) => {
                        const firstCompared =
                            comparisonArtistIds?.includes(
                                first.artist.id,
                            )
                            ?? false;

                        const secondCompared =
                            comparisonArtistIds?.includes(
                                second.artist.id,
                            )
                            ?? false;

                        if (
                            firstCompared
                            !== secondCompared
                        ) {
                            return firstCompared
                                ? 1
                                : -1;
                        }

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
                    const comparisonIndex =
                        comparisonArtistIds?.indexOf(
                            point.artist.id,
                        )
                        ?? -1;

                    const compared =
                        comparisonIndex >= 0;

                    const selected =
                        point.artist.id
                        === explorer.selectedArtistId
                        || compared;

                    const highlighted =
                        highlightClusterId !== null
                        && point.artist.cluster
                        === highlightClusterId;

                    const dimmed =
                        (
                            dimNonHighlighted
                            && highlightClusterId !== null
                            && !highlighted
                        )
                        || (
                            dimNonCompared
                            && comparisonArtistIds !== null
                            && !compared
                        );

                    const baseRadius =
                        highlighted
                            ? 3.5
                            : dimmed
                                ? 2.25
                                : 2.5;

                    const noiseScale =
                        point.artist.is_noise
                            ? 0.78
                            : 1;

                    const radius =
                        (
                            selected
                                ? 7
                                : Math.max(
                                    1.5,
                                    baseRadius
                                    * point.perspective,
                                )
                        )
                        * pointScale
                        * noiseScale;

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
                                    ? 0.38
                                    : point.artist.is_noise
                                        ? 0.42
                                        : 0.68;

                    context.fill();

                    context.globalAlpha =
                        selected
                            ? 1
                            : highlighted
                                ? 0.86
                                : dimmed
                                    ? 0.50
                                    : point.artist.is_noise
                                        ? 0.42
                                        : 0.68;

                    context.strokeStyle =
                        clusterPointOutlineColor(
                            point.artist.cluster,
                        );

                    context.lineWidth =
                        highlighted
                            ? 0.9
                            : 0.5;

                    context.stroke();

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

                    if (compared) {
                        const comparisonLabel =
                            comparisonIndex === 0
                                ? "A"
                                : "B";

                        const labelX =
                            point.screenX
                            + radius
                            + 8;
                        const labelY =
                            point.screenY
                            - radius
                            - 8;

                        context.save();
                        context.beginPath();
                        context.arc(
                            labelX,
                            labelY,
                            10,
                            0,
                            Math.PI * 2,
                        );
                        context.fillStyle =
                            "#111827";
                        context.globalAlpha = 1;
                        context.fill();
                        context.fillStyle =
                            "#ffffff";
                        context.font =
                            "700 11px Inter, Segoe UI, Arial";
                        context.textAlign =
                            "center";
                        context.textBaseline =
                            "middle";
                        context.fillText(
                            comparisonLabel,
                            labelX,
                            labelY,
                        );
                        context.restore();
                    }
                }

                context.globalAlpha = 1;
                context.fillStyle =
                    "#6b7280";
                context.font =
                    "11px Inter, Segoe UI, Arial, sans-serif";

                context.fillText(
                    interactionMode === "pan"
                        ? "Drag to move · Wheel zooms at cursor"
                        : "Drag to rotate · Shift + drag moves · Wheel zooms at cursor",
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
                comparisonArtistIds,
                dimNonCompared,
                dimNonHighlighted,
                explorer.selectedArtistId,
                highlightClusterId,
                interactionMode,
                normalizedData,
                pointScale,
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
                            drawRef.current();
                        },
                    );
            },
            [],
        );

    useEffect(
        () => {
            drawRef.current = draw;
            scheduleDraw();
        },
        [
            draw,
            scheduleDraw,
        ],
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
                            const sourceEvent =
                                event.sourceEvent as
                                    PointerEvent
                                    | MouseEvent;

                            const shouldPan =
                                interactionMode
                                === "pan"
                                || sourceEvent.shiftKey;

                            if (shouldPan) {
                                panRef.current = {
                                    x:
                                        panRef.current.x
                                        + event.dx,

                                    y:
                                        panRef.current.y
                                        + event.dy,
                                };
                            } else {
                                rotationRef.current = {
                                    x:
                                        rotationRef.current.x
                                        + event.dy * 0.008,

                                    y:
                                        rotationRef.current.y
                                        + event.dx * 0.008,
                                };
                            }

                            scheduleDraw();
                        },
                    )
                    .on(
                        "end",
                        () => {
                            canvas.style.cursor =
                                interactionMode
                                === "pan"
                                    ? "move"
                                    : "grab";
                        },
                    );

            select(canvas)
                .call(dragBehavior);

            const handleWheel =
                (event: WheelEvent) => {
                    event.preventDefault();

                    const oldZoom =
                        zoomRef.current;

                    const nextZoom =
                        Math.min(
                            6,
                            Math.max(
                                0.4,
                                oldZoom
                                * Math.exp(
                                    -event.deltaY
                                    * 0.0012,
                                ),
                            ),
                        );

                    const rectangle =
                        canvas.getBoundingClientRect();

                    const pointerX =
                        event.clientX
                        - rectangle.left;

                    const pointerY =
                        event.clientY
                        - rectangle.top;

                    const ratio =
                        nextZoom
                        / oldZoom;

                    panRef.current = {
                        x:
                            pointerX
                            - sizeRef.current.width / 2
                            - ratio
                            * (
                                pointerX
                                - sizeRef.current.width / 2
                                - panRef.current.x
                            ),

                        y:
                            pointerY
                            - sizeRef.current.height / 2
                            - ratio
                            * (
                                pointerY
                                - sizeRef.current.height / 2
                                - panRef.current.y
                            ),
                    };

                    zoomRef.current =
                        nextZoom;

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
        [
            interactionMode,
            scheduleDraw,
        ],
    );

    useEffect(
        () => {
            const currentSize =
                sizeRef.current;

            const focusPoints =
                normalizedData.focusPoints;

            if (
                focusPoints.length === 0
                || currentSize.width <= 0
                || currentSize.height <= 0
            ) {
                return;
            }

            const rotation =
                rotationRef.current;

            const projectedAtUnitZoom =
                focusPoints.map(
                    (point) =>
                        projectPoint(
                            point,
                            currentSize,
                            rotation,
                            1,
                            {
                                x: 0,
                                y: 0,
                            },
                        ),
                );

            const minimumX =
                Math.min(
                    ...projectedAtUnitZoom.map(
                        (point) =>
                            point.screenX,
                    ),
                );

            const maximumX =
                Math.max(
                    ...projectedAtUnitZoom.map(
                        (point) =>
                            point.screenX,
                    ),
                );

            const minimumY =
                Math.min(
                    ...projectedAtUnitZoom.map(
                        (point) =>
                            point.screenY,
                    ),
                );

            const maximumY =
                Math.max(
                    ...projectedAtUnitZoom.map(
                        (point) =>
                            point.screenY,
                    ),
                );

            const spanX =
                Math.max(
                    1,
                    maximumX - minimumX,
                );

            const spanY =
                Math.max(
                    1,
                    maximumY - minimumY,
                );

            const zoom =
                focusPoints.length === 1
                    ? 2.6
                    : Math.max(
                        0.65,
                        Math.min(
                            4.8,
                            Math.min(
                                (
                                    currentSize.width
                                    - 180
                                )
                                / spanX,

                                (
                                    currentSize.height
                                    - 150
                                )
                                / spanY,
                            ),
                        ),
                    );

            zoomRef.current = zoom;

            const projected =
                focusPoints.map(
                    (point) =>
                        projectPoint(
                            point,
                            currentSize,
                            rotation,
                            zoom,
                            {
                                x: 0,
                                y: 0,
                            },
                        ),
                );

            const centerX =
                (
                    Math.min(
                        ...projected.map(
                            (point) =>
                                point.screenX,
                        ),
                    )
                    + Math.max(
                        ...projected.map(
                            (point) =>
                                point.screenX,
                        ),
                    )
                ) / 2;

            const centerY =
                (
                    Math.min(
                        ...projected.map(
                            (point) =>
                                point.screenY,
                        ),
                    )
                    + Math.max(
                        ...projected.map(
                            (point) =>
                                point.screenY,
                        ),
                    )
                ) / 2;

            panRef.current = {
                x:
                    currentSize.width / 2
                    - centerX,

                y:
                    currentSize.height / 2
                    - centerY,
            };

            setTooltip(null);
            scheduleDraw();
        },
        [
            fitRequestKey,
            normalizedData,
            scheduleDraw,
            size.height,
            size.width,
        ],
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
                Math.max(
                    10,
                    8 * pointScale,
                ),
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
        panRef.current = {
            x: 0,
            y: 0,
        };
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
                    cursor:
                        interactionMode
                        === "pan"
                            ? "move"
                            : "grab",
                    touchAction: "none",
                }}
            />

            <ButtonGroup
                size="small"
                aria-label="3D interaction mode"
                sx={{
                    position: "absolute",
                    left: 10,
                    top: 10,
                    zIndex: 3,
                    backgroundColor:
                        "rgba(255,255,255,0.94)",
                }}
            >
                <Button
                    type="button"
                    variant={
                        interactionMode
                        === "rotate"
                            ? "contained"
                            : "outlined"
                    }
                    onClick={() =>
                        setInteractionMode(
                            "rotate",
                        )
                    }
                >
                    Rotate
                </Button>

                <Button
                    type="button"
                    variant={
                        interactionMode
                        === "pan"
                            ? "contained"
                            : "outlined"
                    }
                    onClick={() =>
                        setInteractionMode(
                            "pan",
                        )
                    }
                >
                    Move
                </Button>
            </ButtonGroup>

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