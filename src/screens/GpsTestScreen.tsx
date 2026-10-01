
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import GhostMap from "../components/GhostMap";
import { useGpsTracking } from "../hooks/useGpsTracking";
import { formatDistance } from "../services/distance";
import { flagAccuracy } from "../types/gps";

const FALLBACK_COORDS = { latitude: 49.2494, longitude: -122.9987 }; // BCIT Burnaby

export default function GpsTestScreen() {
  const gps = useGpsTracking();
  const latest = gps.fixes[gps.fixes.length - 1];
  const isTracking = gps.status === "live" || gps.status === "requesting";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ghost Racer — GPS test</Text>
      <Text style={styles.status}>{gps.status}</Text>

      <View style={styles.mapContainer}>
        <GhostMap
          latitude={latest?.lat ?? FALLBACK_COORDS.latitude}
          longitude={latest?.lng ?? FALLBACK_COORDS.longitude}
        />
      </View>

      <View style={styles.row}>
        <Pressable
          style={[styles.button, styles.primary, isTracking && styles.disabled]}
          disabled={isTracking}
          onPress={gps.start}
        >
          <Text style={styles.buttonText}>Start</Text>
        </Pressable>
        <Pressable
          style={[styles.button, !isTracking && styles.disabled]}
          disabled={!isTracking}
          onPress={gps.stop}
        >
          <Text style={styles.buttonText}>Stop</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={gps.clear}>
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <Field label="Lat" value={latest ? latest.lat.toFixed(6) : "—"} />
        <Field label="Lng" value={latest ? latest.lng.toFixed(6) : "—"} />
        <Field
          label="Accuracy"
          value={latest?.accuracy != null ? `${Math.round(latest.accuracy)} m` : "—"}
          flag={latest ? flagAccuracy(latest.accuracy) : "unknown"}
        />
        <Field
          label="Speed"
          value={latest?.speed != null ? `${(latest.speed * 3.6).toFixed(1)} km/h` : "—"}
        />
        <Field label="Points" value={String(gps.fixes.length)} />
        <Field label="Distance" value={formatDistance(gps.distanceMeters)} />
      </View>

      <Text style={styles.label}>Backend endpoint (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="https://your-api.example.com/gps-ingest"
        placeholderTextColor="#7d8895"
        value={gps.endpoint}
        onChangeText={gps.setEndpoint}
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={gps.pingBackend}>
        <Text style={styles.buttonText}>Test connection</Text>
      </Pressable>

      <Text style={styles.label}>Log</Text>
      {gps.log.length === 0 && <Text style={styles.dim}>No fixes yet.</Text>}
      {gps.log.map((entry) => (
        <Text key={entry.time} style={[styles.logLine, styles[entry.level]]}>
          {new Date(entry.time).toLocaleTimeString()} — {entry.message}
        </Text>
      ))}
    </ScrollView>
  );
}

function Field({ label, value, flag }: { label: string; value: string; flag?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, flag === "bad" && styles.bad, flag === "warn" && styles.warn]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1117" },
  content: { padding: 16, paddingBottom: 40 },
  mapContainer: {
  height: 480,
  borderRadius: 8,
  overflow: "hidden",
  marginVertical: 12,
  borderWidth: 1,
  borderColor: "#232b35",
    },
  title: { color: "#e6edf3", fontSize: 16, fontWeight: "600" },
  status: { color: "#7d8895", fontSize: 12, marginTop: 2, marginBottom: 14 },
  row: { flexDirection: "row", gap: 8, marginBottom: 16 },
  button: { flex: 1, backgroundColor: "#161d26", borderWidth: 1, borderColor: "#232b35", borderRadius: 6, paddingVertical: 10, alignItems: "center" },
  primary: { backgroundColor: "#4ee6a8", borderColor: "#4ee6a8" },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#e6edf3", fontWeight: "600", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  field: { width: "47%" },
  fieldLabel: { color: "#7d8895", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { color: "#e6edf3", fontSize: 15, marginTop: 2 },
  bad: { color: "#ff6b6b" },
  warn: { color: "#f0b840" },
  label: { color: "#7d8895", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: "#161d26", borderWidth: 1, borderColor: "#232b35", borderRadius: 6, color: "#e6edf3", padding: 10, marginBottom: 8, fontSize: 12 },
  dim: { color: "#7d8895", fontSize: 12 },
  logLine: { color: "#e6edf3", fontSize: 11, marginBottom: 4 },
  info: { color: "#e6edf3" },
  ok: { color: "#4ee6a8" },
  error: { color: "#ff6b6b" },
});