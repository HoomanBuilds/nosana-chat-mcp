export type FollowBackPromptArgs = {
  funcName: string;
  status: "approved" | "cancelled" | "failed";
  result: any;
};

export function getFollowBackPrompt({
  funcName,
  status,
  result,
}: FollowBackPromptArgs): string {
  const msg =
    status === "approved"
      ? `User approved and successfully executed **${funcName}**.`
      : status === "cancelled"
        ? `User cancelled execution of **${funcName}**.`
        : `Tool **${funcName}** failed during execution.`;

  const toolResult =
    result && typeof result === "object"
      ? "```json\n" + JSON.stringify(result, null, 2) + "\n```"
      : result || "(no result)";

  const query = `
                ${msg}
                ${
                  status === "approved"
                    ? `The tool returned the following result:
${toolResult}

                Please write a short, friendly confirmation for the user that summarizes this success.
                Use natural language similar to:
                "Congratulations! The **${funcName}** tool ran successfully. Here’s what was done:"
                Then mention any key details you find in the result (URLs, IDs, times, etc.) in plain English (tabular format or related structured format).
                If the result includes "nosanaChatUrl", you MUST include that URL exactly and label it as the Nosana Chat URL. Mention that it opens chat using the deployed service URL as inference endpoint.`
                    : status === "cancelled"
                      ? `Ask user what happen or if they want to make any update, also show them related tool suggestions. take previous chat reference and see if there is any mistake or something? "`
                      : `Explain that the tool failed and, if possible, suggest what the user could check or try next. length of explanation should be between brief to detailed based on error length.
                based on this result, decide whether you want to handle another tools execution or directly respond to user, like if error is related to insufficient balance then check wallet balance and
                notify the cause or something     
                `
                }`;

  return query;
}
