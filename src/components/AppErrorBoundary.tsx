import { Component, type ErrorInfo, type ReactNode } from "react";
import { FailurePage } from "./FailurePage";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main id="main-content">
      <FailurePage
        code={500}
        title="Something went wrong"
        explanation="MeepleMark hit an unexpected problem. Reload the page or return home to continue."
        actions={<><button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload</button><a className="button-link" href={import.meta.env.BASE_URL}>Home</a></>}
      />
    </main>;
  }
}
