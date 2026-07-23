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
    ArtistTimelineYear,
} from "../../types/artistInspection";


type TimelineBin = {
    start: number;
    end: number;
    count: number;
    years: ArtistTimelineYear[];
};


type HoveredBin = {
    bin: TimelineBin;
    x: number;
    y: number;
} | null;


function createBins(
    years: ArtistTimelineYear[],
    binSize: 1 | 5 | 10,
): TimelineBin[] {
    if (years.length === 0) {
        return [];
    }

    const minimum =
        Math.min(
            ...years.map(
                (item) =>
                    item.year,
            ),
        );

    const maximum =
        Math.max(
            ...years.map(
                (item) =>
                    item.year,
            ),
        );

    const firstStart =
        Math.floor(
            minimum / binSize,
        ) * binSize;

    const bins: TimelineBin[] = [];

    for (
        let start = firstStart;
        start <= maximum;
        start += binSize
    ) {
        const end =
            start
            + binSize
            - 1;

        const matchingYears =
            years.filter(
                (item) =>
                    item.year >= start
                    && item.year <= end,
            );

        bins.push({
            start,
            end,
            count: matchingYears.reduce(
                (
                    total,
                    item,
                ) =>
                    total + item.count,
                0,
            ),
            years: matchingYears,
        });
    }

    return bins;
}


function binLabel(
    bin: TimelineBin,
): string {
    return bin.start === bin.end
        ? String(bin.start)
        : `${bin.start}–${bin.end}`;
}


