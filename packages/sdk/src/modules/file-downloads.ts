import type { Module } from "../types.js";
import { onLinkClick, sendLink } from "./link.js";

export const DEFAULT_DOWNLOAD_EXTENSIONS = (
  "pdf csv txt rtf doc docx xls xlsx ppt pptx odt ods epub zip rar 7z gz tgz tar dmg pkg exe msi " +
  "apk deb rpm iso mp3 wav mp4 mov avi mkv webm"
).split(" ");

export interface FileDownloadsOptions {
  /** File extensions without the dot. Replaces the default list. */
  extensions?: string[];
}

/**
 * `autoCapture: { fileDownloads: fileDownloads() }`. Sends `file_download` with `url` (origin +
 * path) when a clicked link has a `download` attribute or ends in one of the extensions.
 */
export function fileDownloads(options: FileDownloadsOptions = {}): Module {
  const extensions = new Set(
    (options.extensions ?? DEFAULT_DOWNLOAD_EXTENSIONS).map((e) => e.toLowerCase()),
  );
  return (emit, on) => {
    onLinkClick(on, (url, anchor) => {
      const extension = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase();
      if (anchor.hasAttribute("download") || (extension && extensions.has(extension))) {
        sendLink(emit, "file_download", url);
      }
    });
  };
}
