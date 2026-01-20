import CodeInputCell from "./CodeInputCell";

export default function CodeInputRow({code, onDigitOneChange, onDigitTwoChange, onDigitThreeChange}) {
  return <>
      <CodeInputCell n={code[0]} onChange={onDigitOneChange} />
      <CodeInputCell n={code[1]} onChange={onDigitTwoChange} />
      <CodeInputCell n={code[2]} onChange={onDigitThreeChange} />
  </>
}