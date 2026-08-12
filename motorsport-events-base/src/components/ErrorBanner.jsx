export default function ErrorBanner({ message }) {
    return (
        <div className="bg-red-950/50 border border-red-800/60 rounded-xl p-4 text-red-300 text-sm">
            <span className="font-semibold">Error: </span>
            {message}
        </div>
    );
}
