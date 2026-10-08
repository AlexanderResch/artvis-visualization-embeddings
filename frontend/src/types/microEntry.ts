export const MICRO_ENTRY_VIEWS = [
    "2D embedding map",
    "3D embedding map",
    "Artist search",
    "Filters",
    "Navigation and reset",
    "Artist details and similarity information",
    "Cluster inspection and member table",
    "Ego network",
    "Top connections",
    "Exhibition activity timeline",
    "Artist comparison and shared context",
    "Connecting path view",
    "Cluster comparison",
] as const;

export type MicroEntryContext = Record<string, unknown>;

export type MicroEntry = {
    entry_id: string;
    version: number;
    version_count: number;
    created_at: string;
    updated_at: string;
    pattern: string;
    views: string[];
    explanation: string;
    context: MicroEntryContext;
    capture_id: string;
};

export type ScreenshotCapture = {
    capture_id: string;
    captured_at: string;
};

