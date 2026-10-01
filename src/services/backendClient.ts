
import { GpsFix } from "../types/gps";

export async function postFix(endpoint: string, fix: GpsFix): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fix),
  });

  if (!res.ok) {
    throw new Error(`Backend responded with HTTP ${res.status}`);
  }
}

export async function testConnection(endpoint: string): Promise<number> {
  const res = await fetch(endpoint, { method: "GET" });
  return res.status;
}