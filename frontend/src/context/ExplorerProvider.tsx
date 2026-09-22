import { useMemo, useState, type ReactNode } from "react";
import { ExplorerContext, type ExplorerContextValue, type YearRange } from "./ExplorerContext";
import type { ClusterStatusFilter, GenderFilterValue, GroupMembershipFilter, ViewMode } from "../types/embedding";

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

