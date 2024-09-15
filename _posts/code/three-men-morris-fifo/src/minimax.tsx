import { enableMapSet } from 'immer'

enableMapSet()

import { AdjList, buildAdjList, findStartingNodes, GraphNode, sortedSet } from "./utils";

export enum NodeState {
  Unvisited,
  Queued,
  StartProcessing,
  ProcessChildren,
  CalculateScore,
  EndProcessing,
  Visited,
}

export enum MinimaxStatus {
  Init,
  InProgress,
  Finished,
}

export type MinimaxState = {
  description: string,
  status: MinimaxStatus;
  selectedNode: string | null, // node to highlight
  showNodeChildren: string | null,  // id of the node whose children are shown
  showNodeParent: string | null,  // id of the node whose parents are shown
  stack: string[];
  adj: AdjList;
  nodeStates: Map<string, NodeState>;
  nodeScores: Map<string, number | null>;
  nodes: Map<string, GraphNode>,
};


/**
 * Creates the initial state for a minimax based on the given adjacency list.
 * @param adjList 
 * @returns New state.
 */
export function minimaxInitialState(nodes: GraphNode[]): MinimaxState {
  const adjList = buildAdjList(nodes);
  const nodeIds = Array.from(adjList.keys());

  return {
    description: '',
    status: MinimaxStatus.Init,
    selectedNode: null,
    showNodeChildren: null,
    showNodeParent: null,
    stack: [],
    adj: adjList,
    nodeStates: new Map(nodeIds.map((id) => [id, NodeState.Unvisited])),
    nodeScores: new Map(nodeIds.map((id) => [id, null])),
    nodes: new Map(nodes.map(node => [node.id, node])),
  };
}

/**
 * A coroutine that executes each step of the minimax algorithm.
 * @param ctx Object containing the minimax state to update.
 */
export function *minimaxCoroutine(ctx: { state: MinimaxState }) {
  ctx.state.description = `Push the initial node into the stack`;
  yield;

  ctx.state.status = MinimaxStatus.InProgress;

  ctx.state.stack = findStartingNodes(ctx.state.adj);
  for (var nodeId of ctx.state.stack) {
    ctx.state.nodeStates.set(nodeId, NodeState.Queued);
    ctx.state.description = `Queued node: ${nodeId}`;
    ctx.state.selectedNode = nodeId;
    yield;
  }
  ctx.state.description = `Ready to start navigating the graph`;
  ctx.state.selectedNode = null;
  yield;

  while (ctx.state.stack.length > 0) {
    const nodeId = ctx.state.stack.pop();
    if (!nodeId) {
      throw new Error('Unreachable');
    }

    // update the current node so we can highlight it in the UI
    ctx.state.selectedNode = nodeId;
    ctx.state.showNodeChildren = null;  // id of the node whose children are shown

    switch (ctx.state.nodeStates.get(nodeId)) {
      case NodeState.Visited:
        // this node is finished so we can skip it
        break;

      case NodeState.CalculateScore:
        // should calculate the node score from the children here
        yield * calculateNodeScore(ctx);
        yield;
        break;

      default:
        yield * processNode(ctx);
        yield;
        break;
    }
  }

  ctx.state.status = MinimaxStatus.Finished;
  ctx.state.description = `Finished`;
  ctx.state.showNodeChildren = ctx.state.selectedNode = null;  // id of the node whose children are shown
}

/**
 * Process a node by queuing all its children or setting the appropriate
 * value if it's a terminal one.
 * @param ctx Minimax context.
 */
