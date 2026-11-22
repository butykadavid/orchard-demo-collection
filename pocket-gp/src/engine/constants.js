// ---- Simulation tuning (values carried over from the legacy console game where noted) ----

export const SIM_DT = 0.1; // seconds of race time per fixed simulation step
export const GAP_UPDATE_TICKS = 20; // the timing tower refreshes its gaps every this many simulation steps
export const SPEEDS = [1, 2, 4, 8, 16, 32];
export const RACE_FRACTIONS = [0.25, 0.5, 0.75, 1];

// ---- Pit stops ----
// A stop is driving through the pit lane (time set by the track's pit lane length and the speed limit) plus standing
// still for the service. Cars of one team are serviced one at a time.
export const PIT_ENTRY = 0.96; // lap fraction where cars may turn into the pits
export const PIT_EXIT = 1.04; // lap fraction where the pit lane rejoins the track
export const PIT_LANE_SPAN = PIT_EXIT - PIT_ENTRY; // laps of track the pit lane replaces
export const PIT_SPEED = 16.7; // m/s: pit lane speed limit (60 km/h)
export const PIT_STOP_MODE = 2.75; // s: typical service time
export const PIT_STOP_SD = 0.25; // s: spread of normal services (most land between 2.5 and 3.0 s)
export const PIT_STOP_MIN = 1.8; // s: fastest possible service
export const PIT_STOP_MAX = 10; // s: slowest possible service
export const PIT_SLOW_CHANCE = 0.08; // chance of a problem (stuck wheel nut, ...) that makes the service slower
export const PIT_SLOW_FROM = 3; // s: a troubled service takes at least this long...
export const PIT_SLOW_MEAN = 1.6; // s: ...plus an exponentially distributed delay with this mean
export const PIT_STOP_EXPECTED = 2.9; // s: average service time (what the AI expects)
export const PIT_TEAM_BUFFER = 0.5; // s: gap after one car's service before the team can start on the next
export const DEFAULT_PIT_LANE = 450; // m: pit lane length for tracks without one

export const START_GAP_S = 0.5; // legacy: +0.5 s per grid slot on lap 1
export const FOLLOW_GAP_S = 1.0; // legacy: overtaking only possible within 1 s
export const MIN_GAP_S = 0.35; // closest a following car gets to the car ahead
export const CLOSE_RATE = 0.5; // how quickly a follower closes to MIN_GAP_S (1/s)
export const PASS_CLOSING_SPEED = 0.04; // a car making a pass runs at least this much faster than the car it is passing (slipstream / better exit)
export const PASS_TIMEOUT_S = 40; // a pass that has not completed after this long is abandoned
export const PASS_CORNER_LOSS = 0.05; // both cars lose this share of their speed while side by side outside the overtaking zones (corners: neither has the ideal line), so a longer pass costs more time
export const OVERTAKE_ZONES = [0.3, 0.8]; // lap fractions where passing is easiest (long straights / heavy braking)
export const OVERTAKE_ZONE_WIDTH = 0.08; // length of each zone in laps
export const OVERTAKE_ZONE_SHARE = 0.7; // share of all passing opportunity that lies inside the zones
export const OVTK_EASY_LEVEL = 3; // overtaking difficulty up to which passing keeps its base rate
export const OVTK_HARDNESS_EXP = 0.4; // pass rate falls by exp(-this) per difficulty point above OVTK_EASY_LEVEL
export const ATTEMPTS_PER_LAP = 2; // how often a close follower commits to a move per lap (drives collision risk)

export const SECTORS = 50; // timing resolution per lap, used for accurate gaps

// ---- Tyre cliff, reliability and incidents (new in the web version) ----
export const CLIFF_STATE = 20; // below this tyre % performance drops off faster
export const CLIFF_SECONDS_PER_PCT = 0.15; // extra s/lap per % below the cliff
export const PUNCTURE_PER_LAP = 0.15; // puncture chance per lap at 0% tyre (scales linearly from CLIFF_STATE)
export const PUNCTURE_MAX_PER_LAP = 0.5;
export const PUNCTURE_SPEED = 0.65; // speed factor with a punctured tyre until the car reaches the pits
export const PUNCTURE_COST = 45; // approx. seconds lost to a puncture (slow lap + unplanned stop), used by the AI

export const MECH_FAIL_PER_RACE = 0.02; // chance that a car suffers a mechanical failure during a race
export const ERROR_PER_RACE = 0.04; // base chance of a driver error per race (scaled by skill and wetness); a quarter end in retirement
export const RECOVER_SPEED = 0.2; // speed factor while recovering from a spin, off or contact
export const DAMAGE_MAX = 6; // s per lap: the most lap time damage can cost
export const REPAIR_PER_DAMAGE = 4; // s of repair time in the pits per s/lap of damage
export const CRASH_RANGE_S = 0.6; // cars closer than this can collide
export const CRASH_PER_ATTEMPT = 0.0004; // collision chance per overtaking attempt (scaled by wetness)
export const START_CRASH_CHANCE = 0.004; // collision chance per close pair at the first corner (scaled by wetness)
export const CRASH_CHAIN = 0.3; // chance that the car behind is also caught up in a collision
export const START_CORNER = 0.06; // lap fraction of the first corner

