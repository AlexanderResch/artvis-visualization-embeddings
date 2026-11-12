import hdbscan
import numpy as np
from scipy import sparse


def cluster_jaccards(reference, repeated):
    """Best Jaccard match for each reference cluster, excluding noise."""
    groups, weights = np.unique(reference[reference >= 0], return_counts=True)
    other, other_sizes = np.unique(repeated[repeated >= 0], return_counts=True)
    if not len(groups):
        return groups, weights, np.array([], dtype=float)
    if not len(other):
        return groups, weights, np.zeros(len(groups))
    common = (reference >= 0) & (repeated >= 0)
    left = np.searchsorted(groups, reference[common])
    right = np.searchsorted(other, repeated[common])
    intersection = np.bincount(left * len(other) + right, minlength=len(groups) * len(other))
    intersection = intersection.reshape(len(groups), len(other))
    union = weights[:, None] + other_sizes[None, :] - intersection
    return groups, weights, (intersection / union).max(axis=1)


def matched_jaccard(reference, repeated):
    """Size-weighted best Jaccard match; noise does not count as a cluster."""
    groups, weights, scores = cluster_jaccards(reference, repeated)
    return float(np.average(scores, weights=weights)) if len(groups) else 0.0


def fit(data, size, samples, method="eom"):
    return hdbscan.HDBSCAN(
        min_cluster_size=size, min_samples=samples, metric="euclidean",
        cluster_selection_method=method, approx_min_span_tree=False,
        core_dist_n_jobs=1, gen_min_span_tree=True,
    ).fit(data)


def exhibition_matrix(artists, edges):
    links = edges.loc[edges.relation.eq("EXHIBITED_AT")].copy()
    artist_ids = dict(zip(artists.global_index, np.arange(len(artists)), strict=True))
    links["artist_index"] = links["head"].map(artist_ids)
    links = links.dropna(subset=["artist_index"])
    exhibitions = {value: index for index, value in enumerate(sorted(links["tail"].unique()))}
    return sparse.csr_matrix((np.ones(len(links)), (
        links.artist_index.astype(int), links["tail"].map(exhibitions),
    )), shape=(len(artists), len(exhibitions)))


def graph_agreement(labels, matrix, seed):
    assigned = np.flatnonzero(labels >= 0)
    if len(assigned) < 2:
        return {"within_cluster_shared_exhibition": None, "random_assigned_shared_exhibition": None}
    generator = np.random.default_rng(seed)
    queries = generator.choice(assigned, size=20000, replace=True)
    partners = np.empty(len(queries), dtype=int)
    for label in np.unique(labels[assigned]):
        positions = np.flatnonzero(labels[queries] == label)
        members = np.flatnonzero(labels == label)
        # Rotate by a random nonzero offset to exclude the query itself.
        offsets = generator.integers(1, len(members), len(positions))
        partners[positions] = members[(np.searchsorted(members, queries[positions]) + offsets) % len(members)]
    random_offsets = generator.integers(1, len(assigned), len(queries))
    random_partners = assigned[(np.searchsorted(assigned, queries) + random_offsets) % len(assigned)]
    def rate(neighbors):
        return float((np.asarray(matrix[queries].multiply(matrix[neighbors]).sum(axis=1)).ravel() > 0).mean())
    return {"within_cluster_shared_exhibition": rate(partners),
            "random_assigned_shared_exhibition": rate(random_partners)}
