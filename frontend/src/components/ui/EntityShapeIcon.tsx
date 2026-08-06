import {
    entityNodeShape,
} from "../../visualization/entityShapes";


export function EntityShapeIcon({
                                    entityType,
                                    color,
                                }: {
    entityType: string;
    color: string;
}) {
    const shape =
        entityNodeShape(
            entityType,
        );

    const commonProps = {
        fill: color,
        stroke: "#ffffff",
        strokeWidth: 1.2,
    };

    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
            style={{
                display: "block",
                flex: "0 0 auto",
            }}
        >
            {shape === "circle" && (
                <circle
                    cx="8"
                    cy="8"
                    r="5.8"
                    {...commonProps}
                />
            )}

            {shape === "square" && (
                <rect
                    x="2.5"
                    y="2.5"
                    width="11"
                    height="11"
                    rx="0.8"
                    {...commonProps}
                />
            )}

            {shape === "diamond" && (
                <polygon
                    points="8,1.7 14.3,8 8,14.3 1.7,8"
                    {...commonProps}
                />
            )}

            {shape === "triangle" && (
                <polygon
                    points="8,1.6 14.2,13.3 1.8,13.3"
                    {...commonProps}
                />
            )}

            {shape === "triangle-down" && (
                <polygon
                    points="1.8,2.7 14.2,2.7 8,14.4"
                    {...commonProps}
                />
            )}

            {shape === "pentagon" && (
                <polygon
                    points="8,1.4 14.2,5.9 11.8,13.2 4.2,13.2 1.8,5.9"
                    {...commonProps}
                />
            )}

            {shape === "hexagon" && (
                <polygon
                    points="4,1.8 12,1.8 15,8 12,14.2 4,14.2 1,8"
                    {...commonProps}
                />
            )}

            {shape === "star" && (
                <polygon
                    points="8,1 9.8,5.5 14.7,5.8 10.9,8.9 12.2,13.8 8,11.1 3.8,13.8 5.1,8.9 1.3,5.8 6.2,5.5"
                    {...commonProps}
                />
            )}

            {shape === "cross" && (
                <path
                    d="M5.7 1.3h4.6v4.4h4.4v4.6h-4.4v4.4H5.7v-4.4H1.3V5.7h4.4z"
                    {...commonProps}
                />
            )}

            {shape === "octagon" && (
                <polygon
                    points="5,1.2 11,1.2 14.8,5 14.8,11 11,14.8 5,14.8 1.2,11 1.2,5"
                    {...commonProps}
                />
            )}
        </svg>
    );
}
