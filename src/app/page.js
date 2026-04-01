import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';
import InstallPrompt from '@/components/InstallPrompt';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Dashboard />
      </main>
      <InstallPrompt />
    </>
  );
}
