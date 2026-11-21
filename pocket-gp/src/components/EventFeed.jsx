const KIND_STYLE = {
    overtake: "text-zinc-300",
    pit: "text-amber-400",
    fastest: "text-fuchsia-400",
    finish: "text-emerald-400",
    dnf: "text-red-400",
    puncture: "text-orange-400",
    incident: "text-orange-300",
};

export default function EventFeed({ events }) {
    const recent = events.slice(-8).reverse();
    return (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Race feed</h3>
            {recent.length === 0 ? (
                <p className="text-xs text-zinc-600">Nothing yet.</p>
            ) : (
                <ul className="space-y-0.5 text-xs">
                    {recent.map((e) => (
                        <li key={e.id} className={`flex gap-2 ${KIND_STYLE[e.kind] ?? "text-zinc-300"}`}>
                            <span className="w-8 shrink-0 font-mono text-zinc-600">L{e.lap}</span>
                            <span className="truncate">{e.text}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
