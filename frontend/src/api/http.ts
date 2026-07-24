export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, { signal });

    if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;

        try {
            const body = (await response.json()) as { detail?: string };
            detail = body.detail ?? detail;
        } catch {

        }

        throw new Error(detail);
    }

    return response.json() as Promise<T>;
}

export function buildQuery(
    entries: Record<
        string,
        string | number | boolean | Array<string | number> | null | undefined
    >,
): string {
    const params = new URLSearchParams();

    Object.entries(entries).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, String(item)));
            return;
        }

        params.set(key, String(value));
    });

    const query = params.toString();
    return query ? `?${query}` : "";
}
