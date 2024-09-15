import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  MarkerType,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import StateNode from "./stateNode";
import { MinimaxState, MinimaxStatus } from "./minimax";
import { GraphNode, useGraphNodes } from "./utils";
import { Button } from "@mui/material";
import Description from "./Description";
import useMinimax, { Algorithm } from "./useMinimax";
import FloatingEdge from './FloatingEdge';

export type { GraphNode } from "./utils";

const edgeTypes = {
  floating: FloatingEdge,
};
const nodeTypes = {
  stateNode: StateNode,
};

function Graph({ initial, algorithm }: { initial: GraphNode[], algorithm: Algorithm }) {
  const graphNodes = useGraphNodes(initial)

  const [minimax, updateMinimax] = useMinimax(algorithm, graphNodes);

  // convert to react-flow types
  const initialEdges = getRFEdges(graphNodes, minimax);
  const initialNodes = getRFNodes(graphNodes, minimax);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    // reset BFS if the nodes are changed
    updateMinimax(true);
  }, [graphNodes]);

  useEffect(() => {
    setEdges(getRFEdges(graphNodes, minimax));
    setNodes(getRFNodes(graphNodes, minimax, nodes));
  }, [minimax, setNodes, setEdges]);

  return (
    <>
      <ReactFlow
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Description content={minimax.description} nodeId={minimax.selectedNode} />
        <Controls>
          <Button
            color="primary"
            variant="contained"
            disabled={minimax.status == MinimaxStatus.Finished}
            onClick={() => updateMinimax()}
          >
            Step
          </Button>
          <Button color="primary" variant="outlined" onClick={() => {
              updateMinimax(true);
              setNodes(getRFNodes(graphNodes, minimax)); // reset positions
          }}>
            Restart
          </Button>
        </Controls>
      </ReactFlow>
    </>
  );
}

export default Graph;

function getRFEdges(nodes: GraphNode[], minimax: MinimaxState) {
  return nodes.flatMap((node) => node.edges.map((target) => ({
    id: `${node.id}-${target}`,
    source: node.id,
    target: target,
    type: 'floating',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
    },
    style: {
      stroke: node.isMax ? 'green' : 'red',
      strokeOpacity: 0.5,
    },
    animated: (node.id == minimax.showNodeChildren || target == minimax.showNodeParent),
  })));
}

function getRFNodes(nodes: GraphNode[], minimax: MinimaxState, baseNodes?: Node[]) {
  const positions = new Map<string, any>();
  (baseNodes || nodes).forEach(node => {
    positions.set(node.id, node.position);
  });

  return nodes.map((node) => ({
    id: node.id,
    type: "stateNode",
    data: {
      highlight: minimax.selectedNode == node.id,
      state: minimax.nodeStates.get(node.id),
      score: (node.score != null) ? node.score : minimax.nodeScores.get(node.id),
      isMax: node.isMax,
    },
    position: { ...positions.get(node.id) },
  }));
}
