import React from "react";
import { XMarkdown } from "@ant-design/x-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  isStreaming,
}) => {
  const streaming = isStreaming
    ? {
        hasNextChunk: true,
        enableAnimation: true,
      }
    : undefined;

  return (
    <div className={`markdown-body ${className || ""}`}>
      <XMarkdown content={content} openLinksInNewTab streaming={streaming} />
    </div>
  );
};

export default React.memo(MarkdownRenderer);
