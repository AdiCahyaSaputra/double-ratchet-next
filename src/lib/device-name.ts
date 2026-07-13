function detectBrowser(userAgent: string): string {
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("Chrome/") && !userAgent.includes("Edg/")) return "Chrome";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) return "Safari";
  return "Browser";
}

function detectPlatform(userAgent: string): string {
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) return "macOS";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Linux")) return "Linux";
  return "Unknown";
}

export function detectDeviceName(): string {
  if (typeof navigator === "undefined") {
    return "Unknown Device";
  }

  const uaData = (
    navigator as Navigator & {
      userAgentData?: {
        brands?: Array<{ brand: string }>;
        platform?: string;
      };
    }
  ).userAgentData;

  if (uaData?.brands?.length) {
    const browser =
      uaData.brands.find((brand) => !brand.brand.includes("Not"))?.brand ??
      detectBrowser(navigator.userAgent);
    const platform = uaData.platform || detectPlatform(navigator.userAgent);
    return `${browser} on ${platform}`;
  }

  return `${detectBrowser(navigator.userAgent)} on ${detectPlatform(navigator.userAgent)}`;
}
