import { SkinAnalysisApp } from '@/components/SkinAnalysisApp';

export const dynamic = 'force-dynamic';

export default function Home() {
  return <SkinAnalysisApp geminiApiKey={process.env.GEMINI_API_KEY} />;
}
