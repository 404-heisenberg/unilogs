export interface Term {
  name: string;
  startDate: Date;
  endDate: Date;
}

export const TERMS: Term[] = [
  {
    name: 'Semester 1',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
  },
  {
    name: 'Semester 2',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-12-31'),
  },
];
