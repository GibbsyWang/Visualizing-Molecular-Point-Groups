function tokenizeFormula(formulaText) {
  return String(formulaText ?? "").match(/([A-Z][a-z]?)(\d*)/g) ?? [];
}

export function toMolecularFormulaLatex(formulaText, fallback = "--") {
  const tokens = tokenizeFormula(formulaText);
  if (!tokens.length) {
    return String(formulaText ?? fallback);
  }

  return tokens
    .map((token) => {
      const match = token.match(/^([A-Z][a-z]?)(\d*)$/);
      if (!match) {
        return token;
      }
      const symbol = match[1];
      const count = match[2];
      return count && count !== "1" ? `\\mathrm{${symbol}}_{${count}}` : `\\mathrm{${symbol}}`;
    })
    .join("");
}

export function toDisplayFormulaLatex(pointGroupName, formulaText) {
  const group = String(pointGroupName ?? "");
  const formula = String(formulaText ?? "");
  const formulaLatex = toMolecularFormulaLatex(formula);
  const shouldUseTwisted =
    (group === "C3" || group === "D3") &&
    (formula === "C2H6" || formula === "C2H3F3");

  if (shouldUseTwisted) {
    return `\\text{twisted-}${formulaLatex}`;
  }
  return formulaLatex;
}
