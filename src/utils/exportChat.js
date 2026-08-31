/**
 * Utility functions for exporting Vector chat sessions as Markdown (.md) or PDF.
 */

export function formatSessionAsMarkdown(session) {
  if (!session) return "";

  const title = session.title || "Vector Chat Export";
  const dateStr = session.createdAt
    ? new Date(session.createdAt).toLocaleString()
    : new Date().toLocaleString();

  let md = `# ${title}\n\n`;
  md += `**Exported Date:** ${dateStr}\n`;
  md += `**Session ID:** \`${session.id}\`  \n\n`;
  md += `---\n\n`;

  const messages = session.messages || [];
  for (const msg of messages) {
    if (msg.status === "pending") continue;

    const senderLabel = msg.sender === "user" ? "### 👤 User" : "### 🤖 Assistant";
    const timeStr = msg.time ? new Date(msg.time).toLocaleTimeString() : "";

    md += `${senderLabel} *(${timeStr})*\n\n`;

    if (msg.attachments && msg.attachments.length > 0) {
      md += `*Attached files:*\n`;
      for (const att of msg.attachments) {
        md += `- \`${att.name}\` (${att.kind})\n`;
      }
      md += `\n`;
    }

    md += `${msg.text || ""}\n\n`;
    md += `---\n\n`;
  }

  return md;
}

export function downloadMarkdownFile(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportChatAsMarkdown(session) {
  const mdContent = formatSessionAsMarkdown(session);
  const safeTitle = (session?.title || "chat")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `${safeTitle || "vector-chat"}-${Date.now()}.md`;
  downloadMarkdownFile(filename, mdContent);
}

export function exportChatAsPDF(session) {
  if (!session) return;

  const title = session.title || "Vector Chat Export";
  const dateStr = session.createdAt
    ? new Date(session.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to export chat as PDF.");
    return;
  }

  const messagesHtml = (session.messages || [])
    .filter((m) => m.status !== "pending")
    .map((m) => {
      const isUser = m.sender === "user";
      const senderName = isUser ? "User" : "Assistant";
      const timeStr = m.time ? new Date(m.time).toLocaleTimeString() : "";

      let attHtml = "";
      if (m.attachments && m.attachments.length > 0) {
        attHtml = `<div class="attachments"><strong>Attachments:</strong> ${m.attachments.map((a) => a.name).join(", ")}</div>`;
      }

      return `
        <div class="message ${isUser ? "user" : "assistant"}">
          <div class="msg-header">
            <span class="sender">${senderName}</span>
            <span class="time">${timeStr}</span>
          </div>
          ${attHtml}
          <div class="msg-text">${escapeHtml(m.text || "")}</div>
        </div>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(title)} - Vector Chat Export</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1a1a1a;
            line-height: 1.6;
            margin: 40px;
            background: #ffffff;
          }
          .header {
            border-bottom: 2px solid #7c3aed;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .header h1 {
            margin: 0 0 6px 0;
            font-size: 24px;
            color: #111;
          }
          .header .meta {
            font-size: 12px;
            color: #666;
          }
          .message {
            margin-bottom: 20px;
            padding: 14px 18px;
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .message.user {
            background: #f3f0ff;
            border: 1px solid #ddd6fe;
          }
          .message.assistant {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
          }
          .msg-header {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #475569;
          }
          .attachments {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .msg-text {
            font-size: 14px;
            white-space: pre-wrap;
            word-break: break-word;
          }
          @media print {
            body { margin: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">Exported from Vector AI • ${dateStr} • Session ID: ${session.id}</div>
        </div>
        <div class="messages">
          ${messagesHtml}
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
