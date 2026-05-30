import React from 'react';
import { 
  useLLMOutput, 
  type LLMOutputComponent,
  type LLMOutputBlock,
  type LLMOutputMatcher,
  type LookBackFunction
} from '@llm-ui/react';
import { markdownLookBack } from '@llm-ui/markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LLMMessageProps {
  text: string;
  onConceptClick: (concept: string) => void;
  isUser: boolean;
}

// 1. Concept Link Component
const ConceptComponent: React.FC<{ blockMatch: any; onConceptClick: (concept: string) => void }> = ({
  blockMatch,
  onConceptClick
}) => {
  // Clean up bracket characters
  const concept = blockMatch.visibleText || blockMatch.output.replace(/[\[\]]/g, '').trim();
  return (
    <span 
      className="concept-link" 
      onClick={(e) => {
        e.stopPropagation();
        onConceptClick(concept);
      }}
    >
      {concept}
    </span>
  );
};

// 2. Markdown Fallback Block Component
const MarkdownComponent: LLMOutputComponent = ({ blockMatch }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Render paragraphs as inline span to allow concept links to flow side-by-side
        p: ({ children }) => <span className="markdown-para">{children}</span>,
        pre: ({ children }) => <pre className="message-pre">{children}</pre>,
        code: ({ className, children, ...props }) => {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        ul: ({ children }) => <ul className="message-ul">{children}</ul>,
        ol: ({ children }) => <ol className="message-ol">{children}</ol>,
        li: ({ children }) => <li className="message-li">{children}</li>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="message-link">{children}</a>
      }}
    >
      {blockMatch.output}
    </ReactMarkdown>
  );
};


// 3. Define custom concept block matchers for [Concept Name]
const findCompleteMatch: LLMOutputMatcher = (text: string) => {
  const regex = /\[([^\]\n]+)\]/g;
  const match = regex.exec(text);
  if (match) {
    return {
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      outputRaw: match[0],
    };
  }
  return undefined;
};

const findPartialMatch: LLMOutputMatcher = (text: string) => {
  const lastOpen = text.lastIndexOf('[');
  if (lastOpen === -1) return undefined;
  const lastClose = text.lastIndexOf(']');
  if (lastClose === -1 || lastOpen > lastClose) {
    const rest = text.slice(lastOpen);
    if (!rest.includes('\n')) {
      return {
        startIndex: lastOpen,
        endIndex: text.length,
        outputRaw: rest,
      };
    }
  }
  return undefined;
};

const lookBack: LookBackFunction = ({ output }) => {
  const clean = output.replace(/[\[\]]/g, '').trim();
  return {
    output: output,
    visibleText: clean,
  };
};

const LLMMessageComponent: React.FC<LLMMessageProps> = ({ text, onConceptClick, isUser }) => {
  if (isUser) {
    // User messages do not need markdown parsing or concept linking
    return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  }

  // Memoize conceptBlock to prevent resetting selection when outer states change
  const conceptBlock = React.useMemo<LLMOutputBlock>(() => {
    return {
      findCompleteMatch,
      findPartialMatch,
      lookBack,
      component: (props: any) => <ConceptComponent {...props} onConceptClick={onConceptClick} />
    };
  }, [onConceptClick]);

  // Process streaming output with llm-ui
  const { blockMatches } = useLLMOutput({
    llmOutput: text,
    blocks: [conceptBlock],
    fallbackBlock: {
      component: MarkdownComponent,
      lookBack: markdownLookBack()
    },
    isStreamFinished: true // Mark as finished to render complete blocks
  });

  return (
    <div className="llm-message-container" style={{ display: 'inline', whiteSpace: 'pre-wrap' }}>
      {blockMatches.map((block, index) => {
        const Component = block.block.component;
        return <Component key={index} blockMatch={block} />;
      })}
    </div>
  );
};

export const LLMMessage = React.memo(LLMMessageComponent);

