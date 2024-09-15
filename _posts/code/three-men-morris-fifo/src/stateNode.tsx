import { Handle, Position, useNodeId } from "@xyflow/react";
import { NodeState } from "./minimax";
import { Tooltip } from "@mui/material";
import './stateNode.css';

type Data = {
  state: NodeState,
  score: number,
  highlight: boolean,
  isMax: boolean,
};

export default function StateNode({ data }: { data: Data }) {
  const [bgColor, borderColor] = getColor(data.state, data.score);
  const text = (data.score !== null) ? data.score.toString() : '?'
  const style = {
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    border: `3px solid ${borderColor}`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: bgColor,
    opacity: 1,
  };
  const tooltip = getTooltipText(data);
  const id = useNodeId()
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={true}
        style={{ opacity: 0 }}
        />
      <div className={data.highlight ? "stateNodeHighlighted" : "stateNodeNormal"} ref={null}>
        <Tooltip title={`[${data.isMax ? 'max' : 'min'}] Node ${id}: ${tooltip}`} arrow>
          <div style={style}>
            <div>{text}</div>
          </div>
        </Tooltip>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={true}
        style={{ opacity: 0 }}
      />
    </>
  );
}

function getTooltipText(data: Data) {
  switch (data.state) {
    case NodeState.Unvisited:
      return 'Unvisited';
    case NodeState.Queued:
      return 'Queued';
    case NodeState.StartProcessing:
      return 'Start processing';
    case NodeState.ProcessChildren:
      return 'Processing children';
    case NodeState.CalculateScore:
    case NodeState.EndProcessing:
      return 'Waiting for children results';
    case NodeState.Visited:
      if (data.score > 0) {
        return 'Max wins';
      } else if (data.score < 0) {
        return 'Min wins';
      } else {
        return 'Draw';
      }
    default:
      throw new Error(`Unhandled state "${data.state}"`)
  }
}

function getColor(state: NodeState, score: number) {
  switch (state) {
    case NodeState.Unvisited:
      return ["white", "gray"];
    case NodeState.Queued:
      return ["Gainsboro", "gray"];
    case NodeState.StartProcessing:
      return ["Gainsboro", "CornflowerBlue"];
    case NodeState.ProcessChildren:
      return ["white", "CornflowerBlue"];
    case NodeState.CalculateScore:
    case NodeState.EndProcessing:
      return ["CornflowerBlue", "CornflowerBlue"]
    case NodeState.Visited:
      if (score > 0) {
        return ["green", "green"];
      } else if (score < 0) {
        return ["red", "red"];
      } else {
        return ["sandybrown", "sienna"];
      }
    default:
      throw new Error(`Unhandled state "${state}"`)
  }
}
