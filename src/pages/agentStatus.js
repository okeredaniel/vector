// Maps a raw backend step event (from the /ws WebSocket - see
// orchestrator/fallback.py _notify_step and BaseAgent._emit) to a
// human-friendly status label + icon key for the pending-message
// indicator. Falls back to a generic label for anything unrecognized so
// new step types never render blank.
//
// NOTE: the outer WebSocket envelope always has data.type === "agent_step".
// The actual kind of step (thinking / tool_call / etc.) lives in
// data.step_type instead - see fallback.py's _notify_step for why.

export function getStatusForStep(step) {
  if (!step || !step.step_type) {
    return { label: "Contemplating", icon: "sparkle" };
  }

  switch (step.step_type) {
    case "thinking":
      if ((step.content || "").toLowerCase().includes("processing")) {
        return { label: "Reviewing", icon: "check" };
      }
      return { label: "Contemplating", icon: "sparkle" };

    case "tool_call": {
      const tool = (step.tool || "").toLowerCase();
      if (tool.includes("search") || tool.includes("web_")) {
        return { label: "Researching", icon: "search" };
      }
      if (tool.includes("price") || tool.includes("crypto") || tool.includes("exchange")) {
        return { label: "Calculating", icon: "calc" };
      }
      if (tool.includes("file") || tool.includes("read") || tool.includes("write")) {
        return { label: "Digging through files", icon: "file" };
      }
      if (tool.includes("clip") || tool.includes("video") || tool.includes("caption") || tool.includes("aspect")) {
        return { label: "Editing", icon: "sparkle" };
      }
      if (tool.includes("note")) {
        return { label: "Checking notes", icon: "file" };
      }
      if (tool.includes("weather")) {
        return { label: "Checking the weather", icon: "search" };
      }
      return { label: "Working", icon: "sparkle" };
    }

    case "tool_result":
      return { label: "Reviewing", icon: "check" };

    case "tool_error":
      return { label: "Reckoning", icon: "sparkle" };

    case "tool_builder_started":
      return { label: "Building a new tool", icon: "sparkle" };

    case "tool_pending_review":
    case "tool_needs_manual_fix":
      return { label: "Wrapping up", icon: "check" };

    default:
      return { label: "Contemplating", icon: "sparkle" };
  }
}

// Short description used in the expanded activity log (click-to-expand).
export function describeStep(step) {
  switch (step.step_type) {
    case "thinking":
      return step.content || "Thinking...";
    case "tool_call":
      return `Calling ${step.tool}${step.args ? ` with ${JSON.stringify(step.args)}` : ""}`;
    case "tool_result":
      return `${step.tool} returned: ${step.result}`;
    case "tool_error":
      return `${step.tool} failed: ${step.error}`;
    case "tool_builder_started":
      return `Drafting a new tool: ${step.description || ""}`;
    case "tool_pending_review":
      return `Drafted "${step.tool_name}" - waiting for your review`;
    default:
      return step.content || step.step_type;
  }
}