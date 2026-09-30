type InstallNavigator = Pick<Navigator, "userAgent"> & {
  standalone?: boolean;
};

export function shouldShowIosInstallHint(
  navigatorValue: InstallNavigator,
  standaloneDisplayMode = false,
): boolean {
  const userAgent = navigatorValue.userAgent;
  const isIphone = /iPhone/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent);
  return isIphone && isSafari && navigatorValue.standalone !== true && !standaloneDisplayMode;
}
