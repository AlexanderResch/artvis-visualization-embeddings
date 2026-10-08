import { API_URL } from "./http";
import type {
    MicroEntry,
    MicroEntryContext,
    ScreenshotCapture,
} from "../types/microEntry";

type ErrorResponseBody = {
    detail?: unknown;
};

async function requestJson<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(`${API_URL}${path}`, init);
    } catch (error) {
        throw new Error(
            "The study data could not be saved because the ArtVis backend is unavailable.",
            { cause: error },
        );
    }

    if (!response.ok) {
        const fallback = `${response.status} ${response.statusText}`;
        const message = await response
            .json()
            .then((body: ErrorResponseBody) => {
                if (typeof body.detail === "string") {
                    return body.detail;
                }
                return body.detail
                    ? JSON.stringify(body.detail)
                    : fallback;
            })
            .catch(() => fallback);
        throw new Error(message);
    }

    return response.json() as Promise<T>;
}

export function fetchMicroEntries(
    participantId: string,
    signal?: AbortSignal,
): Promise<MicroEntry[]> {
    const query = new URLSearchParams({
        participant_id: participantId,
    });
    return requestJson<MicroEntry[]>(
        `/evaluation/micro-entries?${query.toString()}`,
        { signal },
    );
}

export function createMicroEntryCapture({
    participantId,
    screenshotDataUrl,
}: {
    participantId: string;
    screenshotDataUrl: string;
}): Promise<ScreenshotCapture> {
    return requestJson<ScreenshotCapture>(
        "/evaluation/micro-entry-captures",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                participant_id: participantId,
                screenshot_data_url: screenshotDataUrl,
            }),
        },
    );
}

export function saveMicroEntry({
    participantId,
    entryId,
    captureId,
    pattern,
    views,
    explanation,
    context,
}: {
    participantId: string;
    entryId: string | null;
    captureId: string;
    pattern: string;
    views: string[];
    explanation: string;
    context: MicroEntryContext;
}): Promise<MicroEntry> {
    return requestJson<MicroEntry>(
        "/evaluation/micro-entries",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                participant_id: participantId,
                entry_id: entryId,
                capture_id: captureId,
                pattern,
                views,
                explanation,
                context,
            }),
        },
    );
}

