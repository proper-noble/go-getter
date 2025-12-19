
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, JobListing, JobAnalysis, ChatMessage } from "../types";

const API_KEY = process.env.API_KEY || "";

export class CareerAgent {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async discoverJobs(profile: UserProfile, location: string = "Remote"): Promise<{ jobs: JobListing[], sources: any[] }> {
    const skillsList = profile.skills.map(s => s.name).join(", ");
    const prompt = `Find 5 recent job openings for a ${profile.title} with skills in ${skillsList} located in ${location}. 
    Provide structured data for each including title, company, location, a short snippet, and the original URL.
    Crucially, assign a predicted 'matchScore' (0-100) based on the user's skills: ${skillsList}.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-latest",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            jobs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  company: { type: Type.STRING },
                  location: { type: Type.STRING },
                  snippet: { type: Type.STRING },
                  url: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER }
                },
                required: ["id", "title", "company", "location", "snippet", "url", "matchScore"]
              }
            }
          },
          required: ["jobs"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"jobs": []}');
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { jobs: data.jobs, sources };
  }

  async analyzeJob(profile: UserProfile, job: JobListing): Promise<JobAnalysis> {
    const prompt = `
      User Profile: ${JSON.stringify(profile)}
      Target Job: ${JSON.stringify(job)}
      
      Perform a deep dive analysis including real-time web research to help with a career decision.
      1. Calculate a match score (0-100).
      2. Identify matching and missing skills.
      3. Provide 3 specific resume bullet points tailored for THIS job that highlight skills mentioned in the job post.
      4. Write a professional cover letter draft.
      5. Research company "${job.company}" culture: 3 values, recent news, 2 pros/cons.
      6. Perform market research for "${job.title}" in "${job.location}":
         - Provide 3 industry trends.
         - 3 main competitors.
         - SPECIFIC Salary Data: Find the low, high, and average annual salary for this exact role and location.
         - Growth outlook and a Stability Rating (High/Medium/Low) based on company news.
      7. Provide 2 likely interview questions with suggested answers.
      8. "Decision Summary": A 2-sentence expert evaluation on whether this is a strong career move based on match, market trends, and company health.
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-latest",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchScore: { type: Type.NUMBER },
            matchingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            resumeTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            coverLetter: { type: Type.STRING },
            companyCulture: {
              type: Type.OBJECT,
              properties: {
                values: { type: Type.ARRAY, items: { type: Type.STRING } },
                recentNews: { type: Type.STRING },
                pros: { type: Type.ARRAY, items: { type: Type.STRING } },
                cons: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["values", "recentNews", "pros", "cons"]
            },
            marketResearch: {
              type: Type.OBJECT,
              properties: {
                industryTrends: { type: Type.ARRAY, items: { type: Type.STRING } },
                competitors: { type: Type.ARRAY, items: { type: Type.STRING } },
                salaryInsights: {
                  type: Type.OBJECT,
                  properties: {
                    low: { type: Type.NUMBER },
                    high: { type: Type.NUMBER },
                    average: { type: Type.NUMBER },
                    currency: { type: Type.STRING },
                    context: { type: Type.STRING }
                  },
                  required: ["low", "high", "average", "currency", "context"]
                },
                growthOutlook: { type: Type.STRING },
                stabilityRating: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
              },
              required: ["industryTrends", "competitors", "salaryInsights", "growthOutlook", "stabilityRating"]
            },
            interviewQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  suggestedAnswer: { type: Type.STRING }
                }
              }
            },
            strategicAdvice: { type: Type.STRING },
            decisionSummary: { type: Type.STRING }
          },
          required: ["matchScore", "matchingSkills", "missingSkills", "resumeTips", "coverLetter", "companyCulture", "marketResearch", "interviewQuestions", "strategicAdvice", "decisionSummary"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  }

  async refineResume(originalTips: string[], job: JobListing, instruction: string): Promise<string[]> {
    const prompt = `
      Original Resume Tips: ${JSON.stringify(originalTips)}
      Target Job: ${job.title} at ${job.company}
      User Refinement Instruction: "${instruction}"
      
      Regenerate 3-4 resume bullet points. Ensure they are hyper-focused on the specific skills requested in the job description while incorporating the user's specific request: "${instruction}".
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            refinedTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["refinedTips"]
        }
      }
    });

    const data = JSON.parse(response.text || '{"refinedTips": []}');
    return data.refinedTips;
  }

  async sendMessage(history: ChatMessage[], message: string, jobContext: JobListing, analysisContext: JobAnalysis): Promise<string> {
    const systemPrompt = `You are the Stagehand Career Pilot Agent. You are helping a user apply for ${jobContext.title} at ${jobContext.company}. 
    Reference the following deep analysis: ${JSON.stringify(analysisContext)}.
    Help the user with:
    - Personalized networking messages.
    - Specific interview question drills.
    - Salary negotiation strategy based on the researched market range.
    - Answering questions about the company's stability and competitors.
    Keep responses highly professional, data-backed, and direct.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-latest',
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: systemPrompt
      }
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  }
}
