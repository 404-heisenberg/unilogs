type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

export default function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    // Figma 21:172: a sand pill track with the chosen option in gold.
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-fit gap-0.5 rounded-full border border-line bg-sand p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-9 rounded-full px-3.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold ${
              selected ? 'bg-gold font-bold text-rail' : 'font-medium text-clay hover:bg-cream'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
