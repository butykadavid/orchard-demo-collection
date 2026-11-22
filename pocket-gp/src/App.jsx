import { useEffect, useState } from "react";
import { DRIVERS, TRACKS } from "./data/index.js";
import { onCustomizationLoaded } from "./data/customization.js";
import { createRng } from "./engine/rng.js";
import { createRace } from "./engine/race.js";
import { runQualifying } from "./engine/qualifying.js";
import QualifyingResults from "./components/QualifyingResults.jsx";
import Customize from "./components/Customize.jsx";
import Race from "./components/Race.jsx";
import Setup from "./components/Setup.jsx";

const VIEWS = [
    { id: "setup", label: "Race weekend" },
    { id: "customize", label: "Customize" },
];

export default function App() {
    const [phase, setPhase] = useState("setup"); // setup | qualifying | race
    const [view, setView] = useState("setup"); // setup | customize (only switchable between races)
    const [config, setConfig] = useState(null);
    const [quali, setQuali] = useState(null);
    const [race, setRace] = useState(null);
    const [dataVersion, setDataVersion] = useState(0); // bumped when saved customisation arrives from Orchard

    useEffect(() => onCustomizationLoaded(() => setDataVersion((v) => v + 1)), []);

    const track = config ? TRACKS.find((t) => t.id === config.trackId) : null;

    const handleRunQualifying = (cfg) => {
        const t = TRACKS.find((x) => x.id === cfg.trackId);
        const results = runQualifying({
            drivers: DRIVERS,
            track: t,
            weather: cfg.weather,
            fraction: cfg.fraction,
            playerTeam: cfg.playerTeam,
            playerTyres: cfg.tyres,
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
                playerTeam: config.playerTeam,
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
                playerTeam={config.playerTeam}
                onBack={() => setPhase("setup")}
                onStartRace={handleStartRace}
            />
        );
    }

    if (phase === "race") {
        return <Race key={config.seed} race={race} onExit={() => setPhase("setup")} />;
    }

    return (
        <>
            <nav className="mx-auto flex max-w-5xl justify-end px-3 pt-3 md:px-6">
                <div className="flex overflow-hidden rounded-md border border-zinc-700">
                    {VIEWS.map((v) => (
                        <button
                            key={v.id}
                            type="button"
                            onClick={() => setView(v.id)}
                            className={`px-3 py-1.5 text-xs font-medium ${view === v.id ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
            </nav>
            {view === "customize" ? <Customize key={dataVersion} /> : <Setup key={dataVersion} initial={config} onRunQualifying={handleRunQualifying} />}
        </>
    );
}
