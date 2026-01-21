export default function Header({n}) {
    return <div className="flex justify-between border-b-2 gap-2">
        <div className="flex">
            <div className="flex justify-center items-center font-bold text-base md:text-lg w-8 h-8 md:w-12 md:h-12">🟦</div>
            <div className="flex justify-center items-center font-bold text-base md:text-lg w-8 h-8 md:w-12 md:h-12">🟨</div>
            <div className="flex justify-center items-center font-bold text-base md:text-lg w-8 h-8 md:w-12 md:h-12">🟪</div>
        </div>
        <div className="flex">
            <div className="flex justify-center items-center font-bold text-sm md:text-lg w-8 h-8 md:w-12 md:h-12">A</div>
            <div className="flex justify-center items-center font-bold text-sm md:text-lg w-8 h-8 md:w-12 md:h-12">B</div>
            <div className="flex justify-center items-center font-bold text-sm md:text-lg w-8 h-8 md:w-12 md:h-12">C</div>
            <div className="flex justify-center items-center font-bold text-sm md:text-lg w-8 h-8 md:w-12 md:h-12">D</div>
            {n > 4 && <div className="flex justify-center items-center font-bold text-sm md:text-lg w-8 h-8 md:w-12 md:h-12">E</div>}
            {n > 5 && <div className="flex justify-center items-center font-bold text-sm md:text-lg w-8 h-8 md:w-12 md:h-12">F</div>}
        </div>
    </div>
}