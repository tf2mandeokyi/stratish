import * as fs from 'fs';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import { Command } from 'commander';
import { GlyphBuilder } from './src/glyph_builder';

(function() {

    const program = new Command();

    program
        .requiredOption('-t, --text <text>', 'text to parse')
        .option('-d, --depth <number>', 'child block glyph depth', '1')
        .option('-s, --scale <number>', 'scale', '1')
        .option('-f, --fill <color>', 'color value to fill glyphs', '#000000')
        .option('-o, --stroke <color>', 'color value to color glyphs\' strokes', '#000000')
        .option('-O, --thickness <number>', 'thickness of glyphs\' stroke', '0')
        .parse();

    const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);

    let svg = new GlyphBuilder({
        child_depth: program.opts().depth - 0, 
        allow_special_glyphs: false, 
        scale: program.opts().scale - 0, 
        custom_pos_func: index => [index, 0],
        polygon_attrs: {
            fill: program.opts().fill,
            'stroke-width': program.opts().thickness,
            stroke: program.opts().stroke
        }
    }).add_sentence(program.opts().text).to_svg_element(document);
    
    fs.writeFileSync('result.svg', new XMLSerializer().serializeToString(svg));
    console.log("Exported to result.svg")
})()