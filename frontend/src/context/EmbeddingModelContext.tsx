import { createContext, useContext } from "react";

export type EmbeddingModelOption = {
    id: string;
    name: string;
    available: boolean;
    rank?: number;
    evaluation?: {
        validation_pair_f1_mean: number;
        test_pair_f1_mean: number;
        noise_fraction_mean: number;
        cross_seed_jaccard_mean: number | null;
        completed_seeds: number;
        clustered_seeds: number;
    };
};

export type ModelCatalog = {
    default: string;
    models: EmbeddingModelOption[];
};

export const EmbeddingModelContext = createContext<{
    model: string;
    models: EmbeddingModelOption[];
    selectModel: (model: string) => void;
} | null>(null);

export function useEmbeddingModel() {
    const context = useContext(EmbeddingModelContext);
    if (!context) throw new Error("Embedding model context is missing.");
    return context;
}
