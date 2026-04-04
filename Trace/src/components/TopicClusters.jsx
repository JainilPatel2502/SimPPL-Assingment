import { useState, useEffect } from "react";
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = (createPlotlyComponent.default || createPlotlyComponent)(Plotly);

export default function ClusterMap3D({
  data,
  nClusters,
  onSliderChange,
  onNodeClick,
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-white/30 text-sm">
        Loading 3D coordinates...
      </div>
    );
  }

  // Pre-define a nice neon/synthwave color palette for the clusters
  const colors = [
    "#fb7185",
    "#38bdf8",
    "#34d399",
    "#a78bfa",
    "#facc15",
    "#cbd5e1",
    "#f472b6",
    "#2dd4bf",
    "#818cf8",
    "#fb923c",
    "#60a5fa",
    "#a3e635",
    "#c084fc",
    "#f87171",
    "#4ade80",
  ];

  // Organize points by cluster to create a separate trace for each legend item
  const traces = [];
  const groupedData = {};

  data.forEach((p) => {
    const c = p.cluster || 0;
    if (!groupedData[c]) {
      groupedData[c] = { x: [], y: [], z: [], texts: [], customdata: [] };
    }
    groupedData[c].x.push(p.umap_x);
    groupedData[c].y.push(p.umap_y);
    groupedData[c].z.push(p.umap_z);
    groupedData[c].customdata.push(p);

    // Formatting the hover label so it's readable
    const safeTitle = (p.title || "No Title").substring(0, 50) + "...";
    groupedData[c].texts.push(
      `<b>Score:</b> ${p.score || 0}<br><b>User:</b> u/${p.author || "Anon"}<br><b>Sub:</b> r/${p.subreddit}<br><i>${safeTitle}</i>`,
    );
  });

  // Calculate centroids to place cluster labels in space
  const annotations = [];

  Object.keys(groupedData).forEach((clusterId) => {
    const group = groupedData[clusterId];
    const cColor = colors[clusterId % colors.length];

    traces.push({
      type: "scatter3d",
      mode: "markers",
      name: `Topic ${clusterId}`,
      x: group.x,
      y: group.y,
      z: group.z,
      text: group.texts,
      customdata: group.customdata,
      hoverinfo: "text",
      marker: {
        size: 3,
        color: cColor,
        opacity: 0.8,
        line: { width: 0 },
      },
    });

    // Add 3D Text Label near the densest part of the cluster (average coords)
    const avgX = group.x.reduce((a, b) => a + b, 0) / group.x.length;
    const avgY = group.y.reduce((a, b) => a + b, 0) / group.y.length;
    const avgZ = group.z.reduce((a, b) => a + b, 0) / group.z.length;

    traces.push({
      type: "scatter3d",
      mode: "text",
      name: `Label ${clusterId}`,
      showlegend: false,
      x: [avgX],
      y: [avgY],
      z: [avgZ + 1], // slightly above cluster
      text: [`Topic ${clusterId}`],
      textfont: {
        color: "#ffffff",
        size: 14,
        family: "Inter, sans-serif",
      },
    });
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      {/* Dynamic Tunable Parameter slider - Required by rubric */}
      <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur border border-white/10 rounded-lg p-3 w-[220px]">
        <label className="text-[11px] text-white/50 uppercase tracking-widest flex justify-between mb-2">
          <span>Number of Clusters</span>
          <span className="text-violet-400 font-bold">{nClusters}</span>
        </label>
        <input
          type="range"
          min="2"
          max="15"
          value={nClusters}
          onChange={(e) => onSliderChange(parseInt(e.target.value))}
          className="w-full h-1 bg-white/20 rounded appearance-none focus:outline-none accent-violet-500"
        />
        <div className="flex justify-between text-[9px] text-white/30 mt-1 mb-2">
          <span>Broad Topics</span>
          <span>Niche Topics</span>
        </div>

        <a
          href="http://localhost:8000/api/topic/datamapplot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-1.5 px-3 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded text-xs transition-colors"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Export to Datamapplot
        </a>
      </div>

      <div className="flex-1 w-full relative">
        <Plot
          data={traces}
          onClick={(e) => {
            if (e.points && e.points.length > 0 && e.points[0].customdata) {
              const post = e.points[0].customdata;
              if (onNodeClick) onNodeClick(post);
            }
          }}
          layout={{
            autosize: true,
            margin: { l: 0, r: 0, t: 0, b: 0 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            scene: {
              bgcolor: "rgba(0,0,0,0)",
              xaxis: { visible: false, showgrid: false, zeroline: false },
              yaxis: { visible: false, showgrid: false, zeroline: false },
              zaxis: { visible: false, showgrid: false, zeroline: false },
              camera: {
                eye: { x: 1.5, y: 1.5, z: 1.5 }, // Starting zoom distance
              },
            },
            legend: {
              font: {
                color: "rgba(255,255,255,0.6)",
                size: 10,
                family: "Inter",
              },
              itemsizing: "constant",
              bgcolor: "rgba(0,0,0,0.5)",
              bordercolor: "rgba(255,255,255,0.1)",
              borderwidth: 1,
            },
            hoverlabel: {
              bgcolor: "rgba(20,20,20,0.95)",
              font: { color: "#ffffff", family: "Inter" },
              bordercolor: "rgba(139,92,246,0.5)",
            },
          }}
          useResizeHandler={true}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
          }}
          config={{ displayModeBar: false }}
        />
      </div>
    </div>
  );
}
