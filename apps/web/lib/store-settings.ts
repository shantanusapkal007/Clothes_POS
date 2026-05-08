"use client";

import { useEffect, useState } from "react";
import { getBillLayoutConfig } from "./printer";

export const STORE_SETTINGS_EVENT = "store-settings-updated";
export const DEFAULT_STORE_NAME = "Clothing Store";

export function getStoreName() {
  const name = getBillLayoutConfig().companyName?.trim();
  return name || DEFAULT_STORE_NAME;
}

export function notifyStoreSettingsUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(STORE_SETTINGS_EVENT));
}

export function useStoreName() {
  const [storeName, setStoreName] = useState(DEFAULT_STORE_NAME);

  useEffect(() => {
    const syncStoreName = () => setStoreName(getStoreName());
    syncStoreName();

    window.addEventListener(STORE_SETTINGS_EVENT, syncStoreName);
    window.addEventListener("storage", syncStoreName);

    return () => {
      window.removeEventListener(STORE_SETTINGS_EVENT, syncStoreName);
      window.removeEventListener("storage", syncStoreName);
    };
  }, []);

  return storeName;
}
