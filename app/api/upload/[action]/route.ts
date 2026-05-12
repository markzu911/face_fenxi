import { NextResponse } from 'next/server';

export async function OPTIONS() {
    return new NextResponse(null, { status: 200 });
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
    const { action } = await params;
    
    try {
        const body = await req.json();
        
        const externalRes = await fetch(`http://aibigtree.com/api/upload/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        if (!externalRes.ok) {
            throw new Error(`HTTP error ${externalRes.status}`);
        }
        
        const responseData = await externalRes.json();
        return NextResponse.json(responseData);
    } catch (error) {
        console.warn(`代理请求到 SaaS 后端 /api/upload/${action} 失败:`, error);
        return NextResponse.json({ success: false, error: "代理转发失败" }, { status: 500 });
    }
}
