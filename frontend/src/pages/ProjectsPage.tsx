const mockProjects = [
  { id: 1, name: 'COMS3011 Project', description: 'SDP logbook build' },
  { id: 2, name: 'Gym', description: 'Workout tracking' },
  { id: 3, name: 'Reading', description: 'Books and papers' },
];

export default function ProjectsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      <ul className="flex flex-col gap-3">
        {mockProjects.map((project) => (
          <li key={project.id} className="border rounded-lg p-4">
            <p className="font-semibold">{project.name}</p>
            <p className="text-sm text-gray-500">{project.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
