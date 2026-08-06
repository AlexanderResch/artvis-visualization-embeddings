export type EntityNodeShape =
    | "circle"
    | "square"
    | "diamond"
    | "triangle"
    | "triangle-down"
    | "pentagon"
    | "hexagon"
    | "star"
    | "cross"
    | "octagon";


const ENTITY_NODE_SHAPES: Record<
    string,
    EntityNodeShape
> = {
    Artist: "circle",
    Exhibition: "square",
    Item: "diamond",
    Artwork: "star",
    Group: "triangle",
    Venue: "hexagon",
    Location: "triangle-down",
    Geoname: "pentagon",
    Organizer: "cross",
    Person: "octagon",
    Entity: "circle",
};


export function entityNodeShape(
    entityType: string,
): EntityNodeShape {
    return ENTITY_NODE_SHAPES[entityType]
        ?? "circle";
}


export function traceEntityNodeShape(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    shape: EntityNodeShape,
) {
    context.beginPath();

    if (shape === "circle") {
        context.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2,
        );
        return;
    }

    if (shape === "square") {
        const halfSide =
            radius * 0.86;

        context.rect(
            x - halfSide,
            y - halfSide,
            halfSide * 2,
            halfSide * 2,
        );
        return;
    }

    if (shape === "diamond") {
        context.moveTo(
            x,
            y - radius,
        );
        context.lineTo(
            x + radius,
            y,
        );
        context.lineTo(
            x,
            y + radius,
        );
        context.lineTo(
            x - radius,
            y,
        );
        context.closePath();
        return;
    }

    if (
        shape === "triangle"
        || shape === "triangle-down"
    ) {
        const direction =
            shape === "triangle"
                ? -1
                : 1;

        context.moveTo(
            x,
            y + direction * radius,
        );
        context.lineTo(
            x + radius * 0.92,
            y - direction * radius * 0.7,
        );
        context.lineTo(
            x - radius * 0.92,
            y - direction * radius * 0.7,
        );
        context.closePath();
        return;
    }

    if (shape === "cross") {
        const outer = radius;
        const inner = radius * 0.38;

        context.moveTo(
            x - inner,
            y - outer,
        );
        context.lineTo(
            x + inner,
            y - outer,
        );
        context.lineTo(
            x + inner,
            y - inner,
        );
        context.lineTo(
            x + outer,
            y - inner,
        );
        context.lineTo(
            x + outer,
            y + inner,
        );
        context.lineTo(
            x + inner,
            y + inner,
        );
        context.lineTo(
            x + inner,
            y + outer,
        );
        context.lineTo(
            x - inner,
            y + outer,
        );
        context.lineTo(
            x - inner,
            y + inner,
        );
        context.lineTo(
            x - outer,
            y + inner,
        );
        context.lineTo(
            x - outer,
            y - inner,
        );
        context.lineTo(
            x - inner,
            y - inner,
        );
        context.closePath();
        return;
    }

    const sides =
        shape === "pentagon"
            ? 5
            : shape === "hexagon"
                ? 6
                : shape === "octagon"
                    ? 8
                    : 10;

    for (
        let index = 0;
        index < sides;
        index += 1
    ) {
        const isStar =
            shape === "star";

        const pointRadius =
            isStar && index % 2 === 1
                ? radius * 0.46
                : radius;

        const angle =
            -Math.PI / 2
            + index
            * Math.PI
            * 2
            / sides;

        const pointX =
            x
            + Math.cos(angle)
            * pointRadius;

        const pointY =
            y
            + Math.sin(angle)
            * pointRadius;

        if (index === 0) {
            context.moveTo(
                pointX,
                pointY,
            );
        } else {
            context.lineTo(
                pointX,
                pointY,
            );
        }
    }

    context.closePath();
}
