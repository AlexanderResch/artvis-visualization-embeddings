const ENTITY_COLORS: Record<string, string> = {
    Artist: "#1F2937",
    Exhibition: "#E76F51",
    Venue: "#2A9D8F",
    Group: "#9B5DE5",
    Location: "#59A14F",
    Organizer: "#F4A261",
    Artwork: "#4E79A7",
    Geoname: "#76B7B2",
    Person: "#6B7280",
    Entity: "#6B7280",
};


function generatedEntityColor(
    entityType: string,
): string {
    let hash = 0;

    for (
        let index = 0;
        index < entityType.length;
        index += 1
    ) {
        hash = (
            hash * 31
            + entityType.charCodeAt(index)
        ) >>> 0;
    }

    const hue = hash % 360;

    return `hsl(${hue} 58% 45%)`;
}


export function entityTypeColor(
    entityType: string,
): string {
    return ENTITY_COLORS[entityType]
        ?? generatedEntityColor(entityType);
}
