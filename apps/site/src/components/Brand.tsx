import { GitMerge } from "lucide-react";

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="SyncPro home">
      <span className="logo">
        <GitMerge className="ico" />
      </span>
      <span className="brand-name">
        Sync<b>Pro</b>
      </span>
    </a>
  );
}
