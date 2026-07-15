import createPlotlyComponentModule from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";

import type { Data, Layout } from "plotly.js";
import type { Embedding3D } from "../types/embedding";

const createPlotlyComponent =
    (createPlotlyComponentModule as any).default ?? createPlotlyComponentModule;

const Plot = createPlotlyComponent(Plotly);

type Props = {
    data: Embedding3D[];
    rotation?: number;
};

export function EmbeddingPlot3D({ data, rotation = 0 }: Props) {
    const types = Array.from(new Set(data.map((d) => d.type)));
    const angle = (rotation * Math.PI) / 180;

    const traces: Data[] = types.map((type) => {
        const filtered = data.filter((d) => d.type === type);

        return {
            x: filtered.map((d) => d.x),
            y: filtered.map((d) => d.y),
            z: filtered.map((d) => d.z),
            customdata: filtered.map((d) => [
                d.display_name,
                d.type,
                d.id,
                d.entity,
            ]),
            mode: "markers",
            type: "scatter3d",
            name: type,
            marker: {
                size: 3,
                opacity: 0.7,
            },
            hovertemplate:
                "<b>%{customdata[0]}</b><br>" +
                "Type: %{customdata[1]}<br>" +
                "ID: %{customdata[2]}<br>" +
                //"Entity: %{customdata[3]}<br>" +
                "x: %{x:.3f}<br>" +
                "y: %{y:.3f}<br>" +
                "z: %{z:.3f}<extra></extra>",
        };
    });

    const layout: Partial<Layout> = {
        title: {
            text: "ArtVis TransE Embeddings, UMAP 3D",
        },
        autosize: true,
        height: 700,
        scene: {
            xaxis: { title: { text: "UMAP 1" } },
            yaxis: { title: { text: "UMAP 2" } },
            zaxis: { title: { text: "UMAP 3" } },
            camera: {
                eye: {
                    x: 1.8 * Math.cos(angle),
                    y: 1.8 * Math.sin(angle),
                    z: 0.9,
                },
            },
        },
        legend: { orientation: "h" },
        margin: { l: 0, r: 0, t: 60, b: 0 },
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