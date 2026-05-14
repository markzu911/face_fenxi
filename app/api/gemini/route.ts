import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const maxDuration = 120; // Explicitly set lambda max execution time

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, saasContext, saasPrompt, model } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "未配置 Gemini API 密钥。请在服务端配置 GEMINI_API_KEY。" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim().replace(/^["']|["']$/g, '') });

    let promptObj = `You are an expert dermatologist and computer vision AI. Analyze this bare-face selfie across 8 key dimensions:
1. pores (毛孔及细腻度)
2. blackheads (黑头分布)
3. wrinkles (皱纹及细纹)
4. spots/pigmentation (色斑及色素沉着)
5. acne/breakouts (痤疮及痘痘)
6. sensitivity/redness (敏感及红血丝)
7. eyeArea (黑眼圈及眼袋)
8. hydration/oil balance (水油平衡及光泽度)

Provide realistic, quantifiable assessments. For each dimension, provide a score out of 100, the severity, clinical details, and an actionable sales pitch proposing a targeted skincare product/ingredient, framed positively but urgently. Respond entirely in Simplified Chinese.`;

    if (saasContext || (saasPrompt && saasPrompt.length > 0)) {
        promptObj += `\n\n【附加上下文约束】`;
        if (saasContext) promptObj += `\n内容主体/要求: ${saasContext}`;
        if (saasPrompt && saasPrompt.length > 0) promptObj += `\n特定关键词/标签: ${saasPrompt.join(', ')}`;
    }

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        skinAge: { type: Type.INTEGER, description: "Estimated visible skin age based on analysis" },
        overallScore: { type: Type.INTEGER, description: "Overall skin health score out of 100" },
        skinType: { type: Type.STRING, description: "Identified skin type classification (e.g. Combination, Dry, Oily)" },
        dimensions: {
          type: Type.OBJECT,
          properties: {
            pores: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER, description: "Score out of 100" },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            },
            blackheads: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            },
            wrinkles: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            },
            spots: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            },
            acne: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            },
            sensitivity: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            },
            eyeArea: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            },
            hydration: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                severity: { type: Type.STRING },
                details: { type: Type.STRING },
                salesPitch: { type: Type.STRING }
              }
            }
          }
        },
        recommendations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              product: { type: Type.STRING },
              reason: { type: Type.STRING }
            }
          }
        }
      }
    };

    const response = await ai.models.generateContent({
      model: model || "gemini-2.5-flash",
      contents: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: promptObj }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    if (response.text) {
      const parsedResult = JSON.parse(response.text);
      return NextResponse.json({ result: parsedResult });
    } else {
      throw new Error('生成的分析报告为空。');
    }
  } catch (error: any) {
    console.error("Gemini API backend error:", error);
    return NextResponse.json(
      { error: error.message || "请求服务器时发生未知异常" },
      { status: 500 }
    );
  }
}
