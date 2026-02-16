export type FollowBackPromptArgs = {
  funcName: string;
  status: "approved" | "cancelled" | "failed";
  result: any;
  jobDef?: any;
};

export function getFollowBackPrompt({
  funcName,
  status,
  result,
  jobDef,
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

  const jobDefContext = jobDef
    ? `\n\nJob Definition:\n\`\`\`json\n${JSON.stringify(jobDef, null, 2)}\n\`\`\``
    : "";

  const query = `
                ${msg}
                ${
                  status === "approved"
                    ? `The tool returned the following result:
${toolResult}${jobDefContext}

                Please write a short, friendly confirmation for the user that summarizes this success.
                Use natural language similar to:
                "Congratulations! The **${funcName}** tool ran successfully. Here's what was done:"
                Then mention any key details you find in the result (URLs, IDs, times, etc.) in plain English (tabular format or related structured format).
                
                IMPORTANT: For job creation (createJob), extract the model name from the job definition:
                1. Look at the jobDef.resources[].url for model URLs (e.g., huggingface paths)
                2. Look at environment variables like MODEL, SERVED_MODEL_NAME
                3. Look at command line arguments
                4. Extract the model in format: organization/model-name (e.g., "deepseek-ai/Janus-Pro-1B")
                
                Include the model name in your response with a label "Model Deployed".
                Also mention that a "Nosana Chat URL" will be available to chat with the deployed model.`
                    : status === "cancelled"
                      ? `Ask user what happen or if they want to make any update, also show them related tool suggestions. take previous chat reference and see if there is any mistake or something? "`
                      : `Explain that the tool failed and, if possible, suggest what the user could check or try next. length of explanation should be between brief to detailed based on error length.
                based on this result, decide whether you want to handle another tools execution or directly respond to user, like if error is related to insufficient balance then check wallet balance and
                notify the cause or something     
                `
                }`;

  return query;
}
