// configura o cliente Gemini da Google Generative AI
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/env.js";

export const gemini = new GoogleGenerativeAI(config.geminiApiKey);