import { useMemo } from "react";

export type GraphNode = {
  id: string,
  position: {
    x: number;
    y: number;
  }
  edges: string[]; // IDs of connected nodes
  isMax?: boolean;
  score?: number;
};

/**
 * Initialize some properties in the given graph nodes.
 * @param initial 
 * @returns Modified graph nodes.
 */
export function useGraphNodes(initial: GraphNode[]): GraphNode[] {
  return useMemo(() => {
    function userCb(node: GraphNode, level: number) {
      if (node.edges.length == 0 && node.score === undefined) {
        throw new Error(`Terminal nodes are expected to have score: in node ${node.id}`);
      }
      return {
        ...node,
        isMax: (level % 2) == 0,
      }
    }
    return bfs(initial, userCb);
  }, [initial]);
}

/**
 * Finds all the nodes that don't have any input edges to them.
 * @param adj Adjacency list describing the graph.
 * @returns Array of nodes.
 */
export function findStartingNodes(adj: Map<string, Set<string>>) {
  const startNodes = new Set<string>(adj.keys());
  for (let targetNodes of Array.from(adj.values())) {
    for (const node of Array.from(targetNodes)) {
      if (startNodes.has(node)) {
        startNodes.delete(node);
      }
    }
  }
  return Array.from(startNodes);
}

export type AdjList = Map<string, Set<string>>;

export function buildAdjList(nodes: GraphNode[]): AdjList {
  const adj: AdjList = new Map();
  nodes.forEach(node => {
    if (!adj.has(node.id)) {
      adj.set(node.id, new Set());
    }
    node.edges.forEach(target => {
      if (!adj.has(target)) {
        adj.set(target, new Set());
      }
      adj.get(node.id)?.add(target);
    });
  });
  return adj;
}

export function bfs(nodes: GraphNode[], userCb: (node: GraphNode, level: number) => GraphNode) {
  const adj = buildAdjList(nodes);
  const queue = findStartingNodes(adj);
  const levels = new Map<string, number>(queue.map(nodeId => [nodeId, 0]));
  const visited = new Set<string>();
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const outputList: GraphNode[] = [];

  // deep copy nodes
  const cb = (node: GraphNode, level: number) => JSON.parse(JSON.stringify(userCb(node, level)))

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      throw new Error('Unreachable');
    }

    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);

    const nodeLevel = levels.get(nodeId);
    if (nodeLevel === undefined) {
      throw new Error('Level not found for node');
    }

    const node = nodeMap.get(nodeId);
    if (!node) {
      throw new Error('Expected node');
    }

    // call user defined transformation
    outputList.push(cb(node, nodeLevel));

    adj.get(nodeId)?.forEach(childId => {
      queue.push(childId);
      levels.set(childId, nodeLevel + 1);
    });
  }
  return outputList;
}


/**
 * Inverts a graph's adjacency list switching input edges to output edges.
 * @param adj Adjacency list to invert.
 * @returns Inverted graph's adjacency list.
 */
export function invertGraph(adj: AdjList): AdjList {
  const inverted: AdjList = new Map();
  for (let [nodeId, outEdges] of adj) {
    if (!inverted.has(nodeId)) {
      inverted.set(nodeId, new Set());
    }

    for (let outNodeId of outEdges) {
      if (!inverted.has(outNodeId)) {
        inverted.set(outNodeId, new Set());
      }
      inverted.get(outNodeId)?.add(nodeId);
    }
  }
  return inverted;
}

export function sortedSet<T>(s?: Set<T>): T[] | undefined {
  if (s == undefined) {
    return undefined;
  }
  const arr = Array.from(s);
  arr.sort();
  return arr;
}
