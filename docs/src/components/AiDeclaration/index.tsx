import type { ReactNode } from 'react';

type Action = 'reviewed' | 'planned' | 'edited' | 'generated';

type Props = {
  /** One of the four verbs named in the COMS3011A AI policy. */
  action?: Action;
  /** Tools and models, e.g. "Claude-Web[Claude Opus 5], Claude-Code[Claude Sonnet 5]" */
  tools: string;
  /** What the assistance was used for. */
  purpose: string;
};

export default function AiDeclaration({ action = 'generated', tools, purpose }: Props): ReactNode {
  return (
    <div className="ai-declaration">
      <strong>AI declaration</strong>
      The preceding page was {action} with the assistance of the following: {tools}. Purpose:{' '}
      {purpose}.
    </div>
  );
}
