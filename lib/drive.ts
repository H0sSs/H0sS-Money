import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { exportBackup, getSettings, updateSetting, importBackup } from "./services";

WebBrowser.maybeCompleteAuthSession();

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: "hossmoney",
  path: "redirect",
});

export function getDriveRedirectUri(): string {
  return REDIRECT_URI;
}

interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // ms epoch
}

async function loadTokens(): Promise<TokenBundle | null> {
  const s = await getSettings();
  if (!s.driveAccessToken || !s.driveTokenExpiresAt) return null;
  return {
    accessToken: s.driveAccessToken,
    refreshToken: s.driveRefreshToken ?? undefined,
    expiresAt: Number(s.driveTokenExpiresAt),
  };
}

async function saveTokens(t: TokenBundle): Promise<void> {
  await updateSetting("driveAccessToken", t.accessToken);
  if (t.refreshToken) await updateSetting("driveRefreshToken", t.refreshToken);
  await updateSetting("driveTokenExpiresAt", String(t.expiresAt));
}

export async function clearDriveAuth(): Promise<void> {
  await updateSetting("driveAccessToken", "");
  await updateSetting("driveRefreshToken", "");
  await updateSetting("driveTokenExpiresAt", "");
}

async function refreshIfNeeded(): Promise<string | null> {
  const t = await loadTokens();
  if (!t) return null;
  if (Date.now() < t.expiresAt - 60_000) return t.accessToken;
  if (!t.refreshToken) return null;

  const s = await getSettings();
  if (!s.googleClientId) return null;

  const res = await fetch(DISCOVERY.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `client_id=${encodeURIComponent(s.googleClientId)}&refresh_token=${encodeURIComponent(t.refreshToken)}&grant_type=refresh_token`,
  });
  if (!res.ok) return null;
  const json = await res.json();
  const updated: TokenBundle = {
    accessToken: json.access_token,
    refreshToken: t.refreshToken,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  await saveTokens(updated);
  return updated.accessToken;
}

export async function connectDrive(clientId: string): Promise<boolean> {
  await updateSetting("googleClientId", clientId);

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: [DRIVE_SCOPE],
    redirectUri: REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { access_type: "offline", prompt: "consent" },
  });

  const result = await request.promptAsync(DISCOVERY);
  if (result.type !== "success" || !result.params.code) return false;

  const tokenRes = await fetch(DISCOVERY.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: result.params.code,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_verifier: request.codeVerifier ?? "",
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) {
    console.warn("token exchange failed", await tokenRes.text());
    return false;
  }
  const tok = await tokenRes.json();
  await saveTokens({
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000,
  });
  return true;
}

const FOLDER_NAME = "H0sS-Money-Backups";

async function findOrCreateFolder(token: string): Promise<string> {
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await list.json();
  if (j.files?.[0]?.id) return j.files[0].id;

  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const cj = await create.json();
  return cj.id;
}

export async function uploadBackupToDrive(): Promise<{ ok: boolean; fileName?: string; error?: string }> {
  try {
    const token = await refreshIfNeeded();
    if (!token) return { ok: false, error: "غير متصل بـ Google Drive" };

    const folderId = await findOrCreateFolder(token);
    const json = await exportBackup();
    const stamp = new Date().toISOString().split("T")[0];
    const fileName = `hossmoney-backup-${stamp}.json`;

    const boundary = "h0ssmoney" + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name: fileName, parents: [folderId], mimeType: "application/json" });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) return { ok: false, error: `رفع فشل: ${res.status}` };

    await updateSetting("driveLastBackupAt", String(Date.now()));
    return { ok: true, fileName };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string | null;
}

export async function listDriveBackups(): Promise<{ ok: boolean; files?: DriveBackupFile[]; error?: string }> {
  try {
    const token = await refreshIfNeeded();
    if (!token) return { ok: false, error: "غير متصل بـ Google Drive" };
    const folderId = await findOrCreateFolder(token);
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const list = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=100&fields=files(id,name,createdTime,size)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!list.ok) return { ok: false, error: `فشل التحميل: ${list.status}` };
    const j = await list.json();
    const files: DriveBackupFile[] = (j.files ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
      size: f.size ?? null,
    }));
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ" };
  }
}

export async function restoreFromDriveFile(
  fileId: string,
  mode: "merge" | "replace"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await refreshIfNeeded();
    if (!token) return { ok: false, error: "غير متصل بـ Google Drive" };
    const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dl.ok) return { ok: false, error: `فشل التحميل: ${dl.status}` };
    const text = await dl.text();
    await importBackup(text, mode);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ" };
  }
}

export async function restoreLatestFromDrive(mode: "merge" | "replace"): Promise<{ ok: boolean; error?: string }> {
  const list = await listDriveBackups();
  if (!list.ok) return { ok: false, error: list.error };
  if (!list.files || list.files.length === 0) return { ok: false, error: "لا توجد نسخ احتياطية" };
  return restoreFromDriveFile(list.files[0].id, mode);
}

export async function deleteDriveBackup(fileId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await refreshIfNeeded();
    if (!token) return { ok: false, error: "غير متصل بـ Google Drive" };
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok && r.status !== 204) return { ok: false, error: `فشل الحذف: ${r.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ" };
  }
}

export async function maybeAutoBackup(): Promise<void> {
  try {
    const s = await getSettings();
    if (!s.driveAutoBackup || !s.driveAccessToken) return;
    const last = s.driveLastBackupAt ? Number(s.driveLastBackupAt) : 0;
    if (Date.now() - last < 24 * 3600 * 1000) return;
    await uploadBackupToDrive();
  } catch {}
}