// Lap 1 is chaotic: more overtaking attempts that succeed more often, and more incidents
export const LAP1_OVERTAKE_MULT = 4; // multiplier on the pass rate
export const LAP1_OVERTAKE_MIN_RATE = 0.9; // minimum pass rate per lap (hazard), even without a pace advantage
export const LAP1_INCIDENT_MULT = 5; // multiplier on collision and driver-error chances

// ---- Race control: safety car, virtual safety car, red flag ----
export const SC_SPEED = 0.55; // share of its free speed a car runs at behind the safety car
export const SC_CATCHUP = 0.9; // cars that are not bunched up yet may run this share of their free speed to close the gap
export const SC_GAP_S = 0.8; // s: gap the field closes up to behind the car in front under the safety car
export const SC_LAPS = [3, 5]; // laps (min, max) the field runs behind the safety car before it comes in
export const VSC_SPEED = 0.7; // share of its free speed every car runs at under the virtual safety car
export const VSC_LAPS = [0.8, 1.8]; // length of a virtual safety car period in laps at the nominal lap time (min, max)
export const NEUTRAL_WEAR = 0.35; // tyre wear per distance covered while the race is neutralised or stopped (relative to racing)
export const NEUTRAL_COOLDOWN_LAPS = 2; // laps after a neutralisation ends before the next one can be called
export const RED_WAIT_S = [360, 720]; // s: how long a stopped race waits before the restart (min, max)
export const RED_WARP = 6; // a stopped race runs this much faster than the selected speed while the cars wait in the pit lane
export const RED_MIN_REMAINING_LAPS = 3; // no red flag when fewer laps than this are left (a safety car is called instead)
export const RED_RAIN_WET = 85; // % track wetness from which the race can be stopped for rain
export const RED_RAIN_RATE = 0.03; // chance per lap that the race is stopped once it is that wet (once per race)
export const RED_RAIN_RESUME_WET = 65; // % track wetness the race has to drop below before a rain stoppage ends
export const RED_RAIN_MAX_WAIT_S = 1500; // s: a rain stoppage ends after this long whatever the weather

// ---- AI strategy ----
export const AI_PLAN_TEMPERATURE = 4; // s: plans within a few seconds of the best are considered equally sensible
export const AI_GRID_VALUE = 4; // race seconds a bot values per second of qualifying advantage (about 2.5 grid slots)
export const AI_MIN_STINT_FRACTION = 0.1; // shortest planned stint as a fraction of the race
export const AI_MAX_STINTS = 4; // planned stints per race (at most 3 stops)
export const AI_SAFETY_STATE = 10; // % - a bot stops early rather than risk dropping below this
export const AI_REPLAN_MARGIN = 5; // s: a bot abandons its plan when following it costs this much more than the best option now
export const AI_COMPETITIVE_MARGIN = 3; // s/lap: a compound is a plan candidate if it is within this of the fastest at some point
export const AI_TRAFFIC_BASE = 2; // s: extra cost of a stop for rejoining behind slower cars
export const AI_TRAFFIC_PER_OVTK = 0.8; // s per point of the track's overtaking difficulty (hard to pass = costlier stops)
export const AI_TRAFFIC_WINDOW_S = 8; // s: cars up to this far ahead of the spot where a stop would drop a bot back on track count as traffic
export const AI_TRAFFIC_MAX = 20; // s: most a bot expects to lose in traffic after one stop
export const AI_CLEAN_AIR_BONUS = 2; // s: most a clean-air rejoin is worth below the average stop cost
export const AI_TRAFFIC_FLEX = 6; // laps: how far a bot may pull a planned stop forward or push it back to dodge traffic or undercut
export const AI_TRAFFIC_MARGIN = 1.5; // s: a tactical change of stop timing must save at least this much
export const AI_POSITION_VALUE = 4; // s: what holding a position is worth when judging an undercut or a cover stop
export const AI_UNDERCUT_RANGE_S = 2.5; // s: undercuts only work on (and are only feared from) cars this close
export const AI_UNDERCUT_HORIZON = 8; // laps: how far ahead a bot reckons the rival's stop
export const AI_OUTLAP_LOSS = 1; // s: slow out-lap on fresh tyres
export const AI_AGGRESSION = [0.7, 1.3]; // per-bot range: scales how readily it takes tactical risks

export const TYRE_IDS = ["s", "m", "h", "i", "w"];

// pace: constant offset per lap (s); wear: legacy wear factor; wetK: slick penalty per wetness point
export const TYRES = {
    s: { id: "s", name: "Soft", pace: 1, wear: 4.4, wetK: 0.38, kind: "slick", color: "#ef4444" },
    m: { id: "m", name: "Medium", pace: 1.8, wear: 3.2, wetK: 0.37, kind: "slick", color: "#facc15" },
    h: { id: "h", name: "Hard", pace: 2.8, wear: 2, wetK: 0.36, kind: "slick", color: "#e4e4e7" },
    i: { id: "i", name: "Inter", pace: 0, wear: 2.5, wetK: 0, kind: "inter", color: "#22c55e" },
    w: { id: "w", name: "Wet", pace: 0, wear: 2.2, wetK: 0, kind: "wet", color: "#38bdf8" },
};
