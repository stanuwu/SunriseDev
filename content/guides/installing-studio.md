---
title: "Installing Sunrise Studio"
date: 2026-10-15
description: "Build Sunrise Studio and Sunrise 0.6 from source and connect them to your game."
weight: 15
---

Sunrise Studio is an alpha. It has no release yet, so you build it yourself. Studio also needs
Sunrise 0.6, which has no release yet either. Both get releases once they are tested and stable.

This guide takes you from a working Sunrise install to a running Studio.

## Requirements

- Windows 10 or 11, 64-bit, with a Direct3D 11 graphics card
- Destiny 2 installed with Sunrise. See [Installing Sunrise](/guides/installing/).
- [Visual Studio 2026](https://visualstudio.microsoft.com/), to build Sunrise
- the [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0), to build Studio
- [git](https://git-scm.com/), optional; without it, download the code as a ZIP
- [Blender](https://www.blender.org/) 5.2 or newer, optional, for the Blender add-on

Close the game before you start.

## Build Sunrise 0.6

Studio reads the game's package keys from a file that Sunrise 0.6 exports. The mods Studio builds
also need the 0.6 mod loader. Sunrise 0.5.1, the current release, has neither.

1. In the Visual Studio Installer, add the **Desktop development with C++** workload. Check that the
   v145 toolset and the Windows SDK 10.0.26100 are selected.
2. Get the source. With git:

   ```powershell
   git clone https://github.com/stanuwu/Sunrise
   ```

   Without git, open [the Sunrise repository](https://github.com/stanuwu/Sunrise), choose
   **Code > Download ZIP** and unzip it.
3. Open `Sunrise.sln` in Visual Studio. Pick the `Release` and `x64` configuration and build.
4. The build writes `build\x64\Release\steam_api64.dll`. In your game folder, replace
   `bin\x64\steam_api64.dll` with it.

Your saves and mission scripts stay as they are. Your settings do not: Sunrise 0.6 replaces an older
`bin\x64\Sunrise\settings.json` with its defaults. Before you start the game, note any values you
changed, such as `steam.language`, and set them again afterwards. See
[The version key](/docs/sunrise/settings-and-logs/#the-version-key).

## Export the package keys

Studio cannot read the game's packages until Sunrise exports their keys. You do this once.
[Export package keys once](/docs/sunrise-studio/getting-started/#export-package-keys-once) has the
steps: turn on `client.exports.package_keys`, start the game once, then turn it off again.

## Build Studio

1. Install the .NET 9 SDK.
2. Get the source. With git:

   ```powershell
   git clone https://github.com/stanuwu/SunriseStudio
   ```

   Without git, open [the Studio repository](https://github.com/stanuwu/SunriseStudio), choose
   **Code > Download ZIP** and unzip it.
3. Open PowerShell in the source folder and run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\publish.ps1
   ```

   The bypass applies to this one command. It is needed when Windows blocks scripts by default.
4. The build writes `publish\Sunrise Studio.exe`.

The exe is one file and needs no .NET install to run. You can move it anywhere. Keep it outside the
game folder.

## Install the Blender add-on

This step is optional. You need the add-on to open Studio's exports in Blender and to bring models
from Blender into Studio. It is a separate project, and Studio does not include it.
[Install the Blender add-on](/docs/sunrise-studio/blender-round-trip/#install-the-blender-add-on)
has the steps.

## Start Studio

Run `Sunrise Studio.exe`. On the first start, pick your game folder and leave **Package key source**
on **Automatic**. [Getting started](/docs/sunrise-studio/getting-started/) walks through the first
start and your first project.

## Update

Studio and Sunrise change often while they are in development. To update:

1. Get the new source: `git pull` in each source folder, or download the ZIP again.
2. Build Sunrise again and replace `bin\x64\steam_api64.dll`. A new settings version again resets
   `settings.json`.
3. Run `publish.ps1` again.

Your projects and Studio's own settings are kept.

## Get help

- Read the [Sunrise Studio docs](/docs/sunrise-studio/).
- Report a Studio bug on [GitHub issues](https://github.com/stanuwu/SunriseStudio/issues).
- Ask a question on [Discord](https://discord.com/invite/projectsunrise).
