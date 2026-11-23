import { useState } from "react";

// Form controls shared by the editors on the Customize page

export const inputClass = "w-full rounded-md border bg-zinc-900 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-red-500";

// Text input that edits freely but only commits values `parse` accepts (it returns undefined for invalid text)
export function CommitInput({ value, parse, onCommit, className = "", ...rest }) {
    const [text, setText] = useState(null); // null while the field is not being edited
    const invalid = text !== null && parse(text) === undefined;
    return (
        <input
            {...rest}
            value={text ?? String(value)}
            onFocus={() => setText(String(value))}
            onChange={(e) => {
                setText(e.target.value);
                const parsed = parse(e.target.value);
                if (parsed !== undefined) onCommit(parsed);
            }}
            onBlur={() => setText(null)}
            className={`${inputClass} ${invalid ? "border-red-500" : "border-zinc-700"} ${className}`}
        />
    );
}

export function NumInput({ value, onChange, min, max, integer = false, className = "" }) {
    const parse = (text) => {
        if (text.trim() === "") return undefined;
        // Mobile decimal keypads in many locales only offer a comma
        const n = Number(text.trim().replace(",", "."));
        if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) return undefined;
        return n;
    };
    return <CommitInput value={value} parse={parse} onCommit={onChange} inputMode="decimal" title={`${min} to ${max}`} className={`text-right font-mono ${className}`} />;
}

export function ColorInput({ value, onChange, title }) {
    return (
        <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            title={title}
            className="h-7 w-full cursor-pointer rounded-md border border-zinc-700 bg-zinc-900 p-0.5"
        />
    );
}

export function IconButton({ onClick, disabled, title, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
        >
            {children}
        </button>
    );
}

export function Hint({ children }) {
    return <p className="mb-3 text-xs text-zinc-500">{children}</p>;
}
