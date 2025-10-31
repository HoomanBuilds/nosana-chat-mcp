
export const Keywords = {
  table: /\b(tabular|table|tables|tabular|spreadsheet|column|columns|row|rows|matrix|grid|dataset|data\s*table|tabl|tabel|tablular|chart|report|csv|excel|sheet|tbl|tab|col|rowdata|rowset|tabler|tabulr|datagrid|dataframe|tabul)\b/i,
  code: /\b(code|snippet|script|javascript|js|python|py|typescript|ts|java|c\+\+|cpp|c#|function|func|class|method|program|algorithm|algo|routine|procedure|subroutine|macro|source|prog|scripting|scriptlet|mod|modul|module|fn|lambda)\b/i,
  list: /\b(list|bullet|bullets|enumerate|steps|checklist|sequence|procedure|instructions|to-do|todo|tasks|points|itemized|ordered\s*list|unordered\s*list|lst|lstitem|stepwise|step-by-step|bulletpoint|bulletpoints)\b/i,
  chart: /\b(chart|graph|plot|diagram|visualization|bar\s*chart|line\s*chart|pie\s*chart|histogram|scatter|scatter\s*plot|plotting|visual|plotchart|graphical|graphs|charts|diagrammatic|dataviz|datavisualization|bargraph|linegraph|piegraph|hist)\b/i,
  example: /\b(example|sample|illustration|demo|demonstration|scenario|case\s*study|ex|eg|instance|template|pattern|model|exemplar|showcase|specimen|paradigm)\b/i,
  formula: /\b(formula|calculation|equation|expression|compute|derive|compute|calculated|math|maths|expression|expr|calc|solve|solving|function|func|theorem|proof|derivation|algebra|geometry|formulae)\b/i,
};


export const Instructions: Record<string, string> = {
  table: `
- Use | to separate columns; alignment, spacing, or extra formatting do not matter — the parser will handle it.
- Include all relevant columns and rows accurately and concisely.
- Include units or labels if applicable.
- Do NOT include any metadata or system notes in the table itself.
`,
  code: `
- Include only necessary code; avoid unrelated comments.
- Explain tricky sections briefly if needed.
- explain concept with light weight prototype code if possible (to make him understand)
`,
  list: `
- Output as bullet points or numbered steps.
- Keep items concise and actionable.
- Maintain logical sequence and clarity.
`,
  chart: `
- Describe chart or graph clearly in Markdown or text.
- Mention axes, labels, units, and type (bar, line, pie, histogram).
- Include summarized insights if possible.
`,
  example: `
- Provide a clear, step-by-step illustration relevant to the query.
- Keep it concise and informative.
`,
  formula: `
- Provide the exact expression.
- Include explanation of each variable.
- Show intermediate steps if computation is involved.
`,
};

export function getInstructions(query: string): string {
  const result: string[] = [];

  for (const cat of Object.keys(Keywords) as (keyof typeof Keywords)[]) {
    if (Keywords[cat].test(query)) {
      result.push(Instructions[cat].trim());
    }
  }

  const defaultInstruction = `
- Provide a clear, concise, and accurate response.
- Use plain text unless otherwise specified.
- Include examples, explanations, or steps if it helps clarity.
  `;

  return result.length ? result.join("\n") : defaultInstruction.trim();
}
