import { Gemini } from "@nosana-chat/ai";
import { z } from "zod";

interface FollowUpQuestion {
    question: string;
}

export const getFollowUpQuestions = async (
    userQuery: string,
    send: (event: string, data: string) => void,
    apiKey?: Record<string, string>
) => {
    const promptMessages = [
        {
            role: "user" as const,
            content: `Based on the user's past query, generate 3–4 smart follow-up questions that expand or clarify the topic.  
                Return only a JSON array of objects, each with a single key "question".  

                Guidelines:
                - Keep each question short, precise, and relevant.  
                - Write as if you are the user, asking an expert for deeper insights.  
                - Do NOT ask meta-questions, confirmations, or repeat the original query.  
                - If no follow-up is meaningful, return an empty array.  

                User query: "${userQuery}"

                Note : ignore follow up if questino if you fine irrelavancy in chats
                     : give short follow ups 6-12 words
            `
        }
    ];

    const followUpSchema: z.ZodType<FollowUpQuestion[]> = z.array(
        z.object({
            question: z.string(),
        })
    );


    const instance = Gemini.GeminiModel("gemini-2.0-flash-lite", apiKey?.gemini);
    try {
        const followUps = await instance.generateObjectGemini<FollowUpQuestion[]>(
            promptMessages,
            followUpSchema as any
        );
        send("followUp", JSON.stringify(followUps));
    } catch {
        send("followUp", JSON.stringify([]));
        console.error("error generating follow up question");
    }

};
