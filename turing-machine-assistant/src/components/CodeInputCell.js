import { Button } from "./ui/button";

export default function CodeInputCell({ n, onChange }) {
    return <>
        <Button
            variant="outline"
            className="w-12 h-12 p-0 text-2xl font-bold hover:cursor-pointer"
            onClick={onChange}
        >
            {n == 0 ? "-" : n}
        </Button>
    </>
}