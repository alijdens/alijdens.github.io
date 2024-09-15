import { useState } from "react";
import Graph from "./Graph";
import "./styles.css";

import { graphs, GraphType } from "./graphs";
import { Algorithms, Algorithm } from "./useMinimax";

const algorithm = getValidAlgorithm(process.env.REACT_APP_ALGORITHM) || "regular";
const graph = process.env.REACT_APP_GRAPH || "noCycles";


export default function App() {
  if (!(graph in graphs)) {
    throw new Error(`Invalid graph "${graph}" name in REACT_APP_GRAPH`);
  }

  const [nodes, _] = useState(graphs[graph as GraphType]);
  return (
    <>
      <Graph initial={nodes} algorithm={algorithm} />
    </>
  );
}


// Type guard function
export function isValidAlgorithm(value: unknown): value is Algorithm {
  return typeof value === 'string' && (Algorithms as readonly string[]).includes(value);
}

// Helper function to get a valid algorithm
export function getValidAlgorithm(value: unknown): Algorithm|null {
  if (!value) {
    return null;
  }
  if (!isValidAlgorithm(value)) {
    throw new Error(`Invalid algorithm "${value}". Expected any of ${Algorithms}"`)
  }
  return value;
}
