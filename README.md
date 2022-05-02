## WebEnhanced
[![Build](https://github.com/quantix-dev/userscripts/actions/workflows/main.yml/badge.svg)](https://github.com/quantix-dev/userscripts/actions/workflows/main.yml)

This is an assortment of userscripts developed for ViolentMonkey, with untested suppot for Greasemonkey
and other userscript managers that support modern ES 6 features.

### Building
There should be a github action that builds the userscripts for release automatically.
However, if you want to build it yourself this project was setup using `yarn 2`

All you need to do is download the source files, and run `yarn build` in the directory
it should then output all of the userscripts to a `dist` folder.

### Userscripts
The userscript source code is located within the [src folder](src)
inside of that folder is a [README](src/README.md) which will list
each of the individual userscripts and their function.

Within each userscript is another readme that displays it's own function
for example, [Spectacles](src/Spectacles/README.md)
