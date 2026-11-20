// ---- Simulation tuning (values carried over from the legacy console game where noted) ----

export const SIM_DT = 0.1; // seconds of race time per fixed simulation step
export const GAP_UPDATE_TICKS = 20; // the timing tower refreshes its gaps every this many simulation steps
export const SPEEDS = [1, 2, 4, 8, 16, 32];
export const RACE_FRACTIONS = [0.25, 0.5, 0.75, 1];

export const PIT_LOSS = 22; // legacy: fixed time lost per pit stop (s)
export const PIT_LANE_FACTOR = 0.2; // speed in the pit lane relative to free pace
export const PIT_DURATION = PIT_LOSS / (1 - PIT_LANE_FACTOR); // time spent in the pit phase (s)
export const PIT_ENTRY = 0.96; // lap fraction where cars may turn into the pits

export const START_GAP_S = 0.5; // legacy: +0.5 s per grid slot on lap 1
export const FOLLOW_GAP_S = 1.0; // legacy: overtaking only possible within 1 s
export const MIN_GAP_S = 0.35; // closest a following car gets to the car ahead
export const CLOSE_RATE = 0.5; // how quickly a follower closes to MIN_GAP_S (1/s)
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

export const TYRE_IDS = ["s", "m", "h", "i", "w"];

// pace: constant offset per lap (s); wear: legacy wear factor; wetK: slick penalty per wetness point
export const TYRES = {
    s: { id: "s", name: "Soft", pace: 1, wear: 4.4, wetK: 0.38, kind: "slick", color: "#ef4444" },
    m: { id: "m", name: "Medium", pace: 1.8, wear: 3.2, wetK: 0.37, kind: "slick", color: "#facc15" },
    h: { id: "h", name: "Hard", pace: 2.8, wear: 2, wetK: 0.36, kind: "slick", color: "#e4e4e7" },
    i: { id: "i", name: "Inter", pace: 0, wear: 2.5, wetK: 0, kind: "inter", color: "#22c55e" },
    w: { id: "w", name: "Wet", pace: 0, wear: 2.2, wetK: 0, kind: "wet", color: "#38bdf8" },
};
