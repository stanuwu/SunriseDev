---
title: "Installing Sunrise"
date: 2026-09-16
description: "Install Destiny 2 and Sunrise, with the launcher or by hand."
weight: 10
---

## Requirements

- Windows 10 or 11, 64-bit
- 100 GB of free storage
- A Steam account that owns Destiny 2

## Before you start

- Pick an empty folder. The game is installed there.
- Your Steam username is the name you sign in with, not the name on your profile.

We also recommend:

- Add the game folder as an exclusion in [Windows Defender](/guides/windows-security/#windows-defender).
- On Windows 11, turn off [Smart App Control](/guides/windows-security/#smart-app-control).

## Install with the launcher

Download and run the [Sunrise Launcher](https://github.com/stanuwu/SunriseLauncher/releases/latest).

The launcher downloads the game, installs Sunrise and the mission scripts, and starts the game. It
also repairs and updates an existing install, including one made with the old installer.

## Install by hand

1. Download [DepotDownloader](https://github.com/SteamRE/DepotDownloader/releases/download/DepotDownloader_3.4.0/DepotDownloader-windows-x64.zip)
   and unzip it.
2. Download both game depots into the same folder. Run the commands in the DepotDownloader folder.
   - Replace `<install-location>` with the folder you picked.
   - Replace `<steam-username>` with your Steam username.
   - Wait for the first command to finish before you run the second.

   ```powershell
   .\DepotDownloader.exe -app 1085660 -depot 1085661 -manifest 7180122903232116872 -dir <install-location> -username <steam-username> -remember-password -qr -os windows -osarch 64

   .\DepotDownloader.exe -app 1085660 -depot 1085662 -manifest 2210332166360342287 -dir <install-location> -username <steam-username> -remember-password -os windows -osarch 64
   ```

3. Download the latest DLL from the [Sunrise releases](https://github.com/stanuwu/Sunrise/releases/latest).
4. In the game folder, replace `bin\x64\steam_api64.dll` with the downloaded file.
5. Install the mission scripts. They hold the scripted missions. Put them in
   `bin\x64\Sunrise\scripts` inside the game folder.

   With git, clone the repository straight into that folder:

   ```powershell
   git clone https://github.com/stanuwu/SunriseMissions.git "<install-location>\bin\x64\Sunrise\scripts"
   ```

   Without git, download
   [the scripts as a ZIP](https://github.com/stanuwu/SunriseMissions/archive/refs/heads/main.zip)
   and unzip it. The ZIP contains one folder; copy everything **inside** it into
   `bin\x64\Sunrise\scripts`. When it is right, the file
   `bin\x64\Sunrise\scripts\lib\flow.lua` exists.

6. Start the game with `destiny2.exe` in the game folder.

The game reads that folder directly, so a script change needs no new version of Sunrise. Update the
scripts later with `git pull`, or by downloading the ZIP again.

Without the scripts the game still runs, but missions load with nothing scripted in them. To write
your own, see the [Mission Scripting docs](/docs/mission-scripting/).

## Get help

- Read the [FAQ](/faq/) for common issues.
- Report a bug on [GitHub issues](https://github.com/stanuwu/Sunrise/issues).
- Ask a question on [Discord](https://discord.com/invite/projectsunrise).
