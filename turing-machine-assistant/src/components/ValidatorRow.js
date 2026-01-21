import ValidatorCell from "./ValidatorCell";

export default function ValidatorRow({ validator, onChange }) {
    return <div className="flex justify-between">
        {validator.a != null && <ValidatorCell validatorValue={validator.a} onChange={() => onChange("a")} />}
        {validator.b != null && <ValidatorCell validatorValue={validator.b} onChange={() => onChange("b")} />}
        {validator.c != null && <ValidatorCell validatorValue={validator.c} onChange={() => onChange("c")} />}
        {validator.d != null && <ValidatorCell validatorValue={validator.d} onChange={() => onChange("d")} />}
        {validator.e != null && <ValidatorCell validatorValue={validator.e} onChange={() => onChange("e")} />}
        {validator.f != null && <ValidatorCell validatorValue={validator.f} onChange={() => onChange("f")} />}
    </div>
}