import { useState } from 'react';
import { SPORTS, CURRENT_YEAR } from './config/sports';
import SportPicker from './components/SportPicker';
import UpcomingTab from './components/UpcomingTab';
import HistoryTab from './components/HistoryTab';
import ChampionshipTab from './components/ChampionshipTab';
import { CalendarDays, History, Trophy } from 'lucide-react';

const TABS = [
    { id: 'upcoming', label: 'Upcoming', Icon: CalendarDays },
    { id: 'history', label: 'History', Icon: History },
    { id: 'championship', label: 'Championship', Icon: Trophy },
];

export default function App() {
    const [sport, setSport] = useState(SPORTS[0]);
    const [tab, setTab] = useState('upcoming');

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-red-500 rounded-full" />
                    <span className="font-black text-lg tracking-tight text-white">
                        MOTORSPORT <span className="text-red-500">HUB</span>
                    </span>
                </div>
                <SportPicker sports={SPORTS} selected={sport} onChange={setSport} />
            </header>

            {/* Tab navigation */}
            <nav className="bg-slate-900 border-b border-slate-800 flex sticky top-[57px] z-30">
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 text-xs sm:text-sm font-medium transition-colors ${tab === id
                                ? 'text-white border-b-2 border-red-500'
                                : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
                            }`}
                    >
                        <Icon size={15} />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>

            {/* Main content */}
            <main className="flex-1 w-full mx-auto px-4 py-6 max-w-3xl">
                {tab === 'upcoming' && <UpcomingTab sport={sport} />}
                {tab === 'history' && <HistoryTab sport={sport} />}
                {tab === 'championship' && <ChampionshipTab sport={sport} />}
            </main>
        </div>
    );
}
