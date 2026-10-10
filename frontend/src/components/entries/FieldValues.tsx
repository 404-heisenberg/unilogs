// An entry's field values as a compact "name value" list (#314), shared by
// the entries timeline and the project workspace.

// How many values are listed before "+N more".
const SHOWN = 4;

export default function FieldValues({ pairs }: { pairs: { name: string; text: string }[] }) {
  if (pairs.length === 0) return null;
  const shown = pairs.slice(0, SHOWN);
  const more = pairs.length - shown.length;
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {shown.map(({ name, text }) => (
        <div key={name} className="flex min-w-0 gap-1">
          <dt className="shrink-0 text-clay">{name}</dt>
          <dd className="truncate font-medium text-espresso">{text}</dd>
        </div>
      ))}
      {more > 0 && <dd className="text-clay">+{more} more</dd>}
    </dl>
  );
}
