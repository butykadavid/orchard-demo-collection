export default function EmptyState({ title, message }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-5xl">🏁</span>
            <h3 className="text-slate-200 font-semibold mt-2">{title}</h3>
            {message && (
                <p className="text-slate-400 text-sm max-w-xs">{message}</p>
            )}
        </div>
    );
}
