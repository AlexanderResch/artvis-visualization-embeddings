import { Box, Button } from "@mui/material";
import {
    drag,
    extent,
    pointer,
    quadtree,
    scaleLinear,
    select,
    type D3DragEvent,
    type Quadtree,
} from "d3";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useExplorer } from "../../context/ExplorerContext";
import type { ArtistEmbedding3D } from "../../types/embedding";
import { clusterColor } from "../../visualization/colors";
import { CanvasTooltip, type CanvasTooltipState } from "./CanvasTooltip";

type Size = {
    width: number;
    height: number;
};

type ProjectedPoint = {
    artist: ArtistEmbedding3D;
    screenX: number;
    screenY: number;
    depth: number;
    perspective: number;
};

function safeDomain(values: number[]): [number, number] {
    const [minimum, maximum] = extent(values);

    if (minimum === undefined || maximum === undefined) {
        return [-1, 1];
    }

    if (minimum === maximum) {
        return [minimum - 1, maximum + 1];
    }

    return [minimum, maximum];
}

function prepareCanvas(canvas: HTMLCanvasElement, size: Size): CanvasRenderingContext2D | null {
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(size.width * ratio));
    const pixelHeight = Math.max(1, Math.round(size.height * ratio));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        canvas.style.width = `${size.width}px`;
        canvas.style.height = `${size.height}px`;
    }

    const context = canvas.getContext("2d", { alpha: true });
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
}

