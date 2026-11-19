import { useState } from "react";
import { DRIVERS, TRACKS } from "./data/index.js";
import { createRng } from "./engine/rng.js";
import { createRace } from "./engine/race.js";
import { runQualifying } from "./engine/qualifying.js";
import QualifyingResults from "./components/QualifyingResults.jsx";
import Race from "./components/Race.jsx";
import Setup from "./components/Setup.jsx";

export default function App() {
    const [phase, setPhase] = useState("setup"); // setup | qualifying | race
    const [config, setConfig] = useState(null);
    const [quali, setQuali] = useState(null);
    const [race, setRace] = useState(null);

    const track = config ? TRACKS.find((t) => t.id === config.trackId) : null;

    const handleRunQualifying = (cfg) => {
        const t = TRACKS.find((x) => x.id === cfg.trackId);
        const results = runQualifying({
            drivers: DRIVERS,
            track: t,
            weather: cfg.weather,
            fraction: cfg.fraction,
            playerCode: cfg.playerCode,
            playerTyre: cfg.tyre,
            reversed: cfg.reversed,
            rng: createRng(cfg.seed + 1),
        });
        setConfig(cfg);
        setQuali(results);
        setPhase("qualifying");
    };

    const handleStartRace = () => {
        setRace(
            createRace({
                grid: quali,
                track,
                weather: config.weather,
                fraction: config.fraction,
                playerCode: config.playerCode,
                rng: createRng(config.seed + 2),
            })
        );
        setPhase("race");
    };

    if (phase === "qualifying") {
        return (
            <QualifyingResults
                results={quali}
                track={track}
                reversed={config.reversed}
                playerCode={config.playerCode}
                onBack={() => setPhase("setup")}
                onStartRace={handleStartRace}
            />
        );
    }

    if (phase === "race") {
        return <Race key={config.seed} race={race} onExit={() => setPhase("setup")} />;
    }

    return <Setup initial={config} onRunQualifying={handleRunQualifying} />;
}
