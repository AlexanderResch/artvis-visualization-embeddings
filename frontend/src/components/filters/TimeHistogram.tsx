import {
    Box,
    Slider,
    Typography
} from "@mui/material";

import {
    scaleBand,
    scaleLinear
} from "d3";

import {
    useEffect,
    useRef
} from "react";

import type {
    YearRange
} from "../../context/ExplorerContext";

import type {
    HistogramBin
} from "../../types/dashboard";


function drawHistogram(
    canvas:
    HTMLCanvasElement,

    bins:
    HistogramBin[],

    value:
    YearRange,

    width:
    number,

    height:
    number
) {
    const ratio =
        window.devicePixelRatio
        || 1;

    canvas.width =
        Math.max(
            1,
            Math.round(
                width * ratio
            )
        );

    canvas.height =
        Math.max(
            1,
            Math.round(
                height * ratio
            )
        );

    canvas.style.width =
        `${width}px`;

    canvas.style.height =
        `${height}px`;

    const context =
        canvas.getContext("2d");

    if (!context) {
        return;
    }

    context.setTransform(
        ratio,
        0,
        0,
        ratio,
        0,
        0
    );

    context.clearRect(
        0,
        0,
        width,
        height
    );

    const x =
        scaleBand<string>()
            .domain(
                bins.map(
                    bin =>
                        `${bin.start}-${bin.end}`
                )
            )
            .range([
                0,
                width
            ])
            .paddingInner(0.14);

    const y =
        scaleLinear()
            .domain([
                0,

                Math.max(
                    1,

                    ...bins.map(
                        bin => bin.count
                    )
                )
            ])
            .range([
                height - 1,
                3
            ]);


    for (const bin of bins) {
        const key =
            `${bin.start}-${bin.end}`;

        const barX =
            x(key);

        if (
            barX === undefined
        ) {
            continue;
        }

        const active =
            bin.end >= value[0]
            && bin.start <= value[1];

        const barY =
            y(bin.count);

        const barHeight =
            height - barY;

        context.fillStyle =
            active

                ? "rgba(49,95,125,0.82)"

                : "rgba(156,163,175,0.38)";

        context.fillRect(
            barX,
            barY,

            Math.max(
                1,
                x.bandwidth()
            ),

            barHeight
        );
    }
}


export function TimeHistogram({
                                  bins,
                                  value,
                                  minimum,
                                  maximum,
                                  onChange
                              }: {
    bins:
        HistogramBin[];

    value:
        YearRange;

    minimum:
        number;

    maximum:
        number;

    onChange:
        (value: YearRange) => void;
}) {
    const containerRef =
        useRef<
            HTMLDivElement | null
        >(null);

    const canvasRef =
        useRef<
            HTMLCanvasElement | null
        >(null);


    useEffect(() => {
        const container =
            containerRef.current;

        const canvas =
            canvasRef.current;

        if (
            !container
            || !canvas
        ) {
            return;
        }

        const render = () => {
            drawHistogram(
                canvas,
                bins,
                value,

                Math.max(
                    1,
                    container.clientWidth
                ),

                58
            );
        };

        const observer =
            new ResizeObserver(
                render
            );

        observer.observe(
            container
        );

        render();

        return () =>
            observer.disconnect();

    }, [
        bins,
        value
    ]);


    return (
        <Box>
            <Box
                ref={containerRef}

                sx={{
                    width: "100%",
                    height: 58
                }}
            >
                <canvas
                    ref={canvasRef}

                    aria-label={
                        "Birth-year histogram"
                    }

                    style={{
                        display: "block"
                    }}
                />
            </Box>

            <Slider
                size="small"

                value={value}

                min={minimum}

                max={maximum}

                step={1}

                valueLabelDisplay="auto"

                onChange={(
                    _,
                    next
                ) =>
                    onChange(
                        next as YearRange
                    )
                }
            />

            <Box
                sx={{
                    display: "flex",
                    justifyContent:
                        "space-between"
                }}
            >
                <Typography
                    variant="caption"
                >
                    {value[0]}
                </Typography>

                <Typography
                    variant="caption"
                >
                    {value[1]}
                </Typography>
            </Box>
        </Box>
    );
}