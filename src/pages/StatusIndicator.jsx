import { useState } from "react";
import { Sparkle, Search, Calculator, FileText, Check, ChevronDown } from "lucide-react";
import { describeStep } from "./agentStatus.js";
import "./StatusIndicator.css";

const ICONS = {
  sparkle: Sparkle,
  search: Search,
  calc: Calculator,
  file: FileText,
  check: Check,
};

export default function StatusIndicator({ label, iconKey, steps = [] }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = ICONS[iconKey] || Sparkle;
  const hasSteps = steps.length > 0;

  return (
    <div className="status-indicator">
      <button
        type="button"
        className="status-indicator-row"
        onClick={() => hasSteps && setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        disabled={!hasSteps}
      >
        <Icon size={15} className="status-indicator-icon" />
        <span className="status-indicator-label">{label}</span>
        {hasSteps && (
          <ChevronDown
            size={13}
            className={`status-indicator-chevron ${expanded ? "open" : ""}`}
          />
        )}
      </button>

      {expanded && hasSteps && (
        <div className="status-indicator-log">
          {steps.map((step, i) => (
            <div key={i} className="status-indicator-log-row">
              <span className="status-indicator-log-dot" />
              <span className="status-indicator-log-text">{describeStep(step)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}