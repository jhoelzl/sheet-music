# App update workflow

After an app update is merged and the local default branch is safely updated,
verify that the web deployment succeeded, then build and install the iOS app
on each connected iPhone and iPad using the device deployment instructions in
`app/README.md`. Do this even for web-only changes, although those changes
normally appear without reinstalling.

Do not uninstall the existing app or overwrite uncommitted work. Respect device
and signing prompts. If a device is unavailable or deployment fails, report
which device still needs updating; do not claim that it was updated.

## Database migrations

Before applying a migration to a shared or remote database, identify the target
project and explain the migration's impact, then ask the user for approval.
After approval, apply it yourself if access and a safe method are available,
verify the result, and report what was applied. If you cannot apply it safely,
explain the blocker and the remaining steps.

Do not run `supabase db push` against a database with unreconciled migration
history, and do not repair migration history without verifying it and obtaining
the user's approval.
