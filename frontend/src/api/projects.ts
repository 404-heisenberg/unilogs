import { apiFetch } from './client';

export async function getProjects() {
  return apiFetch('/api/projects');
}

export async function createProject(name: string) {
  return apiFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