export function ArtistActivityTimeline({
                                           years,
                                           undatedCount,
                                           binSize,
                                           birthYear,
                                           deathYear,
                                       }: {
    years: ArtistTimelineYear[];
    undatedCount: number;
    binSize: 1 | 5 | 10;
    birthYear: number | null;
    deathYear: number | null;
}) {
    const containerRef =
        useRef<HTMLDivElement | null>(null);

    const canvasRef =
        useRef<HTMLCanvasElement | null>(null);

    const hoveredBinRef =
        useRef<TimelineBin | null>(null);

    const [
        width,
        setWidth,
    ] = useState(560);

    const [
        hovered,
        setHovered,
    ] = useState<HoveredBin>(null);

    const bins =
        useMemo(
            () =>
                createBins(
                    years,
                    binSize,
                ),
            [
                binSize,
                years,
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
                                    280,
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

            const height = 320;
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

            if (bins.length === 0) {
                return;
            }

            const margin = {
                top: 20,
                right: 18,
                bottom: 50,
                left: 42,
            };

            const innerWidth =
                Math.max(
                    80,
                    width
                    - margin.left
                    - margin.right,
                );

            const innerHeight =
                height
                - margin.top
                - margin.bottom;

            const xScale =
                scaleBand<number>()
                    .domain(
                        bins.map(
                            (_, index) =>
                                index,
                        ),
                    )
                    .range([
                        margin.left,
                        margin.left
                        + innerWidth,
                    ])
                    .padding(0.15);

            const maximum =
                max(
                    bins,
                    (bin) =>
                        bin.count,
                )
                ?? 1;

            const yScale =
                scaleLinear()
                    .domain([
                        0,
                        maximum,
                    ])
                    .nice()
                    .range([
                        margin.top
                        + innerHeight,
                        margin.top,
                    ]);

            drawingContext.strokeStyle =
                "rgba(107, 114, 128, 0.45)";
            drawingContext.lineWidth = 1;
            drawingContext.beginPath();
            drawingContext.moveTo(
                margin.left,
                margin.top
                + innerHeight,
            );
            drawingContext.lineTo(
                margin.left
                + innerWidth,
                margin.top
                + innerHeight,
            );
            drawingContext.stroke();

            drawingContext.font =
                "11px Inter, Segoe UI, sans-serif";
            drawingContext.fillStyle =
                "#6B7280";
            drawingContext.textAlign =
                "right";
            drawingContext.textBaseline =
                "middle";

            for (
                const tick
                of yScale.ticks(4)
                ) {
                const y =
                    yScale(tick);

                drawingContext.fillText(
                    String(tick),
                    margin.left - 7,
                    y,
                );

                drawingContext.strokeStyle =
                    "rgba(148, 163, 184, 0.18)";
                drawingContext.beginPath();
                drawingContext.moveTo(
                    margin.left,
                    y,
                );
                drawingContext.lineTo(
                    margin.left
                    + innerWidth,
                    y,
                );
                drawingContext.stroke();
            }

            bins.forEach(
                (bin, index) => {
                    const x =
                        xScale(index);

                    if (x === undefined) {
                        return;
                    }

                    const y =
                        yScale(bin.count);

                    const barHeight =
                        margin.top
                        + innerHeight
                        - y;

                    drawingContext.fillStyle =
                        "#315F7D";
                    drawingContext.globalAlpha =
                        bin.count > 0
                            ? 0.88
                            : 0.14;
                    drawingContext.beginPath();
                    drawingContext.roundRect(
                        x,
                        y,
                        xScale.bandwidth(),
                        Math.max(
                            1,
                            barHeight,
                        ),
                        3,
                    );
                    drawingContext.fill();
                    drawingContext.globalAlpha = 1;
                },
            );

            function drawMilestone(
                year: number | null,
                label: string,
                color: string,
            ) {
                if (
                    year === null
                    || bins.length === 0
                ) {
                    return;
                }

                const index =
                    bins.findIndex(
                        (bin) =>
                            year >= bin.start
                            && year <= bin.end,
                    );

                if (index < 0) {
                    return;
                }

                const x =
                    xScale(index);

                if (x === undefined) {
                    return;
                }

                const centerX =
                    x
                    + xScale.bandwidth()
                    / 2;

                drawingContext.strokeStyle =
                    color;
                drawingContext.lineWidth = 1.5;
                drawingContext.setLineDash([
                    4,
                    3,
                ]);
                drawingContext.beginPath();
                drawingContext.moveTo(
                    centerX,
                    margin.top,
                );
                drawingContext.lineTo(
                    centerX,
                    margin.top
                    + innerHeight,
                );
                drawingContext.stroke();
                drawingContext.setLineDash([]);

                drawingContext.fillStyle =
                    color;
                drawingContext.textAlign =
                    "center";
                drawingContext.textBaseline =
                    "bottom";
                drawingContext.fillText(
                    label,
                    centerX,
                    margin.top - 3,
                );
            }

            drawMilestone(
                birthYear,
                "Birth",
                "#2A9D8F",
            );
            drawMilestone(
                deathYear,
                "Death",
                "#E76F51",
            );

            const tickCount =
                Math.min(
                    7,
                    bins.length,
                );

            const tickIndexes =
                Array.from({
                        length: tickCount,
                    }, (_, index) =>
                        Math.round(
                            index
                            * (bins.length - 1)
                            / Math.max(
                                1,
                                tickCount - 1,
                            ),
                        ),
                );

            drawingContext.fillStyle =
                "#6B7280";
            drawingContext.textAlign =
                "center";
            drawingContext.textBaseline =
                "top";

            for (
                const index
                of Array.from(
                new Set(
                    tickIndexes,
                ),
            )
                ) {
                const x =
                    xScale(index);

                if (x === undefined) {
                    continue;
                }

                drawingContext.fillText(
                    binLabel(
                        bins[index],
                    ),
                    x
                    + xScale.bandwidth()
                    / 2,
                    margin.top
                    + innerHeight
                    + 10,
                );
            }

            const selection =
                select(drawingCanvas);

            function handlePointerMove(
                event: PointerEvent,
            ) {
                const [
                    pointerX,
                    pointerY,
                ] = pointer(
                    event,
                    drawingCanvas,
                );

                const index =
                    bins.findIndex(
                        (_, candidateIndex) => {
                            const x =
                                xScale(
                                    candidateIndex,
                                );

                            return x !== undefined
                                && pointerX >= x
                                && pointerX
                                <= x
                                + xScale.bandwidth()
                                && pointerY >= margin.top
                                && pointerY
                                <= margin.top
                                + innerHeight;
                        },
                    );

                if (index < 0) {
                    hoveredBinRef.current = null;
                    setHovered(null);
                    return;
                }

                const bin =
                    bins[index];

                hoveredBinRef.current =
                    bin;

                setHovered({
                    bin,
                    x: pointerX,
                    y: pointerY,
                });
            }

            function handlePointerLeave() {
                hoveredBinRef.current = null;
                setHovered(null);
            }

            selection
                .on(
                    "pointermove",
                    handlePointerMove,
                )
                .on(
                    "pointerleave",
                    handlePointerLeave,
                );

            return () => {
                selection
                    .on(
                        "pointermove",
                        null,
                    )
                    .on(
                        "pointerleave",
                        null,
                    );
            };
        },
        [
            bins,
            birthYear,
            deathYear,
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
            {bins.length === 0
                ? (
                    <Box
                        sx={{
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            p: 2,
                            textAlign: "center",
                        }}
                    >
                        <Typography
                            variant="body2"
                            color="text.secondary"
                        >
                            No dated exhibition activity is available for this Artist.
                            {undatedCount > 0
                                ? ` ${undatedCount} exhibitions have no usable year.`
                                : ""}
                        </Typography>
                    </Box>
                )
                : (
                    <canvas
                        ref={canvasRef}
                        aria-label="Artist exhibition activity timeline"
                        style={{
                            display: "block",
                            width: "100%",
                            height: 320,
                        }}
                    />
                )}

            {hovered && (
                <Box
                    sx={{
                        position: "absolute",
                        left: Math.min(
                            hovered.x + 12,
                            width - 250,
                        ),
                        top: Math.max(
                            8,
                            hovered.y - 80,
                        ),
                        maxWidth: 240,
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
                        {binLabel(
                            hovered.bin,
                        )}
                        {" · "}
                        {hovered.bin.count}
                        {" exhibitions"}
                    </Typography>

                    {hovered.bin.years
                        .flatMap(
                            (year) =>
                                year.activities,
                        )
                        .slice(0, 4)
                        .map(
                            (activity) => (
                                <Typography
                                    key={activity.id}
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                        display: "block",
                                    }}
                                    noWrap
                                >
                                    {activity.label}
                                </Typography>
                            ),
                        )}
                </Box>
            )}

            {bins.length > 0
                && undatedCount > 0 && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            position: "absolute",
                            right: 8,
                            bottom: 2,
                        }}
                    >
                        {undatedCount.toLocaleString()}
                        {" undated exhibitions"}
                    </Typography>
                )}
        </Box>
    );
}
