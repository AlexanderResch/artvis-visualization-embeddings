import {
    CssBaseline,
    ThemeProvider,
} from "@mui/material";

import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
    useParams,
    useSearchParams,
} from "react-router";

import {
    ExplorerProvider,
} from "./context/ExplorerProvider";

import {
    ExplorerPage,
} from "./pages/ExplorerPage.tsx";

import {
    theme,
} from "./theme";

import {
    ParticipantGate,
} from "./components/study/ParticipantGate";

import {
    useState,
} from "react";

import "./App.css";
import { EmbeddingModelProvider } from "./context/EmbeddingModelProvider";
import { useEmbeddingModel } from "./context/EmbeddingModelContext";

const PARTICIPANT_SESSION_KEY = "artvis-study-participant-id";


function ExplorerRedirect({ selection = {} }: { selection?: Record<string, string> }) {
    const { model } = useEmbeddingModel();
    const [params] = useSearchParams();
    const target = new URLSearchParams({ model, ...selection });
    if (params.get("view") === "3d") target.set("view", "3d");
    return <Navigate replace to={`/?${target}`} />;
}


function LegacyClusterRedirect() {
    const {
        clusterId,
    } = useParams();

    const parsedClusterId =
        Number(clusterId);

    const selection =
        Number.isInteger(parsedClusterId)
        && parsedClusterId >= 0
            ? { cluster: String(parsedClusterId) }
            : undefined;

    return (
        <ExplorerRedirect selection={selection} />
    );
}


function LegacyArtistRedirect() {
    const {
        artistId,
    } = useParams();

    return (
        <ExplorerRedirect selection={artistId ? { artist: artistId } : undefined} />
    );
}


function App() {
    const [participantId, setParticipantId] = useState(
        () => sessionStorage.getItem(PARTICIPANT_SESSION_KEY) ?? "",
    );

    const startParticipantSession = (nextParticipantId: string) => {
        sessionStorage.setItem(PARTICIPANT_SESSION_KEY, nextParticipantId);
        setParticipantId(nextParticipantId);
    };

    const changeParticipant = () => {
        sessionStorage.removeItem(PARTICIPANT_SESSION_KEY);
        setParticipantId("");
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />

            {!participantId
                ? (
                    <ParticipantGate onStart={startParticipantSession} />
                )
                : (
                    <BrowserRouter basename={import.meta.env.BASE_URL}>
                        <EmbeddingModelProvider><ExplorerProvider>
                            <Routes>
                                <Route
                                    path="/"
                                    element={
                                        <ExplorerPage
                                            participantId={participantId}
                                            onChangeParticipant={changeParticipant}
                                        />
                                    }
                                />

                                <Route
                                    path="/explore"
                                    element={
                                        <ExplorerPage
                                            participantId={participantId}
                                            onChangeParticipant={changeParticipant}
                                        />
                                    }
                                />

                                <Route
                                    path="/clusters/:clusterId"
                                    element={
                                        <LegacyClusterRedirect />
                                    }
                                />

                                <Route
                                    path="/artists/:artistId"
                                    element={
                                        <LegacyArtistRedirect />
                                    }
                                />

                                <Route
                                    path="/compare"
                                    element={
                                        <ExplorerRedirect />
                                    }
                                />

                                <Route
                                    path="/candidates"
                                    element={
                                        <ExplorerRedirect />
                                    }
                                />

                                <Route
                                    path="*"
                                    element={
                                        <ExplorerRedirect />
                                    }
                                />
                            </Routes>
                        </ExplorerProvider></EmbeddingModelProvider>
                    </BrowserRouter>
                )}
        </ThemeProvider>
    );
}

export default App;
