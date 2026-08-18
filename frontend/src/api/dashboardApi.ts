import { buildQuery, getJson } from "./http";
import type { DashboardOptions } from "../types/dashboard";

export function fetchDashboardOptions(signal?: AbortSignal): Promise<DashboardOptions> {
    return getJson<DashboardOptions>("/dashboard/options", signal);
}

export function fetchFilteredArtistIds(
    groupIds: string[],
    locationIds: string[],
    groupMembership: "all" | "member" | "not-member" = "all",
    signal?: AbortSignal,
): Promise<{ artist_ids: string[] }> {
    const query = buildQuery({
        group: groupIds,
        location: locationIds,
        group_membership: groupMembership !== "all" ? groupMembership : undefined,
    });
    return getJson<{ artist_ids: string[] }>(`/dashboard/filter-artists${query}`, signal);
}
