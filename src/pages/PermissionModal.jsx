import ReactDOM from "react-dom";
import { ShieldAlert, Check, CheckCheck, X } from "lucide-react";
import "./PermissionModal.css";

function formatArgs(args) {
  if (!args || Object.keys(args).length === 0) return null;
  return Object.entries(args).map(([key, value]) => (
    <div key={key} className="perm-arg-row">
      <span className="perm-arg-key">{key}</span>
      <span className="perm-arg-value">
        {typeof value === "string" ? value : JSON.stringify(value)}
      </span>
    </div>
  ));
}

export default function PermissionModal({ request, onDecide }) {
  if (!request) return null;

  const { agent, tool, args } = request;
  const argRows = formatArgs(args);

  return ReactDOM.createPortal(
    <div className="perm-backdrop">
      <div className="perm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="perm-header">
          <div className="perm-header-icon">
            <ShieldAlert size={16} />
          </div>
          <div className="perm-header-text">
            <h3>Permission requested</h3>
            <p>
              <strong>{agent || "An agent"}</strong> wants to use{" "}
              <code className="perm-tool-name">{tool || "a tool"}</code>
            </p>
          </div>
        </div>

        {argRows && <div className="perm-args">{argRows}</div>}

        <div className="perm-actions">
          <button
            type="button"
            className="perm-btn perm-deny"
            onClick={() => onDecide("deny")}
          >
            <X size={14} />
            Deny
          </button>
          <button
            type="button"
            className="perm-btn perm-allow-once"
            onClick={() => onDecide("allow_once")}
          >
            <Check size={14} />
            Allow once
          </button>
          <button
            type="button"
            className="perm-btn perm-allow-forever"
            onClick={() => onDecide("allow_forever")}
          >
            <CheckCheck size={14} />
            Always allow
          </button>
        </div>

        <p className="perm-timeout-note">
          Times out and denies automatically after 2 minutes if left unanswered.
        </p>
      </div>
    </div>,
    document.body
  );
}