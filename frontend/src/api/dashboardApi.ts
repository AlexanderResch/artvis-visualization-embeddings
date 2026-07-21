import { buildQuery, getJson } from "./http";
import type { DashboardOptions } from "../types/dashboard";

export function fetchDashboardOptions(signal?: AbortSignal): Promise<DashboardOptions> {
    return getJson<DashboardOptions>("/dashboard/options", signal);
}

export function fetchFilteredArtistIds(
    groupIds: string[],
    locationIds: string[],
    signal?: AbortSignal,
): Promise<{ artist_ids: string[] }> {
    const query = buildQuery({ group: groupIds, location: locationIds });
    return getJson<{ artist_ids: string[] }>(`/dashboard/filter-artists${query}`, signal);
}
