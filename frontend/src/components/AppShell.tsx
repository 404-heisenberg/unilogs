import { Outlet, Link } from 'react-router-dom';

export default function AppShell() {
  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r p-4">
        <nav className="flex flex-col gap-2">
          <Link to="/projects">Projects</Link>
          <Link to="/entries">Entries</Link>
          <Link to="/entries/new">New Entry</Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
