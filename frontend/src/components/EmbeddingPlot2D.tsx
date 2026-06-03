import createPlotlyComponentModule from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";

import type { Data, Layout } from "plotly.js";
import type { Embedding2D } from "../types/embedding";

const createPlotlyComponent =
    (createPlotlyComponentModule as any).default ?? createPlotlyComponentModule;

const Plot = createPlotlyComponent(Plotly);

type Props = {
    data: Embedding2D[];
};

export function EmbeddingPlot2D({ data }: Props) {
    const types = Array.from(new Set(data.map((d) => d.type)));

    const traces: Data[] = types.map((type) => {
        const filtered = data.filter((d) => d.type === type);

        return {
            x: filtered.map((d) => d.x),
            y: filtered.map((d) => d.y),
            text: filtered.map((d) => d.entity),
            mode: "markers",
            type: "scattergl",
            name: type,
            marker: {
                size: 4,
                opacity: 0.7,
            },
            hovertemplate:
                "<b>%{text}</b><br>x=%{x}<br>y=%{y}<extra></extra>",
        };
    });

    const layout: Partial<Layout> = {
        title: {
            text: "ArtVis TransE Embeddings, UMAP 2D",
        },
        autosize: true,
        height: 700,
        hovermode: "closest",
        xaxis: { title: { text: "UMAP 1" } },
        yaxis: { title: { text: "UMAP 2" } },
        legend: { orientation: "h" },
        margin: { l: 40, r: 20, t: 60, b: 40 },
    };

    return (
        <Plot
            data={traces}
            layout={layout}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
            config={{
                responsive: true,
                displaylogo: false,
            }}
        />
    );
}