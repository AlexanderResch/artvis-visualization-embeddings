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

const PARTICIPANT_SESSION_KEY = "artvis-study-participant-id";


function LegacyClusterRedirect() {
    const {
        clusterId,
    } = useParams();

    const parsedClusterId =
        Number(clusterId);

    const target =
        Number.isInteger(parsedClusterId)
        && parsedClusterId >= 0
            ? `/?cluster=${parsedClusterId}`
            : "/";

    return (
        <Navigate
            replace
            to={target}
        />
    );
}


function LegacyArtistRedirect() {
    const {
        artistId,
    } = useParams();

    const target = artistId
        ? `/?artist=${encodeURIComponent(artistId)}`
        : "/";

    return (
        <Navigate
            replace
            to={target}
        />
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
                    <BrowserRouter basename="/embedding-explorer">
                        <ExplorerProvider>
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
                                        <Navigate
                                            replace
                                            to="/"
                                        />
                                    }
                                />

                                <Route
                                    path="/candidates"
                                    element={
                                        <Navigate
                                            replace
                                            to="/"
                                        />
                                    }
                                />

                                <Route
                                    path="*"
                                    element={
                                        <Navigate
                                            replace
                                            to="/"
                                        />
                                    }
                                />
                            </Routes>
                        </ExplorerProvider>
                    </BrowserRouter>
                )}
        </ThemeProvider>
    );
}

export default App;
