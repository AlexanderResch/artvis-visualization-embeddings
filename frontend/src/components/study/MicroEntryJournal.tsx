import {
    Alert,
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    Drawer,
    IconButton,
    LinearProgress,
    Paper,
    Snackbar,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import html2canvas from "html2canvas";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    createMicroEntryCapture,
    fetchMicroEntries,
    saveMicroEntry,
} from "../../api/microEntriesApi";
import {
    MICRO_ENTRY_VIEWS,
    type MicroEntry,
    type MicroEntryContext,
} from "../../types/microEntry";

const REQUIRED_ENTRY_COUNT = 5;

function contextLabel(context: MicroEntryContext): string {
    const values = [
        typeof context.mode_label === "string"
            ? context.mode_label
            : null,
        typeof context.selected_artist_name === "string"
            ? context.selected_artist_name
            : null,
        typeof context.selected_cluster_id === "number"
            ? `Cluster ${context.selected_cluster_id}`
            : null,
    ].filter(Boolean);
    return values.join(" · ") || "Current exploration view";
}

async function captureMicroEntry(element: HTMLElement): Promise<string> {
    const canvas = await html2canvas(element, {
        backgroundColor: "#f7f8fa",
        logging: false,
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
    });
    return canvas.toDataURL("image/jpeg", 0.9);
}

