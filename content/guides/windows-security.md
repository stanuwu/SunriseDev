---
title: "Windows Defender and Smart App Control"
date: 2026-09-16
description: "Stop Windows from flagging or blocking the game, on Windows 10 and 11."
weight: 20
---

Windows can flag or block Sunrise:

- **Windows Defender** can flag the mod as a threat. See
  [why antivirus tools flag it](/faq/#why-does-my-antivirus-flag-this-file).
- **Smart App Control** can block the game with the error `Bad Image (status 0xc0e90002)`.

## Windows Defender

These steps are the same on Windows 10 and 11. Create the empty game folder first if it does not
exist yet.

1. Open **Start**, search for **Windows Security** and open it.
2. Select **Virus & threat protection**.
3. Under **Virus & threat protection settings**, select **Manage settings**.
4. Scroll to **Exclusions** and select **Add or remove exclusions**. Select **Yes** when Windows
   asks for permission.
5. Select **Add an exclusion**, then **Folder**.
6. Pick the game folder and select **Select Folder**.

You can also add the exclusion from PowerShell. Open PowerShell as administrator and replace the
path with your game folder:

```powershell
Add-MpPreference -ExclusionPath "D:\Games\Destiny 2"
```

If you use a different antivirus, add the exclusion in that program instead.

## Smart App Control

Smart App Control only exists on Windows 11. On Windows 10, skip this part.

Smart App Control has no exclusions. It is either on or off, so to run Sunrise you must turn it off.

1. Open **Start**, search for **Windows Security** and open it.
2. Select **App & browser control**.
3. Under **Smart App Control**, select **Smart App Control settings**.
4. Select **Off**.

> On some Windows 11 versions, you cannot turn Smart App Control back on without reinstalling
> Windows. Read the note on the settings page before you turn it off.

If the settings page already shows **Off**, Smart App Control is not the cause.
