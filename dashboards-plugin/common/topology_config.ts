/** Explicit declarations, not connections inferred from matching throughput. No URLs or credentials. */
export interface TopologyLink {
  logstash_node_id: string;
  pipeline_id: string;
  target_cluster_uuid: string;
}
export interface TopologyConfig { links: TopologyLink[]; }
