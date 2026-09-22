import type { SessionUser } from '@/hooks/useSession';

export default function UserFooter({
  user,
  onSignOut,
}: {
  user: SessionUser | undefined;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[#5c4a3a]/30 pt-3">
      {user && (
        <div className="rounded-md bg-black/5 px-3 py-2">
          <p className="truncate text-sm font-medium text-[#1c0d06]">{user.name}</p>
          <p className="truncate text-xs text-[#7a5230]">{user.email}</p>
        </div>
      )}
      <button
        type="button"
        onClick={onSignOut}
        className="min-h-11 rounded-md px-3 py-2 text-left text-sm text-[#7a5230] transition-colors hover:bg-black/5 hover:text-[#1c0d06] md:min-h-0"
      >
        Sign out
      </button>
    </div>
  );
}
