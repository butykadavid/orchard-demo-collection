import { Button } from "./ui/button";

export default function CodeInputCell({ n, onChange }) {
    return <>
        <Button
            variant="outline"
            className="w-8 h-8 md:w-12 md:h-12 p-0 text-sm md:text-2xl font-bold hover:cursor-pointer"
            onClick={onChange}
        >
            {n == 0 ? "-" : n}
        </Button>
    </>
}