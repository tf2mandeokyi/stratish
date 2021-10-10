<img src=".github/stratish glyph generator.png"/>

# Stratish Generator

This source code generates [Stratzenblitz75](https://www.youtube.com/c/Stratzenblitz75)'s glyph ― called "Stratish" ― that was used for a while in his easter egg images / video frames.

## Usage

### Required Softwares
 * [Node.js](https://nodejs.org/)
 * [Git](https://git-scm.com/downloads)

To generate your own stratish as an .SVG (Scalable Vector Graphics) format, run the command lines below, and check the `result.svg` file in the `stratish` directory.

```bash
git clone https://github.com/tf2mandeokyi/stratish
cd ./stratish/
npm install
ts-node index.ts --text "Your custom sentences goes here"
```

To see all of the available options, run `ts-node index.ts -h`
