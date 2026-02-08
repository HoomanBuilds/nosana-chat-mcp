import { z } from "zod";
import OpenAI from "openai";

interface FollowUpQuestion {
  question: string;
}

export const getFollowUpQuestions = async (
  userQuery: string,
  send: (event: string, data: string) => void,
  model: string,
) => {
  const prompt = `Based on the user's past query, generate 3–4 smart follow-up questions that expand or clarify the topic.  
                Return only a JSON array of objects, each with a single key "question".  

                Guidelines:
                - Keep each question short, precise, and relevant.  
                - Write as if you are the user, asking an expert for deeper insights.  
                - Do NOT ask meta-questions, confirmations, or repeat the original query.  
                - If no follow-up is meaningful, return an empty array.  

                User query: "${userQuery}"

                Note : ignore follow up if questino if you fine irrelavancy in chats
                     : give short follow ups 6-12 words
            `;

  const client = new OpenAI({
    apiKey: process.env.INFERIA_LLM_API_KEY,
    baseURL: process.env.INFERIA_LLM_URL,
  });

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "[]";
    let followUps = JSON.parse(content);

    // Handle cases where the model returns { "questions": [...] } or just the array
    if (!Array.isArray(followUps) && followUps.questions) {
      followUps = followUps.questions;
    }

    send("followUp", JSON.stringify(followUps));
  } catch (err) {
    send("followUp", JSON.stringify([]));
    console.error("error generating follow up question", err);
  }
};
