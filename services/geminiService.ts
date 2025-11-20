import { GoogleGenAI, Modality } from "@google/genai";

const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
}

export const generateBackgroundImage = async (prompt: string): Promise<string | null> => {
  if (!ai) {
    console.error("API Key not found.");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
    }
    return null;

  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const upscaleImage = async (imageBase64: string): Promise<string | null> => {
  if (!ai) {
    console.error("API Key not found.");
    return null;
  }

  try {
    // Strip prefix if present (e.g. "data:image/png;base64,")
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
             inlineData: {
               mimeType: 'image/png',
               data: cleanBase64
             }
          },
          {
            text: "Transform this image into a high-end, ultra-realistic 8K masterpiece. Maximize detail, sharpness, and clarity. Significantly enhance texture details, fix lighting anomalies, and eliminate noise while strictly maintaining the original subject and composition. Output an Ultra HD, 8K production-quality image.",
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part && part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        return `data:image/png;base64,${base64ImageBytes}`;
    }
    return null;

  } catch (error) {
    console.error("Error upscaling image:", error);
    return null;
  }
};