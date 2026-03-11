import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown 渲染组件
 * 支持 GFM（表格、删除线、任务列表、自动链接）、代码高亮
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const components: Components = useMemo(
    () => ({
      // 代码块
      code(props) {
        const { children, className: codeClassName, ...rest } = props;
        const match = /language-(\w+)/.exec(codeClassName || '');
        const isInline = !match && !String(children).includes('\n');

        if (isInline) {
          return (
            <code
              className="bg-base-300/50 text-primary px-1 py-0.5 rounded text-[0.8em]"
              {...rest}
            >
              {children}
            </code>
          );
        }

        return (
          <div className="relative group my-2">
            {match && (
              <span className="absolute top-1.5 right-2 text-[10px] text-base-content/30 uppercase select-none">
                {match[1]}
              </span>
            )}
            <code className={codeClassName} {...rest}>
              {children}
            </code>
          </div>
        );
      },

      // 链接：新窗口打开
      a(props) {
        const { children, href, ...rest } = props;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary link-hover"
            {...rest}
          >
            {children}
          </a>
        );
      },

      // 表格：响应式包装
      table(props) {
        const { children, ...rest } = props;
        return (
          <div className="overflow-x-auto my-2 rounded-lg border border-base-300">
            <table className="table table-sm table-zebra" {...rest}>
              {children}
            </table>
          </div>
        );
      },

      th(props) {
        const { children, ...rest } = props;
        return (
          <th className="bg-base-200 text-base-content/80 font-semibold text-xs" {...rest}>
            {children}
          </th>
        );
      },

      // 图片
      img(props) {
        const { src, alt, ...rest } = props;
        return (
          <img
            src={src}
            alt={alt || ''}
            className="rounded-lg max-w-full h-auto my-2"
            loading="lazy"
            {...rest}
          />
        );
      },

      // 有序/无序列表
      ul(props) {
        const { children, ...rest } = props;
        return (
          <ul className="list-disc list-inside space-y-0.5 my-1" {...rest}>
            {children}
          </ul>
        );
      },

      ol(props) {
        const { children, ...rest } = props;
        return (
          <ol className="list-decimal list-inside space-y-0.5 my-1" {...rest}>
            {children}
          </ol>
        );
      },

      // 引用块
      blockquote(props) {
        const { children, ...rest } = props;
        return (
          <blockquote
            className="border-l-3 border-primary/40 pl-3 my-2 text-base-content/70 italic"
            {...rest}
          >
            {children}
          </blockquote>
        );
      },

      // 标题
      h1(props) {
        const { children, ...rest } = props;
        return <h1 className="text-lg font-bold mt-3 mb-1.5" {...rest}>{children}</h1>;
      },
      h2(props) {
        const { children, ...rest } = props;
        return <h2 className="text-base font-bold mt-2.5 mb-1" {...rest}>{children}</h2>;
      },
      h3(props) {
        const { children, ...rest } = props;
        return <h3 className="text-sm font-bold mt-2 mb-1" {...rest}>{children}</h3>;
      },
      h4(props) {
        const { children, ...rest } = props;
        return <h4 className="text-sm font-semibold mt-2 mb-0.5" {...rest}>{children}</h4>;
      },

      // 水平分割线
      hr() {
        return <hr className="my-3 border-base-300" />;
      },

      // 段落
      p(props) {
        const { children, ...rest } = props;
        return <p className="my-1 leading-relaxed" {...rest}>{children}</p>;
      },

      // 任务列表复选框 (GFM)
      input(props) {
        if (props.type === 'checkbox') {
          return (
            <input
              type="checkbox"
              checked={props.checked}
              disabled
              className="checkbox checkbox-xs checkbox-primary mr-1.5 align-middle"
            />
          );
        }
        return <input {...props} />;
      },

      // pre 块
      pre(props) {
        const { children, ...rest } = props;
        return (
          <pre
            className="bg-base-300/30 rounded-lg p-3 overflow-x-auto text-xs leading-relaxed my-2"
            {...rest}
          >
            {children}
          </pre>
        );
      },
    }),
    []
  );

  return (
    <div className={`markdown-body ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(MarkdownRenderer);
