import { useEffect, useReducer, useRef } from "react";
import { RED_WARP, SIM_DT } from "../engine/constants.js";
import { stepRace } from "../engine/race.js";

// Drives the fixed-timestep simulation from requestAnimationFrame.
// `speed` is the number of simulated seconds per real second.
export function useRaceLoop(race, { running, speed }) {
    const [, force] = useReducer((x) => x + 1, 0);
    const acc = useRef(0);

    useEffect(() => {
        let raf;
        let last = performance.now();

        const loop = (now) => {
            const dt = Math.min((now - last) / 1000, 0.25);
            last = now;

            if (running && !race.finished) {
                acc.current += dt * speed;
                let steps = 0;
                while (acc.current >= SIM_DT && steps < 400 && !race.finished) {
                    // While the cars wait in the pit lane under a red flag nothing happens: time runs faster
                    const waiting = race.control.mode === "red" && race.control.phase === "waiting";
                    stepRace(race, waiting ? SIM_DT * RED_WARP : SIM_DT);
                    acc.current -= SIM_DT;
                    steps++;
                }
            }

            force();
            if (!race.finished) raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [race, running, speed]);

    return force;
}
