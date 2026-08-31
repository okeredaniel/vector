import { useState, Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Play, X } from "lucide-react";
import { createPortal } from "react-dom";
import CodeSandboxModal from "../components/CodeSandboxModal.jsx";
import "./MarkdownMessage.css";

function CodeBlock({ className, children }) {
  const [copied, setCopied] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const rawLang = (className || "").replace("language-", "").toLowerCase();

  const isRunnable =
    ["html", "js", "javascript", "css", "svg", "jsx", "tsx"].includes(rawLang) ||
    code.includes("<!DOCTYPE") ||
    code.includes("<html") ||
    code.includes("function") ||
    code.includes("const ");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="md-code-block">
        <div className="md-code-header">
          <span className="md-code-lang">{rawLang || "code"}</span>
          <div className="md-code-actions">
            {isRunnable && (
              <button
                type="button"
                className="md-code-action-btn md-code-play"
                onClick={() => setSandboxOpen(true)}
                title="Run live preview"
              >
                <Play size={12} fill="currentColor" />
                <span>Preview</span>
              </button>
            )}

            <button
              type="button"
              className="md-code-action-btn md-code-copy"
              onClick={handleCopy}
              title="Copy code"
            >
              {copied ? (
                <>
                  <Check size={12} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
        <pre className={className}>
          <code>{code}</code>
        </pre>
      </div>

      <CodeSandboxModal
        isOpen={sandboxOpen}
        onClose={() => setSandboxOpen(false)}
        code={code}
        language={rawLang}
      />
    </>
  );
}

function MdImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState(false);

  return (
    <>
      <span className="md-img-wrap">
        {!loaded && <span className="md-img-skeleton" />}
        <img
          src={src}
          alt={alt || "image"}
          className="md-inline-img"
          loading="lazy"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onClick={() => setPreview(true)}
        />
      </span>

      {preview &&
        createPortal(
          <div
            className="chat-image-lightbox"
            onClick={() => setPreview(false)}
          >
            <div
              className="chat-image-lightbox-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="chat-image-lightbox-close"
                onClick={() => setPreview(false)}
                title="Close"
              >
                <X size={16} />
              </button>
              <img
                src={src}
                alt={alt || "image"}
                className="chat-image-lightbox-img"
              />
              <div className="chat-image-lightbox-details">
                <span className="chat-image-lightbox-name">
                  {alt || "Image"}
                </span>
                <span className="chat-image-lightbox-meta">Image</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function MdLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

// Recursively checks a subtree of already-rendered React children for an
// MdImage node, so we can detect "this list contains images" regardless of
// how deeply nested the img ends up inside <p>/<li> wrappers.
function subtreeHasImage(children) {
  return Children.toArray(children).some((child) => {
    if (!isValidElement(child)) return false;
    if (child.type === MdImage) return true;
    if (child.props && child.props.children) {
      return subtreeHasImage(child.props.children);
    }
    return false;
  });
}

function MdOrderedList({ children, ...props }) {
  const isImageGrid = subtreeHasImage(children);
  return (
    <ol className={isImageGrid ? "md-image-grid" : undefined} {...props}>
      {children}
    </ol>
  );
}

function MdUnorderedList({ children, ...props }) {
  const isImageGrid = subtreeHasImage(children);
  return (
    <ul className={isImageGrid ? "md-image-grid" : undefined} {...props}>
      {children}
    </ul>
  );
}

export default function MarkdownMessage({ text }) {
  if (!text) return null;

  return (
    <div className="md-message claude-style">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          hr() {
            return <div className="md-hr-spacer" />;
          },
          code({ className, children }) {
            const isBlock = Boolean(className);
            if (!isBlock) {
              return <code className="md-inline-code">{children}</code>;
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          img: MdImage,
          ol: MdOrderedList,
          ul: MdUnorderedList,
          a: MdLink,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}