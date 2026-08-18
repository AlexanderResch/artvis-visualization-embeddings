import {
    createContext,
    useContext,
    useMemo,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react";
import type {
    ClusterStatusFilter,
    GenderFilterValue,
    GroupMembershipFilter,
    ViewMode,
} from "../types/embedding";

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
    groupMembership: GroupMembershipFilter;
    setGroupMembership: Dispatch<SetStateAction<GroupMembershipFilter>>;
    selectedLocationIds: string[];
    setSelectedLocationIds: Dispatch<SetStateAction<string[]>>;
    yearRange: YearRange | null;
    setYearRange: Dispatch<SetStateAction<YearRange | null>>;
    clusterStatus: ClusterStatusFilter;
    setClusterStatus: Dispatch<SetStateAction<ClusterStatusFilter>>;
    selectedGenders: GenderFilterValue[];
    setSelectedGenders: Dispatch<SetStateAction<GenderFilterValue[]>>;
    minimumExhibitedItems: number;
    setMinimumExhibitedItems: Dispatch<SetStateAction<number>>;
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
    const [groupMembership, setGroupMembership] = useState<GroupMembershipFilter>("all");
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [yearRange, setYearRange] = useState<YearRange | null>(null);
    const [clusterStatus, setClusterStatus] = useState<ClusterStatusFilter>("all");
    const [selectedGenders, setSelectedGenders] = useState<GenderFilterValue[]>([]);
    const [minimumExhibitedItems, setMinimumExhibitedItems] = useState(0);
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
            groupMembership,
            setGroupMembership,
            selectedLocationIds,
            setSelectedLocationIds,
            yearRange,
            setYearRange,
            clusterStatus,
            setClusterStatus,
            selectedGenders,
            setSelectedGenders,
            minimumExhibitedItems,
            setMinimumExhibitedItems,
            minimumMembership,
            setMinimumMembership,
            resetFilters: () => {
                setSelectedClusters([]);
                setSelectedGroupIds([]);
                setGroupMembership("all");
                setSelectedLocationIds([]);
                setYearRange(null);
                setClusterStatus("all");
                setSelectedGenders([]);
                setMinimumExhibitedItems(0);
                setMinimumMembership(0);
            },
        }),
        [
            clusterStatus,
            minimumExhibitedItems,
            minimumMembership,
            selectedArtistId,
            selectedClusterId,
            selectedClusters,
            selectedGenders,
            selectedGroupIds,
            groupMembership,
            selectedLocationIds,
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
