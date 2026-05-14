import { NextResponse } from 'next/server';

export const maxDuration = 120; // Explicitly set lambda max execution time

const SAAS_ORIGIN = 'http://aibigtree.com';

async function readJsonResponse(res: Response) {
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 300) };
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || `请求失败: ${res.status}`);
  }

  return data;
}

export async function POST(req: Request) {
  try {
    const { userId, toolId, imageBase64, mimeType = 'image/png', fileName = 'result.png' } = await req.json();

    if (!userId || !toolId || !imageBase64) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    // Convert base64 to buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const fileSize = imageBuffer.byteLength;

    // 4. 扣费
    const consumeRes = await fetch(`${SAAS_ORIGIN}/api/tool/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, toolId })
    });
    
    // Ignore consume error in dev mock scenario ONLY if it's a proxy 404, but API SPEC says we should enforce strict fail
    const consume = await readJsonResponse(consumeRes);
    if (!consume.success) {
      throw new Error(consume.error || consume.message || '扣费失败');
    }

    // 5. 申请直接上传 Token
    const tokenRes = await fetch(`${SAAS_ORIGIN}/api/upload/direct-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        toolId,
        source: 'result',
        mimeType,
        fileName,
        fileSize
      })
    });
    
    const token = await readJsonResponse(tokenRes);

    if (!token.uploadUrl) {
      throw new Error("SaaS returned no uploadUrl");
    }

    // 6. 直传到 OSS
    const uploadRes = await fetch(token.uploadUrl, {
      method: token.method || 'PUT',
      headers: token.headers,
      body: imageBuffer
    });
    if (!uploadRes.ok) throw new Error(`OSS 上传失败: ${uploadRes.status}`);

    // 7. 提交保存
    const commitRes = await fetch(`${SAAS_ORIGIN}/api/upload/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        toolId,
        source: 'result',
        objectKey: token.objectKey,
        fileSize
      })
    });
    const commit = await readJsonResponse(commitRes);
    if (!commit.success || !commit.savedToRecords) {
      throw new Error(commit.error || '图片入库失败');
    }

    return NextResponse.json({ success: true, image: commit.image });
  } catch (error: any) {
    console.error("Save image error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
