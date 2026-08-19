import type { ReactNode } from 'react';

type Props = {
  tools: string;
  purpose: string;
};

export default function AiDeclaration({ tools, purpose }: Props): ReactNode {
  return (
    <div className="ai-declaration">
      <strong>AI declaration</strong>
      This page was produced with the assistance of {tools}. Purpose: {purpose}.
    </div>
  );
}
