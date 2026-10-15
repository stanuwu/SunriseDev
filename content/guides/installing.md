---
title: "Installing Sunrise"
date: 2026-10-15
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

Also recommended:

- Add the game folder as an exclusion in [Windows Defender](/guides/windows-security/#windows-defender).
- On Windows 11, turn off [Smart App Control](/guides/windows-security/#smart-app-control).

## Install with the launcher

Download and run the [Sunrise Launcher](https://github.com/stanuwu/SunriseLauncher/releases/latest).

The launcher downloads the game, installs Sunrise and the mission scripts, and starts the game. It
also repairs and updates an existing install, including one made with the old installer.

- You pick the game language during install or repair. The launcher downloads that language's
  depot and sets `steam.language` in `settings.json`.
- **Update missions**, under **Current install**, replaces the scripts folder with the newest
  missions. A scripts folder that is a git clone is left alone; update it with `git pull`.

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
   and unzip it. The ZIP contains one folder. Copy everything **inside** it into
   `bin\x64\Sunrise\scripts`. When it is right, the file
   `bin\x64\Sunrise\scripts\lib\flow.lua` exists.

6. Start the game with `destiny2.exe` in the game folder.

The game reads that folder directly, so a script change needs no new version of Sunrise. Update the
scripts later with `git pull`, or by downloading the ZIP again.

Without the scripts the game still runs, but missions load with nothing scripted in them. To write
your own, see the [Mission Scripting docs](/docs/mission-scripting/).

## Other languages

The second command downloads the English depot. For another language, use that language's depot
and manifest in the second command instead. Then set `steam.language` in
`bin\x64\Sunrise\settings.json` to the value in the first column. The setting is described in
[Settings, logs and in-game tools](/docs/sunrise/settings-and-logs/#steam).

| `steam.language` | language | depot | manifest |
|---|---|---:|---:|
| `english` | English | `1085662` | `2210332166360342287` |
| `french` | French | `1085663` | `2934940253687559290` |
| `german` | German | `1085664` | `2207989571290186153` |
| `italian` | Italian | `1085665` | `6668232053215128229` |
| `japanese` | Japanese | `1085666` | `7430022397683116838` |
| `brazilian` | Portuguese (Brazil) | `1085667` | `9037238175838085860` |
| `spanish` | Spanish (Spain) | `1085668` | `3424833900894552134` |
| `russian` | Russian | `1085669` | `4539277942371480381` |
| `polish` | Polish | `1085670` | `6407581507105256731` |
| `schinese` | Chinese (Simplified) | `1085671` | `4397663774546719308` |
| `tchinese` | Chinese (Traditional) | `1085672` | `3906738704604711877` |
| `latam` | Spanish (Latin America) | `1085673` | `4773170998099699561` |
| `koreana` | Korean | `1085674` | `7148196199569436690` |

## Get help

- Read the [FAQ](/faq/) for common issues.
- Report a bug on [GitHub issues](https://github.com/stanuwu/Sunrise/issues).
- Ask a question on [Discord](https://discord.com/invite/projectsunrise).