function *processNode(ctx: { state: MinimaxState }) {
  const nodeId = ctx.state.selectedNode;
  if (!nodeId) {
    throw new Error('expected current node');
  }

  // start processing the node
  ctx.state.nodeStates.set(nodeId, NodeState.StartProcessing);
  ctx.state.description = `Popped node ${nodeId} from the stack`;
  yield;
  
  ctx.state.showNodeChildren = nodeId;  // id of the node whose children are shown
  ctx.state.nodeStates.set(ctx.state.showNodeChildren, NodeState.ProcessChildren);  // id of the node whose children are shown

  const childrenToProcess = sortedSet(ctx.state.adj.get(ctx.state.showNodeChildren)) || [];  // id of the node whose children are shown
  if (childrenToProcess.length > 0) {
    const parentNode = ctx.state.showNodeChildren;  // id of the node whose children are shown

    // push this node to the stack so we can process it after the children are done
    ctx.state.stack.push(ctx.state.showNodeChildren);  // id of the node whose children are shown

    ctx.state.description = `Process node children ${childrenToProcess}`;
    yield;

    for (let childId of childrenToProcess) {
      processChild(ctx.state, childId);
      yield;
    }

    ctx.state.description = 'All children processed';
    ctx.state.nodeStates.set(parentNode, NodeState.CalculateScore);
    ctx.state.selectedNode = parentNode;
  } else {
    const node = ctx.state.nodes.get(ctx.state.showNodeChildren);  // id of the node whose children are shown
    if (!node || node.score === undefined) {
      throw new Error(`Expected terminal node with score for node ${ctx.state.showNodeChildren}`);  // id of the node whose children are shown
    }

    ctx.state.description = `Terminal state where the score is ${node.score}`;
    ctx.state.nodeScores.set(ctx.state.showNodeChildren, node.score);  // id of the node whose children are shown
    ctx.state.nodeStates.set(ctx.state.showNodeChildren, NodeState.Visited);  // id of the node whose children are shown
  }
}

/**
 * Calculate a node score based on its children results. If by the
 * time this function is called any child node is not ready (i.e. its
 * score is not calculated) then it assumes we found a cycle.
 * @param ctx Minimax context.
 */
function *calculateNodeScore(ctx: { state: MinimaxState }) {
  const nodeId = ctx.state.selectedNode;
  if (!nodeId) {
    throw new Error('expected current node');
  }

  ctx.state.description = 'Children ready, time to calculate the score';
  ctx.state.nodeStates.set(nodeId, NodeState.EndProcessing);
  yield;

  // all children should be "Visited" by now. If not, it means we found a cycle
  let childrenReady = true;
  ctx.state.adj.get(nodeId)?.forEach(childId => {
    if (ctx.state.nodeStates.get(childId) != NodeState.Visited) {
      childrenReady = false;
    }
  });

  const isMax = ctx.state.nodes.get(nodeId)?.isMax;

  if (!childrenReady) {
    ctx.state.nodeScores.set(nodeId, 0);
    ctx.state.description = `Cycle detected: setting score to a draw`;
  } else {
    // at this point all children were processed so we can calculate this
    // node's score
    const childScores: number[] = [];
    ctx.state.adj.get(nodeId)?.forEach(childId => {
      childScores.push(ctx.state.nodeScores.get(childId) as number);
    });

    ctx.state.description = `Picking ${isMax ? 'max' : 'min'} score from children`;
    yield;

    const f = isMax ? Math.max : Math.min;
    ctx.state.nodeScores.set(nodeId, f(...childScores));
  }

  yield;
  ctx.state.description = `node ${nodeId} is done`;
  ctx.state.nodeStates.set(nodeId, NodeState.Visited);
}

/**
 * Process a child node according to it's current state.
 * @param state Child node state.
 * @param childId Child node ID.
 */
function processChild(state: MinimaxState, childId: string) {
  state.selectedNode = childId;
  const childState = state.nodeStates.get(childId);

  state.description = `Node ${childId} `;
  switch (childState) {
    case NodeState.Unvisited:
      state.description += `not visited yet so it's pushed into the stack`;
      state.nodeStates.set(childId, NodeState.Queued);
      state.stack.push(childId);
      break;

    case NodeState.Queued:
      state.description += `already in stack but we push it again to solve it before coming back to the parent`;
      state.stack.push(childId);
      break;

    case NodeState.Visited:
      state.description += `already solved, skipping...`;
      break;

    case NodeState.CalculateScore:
      state.description += `waiting for children, we found a cycle...`;
      break;

    case NodeState.EndProcessing:
    case NodeState.StartProcessing:
    case NodeState.ProcessChildren:
      throw new Error("Shouldn't reach this state");
  }
}
