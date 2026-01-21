'use client'

import { Button } from "./ui/button";

export default function CodeHelper({ excluded, setExcluded }) {
    const toggleNumber = (color, number) => {
        setExcluded(prev => {
            const newExcluded = { ...prev };
            const newSet = new Set(prev[color]);

            if (newSet.has(number)) {
                newSet.delete(number);
            } else {
                newSet.add(number);
            }

            newExcluded[color] = newSet;
            return newExcluded;
        });
    };

    const resetTable = () => {
        setExcluded({
            blue: new Set(),
            yellow: new Set(),
            purple: new Set(),
        });
    };

    const colors = ['blue', 'yellow', 'purple'];
    const icons = ['🟦', '🟨', '🟪'];
    const numbers = [1, 2, 3, 4, 5];

    return (
        <div className="w-full flex flex-col gap-2 items-center">
            <div className="border rounded-lg p-4">
                <table className="border-collapse">
                <thead>
                    <tr>
                        {icons.map((icon, index) => (
                            <th key={index} className="p-2 w-12 h-12">
                                <div className="flex justify-center items-center text-lg font-bold">{icon}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {numbers.map((number) => (
                        <tr key={number}>
                            {colors.map((color, index) => (
                                <td key={`${color}-${number}`} className="p-0">
                                    <Button
                                        onClick={() => toggleNumber(color, number)}
                                        variant="outline"
                                        className={`w-12 h-12 font-bold hover:cursor-pointer transition-all ${excluded[color].has(number)
                                            ? 'opacity-25 line-through'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        {number}
                                    </Button>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
            <Button
                onClick={resetTable}
                variant="outline"
                className="px-4 py-2 hover:cursor-pointer w-full"
            >
                Reset
            </Button>
        </div>
    );
}
