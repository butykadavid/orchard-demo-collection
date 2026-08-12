export const CURRENT_YEAR = new Date().getFullYear();

export const SPORTS = [
    {
        slug: 'formula1',
        label: 'Formula 1',
        abbr: 'F1',
        coverageFrom: 1950,
        standingsTypes: [
            { value: 'drivers', label: 'Drivers' },
            { value: 'constructors', label: 'Constructors' },
        ],
    },
    {
        slug: 'nascar',
        label: 'NASCAR',
        abbr: 'NASCAR',
        coverageFrom: 1949,
        standingsTypes: [
            { value: 'drivers', label: 'Drivers' },
            { value: 'owners', label: 'Owners' },
            { value: 'manufacturers', label: 'Manufacturers' },
        ],
    },
    {
        slug: 'indycar',
        label: 'IndyCar',
        abbr: 'IndyCar',
        coverageFrom: 1996,
        standingsTypes: [
            { value: 'drivers', label: 'Drivers' },
            { value: 'teams', label: 'Teams' },
        ],
    },
    {
        slug: 'moto-gp',
        label: 'MotoGP',
        abbr: 'MotoGP',
        coverageFrom: 1949,
        standingsTypes: [
            { value: 'drivers', label: 'Riders' },
            { value: 'teams', label: 'Teams' },
            { value: 'constructors', label: 'Constructors' },
        ],
    },
    {
        slug: 'moto2',
        label: 'Moto2',
        abbr: 'Moto2',
        coverageFrom: 1949,
        standingsTypes: [
            { value: 'drivers', label: 'Riders' },
            { value: 'teams', label: 'Teams' },
            { value: 'constructors', label: 'Constructors' },
        ],
    },
    {
        slug: 'moto3',
        label: 'Moto3',
        abbr: 'Moto3',
        coverageFrom: 1949,
        standingsTypes: [
            { value: 'drivers', label: 'Riders' },
            { value: 'teams', label: 'Teams' },
            { value: 'constructors', label: 'Constructors' },
        ],
    },
    {
        slug: 'formula-e',
        label: 'Formula E',
        abbr: 'FE',
        coverageFrom: 2015,
        standingsTypes: [
            { value: 'drivers', label: 'Drivers' },
            { value: 'teams', label: 'Teams' },
        ],
    },
    {
        slug: 'formula2',
        label: 'Formula 2',
        abbr: 'F2',
        coverageFrom: 2017,
        standingsTypes: [
            { value: 'drivers', label: 'Drivers' },
            { value: 'teams', label: 'Teams' },
        ],
    },
    {
        slug: 'formula3',
        label: 'Formula 3',
        abbr: 'F3',
        coverageFrom: 2019,
        standingsTypes: [
            { value: 'drivers', label: 'Drivers' },
            { value: 'teams', label: 'Teams' },
        ],
    },
    {
        slug: 'wec',
        label: 'WEC',
        abbr: 'WEC',
        coverageFrom: 2012,
        standingsTypes: [
            { value: 'drivers', label: 'Drivers' },
        ],
    },
];

export function getSeasons(sport) {
    const from = Math.max(sport.coverageFrom, CURRENT_YEAR - 9);
    return Array.from(
        { length: CURRENT_YEAR - from + 1 },
        (_, i) => CURRENT_YEAR - i
    );
}
