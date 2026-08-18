import {
    getJson,
} from "./http";

import type {
    ClusterInspection,
} from "../types/cluster";

import type {
    GenderFilterValue,
    GroupMembershipFilter,
} from "../types/embedding";

export type ClusterInspectionFilters = {
    genders?: GenderFilterValue[];
    minimumMembership?: number;
    minimumExhibitedItems?: number;
    birthYearMin?: number | null;
    birthYearMax?: number | null;
    groupIds?: string[];
    groupMembership?: GroupMembershipFilter;
    locationIds?: string[];
};


export function fetchClusterInspection(
    clusterId: number,
    signal?: AbortSignal,
    filters?: ClusterInspectionFilters,
): Promise<ClusterInspection> {
    const params = new URLSearchParams();

    filters?.genders?.forEach(
        (gender) => params.append("gender", gender),
    );

    if ((filters?.minimumMembership ?? 0) > 0) {
        params.set(
            "minimum_membership",
            String(filters?.minimumMembership ?? 0),
        );
    }

    if ((filters?.minimumExhibitedItems ?? 0) > 0) {
        params.set(
            "minimum_exhibited_items",
            String(filters?.minimumExhibitedItems ?? 0),
        );
    }

    if (filters?.birthYearMin !== null
        && filters?.birthYearMin !== undefined) {
        params.set(
            "birth_year_min",
            String(filters.birthYearMin),
        );
    }

    if (filters?.birthYearMax !== null
        && filters?.birthYearMax !== undefined) {
        params.set(
            "birth_year_max",
            String(filters.birthYearMax),
        );
    }

    filters?.groupIds?.forEach(
        (groupId) => params.append("group_id", groupId),
    );

    if (
        filters?.groupMembership
        && filters.groupMembership !== "all"
    ) {
        params.set(
            "group_membership",
            filters.groupMembership,
        );
    }

    filters?.locationIds?.forEach(
        (locationId) =>
            params.append("location_id", locationId),
    );

    const query = params.toString();

    return getJson<ClusterInspection>(
        `/clusters/${clusterId}/inspection${query ? `?${query}` : ""}`,
        signal,
    );
}
