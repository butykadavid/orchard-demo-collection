import { useMemo } from "react";
import { Button } from "./ui/button";

export default function ValidatorCell({ validatorValue, onChange }) {

    const renderCellContent = useMemo(() => {
        switch (validatorValue) {
            case -1:
                return <span></span>;
            case 0:
                return <span>⛔</span>;
            case 1:
                return <span>✅</span>;
            default:
                return <span>?</span>;
        }

    }, [validatorValue]);

    return <>
        <Button variant="outline" className="w-12 h-12 p-0 text-2xl font-bold hover:cursor-pointer" onClick={onChange}>
            {renderCellContent}
        </Button>
    </>
}