export function normalizeSearchText(
    value: string,
): string {
    return value
        .trim()
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function matchesSearchTokens(
    candidate: string,
    query: string,
): boolean {
    const normalizedCandidate = normalizeSearchText(candidate);
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
        return true;
    }

    const queryTokens = normalizedQuery.split(" ").filter(Boolean);

    return queryTokens.every(
        (token) => normalizedCandidate.includes(token),
    );
}
