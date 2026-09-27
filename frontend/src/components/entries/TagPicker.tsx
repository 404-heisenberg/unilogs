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
    return <div className="h-9 w-full animate-pulse rounded-md bg-caramel/20" />;
  }

  if (tags.length === 0) {
    return <p className="text-sm text-clay">No tags yet — add some in Settings.</p>;
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
                ? 'border-gold bg-gold text-espresso'
                : 'border-caramel/50 bg-white text-clay hover:bg-cream'
            }`}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
