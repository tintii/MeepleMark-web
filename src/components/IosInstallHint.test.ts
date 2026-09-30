import { describe, expect, it } from "vitest";
import { shouldShowIosInstallHint } from "./iosInstall";

const iphoneSafari = {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
};

describe("shouldShowIosInstallHint", () => {
  it("shows for Safari on an iPhone", () => {
    expect(shouldShowIosInstallHint(iphoneSafari)).toBe(true);
  });

  it("stays hidden when the app is already running standalone", () => {
    expect(shouldShowIosInstallHint({ ...iphoneSafari, standalone: true })).toBe(false);
    expect(shouldShowIosInstallHint(iphoneSafari, true)).toBe(false);
  });

  it("stays hidden in other iPhone browsers and on desktop Safari", () => {
    expect(shouldShowIosInstallHint({ userAgent: iphoneSafari.userAgent.replace("Version/26.0", "CriOS/140.0") })).toBe(false);
    expect(shouldShowIosInstallHint({ userAgent: "Mozilla/5.0 (Macintosh) Version/26.0 Safari/605.1.15" })).toBe(false);
  });
});
