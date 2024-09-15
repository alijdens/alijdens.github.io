import { GraphNode } from "../Graph";

export const graph: GraphNode[] = [
  {
    id: "1",
    position: { x: 0, y: 0 },
    edges: ["90", "4", "14"],
  },

  {
    id: "90",
    position: { x: -50, y: 100 },
    edges: ["7"],
  },
  {
    id: "4",
    position: { x: 200, y: 100 },
    edges: ["9", "10"],
  },

  {
    id: "7",
    position: { x: -50, y: 200 },
    edges: ["11"],
  },

  {
    id: "9",
    position: { x: 150, y: 200 },
    edges: [],
    score: -1,
  },
  {
    id: "10",
    position: { x: 250, y: 200 },
    edges: ["15"],
  },

  {
    id: "11",
    position: { x: -50, y: 300 },
    edges: ["12"],
  },

  {
    id: "12",
    position: { x: 50, y: 300 },
    edges: ["13"],
  },

  {
    id: "13",
    position: { x: 50, y: 200 },
    edges: ["14", "9"],
  },

  {
    id: "14",
    position: { x: 50, y: 100 },
    edges: ["90"],
  },

  {
    id: "15",
    position: { x: 300, y: 300 },
    edges: ["16"],
  },

  {
    id: "16",
    position: { x: 350, y: 200 },
    edges: ["17"],
  },

  {
    id: "17",
    position: { x: 300, y: 100 },
    edges: ["10"],
  },
];
