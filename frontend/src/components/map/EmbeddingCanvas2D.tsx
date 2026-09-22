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

import type {
    VisibleClusterSummary,
} from "../../types/map";

import {
    clusterColor,
    clusterPointOutlineColor,
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
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
};


type SemanticZoomLevel =
    | "overview"
    | "neighborhood"
    | "detail";


type LabelBox = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};


function semanticZoomLevel(
    zoomScale: number,
): SemanticZoomLevel {
    if (zoomScale >= 6) {
        return "detail";
    }

    if (zoomScale >= 2.2) {
        return "neighborhood";
    }

    return "overview";
}


function automaticPointScale(
    visiblePointCount: number,
    zoomScale: number,
): number {
    const densityScale =
        visiblePointCount > 7000
            ? 0.72
            : visiblePointCount > 3500
                ? 0.82
                : visiblePointCount > 1500
                    ? 0.92
                    : visiblePointCount > 600
                        ? 1.03
                        : visiblePointCount > 200
                            ? 1.18
                            : 1.35;

    const zoomAdjustment =
        Math.max(
            0.88,
            Math.min(
                1.48,
                0.9
                + Math.log2(
                    Math.max(
                        1,
                        zoomScale,
                    ),
                ) * 0.16,
            ),
        );

    return densityScale * zoomAdjustment;
}


function boxesOverlap(
    first: LabelBox,
    second: LabelBox,
): boolean {
    return !(
        first.right < second.left
        || first.left > second.right
        || first.bottom < second.top
        || first.top > second.bottom
    );
}


function placeLabel(
    occupied: LabelBox[],
    candidate: LabelBox,
): boolean {
    if (
        occupied.some(
            (existing) =>
                boxesOverlap(
                    existing,
                    candidate,
                ),
        )
    ) {
        return false;
    }

    occupied.push(candidate);
    return true;
}


function drawOverviewClusterLabels(
    context: CanvasRenderingContext2D,
    screenPoints: ScreenPoint[],
    size: CanvasSize,
) {
    const clusters =
        new Map<number, ScreenPoint[]>();

    for (const point of screenPoints) {
        if (point.artist.is_noise) {
            continue;
        }

        const current =
            clusters.get(
                point.artist.cluster,
            ) ?? [];

        current.push(point);
        clusters.set(
            point.artist.cluster,
            current,
        );
    }

    const occupied: LabelBox[] = [];

    const largestClusters =
        [...clusters.entries()]
            .filter(
                ([, points]) =>
                    points.length >= 18,
            )
            .sort(
                (first, second) =>
                    second[1].length
                    - first[1].length,
            )
            .slice(0, 14);

    context.save();
    context.font =
        "600 11px Inter, Segoe UI, Arial";
    context.textAlign = "left";
    context.textBaseline = "middle";

    for (
        const [
            clusterId,
            clusterPoints,
        ] of largestClusters
    ) {
        const centroidX =
            clusterPoints.reduce(
                (sum, point) =>
                    sum + point.screenX,
                0,
            ) / clusterPoints.length;

        const centroidY =
            clusterPoints.reduce(
                (sum, point) =>
                    sum + point.screenY,
                0,
            ) / clusterPoints.length;

        const anchor =
            clusterPoints.reduce(
                (best, point) => {
                    const bestDistance =
                        (
                            best.screenX
                            - centroidX
                        ) ** 2
                        + (
                            best.screenY
                            - centroidY
                        ) ** 2;

                    const pointDistance =
                        (
                            point.screenX
                            - centroidX
                        ) ** 2
                        + (
                            point.screenY
                            - centroidY
                        ) ** 2;

                    return pointDistance
                    < bestDistance
                        ? point
                        : best;
                },
            );

        const label =
            `C${clusterId} · ${clusterPoints.length}`;

        const textWidth =
            context.measureText(label).width;

        const width =
            textWidth + 20;

        const height = 22;

        const left =
            Math.max(
                PADDING.left + 3,
                Math.min(
                    size.width
                    - PADDING.right
                    - width
                    - 3,
                    anchor.screenX
                    - width / 2,
                ),
            );

        const top =
            Math.max(
                PADDING.top + 3,
                Math.min(
                    size.height
                    - PADDING.bottom
                    - height
                    - 3,
                    anchor.screenY
                    - height / 2,
                ),
            );

        const labelBox = {
            left,
            top,
            right: left + width,
            bottom: top + height,
        };

        if (
            !placeLabel(
                occupied,
                labelBox,
            )
        ) {
            continue;
        }

        context.globalAlpha = 0.92;
        context.fillStyle =
            "rgba(255,255,255,0.94)";
        context.strokeStyle =
            clusterColor(clusterId);
        context.lineWidth = 1.5;

        context.beginPath();
        context.roundRect(
            left,
            top,
            width,
            height,
            7,
        );
        context.fill();
        context.stroke();

        context.fillStyle =
            clusterColor(clusterId);
        context.beginPath();
        context.arc(
            left + 8,
            top + height / 2,
            3.5,
            0,
            Math.PI * 2,
        );
        context.fill();

        context.globalAlpha = 1;
        context.fillStyle = "#111827";
        context.fillText(
            label,
            left + 15,
            top + height / 2,
        );
    }

    context.restore();
}


