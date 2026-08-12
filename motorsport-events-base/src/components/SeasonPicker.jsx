import { ChevronDown } from 'lucide-react';
import { getSeasons } from '../config/sports';

export default function SeasonPicker({ sport, value, onChange }) {
    const seasons = getSeasons(sport);
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="appearance-none bg-slate-800 border border-slate-700 rounded-lg text-white text-sm pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer"
            >
                {seasons.map(year => (
                    <option key={year} value={year}>
                        {year}
                    </option>
                ))}
            </select>
            <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
        </div>
    );
}
