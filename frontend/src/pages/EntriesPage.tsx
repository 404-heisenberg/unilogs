const mockEntries = [
  { id: 1, date: '2026-08-18', timeSpent: '2h', description: 'Set up app shell and routing' },
  {
    id: 2,
    date: '2026-08-17',
    timeSpent: '1h 30m',
    description: 'Reviewed wireframes for auth pages',
  },
  { id: 3, date: '2026-08-16', timeSpent: '3h', description: 'Studied Computer Graphics' },
];

export default function EntriesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Entries</h1>
      <ul className="flex flex-col gap-3">
        {mockEntries.map((entry) => (
          <li key={entry.id} className="border rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{entry.date}</span>
              <span>{entry.timeSpent}</span>
            </div>
            <p className="mt-1">{entry.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
