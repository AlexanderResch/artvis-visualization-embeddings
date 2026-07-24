import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    fetchArtistContext,
} from "../api/artistsApi";

import type {
    ArtistContextResponse,
} from "../types/artistContext";


type ArtistContextState = {
    context: ArtistContextResponse | null;
    loading: boolean;
    error: string | null;
};


type ArtistContextResult = {
    key: string | null;
    context: ArtistContextResponse | null;
    error: string | null;
};


export function useArtistContext(
    artistId: string | null,
    enabled: boolean,
): ArtistContextState {
    const requestKey =
        enabled && artistId
            ? artistId
            : null;

    const [result, setResult] =
        useState<ArtistContextResult>({
            key: null,
            context: null,
            error: null,
        });

    useEffect(
        () => {
            if (!requestKey) {
                return;
            }

            const controller =
                new AbortController();

            fetchArtistContext(
                requestKey,
                controller.signal,
            )
                .then(
                    (response) => {
                        if (!controller.signal.aborted) {
                            setResult({
                                key: requestKey,
                                context: response,
                                error: null,
                            });
                        }
                    },
                )
                .catch(
                    (reason: unknown) => {
                        if (!controller.signal.aborted) {
                            setResult({
                                key: requestKey,
                                context: null,
                                error:
                                    reason instanceof Error
                                        ? reason.message
                                        : "Failed to load Artist context",
                            });
                        }
                    },
                );

            return () =>
                controller.abort();
        },
        [requestKey],
    );

    return useMemo(
        () => {
            if (!requestKey) {
                return {
                    context: null,
                    loading: false,
                    error: null,
                };
            }

            if (result.key !== requestKey) {
                return {
                    context: null,
                    loading: true,
                    error: null,
                };
            }

            return {
                context: result.context,
                loading: false,
                error: result.error,
            };
        },
        [
            requestKey,
            result,
        ],
    );
}
