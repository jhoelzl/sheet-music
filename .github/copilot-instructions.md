# App update workflow

After an app update is merged and the local default branch is safely updated,
verify that the web deployment succeeded, then build and install the iOS app
on each connected iPhone and iPad using the device deployment instructions in
`app/README.md`. Do this even for web-only changes, although those changes
normally appear without reinstalling.

Do not uninstall the existing app or overwrite uncommitted work. Respect device
and signing prompts. If a device is unavailable or deployment fails, report
which device still needs updating; do not claim that it was updated.
