import { TYRES, TYRE_IDS } from "./constants.js";

// Mandatory tyre rule: every car has to use at least two different compounds during the race, otherwise it is
// disqualified. Cars that used intermediate or wet tyres are exempt (a wet race can be run on a single compound).
// `used` is the string of compounds fitted so far, in order (car.allTyres).
export function tyreRuleMet(used) {
    const compounds = new Set(used);
    if (compounds.size >= 2) return true;
    for (const id of compounds) if (TYRES[id]?.kind !== "slick") return true;
    return false;
}

// Compounds that satisfy the rule when fitted at the next stop
export const legalTyres = (used) => TYRE_IDS.filter((id) => tyreRuleMet(used + id));

export const tyreRuleReason = "used only one compound";