function drawArtistLabels(
    context: CanvasRenderingContext2D,
    screenPoints: ScreenPoint[],
    size: CanvasSize,
    selectedArtistId: string | null,
    highlightClusterIds: number[],
    zoomScale: number,
) {
    const detailMode =
        semanticZoomLevel(
            zoomScale,
        ) === "detail";

    const candidates =
        screenPoints
            .filter(
                (point) => {
                    const selected =
                        point.artist.id
                        === selectedArtistId;

                    if (selected) {
                        return true;
                    }

                    if (!detailMode) {
                        return false;
                    }

                    if (point.artist.is_noise) {
                        return false;
                    }

                    return highlightClusterIds.length === 0
                        || highlightClusterIds.includes(
                            point.artist.cluster,
                        );
                },
            )
            .sort(
                (first, second) => {
                    const firstSelected =
                        first.artist.id
                        === selectedArtistId;

                    const secondSelected =
                        second.artist.id
                        === selectedArtistId;

                    if (
                        firstSelected
                        !== secondSelected
                    ) {
                        return firstSelected
                            ? -1
                            : 1;
                    }

                    return (
                        second.artist
                            .membership_probability
                        - first.artist
                            .membership_probability
                    );
                },
            );

    const maximumLabels =
        zoomScale >= 12
            ? 80
            : zoomScale >= 8
                ? 55
                : 32;

    const occupied: LabelBox[] = [];
    let drawn = 0;

    context.save();
    context.font =
        "500 11px Inter, Segoe UI, Arial";
    context.textBaseline = "middle";

    for (const point of candidates) {
        if (drawn >= maximumLabels) {
            break;
        }

        const label =
            point.artist.display_name
            ?? point.artist.id;

        const textWidth =
            context.measureText(label).width;

        const width =
            Math.min(
                210,
                textWidth + 12,
            );

        const height = 20;
        const left =
            point.screenX + 7;
        const top =
            point.screenY - height / 2;

        const labelBox = {
            left,
            top,
            right: left + width,
            bottom: top + height,
        };

        if (
            labelBox.right
            > size.width - PADDING.right
            || labelBox.left
            < PADDING.left
            || labelBox.top
            < PADDING.top
            || labelBox.bottom
            > size.height - PADDING.bottom
            || !placeLabel(
                occupied,
                labelBox,
            )
        ) {
            continue;
        }

        context.globalAlpha = 0.88;
        context.fillStyle =
            "rgba(255,255,255,0.92)";
        context.beginPath();
        context.roundRect(
            left,
            top,
            width,
            height,
            4,
        );
        context.fill();

        context.globalAlpha = 1;
        context.fillStyle = "#111827";
        context.fillText(
            label,
            left + 6,
            top + height / 2,
            width - 10,
        );

        drawn += 1;
    }

    context.restore();
}


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
}


function fitTransformForData(
    targetData: ArtistEmbedding2D[],
    size: CanvasSize,
    xScale: ScaleLinear<number, number>,
    yScale: ScaleLinear<number, number>,
): ZoomTransform {
    if (targetData.length === 0) {
        return zoomIdentity;
    }

    const baseXScale =
        xScale.copy().range([
            PADDING.left,
            size.width
            - PADDING.right,
        ]);

    const baseYScale =
        yScale.copy().range([
            size.height
            - PADDING.bottom,
            PADDING.top,
        ]);

    const projected =
        targetData.map(
            (artist) => ({
                x: baseXScale(artist.x),
                y: baseYScale(artist.y),
            }),
        );

    const minimumX =
        Math.min(
            ...projected.map(
                (point) => point.x,
            ),
        );

    const maximumX =
        Math.max(
            ...projected.map(
                (point) => point.x,
            ),
        );

    const minimumY =
        Math.min(
            ...projected.map(
                (point) => point.y,
            ),
        );

    const maximumY =
        Math.max(
            ...projected.map(
                (point) => point.y,
            ),
        );

    const centerX =
        (minimumX + maximumX) / 2;

    const centerY =
        (minimumY + maximumY) / 2;

    const horizontalSpan =
        Math.max(
            1,
            maximumX - minimumX,
        );

    const verticalSpan =
        Math.max(
            1,
            maximumY - minimumY,
        );

    const horizontalPadding = 140;
    const verticalPadding = 120;

    const availableWidth =
        Math.max(
            80,
            size.width
            - horizontalPadding,
        );

    const availableHeight =
        Math.max(
            80,
            size.height
            - verticalPadding,
        );

    const scale =
        targetData.length === 1
            ? 6
            : Math.max(
                0.45,
                Math.min(
                    12,
                    Math.min(
                        availableWidth
                        / horizontalSpan,

                        availableHeight
                        / verticalSpan,
                    ),
                ),
            );

    return zoomIdentity
        .translate(
            size.width / 2
            - scale * centerX,

            size.height / 2
            - scale * centerY,
        )
        .scale(scale);
}




