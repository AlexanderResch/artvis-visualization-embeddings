import {
    createContext,
    useContext,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react";
import type { ViewMode } from "../types/embedding";

export type YearRange = [number, number];

type ExplorerContextValue = {
    viewMode: ViewMode;
    setViewMode: Dispatch<SetStateAction<ViewMode>>;
    selectedArtistId: string | null;
    setSelectedArtistId: Dispatch<SetStateAction<string | null>>;
    selectedClusterId: number | null;
    setSelectedClusterId: Dispatch<SetStateAction<number | null>>;
    selectedClusters: number[];
    setSelectedClusters: Dispatch<SetStateAction<number[]>>;
    selectedGroupIds: string[];
    setSelectedGroupIds: Dispatch<SetStateAction<string[]>>;
    selectedLocationIds: string[];
    setSelectedLocationIds: Dispatch<SetStateAction<string[]>>;
    yearRange: YearRange | null;
    setYearRange: Dispatch<SetStateAction<YearRange | null>>;
    showNoise: boolean;
    setShowNoise: Dispatch<SetStateAction<boolean>>;
    minimumMembership: number;
    setMinimumMembership: Dispatch<SetStateAction<number>>;
    resetFilters: () => void;
};

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export function ExplorerProvider({ children }: { children: ReactNode }) {
    const [viewMode, setViewMode] = useState<ViewMode>("2d");
    const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
    const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
    const [selectedClusters, setSelectedClusters] = useState<number[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [yearRange, setYearRange] = useState<YearRange | null>(null);
    const [showNoise, setShowNoise] = useState(true);
    const [minimumMembership, setMinimumMembership] = useState(0);

    const value = useMemo<ExplorerContextValue>(
        () => ({
            viewMode,
            setViewMode,
            selectedArtistId,
            setSelectedArtistId,
            selectedClusterId,
            setSelectedClusterId,
            selectedClusters,
            setSelectedClusters,
            selectedGroupIds,
            setSelectedGroupIds,
            selectedLocationIds,
            setSelectedLocationIds,
            yearRange,
            setYearRange,
            showNoise,
            setShowNoise,
            minimumMembership,
            setMinimumMembership,
            resetFilters: () => {
                setSelectedClusters([]);
                setSelectedGroupIds([]);
                setSelectedLocationIds([]);
                setYearRange(null);
                setShowNoise(true);
                setMinimumMembership(0);
            },
        }),
        [
            minimumMembership,
            selectedArtistId,
            selectedClusterId,
            selectedClusters,
            selectedGroupIds,
            selectedLocationIds,
            showNoise,
            viewMode,
            yearRange,
        ],
    );

    return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorer(): ExplorerContextValue {
    const context = useContext(ExplorerContext);

    if (!context) {
        throw new Error("useExplorer must be used inside ExplorerProvider");
    }

    return context;
}
