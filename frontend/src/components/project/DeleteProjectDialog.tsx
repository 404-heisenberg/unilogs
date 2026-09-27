import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useMediaQuery } from '@/lib/dashboard';

const LAST_PROJECT_KEY = 'unilogs:last-project-id';

type FormProps = {
  heading: ReactNode;
  projectId: string;
  projectName: string;
  entryCount: number;
  stacked: boolean;
  onClose: () => void;
};

function DeleteForm({ heading, projectId, projectName, entryCount, stacked, onClose }: FormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');

  const deleteProject = useMutation({
    mutationFn: () => api.delete(`/api/projects/${projectId}`),
    onSuccess: () => {
      try {
        if (localStorage.getItem(LAST_PROJECT_KEY) === projectId) {
          localStorage.removeItem(LAST_PROJECT_KEY);
        }
      } catch {
        // storage unavailable - nothing to clean up
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      onClose();
      navigate('/projects', { replace: true });
    },
  });

  const matches = projectName !== '' && typed === projectName;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (matches && !deleteProject.isPending) deleteProject.mutate();
      }}
      className="flex flex-col gap-3"
    >
      {heading}
      <p className="text-xs leading-relaxed text-[#4a3525]">
        This permanently deletes {projectName}, its {entryCount}{' '}
        {entryCount === 1 ? 'entry' : 'entries'} and all custom fields. Shared report links are
        revoked immediately. This cannot be undone.
      </p>
      <label htmlFor="delete-project-confirm" className="text-xs text-[#9b2c2c]">
        Type “{projectName}” to confirm
      </label>
      <input
        id="delete-project-confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={projectName}
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 rounded-md border border-[#d4a373]/60 bg-white px-3 py-1.5 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06] md:min-h-9"
      />
      {deleteProject.isError && (
        <p role="alert" className="text-xs text-[#9b2c2c]">
          {deleteProject.error.message}
        </p>
      )}
      <div className={stacked ? 'mt-1 flex flex-col gap-2' : 'mt-1 flex justify-end gap-2'}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={stacked ? 'min-h-11 w-full' : 'min-h-11 md:min-h-0'}
          onClick={onClose}
          disabled={deleteProject.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className={`bg-[#9b2c2c] text-white hover:bg-[#7f2323] ${
            stacked ? 'min-h-11 w-full' : 'min-h-11 md:min-h-0'
          }`}
          disabled={!matches || deleteProject.isPending}
        >
          {deleteProject.isPending ? 'Deleting…' : 'Delete project'}
        </Button>
      </div>
    </form>
  );
}

type DeleteProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  entryCount: number;
};

// Desktop: centred dialog. Mobile: bottom sheet (matches the Figma frames).
export default function DeleteProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  entryCount,
}: DeleteProjectDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const close = () => onOpenChange(false);
  const shared = { projectId, projectName, entryCount, onClose: close };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="max-w-sm bg-[#FFFCF7] text-[#1c0d06]"
        >
          <DeleteForm
            {...shared}
            stacked={false}
            heading={<DialogTitle className="text-sm">Delete project</DialogTitle>}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="rounded-t-3xl bg-[#FFFCF7] px-5 pb-8 pt-5 text-[#1c0d06]"
      >
        <div className="mx-auto -mt-2 h-1 w-10 rounded-full bg-[#D9CBB8]" aria-hidden />
        <DeleteForm
          {...shared}
          stacked
          heading={
            <SheetTitle className="text-sm font-semibold text-[#1c0d06]">Delete project</SheetTitle>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
