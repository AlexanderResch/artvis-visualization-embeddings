export const CLUSTER_COLORS = [
    "#4e79a7",
    "#f28e2b",
    "#e15759",
    "#76b7b2",
    "#59a14f",
    "#edc948",
    "#b07aa1",
    "#ff9da7",
    "#9c755f",
    "#7B2CBF",
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
];

export function clusterColor(
    cluster: number
): string {
    if (cluster < 0) {
        return "#9aa0a6";
    }

    return CLUSTER_COLORS[
    cluster % CLUSTER_COLORS.length
        ];
}