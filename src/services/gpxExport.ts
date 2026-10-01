
import { GpsFix } from "../types/gps";

export function buildGpx(fixes: GpsFix[], trackName = "Ghost Racer test run"): string {
  const points = fixes
    .map((f) => {
      const ele = f.altitude != null ? `<ele>${f.altitude}</ele>` : "";
      const time = `<time>${new Date(f.timestamp).toISOString()}</time>`;
      return `      <trkpt lat="${f.lat}" lon="${f.lng}">${ele}${time}</trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ghost-racer-test">
  <trk>
    <name>${trackName}</name>
    <trkseg>
${points}
    </trkseg>
  </trk>
</gpx>`;
}