const EMPTY_CLUSTER_IDS: number[] = [];


export function EmbeddingCanvas2D({
                                      data,
                                      highlightClusterId = null,
                                      highlightBoundaryData,
                                      additionalHighlightClusterIds = EMPTY_CLUSTER_IDS,
                                      additionalHighlightBoundaryData,
                                      dimNonHighlighted = false,
                                      comparisonArtistIds = null,
                                      dimNonCompared = false,
                                      focusData,
                                      fitRequestKey = 0,
                                      pointScale = 1,
                                      onVisibleClustersChange,
                                      onArtistClick,
                                  }: {
    data: ArtistEmbedding2D[];
    highlightBoundaryData?:
        ArtistEmbedding2D[];
    highlightClusterId?:
        number | null;
    additionalHighlightClusterIds?: number[];
    additionalHighlightBoundaryData?: ArtistEmbedding2D[];
    dimNonHighlighted?: boolean;
    comparisonArtistIds?:
        [string, string] | null;
    dimNonCompared?: boolean;
    focusData?: ArtistEmbedding2D[];
    fitRequestKey?: number;
    pointScale?: number;
    onVisibleClustersChange?: (
        clusters: VisibleClusterSummary[],
    ) => void;
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

    const lastFitRef = useRef<{
        focusData: ArtistEmbedding2D[];
        fitRequestKey: number;
        xScale: ScaleLinear<number, number>;
        yScale: ScaleLinear<number, number>;
    } | null>(null);

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

    const visibleClusterSignatureRef =
        useRef("");

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

    const highlightedClusterIds =
        useMemo(
            () => {
                const result: number[] = [];

                if (highlightClusterId !== null && highlightClusterId >= 0) {
                    result.push(highlightClusterId);
                }

                for (const clusterId of additionalHighlightClusterIds) {
                    if (clusterId >= 0 && !result.includes(clusterId)) {
                        result.push(clusterId);
                    }
                }

                return result;
            },
            [additionalHighlightClusterIds, highlightClusterId],
        );


    const scaleData =
        useMemo(
            () => [
                ...data,
                ...(highlightBoundaryData ?? []),
                ...(additionalHighlightBoundaryData ?? []),
            ],
            [
                additionalHighlightBoundaryData,
                data,
                highlightBoundaryData,
            ],
        );


    const clusterHulls =
        useMemo(
            () =>
                highlightedClusterIds
                    .map((clusterId) => {
                        const boundarySource =
                            clusterId === highlightClusterId
                                ? highlightBoundaryData ?? data
                                : additionalHighlightBoundaryData ?? data;

                        const coordinates = boundarySource
                            .filter((artist) => artist.cluster === clusterId)
                            .map((artist) => [
                                artist.x,
                                artist.y,
                            ] as [number, number]);

                        const hull = polygonHull(coordinates);

                        return {
                            clusterId,
                            hull: hull ? expandHull(hull) : null,
                        };
                    }),
            [
                additionalHighlightBoundaryData,
                data,
                highlightBoundaryData,
                highlightClusterId,
                highlightedClusterIds,
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

            if (onVisibleClustersChange) {
                const counts =
                    new Map<number, number>();

                for (const point of screenPoints) {
                    counts.set(
                        point.artist.cluster,
                        (
                            counts.get(
                                point.artist.cluster,
                            )
                            ?? 0
                        ) + 1,
                    );
                }

                const summary =
                    [...counts.entries()]
                        .map(
                            ([cluster, count]) => ({
                                cluster,
                                count,
                                isNoise: cluster < 0,
                            }),
                        )
                        .sort(
                            (first, second) =>
                                second.count
                                - first.count
                                || first.cluster
                                - second.cluster,
                        );

                const signature =
                    summary
                        .map(
                            (item) =>
                                `${item.cluster}:${item.count}`,
                        )
                        .join("|");

                if (
                    signature
                    !== visibleClusterSignatureRef.current
                ) {
                    visibleClusterSignatureRef.current =
                        signature;
                    onVisibleClustersChange(summary);
                }
            }

            for (const boundary of clusterHulls) {
                drawClusterBoundary(
                    context,
                    boundary.hull,
                    boundary.clusterId,
                    currentSize,
                    baseXScale,
                    baseYScale,
                    transform,
                );
            }

            if (comparisonArtistIds) {
                const firstComparisonPoint =
                    screenPoints.find(
                        (point) =>
                            point.artist.id
                            === comparisonArtistIds[0],
                    );

                const secondComparisonPoint =
                    screenPoints.find(
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

            screenPoints.sort(
                (
                    firstPoint,
                    secondPoint,
                ) => {
                    const firstCompared =
                        comparisonArtistIds?.includes(
                            firstPoint.artist.id,
                        )
                        ?? false;

                    const secondCompared =
                        comparisonArtistIds?.includes(
                            secondPoint.artist.id,
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
                        highlightedClusterIds.includes(
                            firstPoint.artist.cluster,
                        );

                    const secondHighlighted =
                        highlightedClusterIds.includes(
                            secondPoint.artist.cluster,
                        );

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

            const automaticScale =
                automaticPointScale(
                    screenPoints.length,
                    transform.k,
                );

            const zoomLevel =
                semanticZoomLevel(
                    transform.k,
                );

            for (const point of screenPoints) {
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
                    highlightedClusterIds.includes(
                        point.artist.cluster,
                    );

                const dimmed =
                    (
                        dimNonHighlighted
                        && highlightedClusterIds.length > 0
                        && !highlighted
                    )
                    || (
                        dimNonCompared
                        && comparisonArtistIds !== null
                        && !compared
                    );

                const baseRadius =
                    selected
                        ? 6.5
                        : highlighted
                            ? 3.25
                            : dimmed
                                ? 2.0
                                : zoomLevel === "overview"
                                    ? 2.15
                                    : zoomLevel === "neighborhood"
                                        ? 2.35
                                        : 2.55;

                const noiseScale =
                    point.artist.is_noise
                        ? 0.58
                        : 1;

                const radius =
                    baseRadius
                    * pointScale
                    * automaticScale
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
                            ? 0.96
                            : dimmed
                                ? 0.14
                                : point.artist.is_noise
                                    ? 0.15
                                    : 0.78;

                context.fill();

                context.globalAlpha =
                    selected
                        ? 1
                        : highlighted
                            ? 0.90
                            : dimmed
                                ? 0.12
                                : point.artist.is_noise
                                    ? 0.12
                                    : 0.70;

                context.strokeStyle =
                    clusterPointOutlineColor(
                        point.artist.cluster,
                    );

                context.lineWidth =
                    highlighted
                        ? 0.9
                        : 0.55;

                context.stroke();

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

            if (zoomLevel === "overview") {
                drawOverviewClusterLabels(
                    context,
                    screenPoints,
                    currentSize,
                );
            }

            drawArtistLabels(
                context,
                screenPoints,
                currentSize,
                explorer.selectedArtistId,
                highlightedClusterIds,
                transform.k,
            );

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
            clusterHulls,
            comparisonArtistIds,
            data,
            dimNonCompared,
            dimNonHighlighted,
            explorer.selectedArtistId,
            highlightedClusterIds,
            onVisibleClustersChange,
            pointScale,
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
            highlightedClusterIds,
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

                        const width = Math.max(1, entry.contentRect.width);
                        const height = Math.max(1, entry.contentRect.height);
                        setSize((current) =>
                            current.width === width && current.height === height
                                ? current
                                : { width, height },
                        );
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
        () => {
            const canvas =
                canvasRef.current;

            const zoomBehavior =
                zoomBehaviorRef.current;

            if (
                !canvas
                || !zoomBehavior
                || !focusData
                || focusData.length === 0
                || size.width <= 0
                || size.height <= 0
            ) {
                if (!focusData || focusData.length === 0) {
                    lastFitRef.current = null;
                }
                return;
            }

            const lastFit = lastFitRef.current;
            if (
                lastFit?.focusData === focusData
                && lastFit.fitRequestKey === fitRequestKey
                && lastFit.xScale === xScale
                && lastFit.yScale === yScale
            ) {
                return;
            }

            const transform =
                fitTransformForData(
                    focusData,
                    size,
                    xScale,
                    yScale,
                );

            select(canvas).call(
                zoomBehavior.transform,
                transform,
            );

            lastFitRef.current = {
                focusData,
                fitRequestKey,
                xScale,
                yScale,
            };
        },
        [
            fitRequestKey,
            focusData,
            size,
            xScale,
            yScale,
        ],
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
