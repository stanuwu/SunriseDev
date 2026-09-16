---
title: "FAQ"
description: "Common questions and common problems with Sunrise."
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

### How do I open the overlay?

Press **Insert**. That is the default key.

### How do I change the overlay key?

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
   by Ledian00.
2. Press **Insert** to open the overlay.
3. In the **Activity** module, select the activity from the list, then the bubble.
4. On the same screen, set **Activity Override** to **Enabled**.
5. Press **Insert** again and launch any activity.

Some bubbles need a specific spawn point. You have to find that one yourself.

## Questions

### Why do I need to sign in with Steam to download?

The old game version is downloaded from Steam depots. Steam only allows this for an account that
owns Destiny 2.

### Why does my antivirus flag this file?

Sunrise is a game mod. To work, it writes to protected memory and hooks Windows API calls. Some
malware does the same, so antivirus tools can flag it. Sunrise contains no malware. To stop the
warnings, [add the game folder as an exclusion](/guides/windows-security/#windows-defender).

### Is it safe to use a DLL someone sent me?

Only if you trust where it came from. Use the DLL from the
[official releases](https://github.com/stanuwu/Sunrise/releases), or one from a Sunrise team member.
If you build from source, check the code first. We are not responsible for harmful DLLs you build or
install.

### Why can't I find a feature in my build?

The feature is probably in a pull request that is not merged yet. We only give support for official
releases. If you are not sure what you are doing, use the latest release.

### Why is it not written in Rust?

I believe in using the right tool for the job. I also don't like Rust much.

### Can I install this next to the regular game?

Yes. Sunrise is meant to be installed on its own, apart from the regular game.

### Can this get me banned?

No. The mod does not let the game make any connections. To be safe, do not run it at the same time
as the live game.

### Does this support consoles?

No. Sunrise is for PC on Steam only. It will never support consoles or other platforms.

### Will more features be added?

Maybe. Right now, fixing bugs comes first.

## Still having issues?

Ask in the support channel on [Discord](https://discord.com/invite/projectsunrise). Include:

- A screenshot of the error.
- Screenshots of your Sunrise game folder, if you have one. Hide any personal information first.

Support covers the [official releases](https://github.com/stanuwu/Sunrise/releases) only. To report
a bug, open an issue on [GitHub](https://github.com/stanuwu/Sunrise/issues).
