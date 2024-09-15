import { GraphNode } from "../Graph";

export const graph: GraphNode[] = [
  {
    id: "1",
    position: { x: 0, y: 0 },
    edges: ["2", "3", "4"],
  },

  {
    id: "2",
    position: { x: 0, y: 100 },
    edges: ["7", "8"],
  },
  {
    id: "3",
    position: { x: -200, y: 100 },
    edges: ["5", "6"],
  },
  {
    id: "4",
    position: { x: 200, y: 100 },
    edges: ["8", "10"],
  },

  {
    id: "5",
    position: { x: -250, y: 200 },
    edges: [],
    score: 0,
  },
  {
    id: "6",
    position: { x: -150, y: 200 },
    edges: ["12"],
  },

  {
    id: "7",
    position: { x: -50, y: 200 },
    edges: ["11"],
  },
  {
    id: "8",
    position: { x: 100, y: 200 },
    edges: [],
    score: -1,
  },

  {
    id: "10",
    position: { x: 250, y: 200 },
    edges: [],
    score: 1,
  },

  {
    id: "11",
    position: { x: -50, y: 300 },
    edges: [],
    score: 0,
  },

  {
    id: "12",
    position: { x: -150, y: 300 },
    edges: [],
    score: 1,
  },
];
