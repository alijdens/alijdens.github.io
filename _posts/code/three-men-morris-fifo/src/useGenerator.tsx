import { useRef } from "react";
import { useImmer } from "use-immer";

type Coroutine = Generator<undefined, void, unknown>;

export default function useGenerator<T>(init: () => T, gen: (state: { state: T }) => Coroutine): [T, (restart?: boolean) => void] {
    const [state, updateState] = useImmer(init);
    const ref = useRef<{ g: Coroutine, ctx: { state: T } } | null>(null);

    function restartGen() {
        const ctx = { state: init() };
        ref.current = { g: gen(ctx), ctx: ctx };
    }

    if (ref.current === null) {
        restartGen();
    }

    function stepGenerator(restart?: boolean) {
        if (restart) {
            restartGen();
            updateState(init());
        } else {
            updateState(state => {
                if (!ref.current) {
                    throw new Error("missing generator");
                }
                // overwrite the state in the context so the generator function
                // uses the new one
                ref.current.ctx.state = state as T;

                try {
                    ref.current.g.next().value;
                } catch (e) {
                    console.log(e);
                }
            });
        }
    }

    return [state, stepGenerator];
}
