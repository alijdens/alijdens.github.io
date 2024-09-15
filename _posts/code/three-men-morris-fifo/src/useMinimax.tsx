import { minimaxCoroutine, minimaxInitialState } from "./minimax";
import { minimaxCycleCoroutine } from "./minimaxCycle";
import useGenerator from "./useGenerator";
import { GraphNode } from "./utils";

export const Algorithms = ['regular', 'cycleDetection'] as const;
export type Algorithm = typeof Algorithms[number];


/**
 * Hook that returns the minimax state and a function to step it.
 * @param adjList List of adjacency of the minimax graph.
 * @returns state and step function.
 */
export default function useMinimax(algorithm: Algorithm, nodes: GraphNode[]) {
    const generator = getGenerator(algorithm);
    return useGenerator(() => minimaxInitialState(nodes), generator);
}

function getGenerator(algorithm: Algorithm) {
    switch (algorithm) {
        case 'regular':
            return minimaxCoroutine;
        case 'cycleDetection':
            return minimaxCycleCoroutine;
    }
}
