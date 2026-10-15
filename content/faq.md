---
title: "FAQ"
description: "Common questions and common problems with Sunrise and Sunrise Studio."
proseClass: "faq"
---

## Common issues

### Bad Image (status 0xc0e90002)

Smart App Control blocked the game. Turn Smart App Control off, as shown in
[Windows Defender and Smart App Control](/guides/windows-security/#smart-app-control).

### "DepotDownloader failed with exit code 1"

Most often, the Steam account name or password is wrong. Enter your account name, not your profile
name. The account name is the one you sign in to Steam with. It cannot be changed, and only you can
see it. Steam shows it under **Account details**.

If the name and password are right, check the other causes the message lists: game ownership, Steam
Guard, free space and the install folder.

### Timeout during the first start

Your computer took too long to extract the files the game needs. Wait until the Sunrise popup is
gone, then restart the game.

### The game shows a "Validate Files" error

Most likely, `settings.json` is invalid, for example after a manual edit. Check
the file for typos, such as a missing comma or quote.

If you cannot find the problem, delete `settings.json` from the `bin\x64\Sunrise` folder. Sunrise
creates a new one with the default settings on the next start. Your own settings are lost.

## Using Sunrise

### How do I open the menu?

Press **Insert**. That is the default key.

### How do I change the menu key?

1. Open `settings.json` in the `bin\x64\Sunrise` folder of your game folder.
2. Find this part:

   ```json
   "client": {
     "ui": {
       "enabled": true,
       "toggle_key": "insert"
   ```

3. Replace `insert` with another key. Valid keys are `insert`, `home`, `end`, `delete` and `f1` to
   `f12`.
4. Save the file and restart the game.

### Is there an easier way to edit the settings?

Yes. [Sundial](https://github.com/KyleThmpsn/sundial/releases) by AdeptHavok is a community tool that
edits `settings.json` for you.

### How do I load a specific bubble?

1. Find the bubble in the
   [bubble list](https://docs.google.com/spreadsheets/d/1SfEMoBs0aJO2ycs7-F5jLsjqP0EvTN_9ZA3vuXK__HI/edit?usp=sharing)
   by Breshi.
2. Go to orbit and press **Insert** to open the menu.
3. Open the **Activity Launcher** page, then the **Custom Launch** card.
4. Pick the activity and its launch route. Under the arrival, set the **Bubble**, and the **Slice**
   and **Spawn** if you need them.
5. Select **Launch activity**.

The custom arrival stays active until you select **Clear active override**. Some bubbles need a
specific spawn point. You have to find that one yourself. The menu pages are listed in
[The in-game menu](/docs/sunrise/settings-and-logs/#the-in-game-menu).

## Questions

### Why do I need to sign in with Steam to download?

The old game version is downloaded from Steam depots. Steam only allows this for an account that
owns Destiny 2.

### Why does my antivirus flag this file?

Sunrise is a game mod. To work, it changes the game's code in memory and hooks Windows API calls.
Some malware does the same, so antivirus tools can flag it. Sunrise contains no malware. To stop
the warnings, [add the game folder as an exclusion](/guides/windows-security/#windows-defender).

### Is it safe to use a DLL someone sent me?

Only if you trust where it came from. Use the DLL from the
[official releases](https://github.com/stanuwu/Sunrise/releases), or one from a Sunrise team member.
If you build from source, check the code first. The Sunrise team is not responsible for harmful DLLs
you build or install.

### Why can't I find a feature in my build?

The feature is probably in a pull request that is not merged yet. Support covers official releases
only. If you are not sure what you are doing, use the latest release.

### Why is it not written in Rust?

I believe in using the right tool for the job. I also don't like Rust much.

### Can I install this next to the regular game?

Yes. Sunrise is meant to be installed on its own, apart from the regular game.

### Can this get me banned?

No. Sunrise blocks the game's outbound traffic and sends every connection to its own server on your
machine. To be safe, do not run it at the same time as the live game.

### Does this support consoles?

No. Sunrise is for PC on Steam only. It will never support consoles or other platforms.

### Will more features be added?

Maybe. Bug fixes come first.

## Sunrise Studio

### Where do I download Sunrise Studio?

There is no download yet. Studio is an alpha, and you build it yourself from source.
[Installing Sunrise Studio](/guides/installing-studio/) has the steps. It gets a release once it is
tested and stable.

### Which Sunrise version does Studio need?

Sunrise 0.6, which you also build from source for now. Sunrise 0.5.1 cannot export the package keys
Studio reads, and it cannot load mods.

### Studio says "Cannot read package keys"

Studio has no package keys yet. Sunrise exports them once for you. Follow
[Export package keys once](/docs/sunrise-studio/getting-started/#export-package-keys-once). If the
export file never appears, the most likely cause is a Sunrise older than 0.6.

### Studio shows "Unable to load"

The folder you picked holds no game packages. Press **Choose Sunrise location** and pick your game
folder. Studio also accepts its `packages` folder or its `bin\x64\Sunrise` folder.

### Does Studio change my game files?

No. Studio only reads the installation. Your edits go to your project folder, and builds go to the
project's `build` folder. Only **Build and install** writes into the game folder, and only into
`bin\x64\Sunrise\mods\<mod id>`. Delete that folder to remove the mod.

### My mod does not show up in game

1. Restart the game. Sunrise loads mods once, at startup.
2. Check that the game runs Sunrise 0.6.
3. Open the Sunrise menu with **Insert** and check the **Mods** page. It lists every mod and why one
   did not load.

[Why a mod does not load](/docs/sunrise/mods/#why-a-mod-does-not-load) explains each reason.

### Do I need Blender?

Only to open Studio's exports in Blender or to bring your own models in. You need Blender 5.2 or
newer and the [Sunrise Blender add-on](https://github.com/stanuwu/SunriseBlenderPlugin), which you
install separately. Everything else works without Blender.

### Why is the first start so slow?

On the first open, Studio reads every package to find asset names. Later opens read its loading
cache and are much faster. See [Cache settings](/docs/sunrise-studio/cache/).

### Studio runs out of memory on a large map

Large maps need a lot of memory. Close other heavy programs and try again. On a PC with the Windows
page file turned off, turn it back on. A "decryption failed" message during a big load has the same
cause. Your game files are not damaged.

### What do "WIP" and "may not work in game" mean?

**WIP** marks a feature that is known to be broken or only partly working. Hover the tag to see
what is wrong. "May not work in game" marks a feature that works in Studio but has not been tested
in the game yet.

### Can I share my project?

Yes. A project folder holds no paths to your installation and none of your own settings. Another
person opens it with their own installation.

### Can I change the game while it runs?

Script changes, yes: **Build > Update running game** reloads a mod's scripts in a running game.
Package changes need **Build and install** and a game restart. See
[Update a running game](/docs/sunrise-studio/build-and-install/#update-a-running-game). The Live tab also shows the running
game's screens and world; see [Connect to a running game](/docs/sunrise-studio/live/).

## Still having issues?

Ask in the support channel on [Discord](https://discord.com/invite/projectsunrise). Include:

- A screenshot of the error.
- Screenshots of your Sunrise game folder, if you have one. Hide any personal information first.

Support covers the [official releases](https://github.com/stanuwu/Sunrise/releases) only. To report
a bug, open an issue on [GitHub](https://github.com/stanuwu/Sunrise/issues). Report a Studio bug on
[its GitHub issues](https://github.com/stanuwu/SunriseStudio/issues).
