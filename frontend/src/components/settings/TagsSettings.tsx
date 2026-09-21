import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTags } from '@/hooks/useTags';
import type { Tag } from '@/types';

// Tags have no color field on the backend — derive a stable, decorative dot
// color from the tag id so rows are visually distinguishable at a glance.
const DOT_COLORS = ['#d4a843', '#3e7a52', '#4a6fa5', '#9c5a9c', '#c4664a'];
const dotColorFor = (id: number) => DOT_COLORS[id % DOT_COLORS.length];

function TagRow({ tag }: { tag: Tag }) {
  const { renameTag, deleteTag } = useTags();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);

  const cancel = () => {
    setEditing(false);
    setName(tag.name);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) {
      cancel();
      return;
    }
    renameTag.mutate({ id: tag.id, name: trimmed }, { onSuccess: () => setEditing(false) });
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-5 py-3.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          aria-label={`Rename ${tag.name}`}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-[#d4c4b0] px-2 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
        />
        <Button
          size="sm"
          className="min-h-11 md:min-h-0"
          onClick={save}
          disabled={renameTag.isPending || !name.trim()}
        >
          {renameTag.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-11 md:min-h-0"
          onClick={cancel}
          disabled={renameTag.isPending}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="size-[10px] shrink-0 rounded-full"
          style={{ backgroundColor: dotColorFor(tag.id) }}
          aria-hidden
        />
        <p className="truncate text-sm font-semibold text-[#1c0d06]">{tag.name}</p>
        <p className="shrink-0 text-xs text-[#7a5230]">
          {tag.usageCount} {tag.usageCount === 1 ? 'entry' : 'entries'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${tag.name}`}
          className="flex size-11 items-center justify-center rounded-lg border border-[#d4c4b0] bg-white text-[#1c0d06] hover:bg-[#f0e7db] md:size-7"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => deleteTag.mutate(tag.id)}
          disabled={deleteTag.isPending && deleteTag.variables === tag.id}
          aria-label={`Delete ${tag.name}`}
          className="flex size-11 items-center justify-center rounded-lg border border-[#d4c4b0] bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 md:size-7"
        >
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function CreateTagRow() {
  const { createTag } = useTags();
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createTag.mutate(trimmed, { onSuccess: () => setName('') });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-5 py-3.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New tag name"
        aria-label="New tag name"
        className="min-h-11 min-w-0 flex-1 rounded-md border border-[#d4c4b0] px-2 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-0"
      />
      <Button
        type="submit"
        size="sm"
        className="min-h-11 md:min-h-0"
        disabled={createTag.isPending || !name.trim()}
      >
        {createTag.isPending ? 'Adding…' : 'Add tag'}
      </Button>
    </form>
  );
}

export default function TagsSettings() {
  const { tagsQuery } = useTags();
  const tags = tagsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-bold text-[#1c0d06]">Tags</p>
      <p className="text-xs text-[#7a5230]">
        Deleting a tag removes it from entries — entries are never deleted.
      </p>

      <div className="w-full overflow-hidden rounded-xl border border-[#d4c4b0] bg-white">
        {tagsQuery.isPending && (
          <div className="flex flex-col gap-2 p-4" aria-hidden>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-[#f0e7db]" />
            ))}
          </div>
        )}

        {tagsQuery.isError && (
          <p className="px-5 py-4 text-sm text-red-700">Couldn&apos;t load tags.</p>
        )}

        {tagsQuery.isSuccess && tags.length === 0 && (
          <p className="px-5 py-4 text-sm text-[#7a5230]">No tags yet.</p>
        )}

        {tags.map((tag, index) => (
          <div key={tag.id}>
            {index > 0 && <div className="h-px w-full bg-[#f0e7db]" />}
            <TagRow tag={tag} />
          </div>
        ))}

        {tagsQuery.isSuccess && <div className="h-px w-full bg-[#f0e7db]" />}
        <CreateTagRow />
      </div>
    </div>
  );
}
