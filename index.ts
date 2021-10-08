import * as fs from 'fs';
import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import { Command } from 'commander';
import { GlyphBuilder } from './src/glyph_builder';
import { ChangeDirection, PathPosArrayBuilder } from './src/functions/path_array_builder'

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


    /*
    let posBuilder = new PathPosArrayBuilder({
        10: [ new ChangeDirection([0, 1]) ]
    });
    */

    try {
        let glyphBuilder = new GlyphBuilder({
            child_depth: program.opts().depth - 0, 
            allow_special_glyphs: false, 
            scale: program.opts().scale - 0, 
            positionFunction: index => [index, 0]
        }).addSentence(program.opts().text);
        
        const document = new DOMImplementation().createDocument('http://www.w3.org/1999/xhtml', 'html', null);
        
        let svg = glyphBuilder.toSVGElement(
            document,
            {
                fill: program.opts().fill,
                'stroke-width': program.opts().thickness,
                stroke: program.opts().stroke
            }
        );
        
        fs.writeFileSync('result.svg', new XMLSerializer().serializeToString(svg));
        console.log(`Exported to result.svg (Length: ${glyphBuilder.getTotalBlockGlyphCount()})`);
    } catch(e) {
        console.error(`[ERROR] ${e}`);
    }
})()