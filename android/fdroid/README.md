# Submitting Dormice to F-Droid

`io.github.dirkprimbs.dormice.yml` is the build recipe F-Droid needs. The
store text, icon and screenshots are read from `fastlane/metadata/android/`
at the top of this repository, so they are not repeated in the recipe.

1. Sign in at https://gitlab.com and fork https://gitlab.com/fdroid/fdroiddata.
   The fork has to be public.
2. In the fork, create a branch named `io.github.dirkprimbs.dormice` (not
   `master`) and add the recipe as `metadata/io.github.dirkprimbs.dormice.yml`.
3. Wait for the fork's pipeline to pass, then open a merge request against
   `fdroid/fdroiddata` titled "New app: Dormice" and fill in its checklist.
4. Answer the reviewers' questions there. Once merged, the app appears in
   F-Droid after its next build cycle, usually within a few days.

Things the checklist asks that need an honest answer:

- **Age of the project.** F-Droid's inclusion policy (Quality, point 6) wants
  an app to have been actively developed for at least three months, unless it
  has proven users or its author already maintains apps on F-Droid. Dormice
  was started on 14 November 2026.
- **Reproducible builds.** Not set up: there is no apk signed by the author
  to compare against yet.
- **Wrapped websites.** The app is not a wrapper around a live site: the game
  is packed into the app and runs without network access.

Later versions need no new recipe: F-Droid watches the tags of this
repository and builds each new `v*` tag whose `versionCode` in
`android/app/build.gradle` has gone up. Add a
`fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` for each.
