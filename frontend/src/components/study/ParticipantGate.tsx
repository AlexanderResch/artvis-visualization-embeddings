import {
    Box,
    Button,
    Paper,
    TextField,
    Typography,
} from "@mui/material";
import {
    type FormEvent,
    useState,
} from "react";

const PARTICIPANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function ParticipantGate({
    onStart,
}: {
    onStart: (participantId: string) => void;
}) {
    const [participantId, setParticipantId] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const normalizedId = participantId.trim();
    const valid = PARTICIPANT_ID_PATTERN.test(normalizedId);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setSubmitted(true);
        if (valid) {
            onStart(normalizedId);
        }
    };

    return (
        <Box className="participant-gate">
            <Paper
                component="form"
                elevation={8}
                className="participant-gate__card"
                onSubmit={handleSubmit}
            >
                <Box className="participant-gate__mark" aria-hidden="true">
                    <img src={`${import.meta.env.BASE_URL}artvis-logo.svg`} alt="" />
                </Box>

                <Typography
                    variant="h4"
                    component="h1"
                    sx={{ fontWeight: 750 }}
                >
                    ArtVis User Study
                </Typography>
                <Typography color="text.secondary">
                    Enter the participant code provided by the study facilitator.
                    It is used only to assign the micro-entries recorded in this session.
                </Typography>

                <TextField
                    autoFocus
                    fullWidth
                    label="Participant ID"
                    placeholder="e.g. P01"
                    value={participantId}
                    onChange={(event) => setParticipantId(event.target.value)}
                    error={submitted && !valid}
                    helperText={
                        submitted && !valid
                            ? "Use 1-40 letters, numbers, hyphens, or underscores."
                            : "Please do not enter your name."
                    }
                    slotProps={{
                        htmlInput: {
                            autoComplete: "off",
                            maxLength: 40,
                        },
                    }}
                />

                <Button
                    size="large"
                    variant="contained"
                    type="submit"
                    disabled={!normalizedId}
                >
                    Start exploration
                </Button>
            </Paper>
        </Box>
    );
}

