import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, RefreshCw, Share2 } from "lucide-react";
import { GraphSkeleton } from "@/components/ui/Skeleton";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => <GraphSkeleton />
});

interface GraphNode {
  id: string;
  label: string;
  type: "company" | "finding" | "risk";
  impact?: "High" | "Medium" | "Low";
  val?: number;
  color?: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function ResearchGraph({ accountId }: { accountId: string }) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fgRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
  }, [accountId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/research/graph/${accountId}`);
      if (!res.ok) throw new Error("Graph API unreachable");
      const json = await res.json();

      const processedNodes = json.nodes.map((n: GraphNode) => ({
        ...n,
        val: n.val || (n.type === "company" ? 20 : n.type === "finding" ? 10 : 5),
        color: n.type === "company" ? "var(--brand-blue)" :
               n.type === "finding" ? (n.impact === "High" ? "var(--error)" : "var(--success)") :
               "var(--text-muted)"
      }));

      setData({ nodes: processedNodes, links: json.links });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load knowledge graph");
    } finally {
      setLoading(false);
    }
  };

  if (typeof window === 'undefined') return null;

  return (
    <div className="relative h-[600px] w-full border border-surface-glass-border rounded-2xl bg-surface-base/50 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500 group">
      {}
      <div className="absolute top-4 left-4 z-10 bg-surface-overlay/90 backdrop-blur-md p-3 rounded-xl text-[11px] text-text-dim border border-surface-glass-border shadow-lg">
        <div className="font-medium text-text-muted mb-2">Legend</div>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-2 h-2 rounded-full bg-brand-blue shadow-[0_0_8px_var(--brand-blue-glow)]"></div> Entity</div>
        <div className="flex items-center gap-2 mb-1.5"><div className="w-2 h-2 rounded-full bg-error"></div> High risk</div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success"></div> Confirmed strength</div>
      </div>

      {loading ? (
        <GraphSkeleton />
      ) : error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-error/5 z-30 p-8 text-center animate-in fade-in duration-300">
          <AlertCircle className="h-10 w-10 text-error/50 mb-3" />
          <h4 className="text-base font-medium text-error">Failed to load graph</h4>
          <p className="text-xs text-error/60 max-w-xs mt-1.5">{error}</p>
          <button
            onClick={fetchData}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-error/10 hover:bg-error/20 border border-error/20 rounded-xl text-xs font-medium text-error transition-all active:scale-[0.98]"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          nodeLabel="label"
          nodeColor="color"
          linkColor={() => "rgba(255, 255, 255, 0.06)"}
          backgroundColor="transparent"
          nodeRelSize={6}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={() => 0.005}
          onNodeClick={node => {
            fgRef.current?.centerAt(node.x, node.y, 1000);
            fgRef.current?.zoom(4, 2000);
          }}
        />
      )}

      <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={fetchData}
          className="p-2.5 bg-surface-overlay/80 backdrop-blur-md rounded-xl border border-surface-glass-border text-text-muted hover:text-white hover:border-brand-blue/20 transition-all shadow-lg active:scale-[0.98]"
          title="Refresh layout"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 px-3 py-2 bg-surface-overlay/80 backdrop-blur-md rounded-xl border border-surface-glass-border text-xs text-text-dim shadow-lg">
           <Share2 className="h-3 w-3 text-brand-blue" />
           Knowledge Graph
        </div>
      </div>
    </div>
  );
}