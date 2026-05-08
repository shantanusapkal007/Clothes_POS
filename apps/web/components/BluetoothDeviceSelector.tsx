"use client";

import { useEffect, useState } from "react";
import {
  addManualBluetoothDevice,
  connectBluetoothPrinter,
  getAvailableBluetoothPrinters,
  getPairedBluetoothDevices,
  isIosBrowser,
  removePairedBluetoothDevice,
  type BluetoothDeviceInfo,
  type PrinterConfig,
} from "../lib/printer";

interface BluetoothDeviceSelectorProps {
  onSelectDevice: (device: PrinterConfig) => void;
  onClose?: () => void;
  currentDeviceId?: string;
}

export function BluetoothDeviceSelector({
  onSelectDevice,
  onClose,
  currentDeviceId,
}: BluetoothDeviceSelectorProps) {
  const [availableDevices, setAvailableDevices] = useState<PrinterConfig[]>([]);
  const [pairedDevices, setPairedDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [manualDeviceName, setManualDeviceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [iosBrowser, setIosBrowser] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setIosBrowser(isIosBrowser());
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const [available, paired] = await Promise.all([
        getAvailableBluetoothPrinters(),
        Promise.resolve(getPairedBluetoothDevices()),
      ]);
      const pairedIds = new Set(paired.map((device) => device.id));
      setAvailableDevices(
        available.filter(
          (device) =>
            device.bluetoothDeviceId && !pairedIds.has(device.bluetoothDeviceId),
        ),
      );
      setPairedDevices(paired);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load printer devices.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDevice = async (device: PrinterConfig) => {
    setConnecting(device.bluetoothDeviceId || "");
    setMessage(null);

    if (device.bluetoothDeviceId?.startsWith("manual-")) {
      onSelectDevice({
        ...device,
        connected: false,
      });
      setConnecting(null);
      return;
    }

    try {
      const characteristic = await connectBluetoothPrinter(device);
      const connected = Boolean(characteristic);
      onSelectDevice({ ...device, connected });
      if (!connected) {
        setMessage("Printer saved, but the browser could not open a writable Bluetooth service.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bluetooth connection failed.");
    } finally {
      setConnecting(null);
    }
  };

  const handleAddManualDevice = () => {
    if (!manualDeviceName.trim()) {
      return;
    }
    const device = addManualBluetoothDevice(manualDeviceName);
    setPairedDevices((current) => [
      device,
      ...current.filter((item) => item.id !== device.id && item.name !== device.name),
    ]);
    setManualDeviceName("");
    setMessage("Printer saved. iOS Safari may still require AirPrint for actual printing.");
  };

  const handleRemoveDevice = (deviceId: string) => {
    removePairedBluetoothDevice(deviceId);
    setPairedDevices((current) => current.filter((d) => d.id !== deviceId));
  };

  return (
    <div className="space-y-6">
      {/* iOS Guidance */}
      {iosBrowser && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 shrink-0">
              info
            </span>
            <div>
              <p className="font-semibold text-blue-900">iOS Bluetooth Tip</p>
              <p className="mt-1 text-sm text-blue-800">
                iOS Safari doesn't automatically discover Bluetooth devices.{" "}
                <strong>Manually add your printer name below</strong> after
                pairing it in iOS Settings → Bluetooth.
              </p>
            </div>
          </div>
        </div>
      )}

      {message ? (
        <div className="rounded-lg border border-tertiary-fixed-dim bg-tertiary-fixed px-3 py-2 text-xs font-medium text-on-tertiary-fixed">
          {message}
        </div>
      ) : null}

      {/* Manual Device Entry */}
      {iosBrowser && (
        <section>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-on-surface">
              Add Printer Manually
            </span>
            <div className="flex gap-2">
              <input
                className="field-input flex-1"
                type="text"
                placeholder="Enter paired printer name"
                value={manualDeviceName}
                onChange={(e) => setManualDeviceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddManualDevice();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddManualDevice}
                disabled={!manualDeviceName.trim()}
                className="button button-primary button-small"
              >
                Add
              </button>
            </div>
            <p className="mt-1 text-xs text-on-secondary-container">
              Enter the exact name shown in Bluetooth settings
            </p>
          </label>
        </section>
      )}

      {/* Available Devices */}
      {availableDevices.length > 0 && (
        <section>
          <span className="mb-3 block text-sm font-bold text-on-surface-variant">
            Discovered Devices ({availableDevices.length})
          </span>
          <div className="space-y-2">
            {availableDevices.map((device) => (
              <button
                key={device.bluetoothDeviceId}
                onClick={() => handleSelectDevice(device)}
                disabled={connecting !== null}
                className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                  currentDeviceId === device.bluetoothDeviceId
                    ? "border-blue-500 bg-blue-50"
                    : "border-outline-variant bg-surface-container-highest hover:border-blue-300"
                } disabled:opacity-50`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{device.name}</p>
                    {device.bluetoothDeviceId && (
                      <p className="text-xs text-on-secondary-container">
                        ID: {device.bluetoothDeviceId.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                  {connecting === device.bluetoothDeviceId && (
                    <span className="material-symbols-outlined animate-spin">
                      sync
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Paired Devices */}
      {pairedDevices.length > 0 && (
        <section>
          <span className="mb-3 block text-sm font-bold text-on-surface-variant">
            Paired Devices ({pairedDevices.length})
          </span>
          <div className="space-y-2">
            {pairedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container-highest p-3"
              >
                <div className="flex-1">
                  <p className="font-semibold">{device.name}</p>
                  {device.savedManually && (
                    <p className="text-xs text-on-secondary-container">
                      Manually added
                    </p>
                  )}
                  {device.lastConnected && (
                    <p className="text-xs text-on-secondary-container">
                      Last connected:{" "}
                      {new Date(device.lastConnected).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const config: PrinterConfig = {
                        name: device.name,
                        connectionType: "bluetooth",
                        bluetoothDeviceId: device.id,
                        width: 80,
                        connected: false,
                      };
                      handleSelectDevice(config);
                    }}
                    disabled={connecting !== null}
                    className="button button-secondary button-small"
                  >
                    {connecting === device.id ? "Connecting..." : "Connect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveDevice(device.id)}
                    className="button button-ghost button-small text-error"
                    title="Remove from paired devices"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {!loading && availableDevices.length === 0 && pairedDevices.length === 0 && (
        <div className="rounded-lg border border-outline-variant bg-surface-container-highest p-6 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">
            bluetooth_disabled
          </span>
          <p className="text-sm font-semibold text-on-surface">
            No devices found
          </p>
          <p className="mt-1 text-xs text-on-secondary-container">
            {iosBrowser
              ? "Add your printer manually or ensure Bluetooth is enabled"
              : "Ensure your printer is powered on and discoverable"}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-6">
          <span className="material-symbols-outlined animate-spin">sync</span>
          <span className="ml-2 text-sm">Scanning for devices...</span>
        </div>
      )}

      {onClose ? (
        <button type="button" className="button button-secondary w-full" onClick={onClose}>
          Done
        </button>
      ) : null}
    </div>
  );
}
