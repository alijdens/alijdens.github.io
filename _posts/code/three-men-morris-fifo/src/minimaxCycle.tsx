import { MinimaxState, MinimaxStatus, NodeState } from "./minimax";
import { AdjList, findStartingNodes, invertGraph, sortedSet } from "./utils";


/**
 * A coroutine that executes each step of the minimax algorithm.
 * @param ctx Object containing the minimax state to update.
 */
export function *minimaxCycleCoroutine(ctx: { state: MinimaxState }) {
  ctx.state.description = `Find all terminal nodes and set their scores`;
  yield;

  ctx.state.status = MinimaxStatus.InProgress;
  const invertedAdj = invertGraph(ctx.state.adj);

  ctx.state.stack = findStartingNodes(invertedAdj);
  for (var nodeId of ctx.state.stack) {
    ctx.state.nodeStates.set(nodeId, NodeState.Queued);
    const score = ctx.state.nodes.get(nodeId)?.score;
    if (score === undefined) {
      throw new Error(`Expected score for node ${nodeId}`);
    }
    ctx.state.description = `Terminal node ${nodeId} with value: ${score}`;
    ctx.state.nodeScores.set(nodeId, score);
    ctx.state.selectedNode = nodeId;
    ctx.state.nodeStates.set(nodeId, NodeState.Visited);
    yield;

    ctx.state.showNodeParent = nodeId;
    ctx.state.description = `Push parent nodes into the queue`;
    for (let parentId of (invertedAdj.get(nodeId) || [])) {
      ctx.state.selectedNode = parentId;
      ctx.state.description = `Queuing node ${parentId}`;
      ctx.state.nodeStates.set(parentId, NodeState.Queued);
      ctx.state.stack.push(parentId);
      yield;
    }
    ctx.state.showNodeParent = null;
  }
  ctx.state.description = `Ready to start navigating the graph backwards`;
  ctx.state.selectedNode = null;
  yield;

  while (ctx.state.stack.length > 0) {
    const nodeId = ctx.state.stack.shift();
    if (!nodeId) {
      throw new Error('Unreachable');
    }
    if (ctx.state.nodeStates.get(nodeId) == NodeState.Visited) {
      continue;
    }

    const isMax = ctx.state.nodes.get(nodeId)?.isMax;
    ctx.state.nodeStates.set(nodeId, NodeState.CalculateScore);
    ctx.state.selectedNode = nodeId;
    ctx.state.showNodeChildren = nodeId;
    ctx.state.description = `Check children to see if ${isMax ? 'max' : 'min'} can win`;
    yield;

    yield * processChildren(nodeId, invertedAdj, ctx);
  }
  
  ctx.state.showNodeChildren = null;
  ctx.state.selectedNode = null;
  ctx.state.description = `The rest of the nodes can't force a win/lose state, so we can mark them as a draw`;
  yield;

  for (var [nodeId, state] of ctx.state.nodeStates) {
    if (state != NodeState.Visited) {
      ctx.state.nodeStates.set(nodeId, NodeState.Visited);
      ctx.state.nodeScores.set(nodeId, 0);
    }
  }

  ctx.state.status = MinimaxStatus.Finished;
  ctx.state.description = `Finished`;
  ctx.state.selectedNode = null;
}


function *processChildren(parentId: string, invertedAdj: AdjList, ctx: { state: MinimaxState }) {
  const children = sortedSet(ctx.state.adj.get(parentId));
  if (!children) {
    throw new Error(`Node ${parentId} should have children`);
  }

  const isMax = ctx.state.nodes.get(parentId)?.isMax;

  let readyChildrenCount = 0;
  let resolved = false;
  for (let childId of children) {
    ctx.state.selectedNode = childId;
    const childScore = ctx.state.nodeScores.get(childId);
    if (childScore === undefined || childScore === null) {
      ctx.state.description = `Node ${childId} is not ready, skip for now`
    } else if (isMax && childScore > 0 || !isMax && childScore < 0) {
      resolved = true;
      ctx.state.description = `Can force a win, so we propagate the score`;
      yield;

      ctx.state.selectedNode = parentId;
      ctx.state.nodeScores.set(parentId, childScore);
      ctx.state.nodeStates.set(parentId, NodeState.Visited);
      yield;

      yield * queueParents(parentId, invertedAdj, ctx);
      yield;
      break;
    } else {
      readyChildrenCount += 1;
      ctx.state.description = `Can't force a win, continue looking...`;
    }
    yield;
  }

  if (!resolved && readyChildrenCount == children.length) {
    ctx.state.selectedNode = parentId;
    ctx.state.description = `All child nodes can force a result, so this means that this node does not really have a choice`;
    const f = isMax ? Math.max : Math.min;
    const childScores: number[] = [];
    for(let childId of children) {
      const score = ctx.state.nodeScores.get(childId);
      if (score == null) {
        throw new Error(`${childId} should have a score at this point`);
      }
      childScores.push(score);
    }
    ctx.state.nodeScores.set(parentId, f(...childScores));
    ctx.state.nodeStates.set(parentId, NodeState.Visited);
    yield;

    ctx.state.showNodeChildren = null;
    yield * queueParents(parentId, invertedAdj, ctx);
  }
}


function *queueParents(nodeId: string, invertedAdj: AdjList, ctx: { state: MinimaxState }) {
  const parentIds = invertedAdj.get(nodeId);
  if (parentIds && parentIds.size > 0) {
    ctx.state.selectedNode = nodeId;
    ctx.state.showNodeParent = nodeId;
    ctx.state.description = `Push parent nodes into the queue`;
    yield;

    for (let parentId of parentIds) {
      ctx.state.selectedNode = parentId;

      switch (ctx.state.nodeStates.get(parentId)) {
        case NodeState.Unvisited:
        case NodeState.ProcessChildren:
        case NodeState.EndProcessing:
        case NodeState.CalculateScore:
          ctx.state.description = `Node ${parentId} into the queue`;
          ctx.state.nodeStates.set(parentId, NodeState.Queued);
          ctx.state.stack.push(parentId);
          break;
        case NodeState.Queued:
        case NodeState.Visited:
          ctx.state.description = `Node ${parentId} already solved, do nothing`;
          break;
      }
      yield;
    }
    ctx.state.showNodeParent = null;
  } else {
    ctx.state.selectedNode = nodeId;
    ctx.state.showNodeParent = null;
    ctx.state.description = `No parent nodes to push into the queue`;
    yield;
  }
}
