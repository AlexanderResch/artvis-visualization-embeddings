import {
    createContext,
    useContext,
    type Dispatch,
    type SetStateAction,
} from "react";
import type {
    ClusterStatusFilter,
    GenderFilterValue,
    GroupMembershipFilter,
    ViewMode,
} from "../types/embedding";

export type YearRange = [number, number];

export type ExplorerContextValue = {
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

export const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export function useExplorer(): ExplorerContextValue {
    const context = useContext(ExplorerContext);

    if (!context) {
        throw new Error("useExplorer must be used inside ExplorerProvider");
    }

    return context;
}
