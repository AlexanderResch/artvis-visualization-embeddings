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
} from "./context/ExplorerContext";

import {
    ExplorerPage,
} from "./pages/ExplorerPage.tsx";

import {
    theme,
} from "./theme";

import "./App.css";


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
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />

            <BrowserRouter>
                <ExplorerProvider>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <ExplorerPage />
                            }
                        />

                        <Route
                            path="/explore"
                            element={
                                <ExplorerPage />
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
        </ThemeProvider>
    );
}

export default App;
