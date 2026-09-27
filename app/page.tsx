import { HomeView } from '@/components/home/HomeView';
import { getViewer } from '@/lib/auth';

export default async function Home() {
  return <HomeView viewer={await getViewer()} />;
}
