export default function Spinner({ message = 'Loading...' }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="w-8 h-8 border-2 border-slate-700 border-t-red-500 rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">{message}</span>
        </div>
    );
}
