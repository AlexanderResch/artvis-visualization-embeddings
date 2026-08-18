export function clamp01(
    value: number,
): number {
    return Math.max(
        0,
        Math.min(1, value),
    );
}

export function genderLabel(
    gender: string | null | undefined,
): string {
    const normalized = (
        gender ?? ""
    ).trim().toUpperCase();

    if (normalized === "F") {
        return "Female";
    }

    if (normalized === "M") {
        return "Male";
    }

    return "Unknown";
}
