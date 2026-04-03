import { useRef, useCallback, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";

export default function NetworkGraph({ graphData, onNodeClick }) {
  const fgRef = useRef();
  const hasZoomedRef = useRef(false);

  // Reset zoom tracking when data changes
  useEffect(() => {
    hasZoomedRef.current = false;
  }, [graphData]);

  const handleNodeClick = useCallback(
    (node) => {
      // Center/zoom on node
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(8, 2000);
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [fgRef, onNodeClick],
  );

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-neutral-500 font-medium text-sm">
        No network data points found
      </div>
    );
  }

  return (
    <div className="w-full h-full absolute inset-0">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeColor={(node) => (node.group === 1 ? "#fb7185" : "#38bdf8")}
        nodeRelSize={4}
        linkColor={() => "rgba(82, 82, 82, 0.4)"}
        linkOpacity={0.4}
        linkWidth={(link) => Math.min(Math.max(link.value / 2, 0.5), 3)}
        nodeLabel="name"
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.name;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(
            (n) => n + fontSize * 0.2,
          );

          // Calculate node size based on centrality (if available)
          const baseSize = node.group === 1 ? 4 : 5;
          const centralityBoost = node.centrality
            ? Math.max(node.centrality * 50, 0)
            : 0;
          const nodeRadius = baseSize + centralityBoost;

          // Node circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.group === 1 ? "#fb7185" : "#38bdf8";

          // Highlight high centrality nodes
          if (node.centrality && node.centrality > 0.05) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
          }

          ctx.fill();

          // Only show labels for nodes if zoomed in, or if it's a subreddit/domain (group 2) or high centrality
          if (
            globalScale > 2 ||
            node.group === 2 ||
            (node.centrality && node.centrality > 0.02)
          ) {
            const yOffset = nodeRadius + 4;
            ctx.fillStyle = "rgba(23, 23, 23, 0.8)";
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2 + yOffset,
              ...bckgDimensions,
            );

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#e5e5e5";
            ctx.fillText(label, node.x, node.y + yOffset);
          }
        }}
        onNodeClick={handleNodeClick}
        onEngineStop={() => {
          if (fgRef.current && !hasZoomedRef.current) {
            fgRef.current.zoomToFit(200, 30);
            hasZoomedRef.current = true;
          }
        }}
        warmupTicks={50}
        cooldownTicks={100}
        d3VelocityDecay={0.3}
        backgroundColor="#00000000" // transparent
      />
    </div>
  );
}
