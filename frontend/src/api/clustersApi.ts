import {
    getJson,
} from "./http";

import type {
    ClusterInspection,
} from "../types/cluster";


export function fetchClusterInspection(
    clusterId: number,
    signal?: AbortSignal,
): Promise<ClusterInspection> {
    return getJson<ClusterInspection>(
        `/clusters/${clusterId}/inspection`,
        signal,
    );
}
