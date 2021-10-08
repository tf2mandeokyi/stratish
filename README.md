<img src=".github/stratish glyph generator.png"/>

# Stratish Generator

Inspired by [Stratzenblitz75](https://www.youtube.com/c/Stratzenblitz75), This is the source code that generates his glyph ― called "Stratish" ― that was used for a while.

## Usage

This source code requires [Node.js](https://nodejs.org/) to be installed on your computer in order to generate Stratish as an .SVG (Scalable Vector Graphics) format.

To generate your own stratish based on your custom sentences, run the command lines below, and check the `result.svg` file in the `stratish` directory.

```bash
git clone https://github.com/tf2mandeokyi/stratish
cd ./stratish/
npm install
ts-node index.ts --text "Your custom sentences goes here"
```

To see all of the available options, run `ts-node index.ts -h`