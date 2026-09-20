import { useTags } from '@/hooks/useTags';

export default function TagPicker({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (tagIds: number[]) => void;
}) {
  const { tagsQuery } = useTags();
  const tags = tagsQuery.data ?? [];

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id]);
  };

  if (tagsQuery.isPending) {
    return <div className="h-9 w-full animate-pulse rounded-md bg-[#d4a373]/20" />;
  }

  if (tags.length === 0) {
    return <p className="text-sm text-[#7a5230]">No tags yet — add some in Settings.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const active = selected.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            aria-pressed={active}
            className={`min-h-11 rounded-full border px-3 text-sm font-medium transition-colors ${
              active
                ? 'border-[#d4a843] bg-[#d4a843] text-[#1c0d05]'
                : 'border-[#d4a373]/50 bg-white text-[#7a5230] hover:bg-[#f5ebe0]'
            }`}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
