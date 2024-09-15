import { graph as noCycles } from './noCycles';
import { graph as withCycle } from './withCycle';

export const graphs = {
    noCycles: noCycles,
    withCycle: withCycle,
}

export type GraphType = keyof typeof graphs;
