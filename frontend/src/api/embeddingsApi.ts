import type { Embedding2D, Embedding3D } from "../types/embedding";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function fetchEmbeddings2D(): Promise<Embedding2D[]> {
    const response = await fetch(`${API_URL}/embeddings/2d`);

    if (!response.ok) {
        throw new Error("Failed to fetch 2D embeddings");
    }

    return response.json();
}

export async function fetchEmbeddings3D(): Promise<Embedding3D[]> {
    const response = await fetch(`${API_URL}/embeddings/3d`);

    if (!response.ok) {
        throw new Error("Failed to fetch 3D embeddings");
    }

    return response.json();
}