import { zoomIn, zoomOut, resetView } from "../three/CameraRig.jsx";

export default function ZoomControls() {
  return (
    <div id="zoom-controls">
      <button onClick={zoomIn}>+</button>
      <button style={{ fontSize: 12 }} onClick={resetView}>⤢</button>
      <button onClick={zoomOut}>–</button>
    </div>
  );
}
