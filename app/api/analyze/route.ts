import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType, saasContext, saasPrompt } = await req.json();

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API 密钥未配置, 请在服务端配置环境变量" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Merged prompt according to specification
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
      model: "gemini-3.1-pro-preview",
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
      return NextResponse.json({ result: JSON.parse(response.text) });
    } else {
      return NextResponse.json({ error: "生成的响应不包含有效内容" }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Diagnosis Error:", err);
    return NextResponse.json({ error: err.message || "后端模型调用异常" }, { status: 500 });
  }
}
