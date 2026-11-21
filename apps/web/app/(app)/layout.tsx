import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SessionUser } from '@flint/shared';
import { Providers } from '@/components/providers';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('flint_token')?.value;

  if (!token) {
    redirect('/login');
  }

  let user: SessionUser | null = null;
  const directUrl = 'http://localhost:4000/auth/me';

  try {
    const res = await fetch(directUrl, {
      headers: {
        Cookie: `flint_token=${token}`,
      },
      cache: 'no-store',
    });

    if (res.ok) {
      user = await res.json();
    }
  } catch (err) {
    console.error('Error fetching session in layout:', err);
  }

  if (!user) {
    redirect('/login');
  }

  return (
    <Providers>
      <div className="min-h-screen flex bg-slate-50 text-[#0B132B]">
        {/* Left Sidebar */}
        <AppSidebar userRole={user.role} />

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader user={user} />
          <main className="flex-1 p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
