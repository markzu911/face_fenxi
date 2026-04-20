import { SkinAnalysisApp } from '@/components/SkinAnalysisApp';

export default function Home() {
  return <SkinAnalysisApp geminiApiKey={process.env.GEMINI_API_KEY} />;
}
