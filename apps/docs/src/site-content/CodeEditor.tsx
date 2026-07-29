import { useRef, type UIEvent } from 'react';
import { highlightCode } from '@dataflow-animator/react';

/**
 * Éditeur de code colorisé : un `<pre>` colorisé (Prism) positionné derrière un
 * `<textarea>` transparent (seul le caret est visible). Les deux partagent des
 * métriques identiques et leur défilement est synchronisé.
 */
interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = 'json',
}: CodeEditorProps) {
  const preRef = useRef<HTMLPreElement>(null);

  const onScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const pre = preRef.current;
    if (!pre) return;
    pre.scrollTop = e.currentTarget.scrollTop;
    pre.scrollLeft = e.currentTarget.scrollLeft;
  };

  return (
    <div className="pg-code">
      <pre
        ref={preRef}
        className="pg-code-layer pg-code-pre rdfa-code"
        aria-hidden="true"
      >
        <code
          dangerouslySetInnerHTML={{
            __html: highlightCode(value, language) + '\n',
          }}
        />
      </pre>
      <textarea
        className="pg-code-layer pg-code-ta"
        value={value}
        spellCheck={false}
        wrap="off"
        onChange={(e) => onChange(e.target.value)}
        onScroll={onScroll}
      />
    </div>
  );
}
