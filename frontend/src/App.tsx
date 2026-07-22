import {
    CssBaseline,
    ThemeProvider,
} from "@mui/material";

import {
    BrowserRouter,
    Route,
    Routes,
} from "react-router";

import {
    ExplorerProvider,
} from "./context/ExplorerContext";

import {
    ClusterInspectionPage,
} from "./pages/ClusterInspectionPage";

import {
    DashboardPage,
} from "./pages/DashboardPage";

import {
    PlaceholderPage,
} from "./pages/PlaceholderPage";

import {
    theme,
} from "./theme";

import "./App.css";


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
                                <DashboardPage />
                            }
                        />

                        <Route
                            path="/artists/:artistId"
                            element={
                                <PlaceholderPage
                                    title="Artist detail"
                                />
                            }
                        />

                        <Route
                            path="/clusters/:clusterId"
                            element={
                                <ClusterInspectionPage />
                            }
                        />

                        <Route
                            path="/compare"
                            element={
                                <PlaceholderPage
                                    title="Artist comparison"
                                />
                            }
                        />

                        <Route
                            path="/candidates"
                            element={
                                <PlaceholderPage
                                    title="Cluster expansion"
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
