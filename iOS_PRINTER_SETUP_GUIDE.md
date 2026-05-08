# iOS Thermal Printer Setup Guide

## Problem
iOS Safari doesn't support the Web Bluetooth API, which means the web app cannot automatically discover or enumerate paired Bluetooth devices like Android can. However, manually paired devices **can still be used** with the right configuration.

## Solution Overview
On iOS, we use **two approaches**:
1. **Manual Device Entry** - Add your printer's name directly in the app
2. **AirPrint Fallback** - Use Safari's native printing for wireless printers

## Step-by-Step Setup for iOS

### Method 1: Manual Bluetooth Printer Setup (Recommended)

#### Step 1: Pair Printer with iPhone/iPad
1. Open **Settings** → **Bluetooth**
2. Make sure Bluetooth is **ON**
3. Power on your thermal printer
4. Look for your printer name in the available devices list (e.g., "SUNMI V2", "Epson TM-M30")
5. Tap the printer name to pair
6. You should see "Connected" next to the printer name
7. **Note the EXACT printer name** - you'll need this in the app

#### Step 2: Add Printer to Friends POS App
1. Open the Friends POS App in Safari
2. Tap the **Printer** button
3. Tap the **Bluetooth** card
4. You'll see an iOS-specific info box with setup instructions
5. In the "Add Printer Manually" section:
   - Enter the **EXACT printer name** from Bluetooth settings
   - Example: `SUNMI-V2-2024`, `Epson-M30`, etc.
   - Tap the **Add** button
6. The printer will appear in the "Paired Devices" section
7. Tap **Connect** next to your printer
8. You should see "Bluetooth printer connected" message

#### Step 3: Test Print
1. Go back to the main screen
2. Add some items to the cart
3. Click "Confirm & Print"
4. The printer should print the receipt

### Method 2: Using AirPrint (Alternative)
If manual Bluetooth doesn't work or your printer doesn't support Web Bluetooth:

1. Ensure your printer supports AirPrint
2. Connect it to the same WiFi network as your iPad/iPhone
3. In the Friends POS app, just tap **Confirm & Print**
4. iOS will automatically show the print sheet
5. Select your AirPrint printer from the list
6. Adjust settings and tap **Print**

### Method 3: Share & Print (Fallback Option)
1. Tap the **Share Test Receipt** button in Printer Settings
2. Choose to share via AirPrint or other apps
3. Or copy the text and share to any app that supports printing

## Troubleshooting

### Printer Not Appearing in Bluetooth Settings
- ✅ Power cycle the printer (turn off and on)
- ✅ Move printer closer to iPhone/iPad
- ✅ Forget the device in Bluetooth settings and pair again
- ✅ Restart your iPhone/iPad

### "Failed to Connect" Error
1. Check the printer name is **EXACTLY** correct (case-sensitive)
2. Ensure the printer is already paired in iOS Bluetooth settings
3. Try removing and re-adding the device:
   - Settings → Bluetooth → (i) button next to printer → "Forget This Device"
   - Re-pair the device
   - Re-add to the app

### Printer Connected But Not Printing
- ✅ Check printer has paper and is powered on
- ✅ Try using AirPrint instead (tap "Test Print")
- ✅ Check printer is within Bluetooth range
- ✅ Try the Share option: Settings → Printer → Share Test Receipt

### No Devices Listed
- If auto-discovery doesn't work on iOS (expected), always use **Manual Entry**
- This is normal - iOS doesn't allow apps to enumerate Bluetooth devices like Android

## iOS Technical Notes

### Why Manual Entry is Needed
- iOS restricts Web Bluetooth API access to certain services only
- Device enumeration requires system permissions iOS doesn't grant to Safari web apps
- Manually entered devices are saved locally for future use
- Once added, they appear in the "Paired Devices" section

### Why AirPrint is the Fallback
- AirPrint is built into iOS and works natively
- It supports most modern thermal printers
- No special app or Web Bluetooth required
- Print preview and settings are built-in

### Supported iOS Versions
- iOS 13 and later
- iPad OS 13 and later

## Getting Printer Device Name

Different thermal printer brands display names differently:

| Brand | Common Names | Example |
|-------|------------|---------|
| Sunmi | SUNMI-V2, SUNMI-V3 | SUNMI-V2-2024 |
| Epson | TM-series name | Epson-M30, TM-M30-II |
| Star Micronics | Star name | Star-SM-S270i |
| Zebra | ZSB name | ZSB-R2844 |
| Generic | BT-name | BT-Printer-88MM |

**To find your exact printer name:**
1. Settings → Bluetooth → Look in the device list
2. Write down the EXACT name (including hyphens, numbers, capitals)
3. Enter this in the app

## Best Practices

✅ **DO:**
- Keep printer within 10 meters of iPhone/iPad
- Keep Bluetooth enabled
- Use AirPrint for WiFi-connected printers
- Save device names exactly as shown in Bluetooth settings
- Test print before starting actual sales
- Restart printer if connection drops

❌ **DON'T:**
- Use generic "Bluetooth Printer" names - use the exact device name
- Forget Bluetooth device while app is open
- Move printer too far from device during printing
- Turn off printer during printing

## Still Having Issues?

1. **Screenshot Settings** → Bluetooth page showing your printer
2. **Screenshot** Printer Settings in the app
3. **Try the Safari Console:**
   - Right-click → Inspect Element
   - Check Console for errors
   - Screenshot any red error messages
4. **Contact Support** with these details

## Alternative: Use Web Serial on Desktop
If you're using a desktop/laptop Mac:
- You can use **Serial** or **USB** connection
- Install drivers for your printer model
- Use the desktop version of Friends POS for better printer support