export function MicroEntryJournal({
    participantId,
    context,
    onChangeParticipant,
}: {
    participantId: string;
    context: MicroEntryContext;
    onChangeParticipant: () => void;
}) {
    const [entries, setEntries] = useState<MicroEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(true);
    const [activeEntry, setActiveEntry] = useState<MicroEntry | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [journalOpen, setJournalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pattern, setPattern] = useState("");
    const [views, setViews] = useState<string[]>([]);
    const [explanation, setExplanation] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const drawerContentRef = useRef<HTMLDivElement | null>(null);
    const savingRef = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        fetchMicroEntries(participantId, controller.signal)
            .then(setEntries)
            .catch((reason: unknown) => {
                if (!controller.signal.aborted) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Micro-entries could not be loaded.",
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoadingEntries(false);
                }
            });
        return () => controller.abort();
    }, [participantId]);

    const openEntry = useCallback((entry: MicroEntry | null) => {
        setError(null);
        setActiveEntry(entry);
        setPattern(entry?.pattern ?? "");
        setViews(entry?.views ?? []);
        setExplanation(entry?.explanation ?? "");
        setJournalOpen(false);
        setDrawerOpen(true);
    }, []);

    const handleSave = useCallback(async () => {
        if (!pattern.trim() || !explanation.trim() || views.length === 0) {
            setError("Please answer both questions and select at least one view.");
            return;
        }
        if (!drawerContentRef.current) {
            setError("The micro-entry could not be captured. Please reopen it.");
            return;
        }
        if (savingRef.current) {
            return;
        }

        savingRef.current = true;
        setError(null);
        try {
            const screenshotDataUrl = await captureMicroEntry(
                drawerContentRef.current,
            );
            setSaving(true);
            const capture = await createMicroEntryCapture({
                participantId,
                screenshotDataUrl,
            });
            const saved = await saveMicroEntry({
                participantId,
                entryId: activeEntry?.entry_id ?? null,
                captureId: capture.capture_id,
                pattern,
                views,
                explanation,
                context,
            });
            setEntries((current) => {
                const withoutSaved = current.filter(
                    (entry) => entry.entry_id !== saved.entry_id,
                );
                return [...withoutSaved, saved].sort((first, second) =>
                    first.entry_id.localeCompare(second.entry_id),
                );
            });
            setDrawerOpen(false);
            setNotice(
                activeEntry
                    ? `${saved.entry_id} saved as version ${saved.version}.`
                    : `${saved.entry_id} saved.`,
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : "The micro-entry could not be saved.",
            );
        } finally {
            setSaving(false);
            savingRef.current = false;
        }
    }, [
        activeEntry,
        context,
        explanation,
        participantId,
        pattern,
        views,
    ]);

    const progress = Math.min(
        100,
        (entries.length / REQUIRED_ENTRY_COUNT) * 100,
    );
    const formTitle = activeEntry
        ? `Revise ${activeEntry.entry_id}`
        : `Micro-entry ${String(entries.length + 1).padStart(2, "0")}`;
    const nextVersion = activeEntry
        ? activeEntry.version_count + 1
        : 1;

    return (
        <>
            <Box
                className="micro-entry-widget"
                data-micro-entry-ui
                aria-label="Micro-entry journal"
            >
                <Paper
                    className={
                        journalOpen
                            ? "micro-entry-widget__panel micro-entry-widget__panel--open"
                            : "micro-entry-widget__panel"
                    }
                    elevation={8}
                >
                    <Box className="micro-entry-widget__header">
                        <Box>
                            <Typography sx={{ fontWeight: 750 }}>
                                Micro-entries
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {entries.length} of {REQUIRED_ENTRY_COUNT} observations
                            </Typography>
                        </Box>
                        {loadingEntries && <CircularProgress size={18} />}
                    </Box>
                    <LinearProgress variant="determinate" value={progress} />

                    <Box className="micro-entry-widget__entries">
                        {!loadingEntries && entries.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                No micro-entries yet.
                            </Typography>
                        )}
                        {entries.map((entry, index) => (
                            <Button
                                key={entry.entry_id}
                                className="micro-entry-widget__entry"
                                aria-label={`Open ${entry.entry_id}`}
                                onClick={() => openEntry(entry)}
                            >
                                <span className="micro-entry-widget__entry-number">
                                    {index + 1}
                                </span>
                                <span className="micro-entry-widget__entry-text">
                                    {entry.pattern}
                                </span>
                                <span className="micro-entry-widget__entry-version">
                                    v{entry.version_count}
                                </span>
                            </Button>
                        ))}
                    </Box>

                    <Button
                        fullWidth
                        variant="contained"
                        className="micro-entry-widget__new"
                        onClick={() => openEntry(null)}
                    >
                        + New micro-entry
                    </Button>
                </Paper>

                <Tooltip title="Micro-entry journal" placement="left">
                    <IconButton
                        className="micro-entry-widget__launcher"
                        aria-label="Show micro-entry journal"
                        aria-expanded={journalOpen}
                        onClick={() => setJournalOpen((current) => !current)}
                    >
                        <span className="micro-entry-widget__glyph" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </span>
                        <span className="micro-entry-widget__count">
                            {entries.length}
                        </span>
                    </IconButton>
                </Tooltip>
            </Box>

            <Drawer
                anchor="right"
                open={drawerOpen}
                onClose={() => {
                    if (!saving) {
                        setDrawerOpen(false);
                    }
                }}
                slotProps={{
                    paper: {
                        className: "micro-entry-drawer",
                    },
                }}
            >
                <Box
                    ref={drawerContentRef}
                    className="micro-entry-drawer__content"
                >
                    <Box className="micro-entry-drawer__header">
                        <Box>
                            <Typography
                                variant="h5"
                                sx={{ fontWeight: 750 }}
                            >
                                {formTitle}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Participant {participantId} · Version {nextVersion}
                            </Typography>
                        </Box>
                        <Button size="small" onClick={onChangeParticipant}>
                            Change participant
                        </Button>
                    </Box>

                    <Box className="micro-entry-drawer__capture">
                        <span className="micro-entry-drawer__capture-dot" />
                        <Box>
                            <Typography
                                variant="body2"
                                sx={{ fontWeight: 700 }}
                            >
                                This micro-entry will be captured when you save it
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Recorded in: {contextLabel(context)}
                            </Typography>
                        </Box>
                    </Box>

                    <Box className="micro-entry-drawer__form">
                        <TextField
                            required
                            fullWidth
                            multiline
                            minRows={4}
                            label="What pattern do you notice?"
                            value={pattern}
                            onChange={(event) => setPattern(event.target.value)}
                            slotProps={{
                                htmlInput: { maxLength: 10000 },
                            }}
                        />

                        <Autocomplete
                            multiple
                            options={[...MICRO_ENTRY_VIEWS]}
                            value={views}
                            onChange={(_, value) => setViews(value)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    required
                                    label="Which view did you look at?"
                                    helperText="Select one or more views."
                                    placeholder={views.length
                                        ? "Add another view"
                                        : "Choose views"}
                                />
                            )}
                        />

                        <TextField
                            required
                            fullWidth
                            multiline
                            minRows={5}
                            label="How would you explain this pattern?"
                            value={explanation}
                            onChange={(event) => setExplanation(event.target.value)}
                            slotProps={{
                                htmlInput: { maxLength: 10000 },
                            }}
                        />

                        {error && <Alert severity="error">{error}</Alert>}

                        <Box className="micro-entry-drawer__actions">
                            <Button
                                variant="text"
                                onClick={() => setDrawerOpen(false)}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => void handleSave()}
                                disabled={
                                    saving
                                    || !pattern.trim()
                                    || !explanation.trim()
                                    || views.length === 0
                                }
                            >
                                {saving
                                    ? "Saving…"
                                    : activeEntry
                                        ? `Save version ${nextVersion}`
                                        : "Save micro-entry"}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Drawer>

            <Snackbar
                open={Boolean(error) && !drawerOpen}
                autoHideDuration={7000}
                onClose={() => setError(null)}
                message={error}
                data-micro-entry-ui
            />
            <Snackbar
                open={Boolean(notice)}
                autoHideDuration={4000}
                onClose={() => setNotice(null)}
                message={notice}
                data-micro-entry-ui
            />
        </>
    );
}

