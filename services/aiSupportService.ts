
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Chart } from "../types";

// Initialize Gemini with the platform-provided API key
const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
const model = "gemini-3-flash-preview";

export interface AIDiagnosis {
    diagnosis: string;
    isCodeBug: boolean;
    suggestedFixJson?: string;
    technicalReport?: string;
}

export const analyzeUserChartWithAI = async (chart: Chart, problemDescription: string): Promise<AIDiagnosis> => {
    const ai = genAI.models.generateContent({
        model,
        contents: `
            You are a Senior Technical Support AI for the "Classroom Seating Master" application.
            A user is reporting a bug or issue with their seating chart.
            
            USER DESCRIPTION OF THE PROBLEM:
            "${problemDescription}"
            
            CHART DATA (JSON):
            ${JSON.stringify(chart, null, 2)}
            
            TASK:
            1. Analyze the JSON for any inconsistencies (e.g., students placed twice, missing IDs, invalid coordinates, impossible constraints).
            2. Determine if this is a "Data Bug" (fixable by modifying this specific JSON) or a "Code Bug" (requires a developer to change the app's logic).
            3. If it's a Data Bug, provide the CORRECTED JSON for the 'chart' object.
            4. If it's a Code Bug, provide a "Technical Report" that the admin can give to the developer to fix the app for everyone.
            
            RESPONSE FORMAT (JSON ONLY):
            {
                "diagnosis": "Human-readable explanation of what is wrong (in Hebrew)",
                "isCodeBug": boolean,
                "suggestedFixJson": "The full corrected Chart object as a string (if applicable)",
                "technicalReport": "Detailed report for the developer (if it's a code bug)"
            }
        `,
        config: {
            responseMimeType: "application/json"
        }
    });

    const response: GenerateContentResponse = await ai;
    const result = JSON.parse(response.text || "{}");
    
    return {
        diagnosis: result.diagnosis || "לא ניתן היה לאבחן את הבעיה.",
        isCodeBug: !!result.isCodeBug,
        suggestedFixJson: result.suggestedFixJson,
        technicalReport: result.technicalReport
    };
};
