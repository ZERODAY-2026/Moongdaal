import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Private Legal Document Triage",
  description:
    "On-device, document-grounded explanations of legal documents. Not legal advice.",
};

const css = `
:root{
  --red:#e5322d; --red-dark:#c42823; --red-soft:#fdecea;
  --ink:#33333b; --muted:#6b6b76; --line:#e3e3e8; --bg:#f3f0ee; --card:#ffffff;
  --green:#1e7e4f; --green-soft:#e6f4ec;
  --blue:#1d5fb4; --blue-soft:#e8f0fb;
  --amber:#a15c00; --amber-soft:#fff3dc;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  background:var(--bg); color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  line-height:1.5;
}
button{font:inherit;cursor:pointer}
:focus-visible{outline:3px solid var(--blue);outline-offset:2px}

.top{background:#fff;border-bottom:1px solid var(--line);padding:14px 24px;display:flex;align-items:center;gap:10px}
.logo{width:32px;height:32px;border-radius:8px;background:var(--red);color:#fff;display:grid;place-items:center;font-weight:800}
.top h2{margin:0;font-size:18px}

.banner{background:var(--amber-soft);color:var(--amber);border-bottom:1px solid #f0d9a8;padding:10px 24px;font-size:14px}
.banner strong{color:#7a4500}

.wrap{max-width:1180px;margin:0 auto;padding:32px 24px 64px}

.hero{text-align:center;padding:40px 0 8px}
.hero h1{font-size:40px;margin:0 0 10px;letter-spacing:-0.5px}
.hero p{color:var(--muted);font-size:18px;margin:0 auto 32px;max-width:640px}

.drop{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  max-width:720px;margin:0 auto;padding:56px 24px;background:var(--card);
  border:2px dashed #cfcfd6;border-radius:16px;transition:border-color .15s,background .15s;
}
.drop.over{border-color:var(--red);background:var(--red-soft)}
.btn{
  background:var(--red);color:#fff;border:0;border-radius:10px;
  padding:16px 34px;font-size:20px;font-weight:700;
}
.btn:hover{background:var(--red-dark)}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn.small{padding:10px 18px;font-size:15px}
.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
.btn.ghost:hover{background:#f7f7f9}
.hint{color:var(--muted);font-size:14px}
.err{color:#b3261e;background:#fdecea;border:1px solid #f4c7c3;border-radius:8px;padding:10px 14px;max-width:720px;margin:16px auto 0;font-size:14px}

.spinner{width:28px;height:28px;border:4px solid #ddd;border-top-color:var(--red);border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.bar .file{font-weight:700}
.grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:24px;align-items:start}
@media (max-width:900px){.grid{grid-template-columns:1fr}}

.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:20px}
.card h3{margin:0 0 12px;font-size:18px}
.summary{white-space:pre-wrap}

.escalate{background:var(--red-soft);border:1px solid #f4c7c3;border-radius:10px;padding:12px 14px;margin-top:12px;font-size:14px}

.finding{border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:12px}
.finding .head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.badge{font-size:12px;font-weight:700;border-radius:999px;padding:2px 10px}
.b-explicit{background:var(--green-soft);color:var(--green)}
.b-interpretation{background:var(--blue-soft);color:var(--blue)}
.b-concern{background:var(--amber-soft);color:var(--amber)}
.b-esc{background:var(--red-soft);color:var(--red-dark)}
.page{color:var(--muted);font-size:13px}
.quote{margin:8px 0;padding:8px 12px;border-left:4px solid var(--red);background:#faf8f7;font-style:italic;font-size:14px;white-space:pre-wrap}
.label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-top:8px}
.empty{color:var(--muted);font-size:14px}

.qa{position:sticky;top:16px}
.msgs{max-height:460px;overflow:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
.msg{padding:10px 12px;border-radius:10px;font-size:15px;white-space:pre-wrap}
.msg.user{background:var(--red-soft);align-self:flex-end;max-width:90%}
.msg.assistant{background:#f6f6f8;border:1px solid var(--line)}
.msg .tag{display:inline-block;font-size:12px;font-weight:700;margin-bottom:4px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.chip{background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:13px}
.chip:hover{background:#f7f7f9}
.ask{display:flex;gap:8px}
.ask input{flex:1;border:1px solid #cfcfd6;border-radius:10px;padding:10px 12px;font:inherit}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.tabs{display:flex;justify-content:center;gap:8px;margin:0 auto 20px}
.tab{background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 20px;font-weight:600;color:var(--muted)}
.tab.active{background:var(--red);border-color:var(--red);color:#fff}
.textbox{max-width:720px;margin:0 auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;text-align:left}
.textbox textarea{width:100%;min-height:260px;resize:vertical;border:1px solid #cfcfd6;border-radius:10px;padding:12px;font:inherit}
.textbox .row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;flex-wrap:wrap}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>{children}</body>
    </html>
  );
}