export default function Header({n}) {
    return <div className="flex border-b-2">
        <div className="flex mr-8">
            <div className="flex justify-center font-bold text-lg w-12 h-12">🟦</div>
            <div className="flex justify-center font-bold text-lg w-12 h-12">🟨</div>
            <div className="flex justify-center font-bold text-lg w-12 h-12">🟪</div>
        </div>
        <div className="flex">
            <div className="flex justify-center font-bold text-lg w-12 h-12">A</div>
            <div className="flex justify-center font-bold text-lg w-12 h-12">B</div>
            <div className="flex justify-center font-bold text-lg w-12 h-12">C</div>
            <div className="flex justify-center font-bold text-lg w-12 h-12">D</div>
            {n > 4 && <div className="flex justify-center font-bold text-lg w-12 h-12">E</div>}
            {n > 5 && <div className="flex justify-center font-bold text-lg w-12 h-12">F</div>}
        </div>
    </div>
}