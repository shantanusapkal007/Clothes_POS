"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { formatBarcodeString, parseBarcodeData } from "../lib/barcode-parser";

interface ScannerPanelProps {
  barcodeInput: string;
  setBarcodeInput: (val: string) => void;
  onBarcodeSubmit: (barcode: string) => void;
}

const PRICE_PROMPT_KEY = "scanner-price-prompt";

export function ScannerPanel({
  barcodeInput,
  setBarcodeInput,
  onBarcodeSubmit
}: ScannerPanelProps) {
  const scannerRegionId = useId().replace(/:/g, "-");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void | Promise<void>;
    isScanning?: boolean;
  } | null>(null);
  const scanHandledRef = useRef(false);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraSupported, setCameraSupported] = useState(false);

  const [promptForPrice, setPromptForPrice] = useState(false);
  const [pricePromptOpen, setPricePromptOpen] = useState(false);
  const [pricePromptBarcode, setPricePromptBarcode] = useState<string | null>(null);
  const [pricePromptError, setPricePromptError] = useState<string | null>(null);
  const [pricePromptValues, setPricePromptValues] = useState({
    price: "",
    discount: "",
    qty: "1"
  });

  const focusInput = () => {
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const clearScanner = (scanner: NonNullable<typeof scannerRef.current>) => {
    const result = scanner.clear();
    if (result && typeof (result as Promise<void>).catch === "function") {
      void (result as Promise<void>).catch(() => undefined);
    }
  };

  const closePricePrompt = () => {
    setPricePromptOpen(false);
    setPricePromptBarcode(null);
    setPricePromptError(null);
    focusInput();
  };

  const openPricePrompt = (barcode: string, defaults?: { discount?: number; quantity?: number }) => {
    setPricePromptBarcode(barcode);
    setPricePromptValues({
      price: "",
      discount: defaults?.discount !== undefined ? String(defaults.discount) : "",
      qty: String(defaults?.quantity ?? 1)
    });
    setPricePromptError(null);
    setPricePromptOpen(true);
  };

  const commitBarcode = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      focusInput();
      return;
    }

    const parsed = parseBarcodeData(trimmed);

    if (promptForPrice && parsed.price === undefined) {
      openPricePrompt(parsed.barcode, {
        discount: parsed.discount,
        quantity: parsed.quantity
      });
      return;
    }

    onBarcodeSubmit(trimmed);
    focusInput();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    commitBarcode(barcodeInput);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "Enter" || event.key === "Tab") && barcodeInput.trim()) {
      event.preventDefault();
      commitBarcode(barcodeInput);
    }
  };

  const handlePricePromptSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!pricePromptBarcode) {
      closePricePrompt();
      return;
    }

    const price = Number(pricePromptValues.price);
    if (!Number.isFinite(price) || price < 0) {
      setPricePromptError("Enter a valid price from the sticker.");
      return;
    }

    const discountRaw = pricePromptValues.discount.trim();
    const discountValue = discountRaw ? Number(discountRaw) : undefined;
    const discount =
      discountValue !== undefined && Number.isFinite(discountValue)
        ? Math.max(0, Math.min(100, discountValue))
        : undefined;

    const qtyRaw = parseInt(pricePromptValues.qty, 10);
    const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : undefined;

    const structured = formatBarcodeString(pricePromptBarcode, price, discount, quantity);
    setBarcodeInput(structured);
    setPricePromptOpen(false);
    setPricePromptBarcode(null);
    setPricePromptError(null);

    onBarcodeSubmit(structured);
    focusInput();
  };

  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" &&
      typeof window !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      window.isSecureContext;

    setCameraSupported(supported);

    const storedPrompt = typeof window !== "undefined" ? localStorage.getItem(PRICE_PROMPT_KEY) : null;
    setPromptForPrice(storedPrompt === "true");
  }, []);

  useEffect(() => {
    if (!cameraOpen) {
      focusInput();
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      setCameraPending(true);
      setCameraError(null);
      scanHandledRef.current = false;

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

        if (cancelled) {
          return;
        }

        const scanner = new Html5Qrcode(scannerRegionId);
        const scannerInstance = scanner as unknown as NonNullable<typeof scannerRef.current>;
        scannerInstance.isScanning = false;
        scannerRef.current = scannerInstance;

        const formatsToSupport = [
          Html5QrcodeSupportedFormats?.CODE_128,
          Html5QrcodeSupportedFormats?.CODE_39,
          Html5QrcodeSupportedFormats?.EAN_13,
          Html5QrcodeSupportedFormats?.EAN_8,
          Html5QrcodeSupportedFormats?.UPC_A,
          Html5QrcodeSupportedFormats?.UPC_E,
          Html5QrcodeSupportedFormats?.QR_CODE
        ].filter(Boolean);
        let cameras: any[] = [];
        if (typeof Html5Qrcode.getCameras === "function") {
          try {
            cameras = await Html5Qrcode.getCameras();
          } catch {
            cameras = [];
          }
        }
        const preferredCamera = cameras.find((camera: { label?: string }) =>
          /(rear|back|environment)/i.test(camera.label || "")
        );

        const scannerConfig = {
          fps: 10,
          qrbox: { width: 300, height: 160 },
          formatsToSupport: formatsToSupport.length > 0 ? formatsToSupport : undefined,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        };

        const handleDecoded = (decodedText: string) => {
          if (scanHandledRef.current) {
            return;
          }

          scanHandledRef.current = true;
          setBarcodeInput(decodedText);
          setCameraOpen(false);
          commitBarcode(decodedText);
        };

        try {
          await scanner.start(
            preferredCamera?.id ?? { facingMode: "environment" },
            scannerConfig,
            handleDecoded,
            () => {
              // Ignore per-frame decode noise.
            }
          );
        } catch {
          if (!preferredCamera && cameras[0]?.id) {
            await scanner.start(cameras[0].id, scannerConfig, handleDecoded, () => undefined);
          } else {
            throw new Error("No compatible camera source found.");
          }
        }

        scannerInstance.isScanning = true;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to access the camera. Check browser permission and HTTPS.";
        setCameraError(message);
      } finally {
        if (!cancelled) {
          setCameraPending(false);
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      const activeScanner = scannerRef.current;
      scannerRef.current = null;

      if (activeScanner) {
        const isScanning = activeScanner.isScanning;
        if (isScanning) {
          void activeScanner
            .stop()
            .catch(() => undefined)
            .finally(() => {
              clearScanner(activeScanner);
              focusInput();
            });
        } else {
          clearScanner(activeScanner);
          focusInput();
        }
      }
    };
  }, [cameraOpen, scannerRegionId, setBarcodeInput]);

  return (
    <>
      <div className="glass-panel rounded-lg p-2 sm:p-4 md:p-6 shadow-sm">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 sm:gap-3 md:gap-4"
        >
          <div className="relative flex-1" onClick={focusInput}>
            <span className="material-symbols-outlined absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-outline text-sm md:text-base">
              barcode_scanner
            </span>
            <input
              ref={inputRef}
              className="field-input pl-8 sm:pl-10 md:pl-12 text-xs sm:text-sm md:text-base py-2 sm:py-3 md:py-4"
              placeholder="Scan or enter SKU..."
              type="text"
              value={barcodeInput}
              onChange={(event) => setBarcodeInput(event.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="flex gap-1 sm:gap-2 md:gap-3">
            <button
              type="button"
              onClick={focusInput}
              className="flex items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 md:py-3 text-on-surface transition-all hover:bg-surface-container-high text-xs sm:text-sm md:text-base font-semibold touch-action-manipulation"
              title="Focus scanner input"
            >
              <span className="hidden sm:inline">Ready</span>
              <span className="sm:hidden">🎯</span>
            </button>

            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={!cameraSupported}
              className="flex items-center justify-center rounded-lg bg-primary text-on-primary shadow-lg transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 active:scale-95 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3 font-semibold text-xs sm:text-sm md:text-base touch-action-manipulation"
              title={
                cameraSupported
                  ? "Open Camera Scanner"
                  : "Camera scanning requires HTTPS and camera permission"
              }
            >
              <span className="material-symbols-outlined text-lg sm:text-xl md:text-2xl" data-weight="fill">
                photo_camera
              </span>
              <span className="hidden sm:inline ml-1">Camera</span>
            </button>

            <button
              type="submit"
              className="flex items-center justify-center rounded-lg bg-primary-fixed px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 md:py-3 font-semibold text-on-primary-fixed transition-all hover:bg-primary-fixed-dim active:scale-95 text-xs sm:text-sm md:text-base touch-action-manipulation"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl md:text-2xl">add_circle</span>
              <span className="hidden sm:inline ml-1">Add</span>
            </button>
          </div>
        </form>

        <div className="mt-2 sm:mt-3 md:mt-4 flex flex-col gap-1.5 sm:gap-2 text-[9px] sm:text-xs md:text-sm text-on-secondary-container">
          <p>Keyboard-style barcode scanners can type here and submit with Enter or Tab.</p>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 sm:mt-1"
              checked={promptForPrice}
              onChange={(event) => {
                const next = event.target.checked;
                setPromptForPrice(next);
                localStorage.setItem(PRICE_PROMPT_KEY, String(next));
              }}
            />
            <span>Sticker price prompt (when barcode does not include price)</span>
          </label>

          {!cameraSupported ? (
            <p>
              Camera scanning is available only in a secure browser context (HTTPS) with camera permission enabled.
            </p>
          ) : null}
        </div>
      </div>

      {cameraOpen ? (
        <div className="modal-backdrop">
          <div className="modal-card max-w-lg">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Camera scanner</p>
                <h2 className="text-base sm:text-lg md:text-2xl">Scan barcode with camera</h2>
              </div>
              <button
                className="button button-ghost self-start sm:self-auto text-xs sm:text-sm"
                type="button"
                onClick={() => setCameraOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-2 sm:p-3">
                <div
                  id={scannerRegionId}
                  className="min-h-[200px] sm:min-h-[280px] overflow-hidden rounded-lg bg-black/10"
                />
              </div>

              {cameraPending ? (
                <p className="text-xs sm:text-sm text-on-secondary-container">Starting camera scanner...</p>
              ) : null}

              {cameraError ? <p className="error-text text-xs sm:text-sm">{cameraError}</p> : null}

              <p className="text-xs sm:text-sm text-on-secondary-container">
                For price-on-sticker workflows, QR codes scan best. Embedded formats like{" "}
                <code>barcode|price|discount|qty</code> are supported.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {pricePromptOpen && pricePromptBarcode ? (
        <div className="modal-backdrop">
          <div className="modal-card max-w-lg">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Sticker price</p>
                <h2 className="text-base sm:text-lg md:text-2xl">Enter price from sticker</h2>
              </div>
              <button
                className="button button-ghost self-start sm:self-auto text-xs sm:text-sm"
                type="button"
                onClick={closePricePrompt}
              >
                Cancel
              </button>
            </div>

            <form className="space-y-3 sm:space-y-4" onSubmit={handlePricePromptSubmit}>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-2 sm:p-3 md:p-4 text-xs sm:text-sm">
                <p className="text-on-secondary-container">Scanned barcode</p>
                <p className="mt-1 font-mono text-on-surface break-all text-xs">{pricePromptBarcode}</p>
              </div>

              <div className="inventory-grid">
                <input
                  className="text-input text-xs sm:text-sm py-2 sm:py-3"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="Price (Rs)"
                  value={pricePromptValues.price}
                  onChange={(event) =>
                    setPricePromptValues((current) => ({ ...current, price: event.target.value }))
                  }
                  required
                />
                <input
                  className="text-input text-xs sm:text-sm py-2 sm:py-3"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  placeholder="Discount % (optional)"
                  value={pricePromptValues.discount}
                  onChange={(event) =>
                    setPricePromptValues((current) => ({ ...current, discount: event.target.value }))
                  }
                />
                <input
                  className="text-input text-xs sm:text-sm py-2 sm:py-3"
                  type="number"
                  min={1}
                  step="1"
                  placeholder="Quantity"
                  value={pricePromptValues.qty}
                  onChange={(event) =>
                    setPricePromptValues((current) => ({ ...current, qty: event.target.value }))
                  }
                />
              </div>

              {pricePromptError ? <p className="error-text text-xs sm:text-sm">{pricePromptError}</p> : null}

              <button className="button button-primary w-full text-xs sm:text-sm" type="submit">
                Continue
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

