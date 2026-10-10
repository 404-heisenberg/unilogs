import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { Project } from '@/types';

const DISMISS_KEY = 'unilogs:walkthrough-dismissed';

const STEPS = [
  {
    title: 'Your journal, your rules',
    body: 'UniLogs keeps a logbook for each project you care about — thesis research, gym sessions, anything. Projects define the shape, entries ask the questions, and the dashboard shows the answers.',
  },
  {
    title: 'Create a project first',
    body: 'A project defines the fields its entries ask for — Hours spent, Mood, Readings done. That shape is what makes your dashboard and reports possible.',
    cta: { label: 'Create a project', to: '/projects/new' },
  },
  {
    title: 'Then log your first entry',
    body: 'With a project chosen, an entry is a quick form: a title, notes, and the project’s fields. Entries feed the dashboard, calendar, and weekly reports automatically.',
  },
];

// Round 2 user testing: "a guided walkthrough that other apps provide would
// work really well for our app" (Luthando), echoed by the tutor. Shows on
// first app load while the user has no projects, can be skipped, and can be
// re-opened from the project explorer.
export default function FirstRunWalkthrough({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const { data: projects, isPending } = useQuery({
    // Same cache entry the explorer uses, so this does not refetch.
    queryKey: ['projects', { archived: false }],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });

  const dismissed = localStorage.getItem(DISMISS_KEY) === '1';

  useEffect(() => {
    // Wait for the query to resolve so a pending (unknown) state doesn't
    // read as "no projects" and open the tour for users who already have one.
    if (!open && !dismissed && !isPending && (projects?.length ?? 0) === 0) {
      onOpenChange(true);
    }
  }, [open, dismissed, isPending, projects, onOpenChange]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setStep(0);
    onOpenChange(false);
  };

  const launch = (to: string) => {
    localStorage.setItem(DISMISS_KEY, '1');
    setStep(0);
    onOpenChange(false);
    navigate(to);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setStep(0);
          onOpenChange(true);
        } else {
          dismiss();
        }
      }}
    >
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.body}</DialogDescription>
        </DialogHeader>

        <div aria-hidden className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 w-6 rounded-full ${i === step ? 'bg-gold' : 'bg-sand'}`}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={dismiss}>
            Skip
          </Button>
          {current.cta ? (
            <Button onClick={() => launch(current.cta.to)}>{current.cta.label}</Button>
          ) : isLast ? (
            <Button onClick={dismiss}>Got it</Button>
          ) : (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
