// Gives this server a public https URL so the app can reach it when your phone
// can't reach your computer directly (campus Wi-Fi, cellular, `expo start --tunnel`).
// Needs cloudflared: brew install cloudflared
// Run `npm run dev` first, then `npm run tunnel` in a second terminal.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = Number(process.env.PORT) || 4000;
const envPath = path.join(__dirname, "..", "..", ".env");
const KEY = "EXPO_PUBLIC_API_URL";
const keyLine = new RegExp(`^${KEY}=(.*)$`, "m");

const readEnv = () => (fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "");
const originalUrl = readEnv().match(keyLine)?.[1];

function setApiUrl(url: string) {
  const env = readEnv();
  const line = `${KEY}=${url}`;
  fs.writeFileSync(envPath, keyLine.test(env) ? env.replace(keyLine, line) : `${env.trimEnd()}\n${line}\n`);
}

const child = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`], {
  stdio: ["ignore", "pipe", "pipe"],
});

child.on("error", (err: NodeJS.ErrnoException) => {
  console.error(err.code === "ENOENT" ? "cloudflared is not installed. Run `brew install cloudflared`, then try again." : err);
  process.exit(1);
});

let tunnelUrl: string | undefined;

// cloudflared prints the new URL in its log. Skip api.trycloudflare.com, which only shows up in error messages.
const findUrl = (chunk: Buffer) => {
  const text = chunk.toString();
  if (process.env.TUNNEL_DEBUG) process.stderr.write(text);
  if (tunnelUrl) return;
  const match = text.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/);
  if (!match) return;
  tunnelUrl = match[0];
  setApiUrl(tunnelUrl);
  console.log(`Tunnel open: ${tunnelUrl} -> http://localhost:${port}`);
  console.log(`Wrote ${KEY}=${tunnelUrl} to .env`);
  console.log("Restart Expo with `npx expo start --tunnel -c` so the app picks it up. Ctrl+C here closes the tunnel.");
};
child.stdout.on("data", findUrl);
child.stderr.on("data", findUrl);

// Put the previous URL back so LAN mode works again once the tunnel is closed
child.on("exit", (code) => {
  // A trycloudflare URL left over from an earlier run is already dead, so there's nothing worth restoring
  if (tunnelUrl && originalUrl && !originalUrl.includes("trycloudflare.com")) {
    setApiUrl(originalUrl);
    console.log(`Tunnel closed. Restored ${KEY}=${originalUrl} in .env`);
  } else if (!tunnelUrl) {
    console.error("cloudflared exited before the tunnel opened. Run `TUNNEL_DEBUG=1 npm run tunnel` to see why.");
  }
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
