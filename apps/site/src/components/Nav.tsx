import { ArrowRight } from "lucide-react";
import { Brand } from "./Brand";

export function Nav() {
  return (
    <div className="nav">
      <div className="wrap-lg row between" style={{ height: "100%" }}>
        <div className="row gap-6">
          <Brand />
          <nav className="topnav" style={{ marginLeft: 8 }}>
            <a href="#problem">The problem</a>
            <a href="#vision">What we're building</a>
            <a href="#who">Who it's for</a>
          </nav>
        </div>
        <div className="row gap-2">
          <a className="btn btn-primary btn-sm" href="#waitlist">
            Request early access
            <ArrowRight className="ico" />
          </a>
        </div>
      </div>
    </div>
  );
}
