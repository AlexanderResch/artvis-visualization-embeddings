import {
    Box,
    Button,
} from "@mui/material";

import {
    extent,
    pointer,
    quadtree,
    scaleLinear,
    select,
    zoom,
    zoomIdentity,
    type D3ZoomEvent,
    type Quadtree,
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
    const [
        minimum,
        maximum,
    ] = extent(values);

    if (
        minimum === undefined
        || maximum === undefined
    ) {
        return [0, 1];
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
        canvas.width
        !== pixelWidth
        || canvas.height
        !== pixelHeight
    ) {
        canvas.width =
            pixelWidth;

        canvas.height =
            pixelHeight;

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


export function EmbeddingCanvas2D({
                                      data,
                                  }: {
    data: ArtistEmbedding2D[];
}) {
    const explorer =
        useExplorer();

    const containerRef =
        useRef<
            HTMLDivElement | null
        >(null);

    const canvasRef =
        useRef<
            HTMLCanvasElement | null
        >(null);

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
        useRef<
            number | null
        >(null);

    const [
        tooltip,
        setTooltip,
    ] = useState<
        CanvasTooltipState
        | null
    >(null);

    const [
        size,
        setSize,
    ] = useState<CanvasSize>({
        width: 0,
        height: 0,
    });


    const xScale =
        useMemo(
            () =>
                scaleLinear()
                    .domain(
                        safeDomain(
                            data.map(
                                (point) =>
                                    point.x,
                            ),
                        ),
                    )
                    .nice(),

            [data],
        );


    const yScale =
        useMemo(
            () =>
                scaleLinear()
                    .domain(
                        safeDomain(
                            data.map(
                                (point) =>
                                    point.y,
                            ),
                        ),
                    )
                    .nice(),

            [data],
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

                const transform =
                    transformRef.current;

                const baseXScale =
                    xScale
                        .copy()
                        .range([
                            PADDING.left,

                            currentSize.width
                            - PADDING.right,
                        ]);

                const baseYScale =
                    yScale
                        .copy()
                        .range([
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


                for (
                    const artist
                    of data
                    ) {
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


                screenPoints.sort(
                    (
                        firstPoint,
                        secondPoint,
                    ) => {
                        if (
                            firstPoint.artist.is_noise
                            !== secondPoint.artist.is_noise
                        ) {
                            return firstPoint
                                .artist
                                .is_noise
                                ? -1
                                : 1;
                        }

                        return (
                            firstPoint.artist.cluster
                            - secondPoint.artist.cluster
                        );
                    },
                );


                for (
                    const point
                    of screenPoints
                    ) {
                    const isSelected =
                        point.artist.id
                        === explorer
                            .selectedArtistId;

                    const radius =
                        isSelected
                            ? 6.5
                            : point.artist.is_noise
                                ? 1.5
                                : 2.5;

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
                        isSelected
                            ? 1
                            : point.artist.is_noise
                                ? 0.18
                                : 0.72;

                    context.fill();


                    if (isSelected) {
                        context.globalAlpha =
                            1;

                        context.lineWidth =
                            2;

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

                        context.lineWidth =
                            2;

                        context.stroke();
                    }
                }

                context.globalAlpha =
                    1;


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
                        .addAll(
                            screenPoints,
                        );
            },

            [
                data,
                explorer.selectedArtistId,
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
            sizeRef.current =
                size;

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
                        const entry =
                            entries[0];

                        if (!entry) {
                            return;
                        }

                        setSize({
                            width:
                                Math.max(
                                    1,
                                    entry
                                        .contentRect
                                        .width,
                                ),

                            height:
                                Math.max(
                                    1,
                                    entry
                                        .contentRect
                                        .height,
                                ),
                        });
                    },
                );

            observer.observe(
                container,
            );

            return () => {
                observer.disconnect();
            };
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

                            setTooltip(
                                null,
                            );

                            scheduleDraw();
                        },
                    );

            zoomBehaviorRef.current =
                zoomBehavior;

            select(canvas)
                .call(
                    zoomBehavior,
                );


            return () => {
                select(canvas)
                    .on(
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
            return () => {
                if (
                    animationFrameRef.current
                    !== null
                ) {
                    cancelAnimationFrame(
                        animationFrameRef.current,
                    );
                }
            };
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

        return quadtreeRef
            .current
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
            findPoint(
                event,
            );

        const canvas =
            canvasRef.current;

        if (
            !foundPoint
            || !canvas
        ) {
            setTooltip(
                null,
            );

            if (canvas) {
                canvas.style.cursor =
                    "grab";
            }

            return;
        }

        const canvasRectangle =
            canvas
                .getBoundingClientRect();

        canvas.style.cursor =
            "pointer";

        setTooltip({
            left:
                event.clientX
                - canvasRectangle.left,

            top:
                event.clientY
                - canvasRectangle.top,

            artist:
            foundPoint.artist,
        });
    }


    function handleClick(
        event:
        ReactPointerEvent<
            HTMLCanvasElement
        >,
    ) {
        const foundPoint =
            findPoint(
                event,
            );

        if (!foundPoint) {
            return;
        }

        explorer
            .setSelectedArtistId(
                String(
                    foundPoint.artist.id,
                ),
            );

        explorer
            .setSelectedClusterId(
                foundPoint.artist.cluster,
            );
    }


    function resetView() {
        const canvas =
            canvasRef.current;

        const zoomBehavior =
            zoomBehaviorRef.current;

        setTooltip(
            null,
        );

        if (
            !canvas
            || !zoomBehavior
        ) {
            transformRef.current =
                zoomIdentity;

            scheduleDraw();

            return;
        }

        /*
         * Wichtig:
         * Hier wird dieselbe Zoom-Instanz verwendet,
         * die auch am Canvas registriert wurde.
         * Dadurch wird der Zoom-Listener ausgelöst,
         * transformRef aktualisiert und neu gezeichnet.
         */
        select(canvas)
            .call(
                zoomBehavior.transform,
                zoomIdentity,
            );
    }


    return (
        <Box
            ref={
                containerRef
            }

            sx={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 420,
                overflow: "hidden",
            }}
        >
            <canvas
                ref={
                    canvasRef
                }

                aria-label={
                    "Interactive 2D Artist "
                    + "embedding map"
                }

                onPointerMove={
                    handlePointerMove
                }

                onPointerLeave={
                    () =>
                        setTooltip(
                            null,
                        )
                }

                onClick={
                    handleClick
                }

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

                onClick={
                    resetView
                }

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
                tooltip={
                    tooltip
                }
            />
        </Box>
    );
}


function drawAxes(
    context:
    CanvasRenderingContext2D,

    size:
    CanvasSize,

    visibleXScale:
    ReturnType<
        typeof scaleLinear
    >,

    visibleYScale:
    ReturnType<
        typeof scaleLinear
    >,
) {
    context.save();

    context.strokeStyle =
        "#e7eaee";

    context.lineWidth =
        1;

    context.fillStyle =
        "#6b7280";

    context.font =
        "11px Inter, Segoe UI, Arial";


    visibleXScale
        .ticks(7)
        .forEach(
            (tick) => {
                const x =
                    visibleXScale(
                        tick,
                    );

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
                    visibleXScale
                        .tickFormat(7)(
                            tick,
                        ),

                    x,

                    size.height
                    - PADDING.bottom
                    + 7,
                );
            },
        );


    visibleYScale
        .ticks(6)
        .forEach(
            (tick) => {
                const y =
                    visibleYScale(
                        tick,
                    );

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
                    visibleYScale
                        .tickFormat(6)(
                            tick,
                        ),

                    PADDING.left - 7,
                    y,
                );
            },
        );

    context.restore();
}