export default function EmbeddingCanvas3D({ data }: { data: ArtistEmbedding3D[] }) {
    const explorer = useExplorer();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sizeRef = useRef<Size>({ width: 0, height: 0 });
    const rotationRef = useRef({ x: -0.35, y: 0.65 });
    const zoomRef = useRef(1);
    const quadtreeRef = useRef<Quadtree<ProjectedPoint> | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [size, setSize] = useState<Size>({ width: 0, height: 0 });
    const [tooltip, setTooltip] = useState<CanvasTooltipState | null>(null);

    const normalizedPoints = useMemo(() => {
        const x = scaleLinear().domain(safeDomain(data.map((point) => point.x))).range([-1, 1]);
        const y = scaleLinear().domain(safeDomain(data.map((point) => point.y))).range([-1, 1]);
        const z = scaleLinear().domain(safeDomain(data.map((point) => point.z))).range([-1, 1]);

        return data.map((artist) => ({
            artist,
            x: x(artist.x),
            y: y(artist.y),
            z: z(artist.z),
        }));
    }, [data]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const currentSize = sizeRef.current;

        if (!canvas || currentSize.width <= 0 || currentSize.height <= 0) {
            return;
        }

        const context = prepareCanvas(canvas, currentSize);
        if (!context) {
            return;
        }

        context.clearRect(0, 0, currentSize.width, currentSize.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, currentSize.width, currentSize.height);

        const rotation = rotationRef.current;
        const cosX = Math.cos(rotation.x);
        const sinX = Math.sin(rotation.x);
        const cosY = Math.cos(rotation.y);
        const sinY = Math.sin(rotation.y);
        const baseScale = Math.min(currentSize.width, currentSize.height) * 0.36 * zoomRef.current;
        const projected: ProjectedPoint[] = [];

        for (const point of normalizedPoints) {
            const rotatedX = point.x * cosY + point.z * sinY;
            const firstDepth = -point.x * sinY + point.z * cosY;
            const rotatedY = point.y * cosX - firstDepth * sinX;
            const depth = point.y * sinX + firstDepth * cosX;
            const perspective = 1 / (1 + depth * 0.22);
            const screenX = currentSize.width / 2 + rotatedX * baseScale * perspective;
            const screenY = currentSize.height / 2 - rotatedY * baseScale * perspective;

            projected.push({
                artist: point.artist,
                screenX,
                screenY,
                depth,
                perspective,
            });
        }

        projected.sort((first, second) => first.depth - second.depth);

        for (const point of projected) {
            const selected = point.artist.id === explorer.selectedArtistId;
            const radius = selected ? 7 : (point.artist.is_noise ? 1.4 : 2.6) * point.perspective;

            context.beginPath();
            context.arc(point.screenX, point.screenY, Math.max(1, radius), 0, Math.PI * 2);
            context.fillStyle = clusterColor(point.artist.cluster);
            context.globalAlpha = selected ? 1 : point.artist.is_noise ? 0.16 : 0.65;
            context.fill();

            if (selected) {
                context.globalAlpha = 1;
                context.strokeStyle = "#111827";
                context.lineWidth = 2;
                context.stroke();
            }
        }

        context.globalAlpha = 1;
        context.fillStyle = "#6b7280";
        context.font = "11px Inter, Segoe UI, Arial, sans-serif";
        context.fillText("Drag to rotate · Wheel to zoom", 12, currentSize.height - 12);

        quadtreeRef.current = quadtree<ProjectedPoint>()
            .x((point) => point.screenX)
            .y((point) => point.screenY)
            .addAll(projected);
    }, [explorer.selectedArtistId, normalizedPoints]);

    const scheduleDraw = useCallback(() => {
        if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
            animationFrameRef.current = null;
            draw();
        });
    }, [draw]);

    useEffect(() => {
        sizeRef.current = size;
        scheduleDraw();
    }, [scheduleDraw, size]);

    useEffect(() => {
        scheduleDraw();
    }, [data, explorer.selectedArtistId, scheduleDraw]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) {
                return;
            }

            setSize({
                width: Math.max(1, entry.contentRect.width),
                height: Math.max(1, entry.contentRect.height),
            });
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const dragBehavior = drag<HTMLCanvasElement, unknown>()
            .on("start", () => {
                canvas.style.cursor = "grabbing";
                setTooltip(null);
            })
            .on("drag", (event: D3DragEvent<HTMLCanvasElement, unknown, unknown>) => {
                rotationRef.current = {
                    x: rotationRef.current.x + event.dy * 0.008,
                    y: rotationRef.current.y + event.dx * 0.008,
                };
                scheduleDraw();
            })
            .on("end", () => {
                canvas.style.cursor = "grab";
            });

        select(canvas).call(dragBehavior);

        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            zoomRef.current = Math.min(4.5, Math.max(0.45, zoomRef.current * Math.exp(-event.deltaY * 0.0012)));
            setTooltip(null);
            scheduleDraw();
        };

        canvas.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            select(canvas).on(".drag", null);
            canvas.removeEventListener("wheel", handleWheel);
        };
    }, [scheduleDraw]);

    useEffect(
        () => () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        },
        [],
    );

    function findPoint(event: React.PointerEvent<HTMLCanvasElement>): ProjectedPoint | undefined {
        const canvas = canvasRef.current;
        if (!canvas) {
            return undefined;
        }

        const [x, y] = pointer(event.nativeEvent, canvas);
        return quadtreeRef.current?.find(x, y, 10);
    }

    function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
        const found = findPoint(event);
        const canvas = canvasRef.current;

        if (!found || !canvas) {
            setTooltip(null);
            return;
        }

        const rect = canvas.getBoundingClientRect();
        setTooltip({
            left: event.clientX - rect.left,
            top: event.clientY - rect.top,
            artist: found.artist,
        });
    }

    function handleClick(event: React.PointerEvent<HTMLCanvasElement>) {
        const found = findPoint(event);
        if (!found) {
            return;
        }

        explorer.setSelectedArtistId(found.artist.id);
        explorer.setSelectedClusterId(found.artist.cluster);
    }

    function resetView() {
        rotationRef.current = { x: -0.35, y: 0.65 };
        zoomRef.current = 1;
        setTooltip(null);
        scheduleDraw();
    }

    return (
        <Box ref={containerRef} sx={{ position: "relative", width: "100%", height: "100%", minHeight: 420 }}>
            <canvas
                ref={canvasRef}
                aria-label="Interactive 3D Artist embedding map rendered on Canvas"
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setTooltip(null)}
                onClick={handleClick}
                style={{ display: "block", cursor: "grab", touchAction: "none" }}
            />
            <Button
                size="small"
                variant="outlined"
                onClick={resetView}
                sx={{ position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(255,255,255,0.9)" }}
            >
                Reset view
            </Button>
            <CanvasTooltip tooltip={tooltip} />
        </Box>
    );
}
