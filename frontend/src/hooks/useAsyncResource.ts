import { useCallback, useEffect, useState } from "react";

type Request<T> = (signal: AbortSignal) => Promise<T>;

/** Keep responses tied to their request, so stale data is never shown as current. */
export function useAsyncResource<T>(request: Request<T> | null, delay = 0) {
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{
        request: Request<T>;
        revision: number;
        data: T | null;
        error: string | null;
    } | null>(null);

    useEffect(() => {
        if (!request) return;

        const controller = new AbortController();
        const run = async () => {
            try {
                const data = await request(controller.signal);
                if (!controller.signal.aborted) {
                    setResult({ request, revision, data, error: null });
                }
            } catch (reason) {
                if (!controller.signal.aborted) {
                    setResult({
                        request,
                        revision,
                        data: null,
                        error: reason instanceof Error ? reason.message : "Failed to load data",
                    });
                }
            }
        };

        const timer = delay > 0 ? window.setTimeout(run, delay) : null;
        if (timer === null) void run();

        return () => {
            if (timer !== null) window.clearTimeout(timer);
            controller.abort();
        };
    }, [request, revision, delay]);

    const current = request !== null
        && result?.request === request
        && result.revision === revision;

    return {
        data: current ? result.data : null,
        error: current ? result.error : null,
        loading: request !== null && !current,
        reload: useCallback(() => setRevision((value) => value + 1), []),
    };
}
