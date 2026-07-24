export const API_URL =
    import.meta.env.VITE_API_URL
    ?? "http://localhost:8000";


type ErrorResponseBody = {
    detail?: unknown;
};


function errorDetail(
    value: unknown,
    fallback: string,
): string {
    if (typeof value === "string") {
        return value;
    }

    if (
        value
        && typeof value === "object"
    ) {
        const candidate = value as {
            message?: unknown;
        };

        if (
            typeof candidate.message === "string"
        ) {
            return candidate.message;
        }

        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }

    return fallback;
}


export async function getJson<T>(
    path: string,
    signal?: AbortSignal,
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(
            `${API_URL}${path}`,
            {
                signal,
            },
        );
    } catch (error) {
        if (
            error instanceof DOMException
            && error.name === "AbortError"
        ) {
            throw error;
        }

        throw new Error(
            "The ArtVis backend could not be reached. Check whether the backend and Neo4j containers are running.",
            {
                cause: error,
            },
        );
    }

    if (!response.ok) {
        const fallback =
            `${response.status} ${response.statusText}`;

        const detail = await response
            .json()
            .then(
                (body: ErrorResponseBody) =>
                    errorDetail(
                        body.detail,
                        fallback,
                    ),
            )
            .catch(() => fallback);

        throw new Error(detail);
    }

    return response.json() as Promise<T>;
}


export function buildQuery(
    entries: Record<
        string,
        string
        | number
        | boolean
        | Array<string | number>
        | null
        | undefined
    >,
): string {
    const params = new URLSearchParams();

    Object.entries(entries).forEach(
        ([key, value]) => {
            if (
                value === null
                || value === undefined
                || value === ""
            ) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach(
                    (item) =>
                        params.append(
                            key,
                            String(item),
                        ),
                );
                return;
            }

            params.set(
                key,
                String(value),
            );
        },
    );

    const query = params.toString();
    return query
        ? `?${query}`
        : "";
}
