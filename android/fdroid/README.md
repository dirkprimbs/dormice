# Submitting Dormice to F-Droid

`io.github.dirkprimbs.dormice.yml` is the build recipe F-Droid needs. The
store text, icon and screenshots are read from `fastlane/metadata/android/`
at the top of this repository, so they are not repeated in the recipe.

1. Sign in at https://gitlab.com and fork https://gitlab.com/fdroid/fdroiddata.
2. In the fork, create a branch and add the recipe as
   `metadata/io.github.dirkprimbs.dormice.yml`.
3. Open a merge request against `fdroid/fdroiddata` and choose the
   "App inclusion" template. F-Droid's own checks build the app and report
   back in the merge request.
4. Answer the reviewers' questions there. Once merged, the app appears in
   F-Droid after its next build cycle, usually within a few days.

Later versions need no new recipe: F-Droid watches the tags of this
repository and builds each new `v*` tag whose `versionCode` in
`android/app/build.gradle` has gone up. Add a
`fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` for each.
