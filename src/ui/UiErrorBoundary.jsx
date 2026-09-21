import { Component } from "react";

export default class UiErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[Village UI]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ui-fallback" role="status">
          The Village controls had a display issue. The 3D Village is still running.
        </div>
      );
    }
    return this.props.children;
  }
}
